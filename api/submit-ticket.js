// ═══════════════════════════════════════════════════════════════════════════
// /api/submit-ticket — Soumission unifiée d'un ticket (public + in-app)
// ═══════════════════════════════════════════════════════════════════════════
// Pourquoi cet endpoint ?
//   La page publique /support est utilisée par des utilisateurs anon. La RLS
//   tickets autorise INSERT pour anon, MAIS la policy SELECT est `to
//   authenticated` uniquement. Conséquence : `insert(...).select().single()`
//   côté client renvoie un tableau vide pour anon → on n'obtient jamais
//   l'id du ticket inséré → impossible de chaîner /api/support-ia et
//   /api/notify-ticket.
//
//   Solution : insérer côté serveur avec service_role (bypass RLS), récupérer
//   l'id, déclencher les hooks IA + email en parallèle.
//
// Reçoit : { email, type, titre, description, priorite, user_id? }
// Renvoie : { id, ai: {decision, content}|null }
// ═══════════════════════════════════════════════════════════════════════════

export default async function handler(req,res){
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Methods","POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","Content-Type");
  if(req.method==="OPTIONS")return res.status(200).end();
  if(req.method!=="POST")return res.status(405).json({error:"POST attendu"});

  const supabaseUrl=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL;
  const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!supabaseUrl||!serviceKey){
    return res.status(503).json({error:"Supabase non configuré côté serveur (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY requis)"});
  }

  const {email,type,titre,description,priorite,user_id}=req.body||{};

  // Validation basique (la DB applique les contraintes mais on évite un round-trip)
  if(!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
    return res.status(400).json({error:"email valide requis"});
  }
  if(!titre||!description){
    return res.status(400).json({error:"titre et description requis"});
  }
  if(!["bug","feature","recommandation","autre"].includes(type)){
    return res.status(400).json({error:"type invalide"});
  }
  if(!["basse","normale","haute","urgente"].includes(priorite||"normale")){
    return res.status(400).json({error:"priorite invalide"});
  }

  // ─── Insert via service_role ──────────────────────────────────────────
  const supaHeaders={
    "Content-Type":"application/json",
    "apikey":serviceKey,
    "Authorization":`Bearer ${serviceKey}`,
    "Prefer":"return=representation",
  };
  const insertRes=await fetch(`${supabaseUrl}/rest/v1/tickets`,{
    method:"POST",
    headers:supaHeaders,
    body:JSON.stringify({
      email:email.trim().toLowerCase(),
      type,
      titre:String(titre).trim().slice(0,200),
      description:String(description).trim().slice(0,3000),
      priorite:priorite||"normale",
      user_id:user_id||null,
    }),
  });
  if(!insertRes.ok){
    const txt=await insertRes.text().catch(()=>"");
    return res.status(insertRes.status).json({error:"insert failed",body:txt.slice(0,500)});
  }
  const rows=await insertRes.json();
  const ticket=Array.isArray(rows)?rows[0]:rows;
  if(!ticket?.id){
    return res.status(500).json({error:"insert returned no id"});
  }

  // ─── Hooks IA + email (en parallèle, on ATTEND l'IA pour pouvoir
  // renvoyer la décision au client ; le mail est fire-and-forget) ────────
  const origin=req.headers.origin
    ||`https://${req.headers["x-forwarded-host"]||req.headers.host||"localhost"}`;
  const iaPromise=fetch(`${origin}/api/support-ia`,{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({ticketId:ticket.id}),
  }).then(r=>r.ok?r.json():null).catch(()=>null);
  fetch(`${origin}/api/notify-ticket`,{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({ticketId:ticket.id}),
  }).catch(()=>{});

  const ai=await iaPromise;

  return res.status(200).json({id:ticket.id,ai});
}
