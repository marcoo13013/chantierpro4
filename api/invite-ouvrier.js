// Proxy serverless Vercel pour l'invitation d'un ouvrier via l'API Admin
// Supabase. Le client envoie : { email, nom (optionnel), redirectTo }
// On forward vers POST <SUPABASE_URL>/auth/v1/invite avec la service_role
// key (SUPABASE_SERVICE_ROLE_KEY env var côté Vercel).
//
// GET /api/invite-ouvrier → diagnostic : indique si les env vars sont
// présentes (sans leak de secret) → permet de vérifier en prod si la
// fonction est bien déployée et configurée.
export default async function handler(req,res){
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Methods","GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","Content-Type");
  if(req.method==="OPTIONS")return res.status(200).end();

  const supabaseUrl=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL;
  const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Diagnostic GET : aucun email n'est exposé, on dit juste si chaque var
  // est présente + de quelle longueur (pour vérifier qu'elle n'est pas tronquée).
  if(req.method==="GET"){
    return res.status(200).json({
      deployed:true,
      supabaseUrl_present:!!supabaseUrl,
      supabaseUrl_value:supabaseUrl?supabaseUrl.replace(/^(https?:\/\/[^.]{4})[^.]+/,"$1***"):null,
      serviceKey_present:!!serviceKey,
      serviceKey_length:serviceKey?serviceKey.length:0,
      ready_to_invite:!!(supabaseUrl&&serviceKey),
    });
  }

  if(req.method!=="POST")return res.status(405).json({error:"POST ou GET attendu"});

  const {email,nom,redirectTo}=req.body||{};
  if(!email||!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){
    return res.status(400).json({error:"email valide requis"});
  }
  if(!supabaseUrl||!serviceKey){
    return res.status(503).json({
      error:"Service d'invitation non configuré",
      hint:"Ajoute SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY dans Vercel → Settings → Environment Variables → Production, puis redéploie.",
      diagnostic:{
        supabaseUrl_present:!!supabaseUrl,
        serviceKey_present:!!serviceKey,
      },
    });
  }
  // Forward vers Supabase Auth Admin API
  let supaStatus=0,supaBody=null,supaRaw="";
  try{
    const r=await fetch(`${supabaseUrl}/auth/v1/invite`,{
      method:"POST",
      headers:{
        "Content-Type":"application/json",
        "apikey":serviceKey,
        "Authorization":`Bearer ${serviceKey}`,
      },
      body:JSON.stringify({
        email,
        data:{invitation_source:"chantierpro",nom:nom||null},
        ...(redirectTo&&{redirect_to:redirectTo}),
      }),
    });
    supaStatus=r.status;
    supaRaw=await r.text();
    try{supaBody=JSON.parse(supaRaw);}catch{supaBody={raw:supaRaw};}
    if(!r.ok){
      // Renvoie l'erreur Supabase verbatim au client + diagnostic complet
      return res.status(r.status).json({
        error:supaBody?.msg||supaBody?.error||supaBody?.message||`HTTP ${r.status}`,
        supabase_status:r.status,
        supabase_body:supaBody,
        hint:r.status===422?"Vérifie que les inscriptions email sont autorisées dans Supabase → Authentication → Providers → Email":
             r.status===403?"Service role key invalide ou non autorisée. Régénère-la dans Supabase → Settings → API.":
             r.status===429?"Limite d'invitations Supabase atteinte (rate limit). Attends quelques minutes.":
             null,
      });
    }
    return res.status(200).json({success:true,supabase_response:supaBody});
  }catch(e){
    return res.status(500).json({
      error:e.message,
      stage:"fetch supabase",
      supaStatus,
      supaRaw:(supaRaw||"").slice(0,500),
    });
  }
}
