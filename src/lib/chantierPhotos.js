// ═══════════════════════════════════════════════════════════════════════════
// Helper upload / fetch / delete photos chantier (Supabase Storage + DB)
// ═══════════════════════════════════════════════════════════════════════════
// Path convention dans le bucket : {patron_user_id}/{chantier_id}/{filename}
// → cohérent avec les policies storage.objects (foldername[1] = patron_user_id).
// L'ouvrier uploade dans le dossier de SON patron (resolved via
// entreprises.patron_user_id) ; le patron uploade dans le sien.
// ═══════════════════════════════════════════════════════════════════════════

import { supabase } from "./supabase.js";

const BUCKET = "chantier-photos";
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ACCEPTED_MIME = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

export const PHOTO_LIMITS = {
  maxBytes: MAX_BYTES,
  acceptedMime: ACCEPTED_MIME,
  maxPerSession: 5,
};

// Sanitize un nom de fichier pour un path Storage.
function sanitizeName(name) {
  return String(name || "photo")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 80);
}

// Résout le user_id du PATRON (= dossier racine dans le bucket).
// - Pour un patron : user_id = authUser.id
// - Pour un ouvrier : user_id = entreprises.patron_user_id (lu depuis Supabase)
async function resolvePatronUserId(authUser) {
  if (!authUser?.id || !supabase) return null;
  // Lit la ligne entreprises pour cet authUser
  const { data, error } = await supabase
    .from("entreprises")
    .select("user_id, role, patron_user_id")
    .eq("user_id", authUser.id)
    .maybeSingle();
  if (error || !data) return authUser.id; // fallback patron
  if (data.role === "ouvrier" || data.role === "soustraitant") {
    return data.patron_user_id || authUser.id;
  }
  return data.user_id;
}

// Upload une seule photo. Retourne { url, storage_path } ou throw.
export async function uploadChantierPhoto({ file, chantierId, authUser }) {
  if (!supabase) throw new Error("Supabase non configuré.");
  if (!file) throw new Error("Aucun fichier.");
  if (file.size > MAX_BYTES) throw new Error(`Fichier trop gros (${Math.round(file.size/1024/1024*10)/10} MB > 5 MB).`);
  if (!ACCEPTED_MIME.includes(file.type)) throw new Error(`Format non supporté (${file.type}). Utilise JPG, PNG, WebP ou HEIC.`);
  if (!chantierId) throw new Error("Chantier requis.");

  const patronId = await resolvePatronUserId(authUser);
  if (!patronId) throw new Error("Profil patron introuvable — re-connecte-toi.");

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const stamp = Date.now();
  const safeBase = sanitizeName((file.name || "photo").replace(/\.[^.]+$/, ""));
  const path = `${patronId}/${chantierId}/${stamp}_${safeBase}.${ext}`;

  // Upload vers Storage
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (upErr) throw new Error(`Storage upload : ${upErr.message}`);

  // URL publique (bucket public)
  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const publicUrl = urlData?.publicUrl;
  if (!publicUrl) throw new Error("URL publique introuvable après upload.");

  // Enregistre la métadonnée dans chantier_photos
  const { data: row, error: insErr } = await supabase
    .from("chantier_photos")
    .insert({
      user_id: patronId,
      chantier_id: chantierId,
      url: publicUrl,
      storage_path: path,
      created_by: authUser.id,
    })
    .select()
    .single();
  if (insErr) {
    // Best-effort cleanup du fichier orphelin
    supabase.storage.from(BUCKET).remove([path]).catch(() => {});
    throw new Error(`DB insert : ${insErr.message}`);
  }
  return { id: row.id, url: publicUrl, storage_path: path, chantier_id: chantierId };
}

// Liste les photos d'un chantier (les plus récentes d'abord).
export async function listChantierPhotos(chantierId) {
  if (!supabase || !chantierId) return [];
  const { data, error } = await supabase
    .from("chantier_photos")
    .select("id, url, storage_path, chantier_id, created_at, created_by")
    .eq("chantier_id", chantierId)
    .order("created_at", { ascending: false });
  if (error) {
    console.warn("[chantier_photos list]", error.message);
    return [];
  }
  return data || [];
}

// Supprime une photo (DB + Storage). Owner-only via RLS.
export async function deleteChantierPhoto(photo) {
  if (!supabase || !photo?.id) return;
  // DB d'abord (RLS vérifie owner)
  const { error: delErr } = await supabase
    .from("chantier_photos")
    .delete()
    .eq("id", photo.id);
  if (delErr) throw new Error(`DB delete : ${delErr.message}`);
  // Storage ensuite (best-effort — si échec, le row est déjà supprimé,
  // l'orphelin pourra être nettoyé plus tard).
  if (photo.storage_path) {
    await supabase.storage.from(BUCKET).remove([photo.storage_path]).catch(e => {
      console.warn("[chantier_photos storage delete]", e?.message || e);
    });
  }
}
