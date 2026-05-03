// Proxy serverless Vercel pour l'invitation d'un ouvrier.
// Le client envoie : { email, nom, redirectTo, patronUserId }
//
// Flow complet :
// 1) POST <SUPABASE_URL>/auth/v1/invite avec service_role → crée le user
//    auth.users + envoie l'email d'invitation
// 2) Récupère l'id du nouveau user dans la réponse
// 3) Charge le profil du patron (entreprises) pour récupérer nom/logo/statut
// 4) Upsert la ligne entreprises de l'ouvrier avec role='ouvrier' + patron_
//    user_id pré-rempli. À sa 1ʳᵉ connexion, l'app trouve la ligne et
//    bascule directement sur VueOuvrierTerrain — plus besoin de l'auto-
//    match RPC find_patron_by_email
//
// GET /api/invite-ouvrier → diagnostic (env vars présentes ? sans secret).
export default async function handler(req,res){
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Methods","GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","Content-Type");
  if(req.method==="OPTIONS")return res.status(200).end();

  const supabaseUrl=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL;
  const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;

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

  const {email,nom,redirectTo,patronUserId,role}=req.body||{};
  if(!email||!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){
    return res.status(400).json({error:"email valide requis"});
  }
  if(!supabaseUrl||!serviceKey){
    return res.status(503).json({
      error:"Service d'invitation non configuré",
      hint:"Ajoute SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY dans Vercel → Settings → Environment Variables → Production, puis redéploie.",
      diagnostic:{supabaseUrl_present:!!supabaseUrl,serviceKey_present:!!serviceKey},
    });
  }
  // Le rôle attribué par défaut : 'ouvrier'. Permet d'inviter aussi un
  // sous-traitant si role='soustraitant' est passé explicitement.
  const targetRole=role==="soustraitant"?"soustraitant":"ouvrier";

  console.log("[invite] start",{email,nom,patronUserId,role:targetRole,redirectTo:redirectTo?"(set)":"(none)"});

  // ─── 1) Envoi de l'invitation Auth Supabase ────────────────────────────
  let supaStatus=0,supaBody=null;
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
        data:{invitation_source:"chantierpro",nom:nom||null,patron_user_id:patronUserId||null,role:targetRole},
        ...(redirectTo&&{redirect_to:redirectTo}),
      }),
    });
    supaStatus=r.status;
    const raw=await r.text();
    try{supaBody=JSON.parse(raw);}catch{supaBody={raw};}
    console.log("[invite] auth/v1/invite status:",r.status,"body keys:",supaBody?Object.keys(supaBody):"null");
    if(!r.ok){
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
  }catch(e){
    console.error("[invite] fetch invite error:",e.message);
    return res.status(500).json({error:e.message,stage:"fetch supabase invite",supaStatus});
  }

  // ─── 2) Récupère l'id du nouveau user (Supabase renvoie l'objet user) ──
  const newUserId=supaBody?.id||supaBody?.user?.id||null;
  console.log("[invite] newUserId:",newUserId);
  if(!newUserId){
    return res.status(200).json({
      success:true,
      supabase_response:supaBody,
      warning:"Invitation envoyée mais id user non récupéré → ligne entreprises non pré-créée. L'auto-match RPC s'en chargera à la 1ʳᵉ connexion.",
    });
  }

  // ─── 3) Sans patronUserId, on ne peut pas pré-créer le profil ──────────
  if(!patronUserId){
    console.warn("[invite] patronUserId manquant — pas de pré-création entreprises");
    return res.status(200).json({
      success:true,
      supabase_response:supaBody,
      newUserId,
      warning:"patronUserId non fourni → ligne entreprises non pré-créée. L'auto-match RPC s'en chargera.",
    });
  }

  // ─── 4) Charge le profil patron pour pré-remplir nom/logo/statut ──────
  let patronProfile=null;
  let patronProfileErr=null;
  try{
    const pr=await fetch(`${supabaseUrl}/rest/v1/entreprises?user_id=eq.${encodeURIComponent(patronUserId)}&select=*`,{
      headers:{"apikey":serviceKey,"Authorization":`Bearer ${serviceKey}`},
    });
    if(pr.ok){
      const arr=await pr.json().catch(()=>[]);
      patronProfile=Array.isArray(arr)&&arr[0]?arr[0]:null;
      console.log("[invite] patron profile loaded:",patronProfile?"yes":"empty");
    }else{
      patronProfileErr={status:pr.status,body:(await pr.text()).slice(0,200)};
      console.warn("[invite] patron profile load failed:",patronProfileErr);
    }
  }catch(e){
    patronProfileErr={status:500,body:e.message};
    console.warn("[invite] patron profile fetch threw:",e.message);
  }

  // ─── 5) Pré-crée la ligne entreprises pour l'ouvrier ──────────────────
  const newRow={
    user_id:newUserId,
    nom:patronProfile?.nom||"Entreprise",
    nom_court:patronProfile?.nom_court||null,
    siret:patronProfile?.siret||null,
    email:email,
    role:targetRole,
    patron_user_id:patronUserId,
    statut:patronProfile?.statut||"sarl",
    logo:patronProfile?.logo||null,
    onboarding_done:true,
  };
  console.log("[invite] upserting entreprises row for newUserId:",newUserId,"with role:",targetRole);
  console.log("[invite] newRow payload:",JSON.stringify(newRow));
  let entInserted=false,entError=null,entResponseBody=null;
  try{
    const ir=await fetch(`${supabaseUrl}/rest/v1/entreprises?on_conflict=user_id`,{
      method:"POST",
      headers:{
        "Content-Type":"application/json",
        "apikey":serviceKey,
        "Authorization":`Bearer ${serviceKey}`,
        "Prefer":"resolution=merge-duplicates,return=representation",
      },
      body:JSON.stringify(newRow),
    });
    const respText=await ir.text();
    try{entResponseBody=JSON.parse(respText);}catch{entResponseBody={raw:respText.slice(0,400)};}
    console.log("[invite] upsert entreprises status:",ir.status,"ok:",ir.ok);
    console.log("[invite] upsert response body (full):",respText);
    if(ir.ok){
      entInserted=true;
      console.log("[invite] ✓ entreprise row inserted/merged");
    }else{
      entError={status:ir.status,body:respText.slice(0,400),hint:
        ir.status===401?"service_role key non valide ou pas accès écriture":
        ir.status===409?"Conflit — la ligne existe et merge a échoué":
        ir.status===422?"Données invalides (colonne manquante ?)":
        ir.status===500?"Erreur serveur Supabase (FK auth.users encore en commit ?)":null
      };
      console.warn("[invite] ✗ upsert entreprises failed:",entError);
    }
  }catch(e){
    entError={status:500,body:e.message};
    console.error("[invite] upsert entreprises threw:",e.message);
  }

  return res.status(200).json({
    success:true,
    supabase_response:supaBody,
    newUserId,
    entreprise_inserted:entInserted,
    entreprise_error:entError,
    entreprise_response_body:entResponseBody,
    patron_profile_loaded:!!patronProfile,
    patron_profile_error:patronProfileErr,
    role:targetRole,
    patron_user_id:patronUserId,
  });
}
