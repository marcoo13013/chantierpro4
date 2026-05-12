// ═══════════════════════════════════════════════════════════════════════════
// numerotation.js — numérotation continue par série (CGI art. 289 / 242 nonies A)
// ═══════════════════════════════════════════════════════════════════════════
// L'administration fiscale française impose une séquence numérique chronologique
// continue sans rupture pour chaque série de documents commerciaux. Les séries
// (devis / factures / acomptes) sont indépendantes : chacune a son compteur.
//
// État stocké sur entreprise.numerotation :
//   {
//     annee_courante: 2026,
//     compteur_devis: 0,
//     compteur_factures: 0,
//     compteur_acomptes: 0
//   }
//
// Format : <PREFIX>-<YYYY>-<NNN> (ex: DEV-2026-001, FAC-2026-001, FA-2026-001).
// Reset annuel : au passage à une nouvelle année, les 3 compteurs repartent
// à 0 (et le 1er document de l'année incrémente à 1).
//
// Documents existants (DEV-94355, FAC-8470, FA-ACOMPTE-2026-001) ne sont PAS
// migrés — leur numéro reste tel quel. Le nouveau système coexiste avec
// l'ancien. La détection se fait par format : si le numéro matche
// /^[A-Z]+-\d{4}-\d{3,}$/ → nouveau format, sinon legacy.
// ═══════════════════════════════════════════════════════════════════════════

const PREFIX = {
  devis: "DEV",
  factures: "FAC",
  acomptes: "FA",
};

const TYPES_VALIDES = Object.keys(PREFIX);

function validerType(type) {
  if (!TYPES_VALIDES.includes(type)) {
    throw new Error(`numerotation: type inconnu "${type}". Valides : ${TYPES_VALIDES.join(", ")}`);
  }
}

// ─── Preview : prochain numéro SANS incrémenter ────────────────────────────
// Utile pour afficher dans l'éditeur le numéro qui sera attribué au save,
// sans modifier le compteur (le compteur n'est incrémenté qu'au save réel
// pour éviter les trous en cas d'abandon de l'éditeur).
export function prochainNumeroDocument(type, entreprise) {
  validerType(type);
  const annee = new Date().getFullYear();
  const num = entreprise?.numerotation || {};
  const compteurKey = `compteur_${type}`;
  const sameYear = num.annee_courante === annee;
  const compteur = (sameYear ? (num[compteurKey] || 0) : 0) + 1;
  return `${PREFIX[type]}-${annee}-${String(compteur).padStart(3, "0")}`;
}

// ─── Génère ET incrémente : retourne {numero, nouveauState} ───────────────
// Le caller DOIT persister nouveauState via setEntreprise(prev => ({...prev,
// numerotation: nouveauState})) — sinon la prochaine génération produira
// le même numéro (doublon).
export function genererNumeroDocument(type, entreprise) {
  validerType(type);
  const annee = new Date().getFullYear();
  const num = entreprise?.numerotation || {};
  const isNouvelleAnnee = num.annee_courante !== annee;
  const compteurKey = `compteur_${type}`;
  const compteur = (isNouvelleAnnee ? 0 : (num[compteurKey] || 0)) + 1;
  const numero = `${PREFIX[type]}-${annee}-${String(compteur).padStart(3, "0")}`;

  // Au passage d'année, reset des 3 compteurs à 0 puis incrément du compteur
  // du type demandé. Sinon, conservation des autres compteurs intacts.
  const nouveauState = isNouvelleAnnee
    ? {
        annee_courante: annee,
        compteur_devis: 0,
        compteur_factures: 0,
        compteur_acomptes: 0,
        [compteurKey]: compteur,
      }
    : { ...num, annee_courante: annee, [compteurKey]: compteur };

  return { numero, nouveauState };
}

// ─── Helper : reconnaît si un numéro est au nouveau format ────────────────
// True pour "DEV-2026-001", "FAC-2026-042", "FA-2026-007".
// False pour "DEV-94355" (slice timestamp), "FAC-8470", "FA-ACOMPTE-2026-001"
// (ancien format compteur ACOMPTE).
export function estNumeroNouveauFormat(numero) {
  if (!numero || typeof numero !== "string") return false;
  return /^(DEV|FAC|FA)-\d{4}-\d{3,}$/.test(numero);
}
