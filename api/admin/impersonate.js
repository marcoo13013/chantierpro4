// ═══════════════════════════════════════════════════════════════════════════
// /api/admin/impersonate — Génère un token de session pour un user cible
// ═══════════════════════════════════════════════════════════════════════════
// Sécurité :
//   1. Vérifie que le caller est authentifié et a role='admin' dans profiles
//      (vérification via service_role qui bypass RLS, sans exposer le service
//      key au client).
//   2. Si OK, génère un magic link via auth.admin.generateLink() qui retourne
//      un hashed_token utilisable ensuite par le frontend avec verifyOtp.
//   3. Trace l'action dans audit_log.
//
// Le frontend appelle ensuite supabase.auth.verifyOtp({token_hash, type:'magiclink'})
// pour ouvrir une vraie session Supabase du target user. La session originale
// admin est sauvegardée localStorage avant le swap, restaurable au retour.
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

  // 1. Récupère le caller depuis le bearer token
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Authorization Bearer manquant" });

  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${token}` },
  });
  if (!userRes.ok) {
    return res.status(401).json({ error: "Token invalide" });
  }
  const caller = await userRes.json();
  if (!caller?.id) return res.status(401).json({ error: "User introuvable" });

  // 2. Vérifie que le caller est admin (lecture profiles via service_role)
  const profileRes = await fetch(
    `${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(caller.id)}&select=id,email,role`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
  );
  const profiles = await profileRes.json().catch(() => []);
  const callerProfile = Array.isArray(profiles) ? profiles[0] : null;
  if (!callerProfile || callerProfile.role !== "admin") {
    return res.status(403).json({ error: "Accès admin requis" });
  }

  // 3. Récupère le target
  const { target_user_id } = req.body || {};
  if (!target_user_id) return res.status(400).json({ error: "target_user_id requis" });
  if (target_user_id === caller.id) return res.status(400).json({ error: "Auto-impersonation interdite" });

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

  // 4. Génère le magic link via admin API (sans envoyer d'email)
  // Endpoint : POST /auth/v1/admin/generate_link
  // Type 'magiclink' avec email du target → retourne hashed_token
  const linkRes = await fetch(`${supabaseUrl}/auth/v1/admin/generate_link`, {
    method: "POST",
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "magiclink",
      email: targetEmail,
    }),
  });
  if (!linkRes.ok) {
    const body = await linkRes.text().catch(() => "");
    console.error("[impersonate] generate_link failed:", linkRes.status, body);
    return res.status(500).json({ error: "Génération magic link échouée", detail: body.slice(0, 300) });
  }
  const linkData = await linkRes.json();
  const hashed_token = linkData?.properties?.hashed_token || linkData?.hashed_token;
  if (!hashed_token) {
    return res.status(500).json({ error: "Hashed token absent de la réponse" });
  }

  // 5. Audit log (best effort, non bloquant)
  try {
    await fetch(`${supabaseUrl}/rest/v1/audit_log`, {
      method: "POST",
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({
        admin_id: caller.id,
        target_user_id,
        action: "impersonate.start",
        metadata: {
          admin_email: caller.email,
          target_email: targetEmail,
          ua: req.headers["user-agent"] || null,
        },
      }),
    });
  } catch (e) {
    console.warn("[impersonate] audit log failed (non-blocking):", e?.message);
  }

  return res.status(200).json({ ok: true, hashed_token, target_email: targetEmail });
}
