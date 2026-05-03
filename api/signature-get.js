// Endpoint public (pas d'auth) pour récupérer un devis à signer via son token.
// Utilise le service_role Supabase pour bypasser RLS (le client signataire
// n'a pas de session).
//
// GET /api/signature-get?token=<uuid>
// → 200 {signed:false, doc:{...}, entreprise:{...}}
// → 200 {signed:true, signedAt, signerName, doc:{minimal}}  // déjà signé
// → 404 lien invalide / expiré
// → 503 service non configuré (env vars manquantes)
export default async function handler(req,res){
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Methods","GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","Content-Type");
  if(req.method==="OPTIONS")return res.status(200).end();
  if(req.method!=="GET")return res.status(405).json({error:"GET attendu"});

  const supabaseUrl=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL;
  const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!supabaseUrl||!serviceKey){
    return res.status(503).json({error:"Service de signature non configuré (env vars manquantes côté serveur)"});
  }

  const token=(req.query.token||"").trim();
  if(!token||!/^[a-f0-9-]{20,}$/i.test(token)){
    return res.status(400).json({error:"token invalide"});
  }

  try{
    // Cherche le devis par data->>signatureToken (PostgREST jsonb path)
    const r=await fetch(`${supabaseUrl}/rest/v1/devis?data->>signatureToken=eq.${encodeURIComponent(token)}&select=*&limit=1`,{
      headers:{apikey:serviceKey,Authorization:`Bearer ${serviceKey}`},
    });
    if(!r.ok){
      const body=await r.text();
      console.error("[signature-get] supabase error",r.status,body.slice(0,200));
      return res.status(500).json({error:"Erreur DB",detail:body.slice(0,200)});
    }
    const arr=await r.json().catch(()=>[]);
    if(!Array.isArray(arr)||arr.length===0){
      return res.status(404).json({error:"Lien de signature invalide ou expiré"});
    }
    const row=arr[0];
    const doc=row.data||{};

    // Charge le profil entreprise pour le header du PDF affiché au signataire
    let entreprise=null;
    try{
      const er=await fetch(`${supabaseUrl}/rest/v1/entreprises?user_id=eq.${row.user_id}&select=*&limit=1`,{
        headers:{apikey:serviceKey,Authorization:`Bearer ${serviceKey}`},
      });
      if(er.ok){
        const erArr=await er.json().catch(()=>[]);
        if(Array.isArray(erArr)&&erArr[0]){
          const e=erArr[0];
          entreprise={
            nom:e.nom,nomCourt:e.nom_court,siret:e.siret,
            adresse:e.adresse,tel:e.tel,email:e.email,logo:e.logo,
          };
        }
      }
    }catch(e){console.warn("[signature-get] charge entreprise échoué",e.message);}

    // Si déjà signé, on ne renvoie pas le PDF complet — juste l'info "déjà signé"
    if(doc.signature){
      return res.status(200).json({
        signed:true,
        signedAt:doc.signedAt,
        signerName:doc.signerName,
        doc:{numero:doc.numero,client:doc.client,date:doc.date},
        entreprise,
      });
    }

    // Renvoi minimal du devis pour l'aperçu signature (pas d'infos sensibles
    // comme marges, fournitures détaillées, etc.)
    return res.status(200).json({
      signed:false,
      doc:{
        id:doc.id,
        numero:doc.numero,
        date:doc.date,
        client:doc.client,
        titreChantier:doc.titreChantier,
        adresseClient:doc.adresseClient,
        emailClient:doc.emailClient,
        telClient:doc.telClient,
        conditionsReglement:doc.conditionsReglement,
        notes:doc.notes,
        signatureMessage:doc.signatureMessage||"",
        lignes:(doc.lignes||[]).map(l=>{
          // On retire les fournitures détaillées (info patron uniquement)
          const{fournitures,...rest}=l;
          return rest;
        }),
        optionsAccepted:doc.optionsAccepted||[],
      },
      entreprise,
    });
  }catch(e){
    console.error("[signature-get] erreur",e);
    return res.status(500).json({error:e.message||"Erreur serveur"});
  }
}
