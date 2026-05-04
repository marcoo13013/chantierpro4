// ═══════════════════════════════════════════════════════════════════════════
// Helpers communs aux 4 endpoints agents (api/agent-*.js)
// ═══════════════════════════════════════════════════════════════════════════
// Pas un endpoint en soi (préfixe '_' ignoré par Vercel functions). Mutualise :
//   - auth cron (Bearer CRON_SECRET) avec bypass dev
//   - lecture des patrons concernés (entreprises.agents_enabled.<agent>=true)
//   - lecture jsonb data des tables (devis/chantiers_v2)
//   - insert notification + log
//   - appel Claude Haiku 4.5 pour formuler les messages naturellement
// ═══════════════════════════════════════════════════════════════════════════

export function checkCronAuth(req){
  const expected=process.env.CRON_SECRET;
  if(!expected)return null; // dev / pas configuré → on laisse passer
  const got=(req.headers.authorization||"").replace(/^Bearer\s+/i,"");
  return got===expected?null:"unauthorized";
}

export function supaConfig(){
  const url=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)return null;
  return {
    url,key,
    headers:{
      "Content-Type":"application/json",
      "apikey":key,
      "Authorization":`Bearer ${key}`,
    },
  };
}

// Récupère les patrons (role='patron' ou role IS NULL) qui ont l'agent activé.
// agents_enabled est un jsonb {devis:true, chantier:true, ...}. Si la clé
// manque ou l'objet est null, on considère activé par défaut.
export async function fetchActivePatrons(supa,agentKey){
  const u=`${supa.url}/rest/v1/entreprises?select=user_id,nom,role,agents_enabled,onboarding_done&onboarding_done=eq.true`;
  const r=await fetch(u,{headers:supa.headers});
  if(!r.ok)return [];
  const rows=await r.json();
  return rows.filter(p=>{
    if(p.role==="ouvrier"||p.role==="soustraitant")return false;
    const ae=p.agents_enabled||{};
    return ae[agentKey]!==false; // défaut true
  });
}

// Charge les `data` jsonb d'une table user-scopée (devis/chantiers_v2).
export async function fetchUserData(supa,table,userId,extra=""){
  const u=`${supa.url}/rest/v1/${table}?select=id,data,updated_at,created_at&user_id=eq.${userId}${extra?"&"+extra:""}`;
  const r=await fetch(u,{headers:supa.headers});
  if(!r.ok)return [];
  return r.json();
}

// Insert une notification (et un log audit en parallèle).
export async function pushNotification(supa,userId,agentId,{titre,message,type="info",data={}}){
  await Promise.all([
    fetch(`${supa.url}/rest/v1/notifications`,{
      method:"POST",
      headers:{...supa.headers,"Prefer":"return=minimal"},
      body:JSON.stringify({user_id:userId,agent_id:agentId,titre,message,type,data,lu:false}),
    }).catch(()=>{}),
    fetch(`${supa.url}/rest/v1/agent_logs`,{
      method:"POST",
      headers:{...supa.headers,"Prefer":"return=minimal"},
      body:JSON.stringify({agent_id:agentId,user_id:userId,type:"detection",message:titre,data}),
    }).catch(()=>{}),
  ]);
}

// Append un log "run_summary" (synthèse d'une exécution sur un user).
export async function logRun(supa,userId,agentId,summary){
  await fetch(`${supa.url}/rest/v1/agent_logs`,{
    method:"POST",
    headers:{...supa.headers,"Prefer":"return=minimal"},
    body:JSON.stringify({agent_id:agentId,user_id:userId,type:"run_summary",message:summary.title||"run",data:summary}),
  }).catch(()=>{});
}

// Reformule un libellé brut en une phrase naturelle française via Claude
// Haiku 4.5 (rapide+cheap). Si la clé Anthropic manque, renvoie le libellé brut.
export async function naturalize(messages){
  // messages : [{role:'user'|'assistant', content:string}]
  const key=process.env.ANTHROPIC_API_KEY;
  if(!key)return null;
  try{
    const r=await fetch("https://api.anthropic.com/v1/messages",{
      method:"POST",
      headers:{"Content-Type":"application/json","x-api-key":key,"anthropic-version":"2023-06-01"},
      body:JSON.stringify({
        model:"claude-haiku-4-5-20251001",
        max_tokens:300,
        system:"Tu es un assistant pour artisans BTP français. Tu reformules des alertes techniques en messages courts (1-2 phrases), action-oriented, ton chaleureux mais pro. Tu réponds UNIQUEMENT par le message — pas de markdown, pas de '**', pas de préambule.",
        messages,
      }),
    });
    if(!r.ok)return null;
    const data=await r.json();
    return (data?.content?.[0]?.text||"").trim();
  }catch{return null;}
}
