// Proxy serverless Vercel pour appel Qonto (contourne CORS browser).
// Le client envoie : { token, organizationSlug, payload }
// On forward vers POST https://thirdparty.qonto.com/v2/supplier_invoices
// avec l'auth header au format "<organization_slug>:<secret_key>".
export default async function handler(req,res){
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Methods","POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","Content-Type");
  if(req.method==="OPTIONS")return res.status(200).end();
  if(req.method!=="POST")return res.status(405).json({error:"POST attendu"});
  try{
    const {token,organizationSlug,payload}=req.body||{};
    if(!token||!payload)return res.status(400).json({error:"token et payload requis"});
    // Format auth : si l'utilisateur fournit "slug:key" tel quel, on l'utilise ;
    // sinon on construit depuis organizationSlug + token (clé secrète).
    const auth=token.includes(":")?token:(organizationSlug?`${organizationSlug}:${token}`:token);
    const r=await fetch("https://thirdparty.qonto.com/v2/supplier_invoices",{
      method:"POST",
      headers:{
        "Content-Type":"application/json",
        "Authorization":auth,
      },
      body:JSON.stringify(payload),
    });
    const data=await r.json().catch(()=>({status:r.status,statusText:r.statusText}));
    res.status(r.status).json(data);
  }catch(e){
    res.status(500).json({error:e.message});
  }
}
