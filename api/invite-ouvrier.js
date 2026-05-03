// Proxy serverless Vercel pour l'invitation d'un ouvrier via l'API Admin
// Supabase. Le client envoie : { email, nom (optionnel), redirectTo }
// On forward vers POST <SUPABASE_URL>/auth/v1/invite avec la service_role
// key (SUPABASE_SERVICE_ROLE_KEY env var côté Vercel).
//
// Si la service_role n'est pas configurée → 503, le client fait un fallback
// sur mailto pour ne pas bloquer l'UX.
export default async function handler(req,res){
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Methods","POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","Content-Type");
  if(req.method==="OPTIONS")return res.status(200).end();
  if(req.method!=="POST")return res.status(405).json({error:"POST attendu"});
  const {email,nom,redirectTo}=req.body||{};
  if(!email||!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){
    return res.status(400).json({error:"email valide requis"});
  }
  const supabaseUrl=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL;
  const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!supabaseUrl||!serviceKey){
    return res.status(503).json({error:"Service d'invitation non configuré (SUPABASE_SERVICE_ROLE_KEY manquante)"});
  }
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
    const data=await r.json().catch(()=>({}));
    res.status(r.status).json(data);
  }catch(e){
    res.status(500).json({error:e.message});
  }
}
