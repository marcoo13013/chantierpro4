// ═══════════════════════════════════════════════════════════════════════════
// /api/support-ia — Agent IA pour le module Support (Phase 2)
// ═══════════════════════════════════════════════════════════════════════════
// Flow :
//   1. POST { ticketId } depuis le client après création d'un ticket
//   2. Lit le ticket + la FAQ active depuis Supabase (service_role)
//   3. Demande à Claude : "AUTO_RESPOND <réponse>" (FAQ match) OU
//      "ESCALATE <résumé interne>" (besoin admin)
//   4. Si AUTO_RESPOND → met à jour le ticket avec reponse_par='ia',
//      statut='resolu', reponse_admin=<réponse>
//   5. Si ESCALATE → laisse statut='ouvert', ajoute le résumé en
//      reponse_admin avec préfixe "[escalade IA] " (visible côté admin)
//
// Sécurité : on n'utilise PAS le JWT du client. Le service_role bypass RLS
// pour pouvoir lire/écrire un ticket même si ce n'est pas le sien (cas
// soumission anonyme via /support).
// ═══════════════════════════════════════════════════════════════════════════

export default async function handler(req,res){
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Methods","POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","Content-Type");
  if(req.method==="OPTIONS")return res.status(200).end();
  if(req.method!=="POST")return res.status(405).json({error:"POST attendu"});

  const supabaseUrl=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL;
  const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anthropicKey=process.env.ANTHROPIC_API_KEY;

  if(!supabaseUrl||!serviceKey){
    return res.status(503).json({error:"Supabase non configuré côté serveur (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)"});
  }
  if(!anthropicKey){
    return res.status(503).json({error:"ANTHROPIC_API_KEY manquante"});
  }

  const {ticketId}=req.body||{};
  if(!ticketId)return res.status(400).json({error:"ticketId requis"});

  // ─── 1. Charger ticket + FAQ via service_role ───────────────────────────
  const supaHeaders={
    "Content-Type":"application/json",
    "apikey":serviceKey,
    "Authorization":`Bearer ${serviceKey}`,
  };
  const [ticketRes,faqRes]=await Promise.all([
    fetch(`${supabaseUrl}/rest/v1/tickets?id=eq.${ticketId}&select=*`,{headers:supaHeaders}),
    fetch(`${supabaseUrl}/rest/v1/faq?active=eq.true&select=question,reponse,keywords&order=ordre.asc`,{headers:supaHeaders}),
  ]);
  if(!ticketRes.ok)return res.status(500).json({error:"impossible de charger le ticket"});
  const tickets=await ticketRes.json();
  if(!tickets[0])return res.status(404).json({error:"ticket introuvable"});
  const ticket=tickets[0];
  const faq=faqRes.ok?await faqRes.json():[];

  // Si déjà répondu → idempotent, on ne refait rien
  if(ticket.reponse_admin&&ticket.statut!=="ouvert"){
    return res.status(200).json({skipped:true,reason:"already answered"});
  }

  // ─── 2. Demander à Claude ──────────────────────────────────────────────
  const faqText=faq.length===0
    ?"(aucune FAQ disponible)"
    :faq.map((f,i)=>`[${i+1}] Q: ${f.question}\nR: ${f.reponse}\nMots-clés: ${(f.keywords||[]).join(", ")}`).join("\n\n");

  const systemPrompt=`Tu es l'agent de support de ChantierPro, une app pour artisans BTP français.
Tu lis un ticket utilisateur et tu décides UNE de ces deux actions :

1. AUTO_RESPOND — si le ticket correspond clairement à une question de la FAQ ci-dessous,
   réponds directement à l'utilisateur en réutilisant la réponse FAQ adaptée à sa formulation.
   Format : commence ta réponse par exactement "AUTO_RESPOND" sur une ligne seule, puis la
   réponse en français, ton chaleureux et professionnel, 2-4 phrases max, signe "— L'équipe ChantierPro".

2. ESCALATE — si le ticket est un bug technique, une demande spécifique au compte de
   l'utilisateur, une plainte, ou si aucune FAQ ne couvre la question, NE RÉPONDS PAS au
   client. À la place, écris un résumé court (1-2 phrases) pour Marco l'admin.
   Format : commence ta réponse par exactement "ESCALATE" sur une ligne seule, puis le
   résumé interne en français, max 2 phrases.

RÈGLES STRICTES :
- Tu réponds UNIQUEMENT avec "AUTO_RESPOND" ou "ESCALATE" suivi du contenu
- Pas de markdown, pas de listes, pas d'émojis dans la réponse
- En cas de doute, ESCALATE — il vaut mieux que Marco voie le ticket que de mal répondre
- Tu ne mentionnes JAMAIS la FAQ dans ta réponse au client (l'utilisateur ne sait pas qu'elle existe)

═══════════════════════════════════════════════════════════════════════════
FAQ DISPONIBLE :
${faqText}
═══════════════════════════════════════════════════════════════════════════`;

  // Inclure les metadata structurées (page, appareil, gravité, module, etc.)
  // pour que Claude ait le contexte type-spécifique.
  const meta=ticket.metadata&&typeof ticket.metadata==="object"?ticket.metadata:{};
  const metaLines=Object.entries(meta).filter(([,v])=>v).map(([k,v])=>`${k} : ${v}`).join("\n");
  const userPrompt=`TICKET REÇU :
Type : ${ticket.type}
Priorité : ${ticket.priorite}
Titre : ${ticket.titre}
${metaLines?metaLines+"\n":""}Description : ${ticket.description}`;

  let claudeRes;
  try{
    claudeRes=await fetch("https://api.anthropic.com/v1/messages",{
      method:"POST",
      headers:{"Content-Type":"application/json","x-api-key":anthropicKey,"anthropic-version":"2023-06-01"},
      body:JSON.stringify({
        model:"claude-haiku-4-5-20251001",
        max_tokens:600,
        system:systemPrompt,
        messages:[{role:"user",content:userPrompt}],
      }),
    });
  }catch(e){
    return res.status(502).json({error:"appel Claude échoué",details:e.message});
  }
  if(!claudeRes.ok){
    const txt=await claudeRes.text().catch(()=>"");
    return res.status(502).json({error:"Claude HTTP "+claudeRes.status,body:txt.slice(0,500)});
  }
  const claudeData=await claudeRes.json();
  const text=(claudeData?.content?.[0]?.text||"").trim();

  // ─── 3. Parser la décision ──────────────────────────────────────────────
  let decision="ESCALATE",content="(pas de contenu IA)";
  if(/^AUTO_RESPOND/i.test(text)){
    decision="AUTO_RESPOND";
    content=text.replace(/^AUTO_RESPOND\s*\n?/i,"").trim();
  }else if(/^ESCALATE/i.test(text)){
    decision="ESCALATE";
    content=text.replace(/^ESCALATE\s*\n?/i,"").trim();
  }else{
    // Format invalide → on escalade par sécurité, on stocke la sortie brute
    decision="ESCALATE";
    content=`(format IA invalide) ${text.slice(0,300)}`;
  }

  // ─── 4. Mettre à jour le ticket ─────────────────────────────────────────
  const patch=decision==="AUTO_RESPOND"
    ?{reponse_admin:content,reponse_par:"ia",reponse_at:new Date().toISOString(),statut:"resolu"}
    :{reponse_admin:`[escalade IA] ${content}`,reponse_par:"ia",reponse_at:new Date().toISOString()};

  const upd=await fetch(`${supabaseUrl}/rest/v1/tickets?id=eq.${ticketId}`,{
    method:"PATCH",
    headers:{...supaHeaders,"Prefer":"return=minimal"},
    body:JSON.stringify(patch),
  });
  if(!upd.ok){
    const txt=await upd.text().catch(()=>"");
    return res.status(500).json({error:"update ticket failed",body:txt.slice(0,500)});
  }

  return res.status(200).json({decision,content,ticketId});
}
