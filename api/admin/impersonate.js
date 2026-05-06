// ═══════════════════════════════════════════════════════════════════════════
// /api/admin/impersonate — Endpoint unique pour start/end impersonation
// ═══════════════════════════════════════════════════════════════════════════
// Consolidation de impersonate.js + impersonate-end.js (sprint Vercel Hobby
// limite 12 functions). Routing par body.action :
//   - { action: "start", target_user_id }  → magic link + audit start
//   - { action: "end",   target_user_id? } → audit end uniquement
// Si action absent → "start" par défaut (backward-compat).
//
// Sécurité commune aux 2 actions :
//   1. Bearer token requis
//   2. Vérification role='admin' dans profiles via service_role
// ═══════════════════════════════════════════════════════════════════════════

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST attendu" });

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return res.status(503).json({ error: "Supabase non configuré côté serveur" });
  }

  // ─── Auth + check admin (commun aux 2 actions) ──────────────────────────
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Authorization Bearer manquant" });

  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${token}` },
  });
  if (!userRes.ok) return res.status(401).json({ error: "Token invalide" });
  const caller = await userRes.json();
  if (!caller?.id) return res.status(401).json({ error: "User introuvable" });

  const profileRes = await fetch(
    `${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(caller.id)}&select=id,email,role`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
  );
  const profiles = await profileRes.json().catch(() => []);
  const callerProfile = Array.isArray(profiles) ? profiles[0] : null;
  if (!callerProfile || callerProfile.role !== "admin") {
    return res.status(403).json({ error: "Accès admin requis" });
  }

  // ─── Routing par action ─────────────────────────────────────────────────
  const action = (req.body?.action || "start").toLowerCase();
  if (action === "end") return handleEnd(req, res, { supabaseUrl, serviceKey, caller });
  if (action === "start") return handleStart(req, res, { supabaseUrl, serviceKey, caller });
  return res.status(400).json({ error: "action invalide (attendu: start|end)" });
}

async function handleStart(req, res, { supabaseUrl, serviceKey, caller }) {
  const { target_user_id } = req.body || {};
  if (!target_user_id) return res.status(400).json({ error: "target_user_id requis" });
  if (target_user_id === caller.id) return res.status(400).json({ error: "Auto-impersonation interdite" });

  // 1. Récupère target email
  const targetRes = await fetch(
    `${supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(target_user_id)}`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
  );
  if (!targetRes.ok) {
    const body = await targetRes.text().catch(() => "");
    return res.status(404).json({ error: "Target user introuvable", detail: body.slice(0, 200) });
  }
  const target = await targetRes.json();
  const targetEmail = target.email;
  if (!targetEmail) return res.status(400).json({ error: "Target sans email" });

  // 2. Magic link via admin API (sans envoyer d'email)
  const linkRes = await fetch(`${supabaseUrl}/auth/v1/admin/generate_link`, {
    method: "POST",
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ type: "magiclink", email: targetEmail }),
  });
  if (!linkRes.ok) {
    const body = await linkRes.text().catch(() => "");
    console.error("[impersonate.start] generate_link failed:", linkRes.status, body);
    return res.status(500).json({ error: "Génération magic link échouée", detail: body.slice(0, 300) });
  }
  const linkData = await linkRes.json();
  const hashed_token = linkData?.properties?.hashed_token || linkData?.hashed_token;
  if (!hashed_token) return res.status(500).json({ error: "Hashed token absent de la réponse" });

  // 3. Audit (best effort)
  try {
    await fetch(`${supabaseUrl}/rest/v1/audit_log`, {
      method: "POST",
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({
        admin_id: caller.id, target_user_id,
        action: "impersonate.start",
        metadata: { admin_email: caller.email, target_email: targetEmail, ua: req.headers["user-agent"] || null },
      }),
    });
  } catch (e) {
    console.warn("[impersonate.start] audit failed (non-blocking):", e?.message);
  }

  return res.status(200).json({ ok: true, hashed_token, target_email: targetEmail });
}

async function handleEnd(req, res, { supabaseUrl, serviceKey, caller }) {
  const { target_user_id } = req.body || {};
  try {
    await fetch(`${supabaseUrl}/rest/v1/audit_log`, {
      method: "POST",
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({
        admin_id: caller.id,
        target_user_id: target_user_id || null,
        action: "impersonate.end",
        metadata: { admin_email: caller.email },
      }),
    });
  } catch (e) {
    console.warn("[impersonate.end] audit failed (non-blocking):", e?.message);
  }
  return res.status(200).json({ ok: true });
}
