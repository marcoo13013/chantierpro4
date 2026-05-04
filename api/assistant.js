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
  {
    name:"list_planning",
    description:"Liste les phases du planning du patron : pour chaque phase, donne le chantier (nom), libellé de la tâche, dates, ouvriers assignés (noms résolus). Filtres optionnels : chantier (numero ou nom), ouvrier (nom), période (date_debut/date_fin).",
    input_schema:{
      type:"object",
      properties:{
        chantier:{type:"string",description:"Filtre par numero ou nom de chantier (insensible casse). Optionnel."},
        ouvrier:{type:"string",description:"Filtre par nom d'ouvrier. Optionnel."},
        date_debut:{type:"string",description:"Borne basse YYYY-MM-DD. Optionnel."},
        date_fin:{type:"string",description:"Borne haute YYYY-MM-DD. Optionnel."},
      },
    },
  },
  {
    name:"propose_create_phase",
    description:"PROPOSE la création d'une nouvelle phase de planning sur un chantier. Résout le chantier et les ouvriers par nom, calcule la durée en jours à partir de date_debut/date_fin, et renvoie un pending_action. Utilise quand l'utilisateur demande explicitement de créer une nouvelle phase (ex: 'crée une phase carrelage du 15 au 25 mai sur DEV-83211').",
    input_schema:{
      type:"object",
      properties:{
        chantier:{type:"string",description:"Numero ou nom du chantier."},
        libelle:{type:"string",description:"Libellé de la phase (ex: 'Carrelage salle de bain', 'Maçonnerie sous-sol')."},
        date_debut:{type:"string",description:"Date de début YYYY-MM-DD."},
        date_fin:{type:"string",description:"Date de fin YYYY-MM-DD (incluse)."},
        ouvriers:{type:"array",items:{type:"string"},description:"Noms ou rôles des ouvriers à assigner. Optionnel (phase peut être créée sans ouvriers)."},
      },
      required:["chantier","libelle","date_debut","date_fin"],
    },
  },
  {
    name:"propose_add_to_planning",
    description:"PROPOSE d'ajouter des ouvriers au planning d'un chantier sur une période. Logique : si une phase existante recouvre la période → ajoute les ouvriers à cette phase. Sinon → propose la création d'une nouvelle phase. Renvoie un pending_action avec mode='add_existing' ou 'create_new'.",
    input_schema:{
      type:"object",
      properties:{
        chantier:{type:"string",description:"Numero ou nom du chantier."},
        ouvriers:{type:"array",items:{type:"string"},description:"Noms ou rôles des ouvriers (ex: ['Thomas', 'le maçon', 'chef de chantier'])."},
        date_debut:{type:"string",description:"Date de début YYYY-MM-DD."},
        date_fin:{type:"string",description:"Date de fin YYYY-MM-DD (incluse)."},
        libelle_phase:{type:"string",description:"Libellé pour la nouvelle phase si on en crée une. Optionnel."},
      },
      required:["chantier","ouvriers","date_debut","date_fin"],
    },
  },
  {
    name:"propose_remove_from_planning",
    description:"PROPOSE de retirer un ouvrier du planning. Cherche toutes les phases (du chantier précisé ou de tous) où l'ouvrier est assigné dans la période donnée, et propose le retrait. Renvoie un pending_action avec la liste des phases impactées.",
    input_schema:{
      type:"object",
      properties:{
        ouvrier:{type:"string",description:"Nom de l'ouvrier à retirer."},
        chantier:{type:"string",description:"Numero/nom du chantier (limite la recherche). Optionnel."},
        date_debut:{type:"string",description:"Borne basse de la période. Optionnel."},
        date_fin:{type:"string",description:"Borne haute. Optionnel."},
      },
      required:["ouvrier"],
    },
  },
];

// ─── Helpers dates ─────────────────────────────────────────────────────────
function daysBetween(d1,d2){
  const a=new Date(d1+"T00:00:00"),b=new Date(d2+"T00:00:00");
  return Math.round((b-a)/86400000)+1; // +1 car date_fin incluse
}
function phaseEndDate(phase){
  const d=new Date(phase.dateDebut+"T00:00:00");
  d.setDate(d.getDate()+(+phase.dureeJours||1)-1);
  return d.toISOString().slice(0,10);
}
function rangesOverlap(aStart,aEnd,bStart,bEnd){
  return aStart<=bEnd&&bStart<=aEnd;
}

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

  // ─── Helpers résolution chantier / ouvriers ────────────────────────────
  async function findChantier(query){
    if(!query)return null;
    const q=norm(query);
    const rows=await supaSelect("chantiers_v2","select=id,data");
    return rows.find(r=>{
      const d=r.data||{};
      return norm(d.nom).includes(q)||norm(d.client).includes(q)||norm(String(r.id)).includes(q);
    })||null;
  }
  async function loadSalaries(){
    return await supaSelect("salaries","select=id,data");
  }
  function findSalarie(salaries,query){
    const q=norm(query);
    return salaries.find(s=>{
      const d=s.data||{};
      const fullName=`${d.prenom||""} ${d.nom||""}`;
      return norm(fullName).includes(q)||norm(d.nom).includes(q)||norm(d.prenom).includes(q)||norm(d.role).includes(q)||norm(d.poste).includes(q);
    });
  }

  // ─── Tools planning ────────────────────────────────────────────────────
  async function tool_list_planning(input){
    const [chRows,salRows]=await Promise.all([
      supaSelect("chantiers_v2","select=id,data"),
      loadSalaries(),
    ]);
    const filtreChan=input?.chantier?norm(input.chantier):null;
    const filtreOuv=input?.ouvrier?norm(input.ouvrier):null;
    const out=[];
    for(const r of chRows){
      const c=r.data||{};
      if(filtreChan&&!norm(c.nom).includes(filtreChan)&&!norm(c.client).includes(filtreChan)&&!norm(String(r.id)).includes(filtreChan))continue;
      for(const p of (c.planning||[])){
        const dEnd=phaseEndDate(p);
        if(input?.date_debut&&dEnd<input.date_debut)continue;
        if(input?.date_fin&&p.dateDebut>input.date_fin)continue;
        const ouvriers=(p.salariesIds||[]).map(sid=>{
          const s=salRows.find(x=>x.id===sid);
          if(!s)return `(id ${sid})`;
          return `${s.data?.prenom||""} ${s.data?.nom||""}`.trim()||`(id ${sid})`;
        });
        if(filtreOuv&&!ouvriers.some(o=>norm(o).includes(filtreOuv)))continue;
        out.push({
          chantier_id:r.id,
          chantier_nom:c.nom||"",
          phase_id:p.id,
          libelle:p.tache||"",
          date_debut:p.dateDebut,
          date_fin:dEnd,
          duree_jours:p.dureeJours,
          ouvriers,
        });
      }
    }
    return {phases:out,total:out.length};
  }

  async function tool_propose_create_phase(input){
    const ch=await findChantier(input?.chantier);
    if(!ch)return {error:`Chantier "${input?.chantier}" introuvable. Utilise list_chantiers pour vérifier.`};
    if(!input?.libelle||!input?.date_debut||!input?.date_fin)return {error:"libelle, date_debut, date_fin requis"};
    if(input.date_fin<input.date_debut)return {error:"date_fin doit être ≥ date_debut"};
    const dureeJours=daysBetween(input.date_debut,input.date_fin);
    // Résolution ouvriers
    const salRows=await loadSalaries();
    const resolvedOuvriers=[];
    const unresolved=[];
    for(const name of (input.ouvriers||[])){
      const s=findSalarie(salRows,name);
      if(s)resolvedOuvriers.push({id:s.id,nom:`${s.data?.prenom||""} ${s.data?.nom||""}`.trim()});
      else unresolved.push(name);
    }
    return {
      pending_action:{
        kind:"create_phase",
        chantier_id:ch.id,
        chantier_nom:ch.data?.nom||"",
        phase:{
          libelle:input.libelle,
          date_debut:input.date_debut,
          date_fin:input.date_fin,
          duree_jours:dureeJours,
          salariesIds:resolvedOuvriers.map(o=>o.id),
          ouvriers_resolved:resolvedOuvriers,
        },
      },
      message:`Phase "${input.libelle}" prête : chantier ${ch.data?.nom}, ${input.date_debut} → ${input.date_fin} (${dureeJours}j), ${resolvedOuvriers.length} ouvrier(s) résolu(s)${unresolved.length?`. Non résolus : ${unresolved.join(", ")}`:""}.`,
    };
  }

  async function tool_propose_add_to_planning(input){
    const ch=await findChantier(input?.chantier);
    if(!ch)return {error:`Chantier "${input?.chantier}" introuvable.`};
    if(!input?.date_debut||!input?.date_fin)return {error:"date_debut et date_fin requis"};
    if(!Array.isArray(input.ouvriers)||input.ouvriers.length===0)return {error:"ouvriers (array de noms) requis"};
    // Résolution ouvriers
    const salRows=await loadSalaries();
    const resolved=[],unresolved=[];
    for(const name of input.ouvriers){
      const s=findSalarie(salRows,name);
      if(s)resolved.push({id:s.id,nom:`${s.data?.prenom||""} ${s.data?.nom||""}`.trim()});
      else unresolved.push(name);
    }
    if(resolved.length===0)return {error:`Aucun ouvrier résolu. Demandés : ${input.ouvriers.join(", ")}. Vérifie avec list_salaries.`};
    // Cherche une phase qui chevauche la période
    const planning=ch.data?.planning||[];
    const matching=planning.find(p=>{
      const pEnd=phaseEndDate(p);
      return rangesOverlap(p.dateDebut,pEnd,input.date_debut,input.date_fin);
    });
    if(matching){
      // Mode add_existing — ajoute les ouvriers à la phase trouvée (sans doublons)
      const currentIds=new Set(matching.salariesIds||[]);
      const newIds=resolved.filter(o=>!currentIds.has(o.id));
      if(newIds.length===0){
        return {info:`Tous les ouvriers (${resolved.map(o=>o.nom).join(", ")}) sont déjà assignés à la phase "${matching.tache}" (${matching.dateDebut} sur ${matching.dureeJours}j). Rien à ajouter.`};
      }
      return {
        pending_action:{
          kind:"add_to_phase",
          chantier_id:ch.id,
          chantier_nom:ch.data?.nom||"",
          phase_id:matching.id,
          phase_libelle:matching.tache||"",
          phase_dates:`${matching.dateDebut} → ${phaseEndDate(matching)}`,
          ouvriers_to_add:newIds,
        },
        message:`Phase existante trouvée : "${matching.tache}" (${matching.dateDebut} → ${phaseEndDate(matching)}). Ajout de ${newIds.length} ouvrier(s) : ${newIds.map(o=>o.nom).join(", ")}.${unresolved.length?` Non résolus : ${unresolved.join(", ")}.`:""}`,
      };
    }
    // Sinon : créer une nouvelle phase
    const dureeJours=daysBetween(input.date_debut,input.date_fin);
    return {
      pending_action:{
        kind:"create_phase",
        chantier_id:ch.id,
        chantier_nom:ch.data?.nom||"",
        phase:{
          libelle:input.libelle_phase||`Travaux ${input.date_debut}`,
          date_debut:input.date_debut,
          date_fin:input.date_fin,
          duree_jours:dureeJours,
          salariesIds:resolved.map(o=>o.id),
          ouvriers_resolved:resolved,
        },
      },
      message:`Aucune phase existante ne couvre cette période. Création d'une nouvelle phase "${input.libelle_phase||"Travaux"}" : ${input.date_debut} → ${input.date_fin} (${dureeJours}j) avec ${resolved.length} ouvrier(s).${unresolved.length?` Non résolus : ${unresolved.join(", ")}.`:""}`,
    };
  }

  async function tool_propose_remove_from_planning(input){
    if(!input?.ouvrier)return {error:"ouvrier requis"};
    const salRows=await loadSalaries();
    const sal=findSalarie(salRows,input.ouvrier);
    if(!sal)return {error:`Ouvrier "${input.ouvrier}" introuvable. Utilise list_salaries pour vérifier.`};
    const ouvNom=`${sal.data?.prenom||""} ${sal.data?.nom||""}`.trim();
    // Filtre chantier optionnel
    const chRows=await supaSelect("chantiers_v2","select=id,data");
    let cible=chRows;
    if(input.chantier){
      const ch=await findChantier(input.chantier);
      if(!ch)return {error:`Chantier "${input.chantier}" introuvable.`};
      cible=[ch];
    }
    const removals=[];
    for(const r of cible){
      const c=r.data||{};
      for(const p of (c.planning||[])){
        if(!(p.salariesIds||[]).includes(sal.id))continue;
        const pEnd=phaseEndDate(p);
        if(input.date_debut&&pEnd<input.date_debut)continue;
        if(input.date_fin&&p.dateDebut>input.date_fin)continue;
        removals.push({
          chantier_id:r.id,
          chantier_nom:c.nom||"",
          phase_id:p.id,
          phase_libelle:p.tache||"",
          phase_dates:`${p.dateDebut} → ${pEnd}`,
        });
      }
    }
    if(removals.length===0){
      return {info:`Aucune phase trouvée où ${ouvNom} est assigné${input.chantier?` sur ${input.chantier}`:""}${input.date_debut||input.date_fin?` dans la période`:""}.`};
    }
    return {
      pending_action:{
        kind:"remove_from_phases",
        ouvrier_id:sal.id,
        ouvrier_nom:ouvNom,
        removals,
      },
      message:`${ouvNom} est assigné à ${removals.length} phase(s) : ${removals.map(x=>`"${x.phase_libelle}" (${x.chantier_nom}, ${x.phase_dates})`).join("; ")}. Confirmer le retrait ?`,
    };
  }

  const TOOL_HANDLERS={
    list_chantiers:tool_list_chantiers,
    list_devis:tool_list_devis,
    list_salaries:tool_list_salaries,
    propose_change_devis_statut:tool_propose_change_devis_statut,
    list_planning:tool_list_planning,
    propose_create_phase:tool_propose_create_phase,
    propose_add_to_planning:tool_propose_add_to_planning,
    propose_remove_from_planning:tool_propose_remove_from_planning,
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
