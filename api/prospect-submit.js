// ═══════════════════════════════════════════════════════════════════════════
// /api/prospect-submit — Soumission formulaire /demo (public, anon)
// ═══════════════════════════════════════════════════════════════════════════
// Reçoit { nom_entreprise, email, telephone, logiciel_actuel, volume_clients }
// 1. Insert dans prospects via service_role (bypass RLS qui restreint aux admins)
// 2. Envoie email à Marco via Resend (best effort, n'échoue pas si pas configuré)
// 3. Retourne { ok:true, id }
// ═══════════════════════════════════════════════════════════════════════════

const ADMIN_EMAIL = "francehabitat.immo@gmail.com";
const FROM_EMAIL  = "onboarding@resend.dev";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST attendu" });

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resendKey = process.env.RESEND_API_KEY;

  if (!supabaseUrl || !serviceKey) {
    return res.status(503).json({ error: "Supabase non configuré côté serveur" });
  }

  const { nom_entreprise, email, telephone, logiciel_actuel, volume_clients } = req.body || {};

  // Validation
  if (!nom_entreprise || !String(nom_entreprise).trim()) {
    return res.status(400).json({ error: "Nom entreprise requis" });
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Email valide requis" });
  }

  // Insert via service_role
  const insertRes = await fetch(`${supabaseUrl}/rest/v1/prospects`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      nom_entreprise: String(nom_entreprise).trim(),
      email: String(email).trim().toLowerCase(),
      telephone: telephone ? String(telephone).trim() : null,
      logiciel_actuel: logiciel_actuel || null,
      volume_clients: volume_clients || null,
      statut: "nouveau",
      source: "demo",
    }),
  });

  if (!insertRes.ok) {
    const body = await insertRes.text().catch(() => "");
    console.error("[prospect-submit] insert failed:", insertRes.status, body);
    return res.status(500).json({ error: "Insert prospect échoué", detail: body.slice(0, 300) });
  }
  const inserted = await insertRes.json().catch(() => []);
  const id = Array.isArray(inserted) ? inserted[0]?.id : inserted?.id;

  // Email best-effort à Marco (silencieux si pas de RESEND_API_KEY)
  if (resendKey) {
    try {
      const html = renderEmailHtml({ nom_entreprise, email, telephone, logiciel_actuel, volume_clients });
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: ADMIN_EMAIL,
          subject: `🔔 Nouveau prospect : ${nom_entreprise} (depuis ${logiciel_actuel || "—"})`,
          html,
        }),
      });
    } catch (e) {
      console.warn("[prospect-submit] email error (non-blocking):", e?.message);
    }
  }

  return res.status(200).json({ ok: true, id });
}

function renderEmailHtml({ nom_entreprise, email, telephone, logiciel_actuel, volume_clients }) {
  return `
<!DOCTYPE html>
<html>
<body style="font-family:-apple-system,Helvetica,sans-serif;background:#f5f7fa;padding:20px;color:#1B3A5C">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 14px rgba(0,0,0,0.08)">
    <div style="background:#E8620A;color:#fff;padding:18px 24px">
      <h1 style="margin:0;font-size:20px">🔔 Nouveau prospect ChantierPro</h1>
    </div>
    <div style="padding:24px">
      <p style="font-size:14px;color:#475569;margin:0 0 18px">Une nouvelle demande de démo vient d'arriver depuis la page publique.</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr><td style="padding:8px 0;color:#64748B;width:140px">🏢 Entreprise</td><td style="padding:8px 0;font-weight:700">${escapeHtml(nom_entreprise)}</td></tr>
        <tr><td style="padding:8px 0;color:#64748B">✉️ Email</td><td style="padding:8px 0"><a href="mailto:${escapeHtml(email)}" style="color:#2563EB;text-decoration:none;font-weight:600">${escapeHtml(email)}</a></td></tr>
        ${telephone ? `<tr><td style="padding:8px 0;color:#64748B">📞 Téléphone</td><td style="padding:8px 0"><a href="tel:${escapeHtml(telephone)}" style="color:#2563EB;text-decoration:none;font-weight:600">${escapeHtml(telephone)}</a></td></tr>` : ""}
        ${logiciel_actuel ? `<tr><td style="padding:8px 0;color:#64748B">💻 Logiciel actuel</td><td style="padding:8px 0;font-weight:700">${escapeHtml(logiciel_actuel)}</td></tr>` : ""}
        ${volume_clients ? `<tr><td style="padding:8px 0;color:#64748B">📊 Volume clients</td><td style="padding:8px 0;font-weight:700">${escapeHtml(volume_clients)}</td></tr>` : ""}
      </table>
      <div style="margin-top:24px;padding-top:18px;border-top:1px solid #E2E8F0;font-size:12px;color:#94A3B8">
        Pour répondre, ouvre l'app ChantierPro → Admin → onglet Prospects.
      </div>
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
