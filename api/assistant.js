// ═══════════════════════════════════════════════════════════════════════════
// /api/assistant — Assistant IA conversationnel avec tool use (Phase A)
// ═══════════════════════════════════════════════════════════════════════════
// Phase A : LECTURE SEULE. Trois outils définis :
//   - list_chantiers   : liste les chantiers du patron (nom, client, statut, HT)
//   - list_devis       : liste les devis/factures (numero, type, client, statut)
//   - list_salaries    : liste les membres de l'équipe (nom, role, taux)
//
// Pas d'écriture pour l'instant (la confirmation UI / dispatch des mutations
// arrivera en Phase B+). L'assistant peut :
//   - Répondre librement aux questions BTP/compta (comme avant)
//   - Si l'utilisateur demande des infos sur ses données → outil approprié
//   - Combiner plusieurs outils si nécessaire (boucle tool_use jusqu'à
//     stop_reason==='end_turn')
//
// Sécurité : on utilise le JWT du patron (Authorization: Bearer <token>) pour
// les appels Supabase REST. RLS filtre automatiquement par user_id, donc même
// si Claude tentait de lire les données d'un autre user, Supabase refuserait.
// ═══════════════════════════════════════════════════════════════════════════

const STATUTS_DEVIS=["brouillon","envoyé","en attente","en attente signature","accepté","signé","refusé"];
const STATUTS_FACTURE=["en attente","payé","annulé"];

const TOOLS=[
  {
    name:"list_chantiers",
    description:"Liste les chantiers du patron connecté avec leur nom, client, statut et montant HT. À utiliser quand l'utilisateur pose une question sur ses chantiers (ex: 'mes chantiers en cours', 'le chantier de M. Dupont', 'mes chantiers terminés').",
    input_schema:{
      type:"object",
      properties:{
        statut:{type:"string",enum:["planifié","en cours","terminé","annulé"],description:"Filtrer par statut. Optionnel."},
        recherche:{type:"string",description:"Filtre texte sur nom du chantier ou client. Optionnel."},
        limit:{type:"integer",default:20,description:"Nombre max de résultats. Défaut 20."},
      },
    },
  },
  {
    name:"list_devis",
    description:"Liste les devis et factures du patron avec numero, type (devis/facture), client, statut et montant HT. À utiliser pour les questions sur les devis ou factures.",
    input_schema:{
      type:"object",
      properties:{
        type:{type:"string",enum:["devis","facture"],description:"Filtrer par type. Optionnel."},
        statut:{type:"string",description:"Filtrer par statut (brouillon, envoyé, accepté, signé, etc). Optionnel."},
        recherche:{type:"string",description:"Filtre texte sur numero ou client. Optionnel."},
        limit:{type:"integer",default:20,description:"Nombre max de résultats. Défaut 20."},
      },
    },
  },
  {
    name:"list_salaries",
    description:"Liste les membres de l'équipe du patron : nom, prénom, rôle, taux horaire. Utile pour les questions sur l'équipe, les ouvriers, les coûts MO.",
    input_schema:{
      type:"object",
      properties:{
        recherche:{type:"string",description:"Filtre texte sur nom/prénom/rôle. Optionnel."},
      },
    },
  },
  {
    name:"propose_change_devis_statut",
    description:`PROPOSE un changement de statut sur un devis ou une facture. NE FAIT PAS le changement — résout le document, vérifie qu'il existe, et renvoie un objet 'pending_action' que le client humain doit confirmer en cliquant sur [Confirmer]. Utilise cet outil quand l'utilisateur demande de changer un statut (ex: 'passe DEV-83211 en accepté', 'marque la facture FAC-1234 comme payée'). Statuts devis valides : ${STATUTS_DEVIS.join(", ")}. Statuts facture valides : ${STATUTS_FACTURE.join(", ")}.`,
    input_schema:{
      type:"object",
      properties:{
        numero:{type:"string",description:"Numero exact du devis ou facture (ex: 'DEV-83211' ou 'FAC-1234')."},
        nouveau_statut:{type:"string",description:"Le statut cible souhaité par l'utilisateur."},
      },
      required:["numero","nouveau_statut"],
    },
  },
];

export default async function handler(req,res){
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Methods","POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","Content-Type,Authorization");
  if(req.method==="OPTIONS")return res.status(200).end();
  if(req.method!=="POST")return res.status(405).json({error:"POST attendu"});

  const supabaseUrl=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL;
  const anonKey=process.env.SUPABASE_ANON_KEY||process.env.VITE_SUPABASE_ANON_KEY;
  const anthropicKey=process.env.ANTHROPIC_API_KEY;

  if(!supabaseUrl||!anonKey){
    return res.status(503).json({error:"Supabase non configuré (SUPABASE_URL + SUPABASE_ANON_KEY requis)"});
  }
  if(!anthropicKey){
    return res.status(503).json({error:"ANTHROPIC_API_KEY manquante"});
  }

  const {messages,system,access_token}=req.body||{};
  if(!Array.isArray(messages)||messages.length===0){
    return res.status(400).json({error:"messages[] requis"});
  }
  if(!access_token){
    return res.status(401).json({error:"access_token requis (utilisateur connecté nécessaire pour les outils)"});
  }

  // ─── Helpers Supabase REST ─────────────────────────────────────────────
  const supaHeaders={
    "Content-Type":"application/json",
    "apikey":anonKey,
    "Authorization":`Bearer ${access_token}`,
  };
  async function supaSelect(table,query=""){
    const url=`${supabaseUrl}/rest/v1/${table}${query?"?"+query:""}`;
    const r=await fetch(url,{headers:supaHeaders});
    if(!r.ok){
      const txt=await r.text().catch(()=>"");
      throw new Error(`Supabase ${table} HTTP ${r.status}: ${txt.slice(0,200)}`);
    }
    return r.json();
  }

  // ─── Exécuteurs des tools ──────────────────────────────────────────────
  // Les data sont en jsonb — on extrait juste les champs utiles pour Claude
  // (limite la taille du contexte renvoyé).
  function norm(s){return (s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"");}
  async function tool_list_chantiers(input){
    const rows=await supaSelect("chantiers_v2","select=id,data&order=updated_at.desc");
    const recherche=norm(input?.recherche);
    const limit=Math.min(input?.limit||20,50);
    const out=[];
    for(const r of rows){
      const d=r.data||{};
      if(input?.statut&&d.statut!==input.statut)continue;
      if(recherche&&!norm(d.nom).includes(recherche)&&!norm(d.client).includes(recherche))continue;
      out.push({
        id:r.id,
        nom:d.nom||"",
        client:d.client||"",
        adresse:d.adresse||"",
        statut:d.statut||"",
        devis_ht:d.devisHT||0,
        notes:d.notes||"",
      });
      if(out.length>=limit)break;
    }
    return {chantiers:out,total:out.length};
  }
  async function tool_list_devis(input){
    const rows=await supaSelect("devis","select=id,data&order=updated_at.desc");
    const recherche=norm(input?.recherche);
    const limit=Math.min(input?.limit||20,50);
    const out=[];
    for(const r of rows){
      const d=r.data||{};
      if(input?.type&&d.type!==input.type)continue;
      if(input?.statut&&d.statut!==input.statut)continue;
      if(recherche&&!norm(d.numero).includes(recherche)&&!norm(d.client).includes(recherche))continue;
      // Total HT depuis lignes
      const ht=(d.lignes||[]).reduce((a,l)=>{
        if(l.type==="titre"||l.type==="soustitre")return a;
        return a+(+l.qte||0)*(+l.prixUnitHT||0);
      },0);
      out.push({
        id:r.id,
        numero:d.numero||"",
        type:d.type||"devis",
        client:d.client||"",
        statut:d.statut||"",
        date:d.date||"",
        total_ht:Math.round(ht*100)/100,
      });
      if(out.length>=limit)break;
    }
    return {documents:out,total:out.length};
  }
  async function tool_list_salaries(input){
    const rows=await supaSelect("salaries","select=id,data");
    const recherche=norm(input?.recherche);
    const out=[];
    for(const r of rows){
      const d=r.data||{};
      const fullName=`${d.nom||""} ${d.prenom||""} ${d.role||""}`;
      if(recherche&&!norm(fullName).includes(recherche))continue;
      out.push({
        id:r.id,
        nom:d.nom||"",
        prenom:d.prenom||"",
        role:d.role||"",
        taux_horaire:d.tauxHoraire||0,
      });
    }
    return {salaries:out,total:out.length};
  }
  // Tool d'écriture en mode "propose only" — vérifie + renvoie un objet
  // pending_action que le frontend transformera en bulle de confirmation.
  // Aucune mutation côté serveur ici : c'est le frontend qui écrit via sa
  // session Supabase (RLS impose user_id = auth.uid()).
  async function tool_propose_change_devis_statut(input){
    const numero=String(input?.numero||"").trim();
    const nouveau=String(input?.nouveau_statut||"").trim().toLowerCase();
    if(!numero)return {error:"numero requis"};
    if(!nouveau)return {error:"nouveau_statut requis"};
    // Recherche par numero (insensible casse) parmi les devis/factures
    const rows=await supaSelect("devis","select=id,data");
    const found=rows.find(r=>(r.data?.numero||"").toLowerCase()===numero.toLowerCase());
    if(!found){
      return {error:`Aucun devis ou facture avec le numero "${numero}". Utilise list_devis avec recherche="${numero.slice(0,4)}" pour vérifier.`};
    }
    const d=found.data||{};
    const docType=d.type||"devis";
    const validStatuts=docType==="facture"?STATUTS_FACTURE:STATUTS_DEVIS;
    // Match exact ou approché (insensible casse + ignorer accents)
    const norm2=s=>norm(s).replace(/\s+/g," ").trim();
    const target=validStatuts.find(s=>norm2(s)===norm2(nouveau));
    if(!target){
      return {error:`Statut "${nouveau}" invalide pour un ${docType}. Statuts possibles : ${validStatuts.join(", ")}.`};
    }
    if(d.statut===target){
      return {info:`Le ${docType} ${d.numero} est déjà au statut "${target}". Rien à changer.`};
    }
    return {
      pending_action:{
        kind:"change_devis_statut",
        devis_id:found.id,
        numero:d.numero,
        type:docType,
        client:d.client||"(client non renseigné)",
        current_statut:d.statut||"(aucun)",
        target_statut:target,
      },
      message:`Devis ${d.numero} trouvé (client : ${d.client||"?"}). Statut actuel : "${d.statut}". Changer vers : "${target}".`,
    };
  }

  const TOOL_HANDLERS={
    list_chantiers:tool_list_chantiers,
    list_devis:tool_list_devis,
    list_salaries:tool_list_salaries,
    propose_change_devis_statut:tool_propose_change_devis_statut,
  };

  // ─── Boucle tool use (max 6 itérations pour éviter de boucler) ─────────
  const MAX_ITER=6;
  let convo=messages.map(m=>({role:m.role,content:m.content}));
  const toolsUsed=[];
  for(let iter=0;iter<MAX_ITER;iter++){
    const claudeRes=await fetch("https://api.anthropic.com/v1/messages",{
      method:"POST",
      headers:{"Content-Type":"application/json","x-api-key":anthropicKey,"anthropic-version":"2023-06-01"},
      body:JSON.stringify({
        model:"claude-sonnet-4-6",
        max_tokens:2000,
        system:system||"Tu es un assistant pour ChantierPro (app BTP). Réponds en français, concis, actionnable.",
        tools:TOOLS,
        messages:convo,
      }),
    });
    if(!claudeRes.ok){
      const txt=await claudeRes.text().catch(()=>"");
      return res.status(502).json({error:`Claude HTTP ${claudeRes.status}`,body:txt.slice(0,500)});
    }
    const data=await claudeRes.json();

    if(data.stop_reason!=="tool_use"){
      // Réponse finale — extrait le texte
      const text=(data.content||[]).filter(c=>c.type==="text").map(c=>c.text).join("\n").trim();
      return res.status(200).json({text,tools_used:toolsUsed});
    }

    // Exécute tous les tool_use en parallèle
    const calls=(data.content||[]).filter(c=>c.type==="tool_use");
    const results=await Promise.all(calls.map(async c=>{
      try{
        const handler=TOOL_HANDLERS[c.name];
        if(!handler)return {tool_use_id:c.id,type:"tool_result",content:`Outil inconnu: ${c.name}`,is_error:true};
        const r=await handler(c.input||{});
        // Si le tool renvoie un pending_action, on le remonte au frontend pour
        // qu'il affiche la bulle de confirmation [Confirmer]/[Annuler].
        toolsUsed.push({
          name:c.name,
          input:c.input,
          result_summary:r.total!=null?`${r.total} résultat(s)`:r.error?`erreur: ${r.error}`:"OK",
          pending_action:r.pending_action||null,
        });
        return {tool_use_id:c.id,type:"tool_result",content:JSON.stringify(r)};
      }catch(e){
        return {tool_use_id:c.id,type:"tool_result",content:`Erreur: ${e.message}`,is_error:true};
      }
    }));

    // Push assistant + tool_result et reboucle
    convo.push({role:"assistant",content:data.content});
    convo.push({role:"user",content:results});
  }

  return res.status(500).json({error:"Boucle tool use dépassée (max 6 itérations)",tools_used:toolsUsed});
}
