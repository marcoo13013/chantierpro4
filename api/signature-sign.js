// Endpoint public (pas d'auth) pour soumettre une signature manuscrite.
// Le client signataire envoie : token + image base64 + nom + email optionnel.
// Le serveur capture l'IP et l'horodatage côté serveur (anti-falsification).
//
// POST /api/signature-sign
// body : { token, signature (dataURL PNG), signerName, signerEmail? }
// → 200 {success:true, signedAt}
// → 400 input invalide
// → 404 lien invalide
// → 409 déjà signé
// → 503 service non configuré
export default async function handler(req,res){
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Methods","POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","Content-Type");
  if(req.method==="OPTIONS")return res.status(200).end();
  if(req.method!=="POST")return res.status(405).json({error:"POST attendu"});

  const supabaseUrl=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL;
  const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!supabaseUrl||!serviceKey){
    return res.status(503).json({error:"Service de signature non configuré"});
  }

  const{token,signature,signerName,signerEmail}=req.body||{};
  if(!token||typeof token!=="string"||!/^[a-f0-9-]{20,}$/i.test(token)){
    return res.status(400).json({error:"token invalide"});
  }
  if(!signature||typeof signature!=="string"||!signature.startsWith("data:image/")){
    return res.status(400).json({error:"signature invalide (data URL image attendue)"});
  }
  if(!signerName||typeof signerName!=="string"||!signerName.trim()){
    return res.status(400).json({error:"nom du signataire requis"});
  }
  // Limite taille signature à ~500KB pour éviter abus
  if(signature.length>700000){
    return res.status(413).json({error:"Signature trop volumineuse"});
  }

  // Capture IP côté serveur (preuve probatoire)
  const ip=(req.headers["x-forwarded-for"]||"").toString().split(",")[0].trim()
    ||req.headers["x-real-ip"]
    ||req.connection?.remoteAddress
    ||req.socket?.remoteAddress
    ||"unknown";
  const userAgent=(req.headers["user-agent"]||"").slice(0,200);

  try{
    // Cherche le devis
    const r=await fetch(`${supabaseUrl}/rest/v1/devis?data->>signatureToken=eq.${encodeURIComponent(token)}&select=*&limit=1`,{
      headers:{apikey:serviceKey,Authorization:`Bearer ${serviceKey}`},
    });
    if(!r.ok){
      return res.status(500).json({error:"Erreur DB"});
    }
    const arr=await r.json().catch(()=>[]);
    if(!Array.isArray(arr)||arr.length===0){
      return res.status(404).json({error:"Lien de signature invalide"});
    }
    const row=arr[0];
    if(row.data?.signature){
      return res.status(409).json({error:"Devis déjà signé",signedAt:row.data.signedAt});
    }

    // Met à jour le doc avec la signature, IP, horodatage et statut "signé"
    const signedAt=new Date().toISOString();
    const updatedDoc={
      ...row.data,
      signature,
      signerName:signerName.trim(),
      signerEmail:(signerEmail||"").trim()||null,
      signedAt,
      signerIP:ip,
      signerUserAgent:userAgent,
      statut:"signé",
    };
    const upd=await fetch(`${supabaseUrl}/rest/v1/devis?user_id=eq.${row.user_id}&id=eq.${row.id}`,{
      method:"PATCH",
      headers:{
        "Content-Type":"application/json",
        apikey:serviceKey,
        Authorization:`Bearer ${serviceKey}`,
        Prefer:"return=minimal",
      },
      body:JSON.stringify({data:updatedDoc,updated_at:signedAt}),
    });
    if(!upd.ok){
      const body=await upd.text();
      console.error("[signature-sign] update failed",upd.status,body.slice(0,200));
      return res.status(500).json({error:"Échec enregistrement signature",detail:body.slice(0,200)});
    }
    console.log("[signature-sign] OK",row.id,signerName,ip);
    return res.status(200).json({success:true,signedAt});
  }catch(e){
    console.error("[signature-sign] erreur",e);
    return res.status(500).json({error:e.message||"Erreur serveur"});
  }
}
