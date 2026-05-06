// ═══════════════════════════════════════════════════════════════════════════
// /api/admin/impersonate-end — Audit log fin d'impersonation
// ═══════════════════════════════════════════════════════════════════════════
// Best effort. Le bouton "Quitter" du bandeau appelle cet endpoint après
// avoir restauré la session admin (donc le token bearer est celui de l'admin).
// ═══════════════════════════════════════════════════════════════════════════

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST attendu" });

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return res.status(503).json({ error: "Supabase non configuré" });

  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Authorization manquant" });

  // Identifie l'admin caller
  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${token}` },
  });
  if (!userRes.ok) return res.status(401).json({ error: "Token invalide" });
  const caller = await userRes.json();
  if (!caller?.id) return res.status(401).json({ error: "User introuvable" });

  // Vérifie role admin
  const profileRes = await fetch(
    `${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(caller.id)}&select=role`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
  );
  const profiles = await profileRes.json().catch(() => []);
  if (!Array.isArray(profiles) || profiles[0]?.role !== "admin") {
    return res.status(403).json({ error: "Admin requis" });
  }

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
    console.warn("[impersonate-end] audit failed:", e?.message);
  }

  return res.status(200).json({ ok: true });
}
