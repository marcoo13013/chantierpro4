// ═══════════════════════════════════════════════════════════════════════════
// Packs métier de la Bibliothèque BTP — ChantierPro
// ═══════════════════════════════════════════════════════════════════════════
// 13 packs activables/désactivables depuis Paramètres > Bibliothèque.
// Chaque ouvrage du catalogue porte un champ `corps_metier` qui matche un
// des packs ci-dessous. Le filtre dans VueBibliotheque + BibliothequeSearchModal
// vérifie que `corps_metier ∈ entreprise.packsActifs`.
// ═══════════════════════════════════════════════════════════════════════════

export const PACKS_META = {
  maconnerie:           {label:"Maçonnerie",            icon:"🧱", couleur:"#92400E"},
  charpente_couverture: {label:"Charpente / Couverture", icon:"🏠", couleur:"#7C2D12"},
  etancheite_isolation: {label:"Étanchéité / Isolation", icon:"🧊", couleur:"#15803D"},
  plomberie:            {label:"Plomberie",              icon:"🚿", couleur:"#0369A1"},
  chauffage_clim:       {label:"Chauffage / Clim",       icon:"🔥", couleur:"#B45309"},
  electricite:          {label:"Électricité",            icon:"⚡", couleur:"#EA580C"},
  platrerie:            {label:"Plâtrerie",              icon:"🪜", couleur:"#A78BFA"},
  menuiserie_int:       {label:"Menuiserie intérieure",  icon:"🚪", couleur:"#854D0E"},
  menuiserie_ext:       {label:"Menuiserie extérieure",  icon:"🪟", couleur:"#0F766E"},
  carrelage:            {label:"Carrelage / Faïence",    icon:"🟫", couleur:"#65A30D"},
  peinture:             {label:"Peinture",               icon:"🎨", couleur:"#EC4899"},
  sols_souples:         {label:"Sols souples",           icon:"📐", couleur:"#6366F1"},
  demolition_vrd:       {label:"Démolition / VRD",       icon:"⛏",  couleur:"#DC2626"},
};

export const PACKS_ORDER = [
  "maconnerie","charpente_couverture","etancheite_isolation",
  "plomberie","chauffage_clim","electricite","platrerie",
  "menuiserie_int","menuiserie_ext","carrelage","peinture",
  "sols_souples","demolition_vrd",
];

// Map code-prefix → pack métier. Sert à tagger les ouvrages legacy
// (BIBLIOTHEQUE_BTP) qui n'ont pas encore de champ corps_metier explicite.
// L'inférence se fait par défaut via le préfixe ; les overrides per-libellé
// (ex MEN qui mélange int/ext) sont gérés dans inferPackFromOuvrage().
export const CODE_PREFIX_TO_PACK = {
  MAC: "maconnerie",
  CHC: "charpente_couverture",
  EIS: "etancheite_isolation",
  ETA: "etancheite_isolation",
  ISO: "etancheite_isolation",
  PLO: "plomberie",
  CHF: "chauffage_clim",
  CLI: "chauffage_clim",
  ELE: "electricite",
  PLA: "platrerie",
  MIN: "menuiserie_int",
  MEX: "menuiserie_ext",
  CAR: "carrelage",
  PEI: "peinture",
  SOL: "sols_souples",
  DVR: "demolition_vrd",
  DEM: "demolition_vrd",
  VRD: "demolition_vrd",
};

// Heuristique pour les MEN-XXX legacy (mélangent int/ext). Mots-clés sur le
// libellé pour décider. Tout ce qui n'est pas explicitement extérieur est
// considéré intérieur par défaut.
function isMenuiserieExt(libelle){
  const l=(libelle||"").toLowerCase();
  return /(fenêtre|porte d'entrée|volet|bardage|charpente|terrasse|portail|garage|baie|véranda|pergola|store)/.test(l);
}

export function inferPackFromOuvrage(o){
  if(!o)return null;
  // 1. Si déjà un corps_metier défini, on respecte
  if(o.corps_metier&&PACKS_META[o.corps_metier])return o.corps_metier;
  // 2. Préfixe du code
  const code=String(o.code||"");
  const m=code.match(/^([A-Z]+)-/);
  if(m){
    const prefix=m[1];
    // Cas spécial MEN : on désambiguïse via le libellé
    if(prefix==="MEN")return isMenuiserieExt(o.libelle)?"menuiserie_ext":"menuiserie_int";
    if(CODE_PREFIX_TO_PACK[prefix])return CODE_PREFIX_TO_PACK[prefix];
  }
  // 3. Fallback : matching loose sur le champ corps (fr)
  const c=(o.corps||"").toLowerCase();
  if(c.includes("maço"))return"maconnerie";
  if(c.includes("plomb"))return"plomberie";
  if(c.includes("élec")||c.includes("elec"))return"electricite";
  if(c.includes("isol"))return"etancheite_isolation";
  if(c.includes("étan")||c.includes("etan"))return"etancheite_isolation";
  if(c.includes("carr"))return"carrelage";
  if(c.includes("peint"))return"peinture";
  if(c.includes("démol")||c.includes("demol"))return"demolition_vrd";
  if(c.includes("plâtr")||c.includes("platr"))return"platrerie";
  if(c.includes("char")||c.includes("couv"))return"charpente_couverture";
  if(c.includes("chauf")||c.includes("clim"))return"chauffage_clim";
  if(c.includes("menui"))return isMenuiserieExt(o.libelle)?"menuiserie_ext":"menuiserie_int";
  if(c.includes("sol"))return"sols_souples";
  if(c.includes("vrd")||c.includes("terrass"))return"demolition_vrd";
  return"maconnerie"; // bucket par défaut
}

// Tagge un array d'ouvrages avec leur corps_metier inféré. Idempotent (ne
// touche pas si déjà taggé).
export function taggerOuvrages(ouvrages){
  return (ouvrages||[]).map(o=>o.corps_metier?o:{...o,corps_metier:inferPackFromOuvrage(o)});
}

// Default : tous les packs activés. Persisté dans entreprise.packsActifs.
export const DEFAULT_PACKS_ACTIFS=Object.keys(PACKS_META);

// Filtre un array d'ouvrages selon les packs actifs.
export function filterOuvragesByPacks(ouvrages,packsActifs){
  if(!Array.isArray(packsActifs)||packsActifs.length===0)return ouvrages||[];
  const set=new Set(packsActifs);
  return (ouvrages||[]).filter(o=>set.has(o.corps_metier||inferPackFromOuvrage(o)));
}
