// ═══════════════════════════════════════════════════════════════════════════
// /api/notify-ticket — Notification email à l'admin Support (Phase 2)
// ═══════════════════════════════════════════════════════════════════════════
// Flow :
//   1. Le client POST { ticketId } juste après création du ticket.
//   2. On charge le ticket depuis Supabase (service_role bypass RLS — utile
//      pour les soumissions anonymes via /support).
//   3. On envoie un email HTML via Resend à francehabitat.immo@gmail.com.
//
// Configuration requise (Vercel → Settings → Environment Variables) :
//   - RESEND_API_KEY    : clé API Resend (https://resend.com → API Keys)
//   - SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (déjà présents)
//   - SUPPORT_ADMIN_URL : optionnel, URL absolue vers le dashboard admin.
//     Défaut : déduit du host de la requête.
//
// Email expéditeur (FROM) : 'onboarding@resend.dev' — domaine de test
// gratuit fourni par Resend, pas besoin de vérifier un domaine perso. Limite
// : ne peut envoyer qu'à l'email du compte Resend (= francehabitat.immo@
// gmail.com ici, qui est aussi le destinataire — donc OK pour ce cas).
//
// Sécurité : pas de check auth — l'endpoint ne fait qu'une notification, le
// risque max est qu'un attaquant flood l'admin de mails. Le ticket DOIT
// déjà exister en DB (service_role lit via id) pour qu'un email parte.
// ═══════════════════════════════════════════════════════════════════════════

const ADMIN_EMAIL="francehabitat.immo@gmail.com";
const FROM_EMAIL="onboarding@resend.dev";

export default async function handler(req,res){
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Methods","POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","Content-Type");
  if(req.method==="OPTIONS")return res.status(200).end();

  const supabaseUrl=process.env.SUPABASE_URL||process.env.VITE_SUPABASE_URL;
  const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resendKey=process.env.RESEND_API_KEY;

  if(req.method==="GET"){
    // Diagnostic (sans exposer les secrets)
    return res.status(200).json({
      deployed:true,
      supabase_present:!!(supabaseUrl&&serviceKey),
      resend_present:!!resendKey,
      from_email:FROM_EMAIL,
      admin_email:ADMIN_EMAIL,
    });
  }
  if(req.method!=="POST")return res.status(405).json({error:"POST attendu"});

  if(!supabaseUrl||!serviceKey){
    return res.status(503).json({error:"Supabase non configuré côté serveur"});
  }
  if(!resendKey){
    return res.status(503).json({
      error:"RESEND_API_KEY manquante",
      hint:"Crée un compte sur https://resend.com, génère une clé API et ajoute-la dans Vercel → Settings → Environment Variables → Production. Redéploie ensuite.",
    });
  }

  // ─── Routing par type : client_confirmation (Commit 4 sprint flow) ───────
  // Le mode historique (notification admin support) ne passe PAS de type ; on
  // bascule sur la branche client UNIQUEMENT si body.type === "client_confirmation".
  if((req.body||{}).type==="client_confirmation"){
    return await handleClientConfirmation(req,res,{resendKey});
  }

  const {ticketId}=req.body||{};
  if(!ticketId)return res.status(400).json({error:"ticketId requis"});

  // ─── Charger le ticket ────────────────────────────────────────────────
  const supaHeaders={
    "Content-Type":"application/json",
    "apikey":serviceKey,
    "Authorization":`Bearer ${serviceKey}`,
  };
  const tRes=await fetch(`${supabaseUrl}/rest/v1/tickets?id=eq.${ticketId}&select=*`,{headers:supaHeaders});
  if(!tRes.ok)return res.status(500).json({error:"impossible de charger le ticket"});
  const tickets=await tRes.json();
  if(!tickets[0])return res.status(404).json({error:"ticket introuvable"});
  const tk=tickets[0];

  // ─── Construire URL admin (préfixe protocole + host de la requête) ────
  const adminUrl=process.env.SUPPORT_ADMIN_URL
    ||(req.headers.origin
      ||`https://${req.headers["x-forwarded-host"]||req.headers.host||"localhost"}`)+"/?view=support";

  // ─── Email HTML ────────────────────────────────────────────────────────
  const escape=s=>String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  const typeLabel={bug:"🐛 Bug",feature:"✨ Fonctionnalité",recommandation:"💡 Recommandation",autre:"💬 Autre"}[tk.type]||tk.type;
  const priColor={basse:"#94A3B8",normale:"#1B3A5C",haute:"#D97706",urgente:"#DC2626"}[tk.priorite]||"#1B3A5C";

  const html=`<!doctype html>
<html><body style="margin:0;padding:0;background:#F8FAFC;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1E293B;">
<div style="max-width:600px;margin:24px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
  <div style="background:linear-gradient(135deg,#1B3A5C,#FF6B2C);color:#fff;padding:18px 22px;">
    <div style="font-size:13px;opacity:0.85;text-transform:uppercase;letter-spacing:1px;font-weight:600;">ChantierPro · Support</div>
    <div style="font-size:18px;font-weight:800;margin-top:4px;">📨 Nouveau ticket reçu</div>
  </div>
  <div style="padding:22px;">
    <div style="display:inline-block;background:#F1F5F9;color:#1B3A5C;padding:5px 12px;border-radius:6px;font-size:12px;font-weight:700;margin-right:6px;">${escape(typeLabel)}</div>
    <div style="display:inline-block;background:${priColor}15;color:${priColor};padding:5px 12px;border-radius:6px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">priorité ${escape(tk.priorite)}</div>
    <h2 style="margin:14px 0 6px;font-size:18px;color:#1B3A5C;">${escape(tk.titre)}</h2>
    <div style="font-size:11px;color:#64748B;font-family:monospace;">de ${escape(tk.email)} · ${new Date(tk.created_at).toLocaleString("fr-FR")}</div>
    <div style="margin-top:14px;padding:14px;background:#F8FAFC;border-left:3px solid #FF6B2C;border-radius:6px;font-size:13px;line-height:1.6;white-space:pre-wrap;">${escape(tk.description)}</div>
    <div style="margin-top:22px;text-align:center;">
      <a href="${escape(adminUrl)}" style="display:inline-block;background:#FF6B2C;color:#fff;text-decoration:none;font-weight:700;padding:11px 22px;border-radius:8px;font-size:13px;">→ Ouvrir dans le dashboard admin</a>
    </div>
    <div style="margin-top:18px;font-size:11px;color:#94A3B8;text-align:center;font-style:italic;">L'agent IA va analyser ce ticket. Si la question est dans la FAQ, il y répondra automatiquement. Sinon, à toi de jouer.</div>
  </div>
  <div style="background:#F8FAFC;padding:14px 22px;font-size:10px;color:#94A3B8;text-align:center;border-top:1px solid #E2E8F0;">ChantierPro — notification automatique support#${tk.id}</div>
</div></body></html>`;

  // ─── Envoi via Resend ─────────────────────────────────────────────────
  const resendRes=await fetch("https://api.resend.com/emails",{
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "Authorization":`Bearer ${resendKey}`,
    },
    body:JSON.stringify({
      from:`ChantierPro Support <${FROM_EMAIL}>`,
      to:[ADMIN_EMAIL],
      reply_to:tk.email||undefined,
      subject:`[Ticket #${tk.id}] ${typeLabel} — ${tk.titre}`,
      html,
    }),
  });
  const body=await resendRes.json().catch(()=>({}));
  if(!resendRes.ok){
    return res.status(resendRes.status).json({
      error:"Resend send failed",
      resend_status:resendRes.status,
      resend_body:body,
      hint:resendRes.status===403?"Avec onboarding@resend.dev, Resend n'autorise l'envoi QUE vers l'email du compte Resend. Vérifie que ton compte Resend est bien créé avec francehabitat.immo@gmail.com.":undefined,
    });
  }
  return res.status(200).json({sent:true,resend_id:body?.id,ticketId});
}

// ═══════════════════════════════════════════════════════════════════════════
// Mode client_confirmation — mail envoyé au CLIENT à l'acceptation du devis
// ═══════════════════════════════════════════════════════════════════════════
// Body attendu :
//   {
//     type: "client_confirmation",
//     devisNumero, clientNom, clientEmail,
//     dateDebut, dateFin,           // ISO YYYY-MM-DD ou string formatable
//     montantHT,                    // number
//     nomEntreprise, telEntreprise,
//   }
//
// ⚠️ Limite Resend mode test (FROM = onboarding@resend.dev) : les mails
// vers une adresse arbitraire sont refusés (403). Tant qu'un domaine custom
// n'est pas vérifié sur Resend, seuls les mails vers l'email du compte
// Resend (= francehabitat.immo@gmail.com) passent. Marco a validé cette
// limite — la migration DNS viendra plus tard.
async function handleClientConfirmation(req,res,{resendKey}){
  const b=req.body||{};
  const requiredFields=["devisNumero","clientNom","clientEmail"];
  for(const f of requiredFields){
    if(!b[f])return res.status(400).json({error:`Champ '${f}' requis`});
  }
  // Validation email simple
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(b.clientEmail).trim())){
    return res.status(400).json({error:"Email client invalide"});
  }

  // Formatage dates FR (fallback sur string brute si parsing échoue)
  function fmtFR(iso){
    if(!iso)return"—";
    const d=new Date(iso);
    if(isNaN(d.getTime()))return String(iso);
    return d.toLocaleDateString("fr-FR",{day:"2-digit",month:"long",year:"numeric"});
  }
  function fmtMontant(n){
    const v=Number(n)||0;
    return v.toLocaleString("fr-FR",{minimumFractionDigits:2,maximumFractionDigits:2});
  }
  const escape=s=>String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");

  const dateDebutFR=fmtFR(b.dateDebut);
  const dateFinFR=fmtFR(b.dateFin);
  const montant=fmtMontant(b.montantHT);
  const nomEntreprise=escape(b.nomEntreprise||"Votre artisan");
  const telEntreprise=escape(b.telEntreprise||"");
  const clientNom=escape(b.clientNom);
  const devisNumero=escape(b.devisNumero);

  const html=`<!doctype html>
<html><body style="margin:0;padding:0;background:#F8FAFC;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1E293B;">
<div style="max-width:580px;margin:24px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
  <div style="background:linear-gradient(135deg,#1B3A5C,#FF6B2C);color:#fff;padding:22px 26px;">
    <div style="font-size:12px;opacity:0.85;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Confirmation chantier</div>
    <div style="font-size:20px;font-weight:800;margin-top:6px;">Vos travaux démarrent le ${escape(dateDebutFR)}</div>
  </div>
  <div style="padding:26px;font-size:14px;line-height:1.65;">
    <p style="margin:0 0 14px;">Bonjour <strong>${clientNom}</strong>,</p>
    <p style="margin:0 0 14px;">Nous confirmons le démarrage de vos travaux le <strong>${escape(dateDebutFR)}</strong>.</p>
    <p style="margin:0 0 18px;">La fin est prévue le <strong>${escape(dateFinFR)}</strong>.</p>
    <div style="background:#F8FAFC;border-left:3px solid #FF6B2C;border-radius:6px;padding:12px 16px;margin:18px 0;">
      <div style="font-size:11px;color:#64748B;text-transform:uppercase;letter-spacing:0.6px;font-weight:700;margin-bottom:4px;">Devis</div>
      <div style="font-family:monospace;font-size:13px;color:#1B3A5C;font-weight:600;">${devisNumero}</div>
      <div style="font-size:13px;color:#1E293B;margin-top:6px;">Montant : <strong>${montant} € HT</strong></div>
    </div>
    ${telEntreprise?`<p style="margin:0 0 14px;font-size:13px;color:#475569;">Pour toute question : <strong>${telEntreprise}</strong></p>`:""}
    <p style="margin:18px 0 4px;">Cordialement,</p>
    <p style="margin:0;font-size:15px;font-weight:700;color:#1B3A5C;">${nomEntreprise}</p>
  </div>
  <div style="background:#F8FAFC;padding:12px 22px;font-size:10px;color:#94A3B8;text-align:center;border-top:1px solid #E2E8F0;">Confirmation automatique générée par ChantierPro · ${escape(devisNumero)}</div>
</div></body></html>`;

  const fromName=nomEntreprise.replace(/[<>"]/g,"");
  const resendRes=await fetch("https://api.resend.com/emails",{
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "Authorization":`Bearer ${resendKey}`,
    },
    body:JSON.stringify({
      from:`${fromName} <${FROM_EMAIL}>`,
      to:[String(b.clientEmail).trim()],
      subject:`Confirmation de votre chantier — début ${dateDebutFR}`,
      html,
    }),
  });
  const body2=await resendRes.json().catch(()=>({}));
  if(!resendRes.ok){
    return res.status(resendRes.status).json({
      error:"Resend send failed",
      resend_status:resendRes.status,
      resend_body:body2,
      hint:resendRes.status===403?"Avec onboarding@resend.dev, Resend n'autorise l'envoi QUE vers l'email du compte Resend (francehabitat.immo@gmail.com pour les tests). Vérifie un domaine custom dans Resend pour envoyer à n'importe quel client.":undefined,
    });
  }
  return res.status(200).json({sent:true,resend_id:body2?.id,canal:"mail",destinataire:b.clientEmail});
}
