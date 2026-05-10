// ═══════════════════════════════════════════════════════════════════════════
// facturx-node-stubs.js — stubs Node-only pour le bundle browser
// ═══════════════════════════════════════════════════════════════════════════
// La lib @stackforge-eu/factur-x importe statiquement node:fs / path / url /
// console / module pour sa fonction validateXsd() (chargement de schémas XSD
// depuis le filesystem). Côté browser, on désactive validateXsd (cf
// src/lib/facturx/index.js → validateXsd: false), donc ces imports ne sont
// JAMAIS exécutés à runtime. Mais Vite analyse statiquement le bundle et
// plante.
//
// Solution : alias dans vite.config.js → ce fichier exporte tout ce dont
// le bundle a besoin pour passer le static analysis. Si jamais une fonction
// est appelée, on jette une erreur claire pour signaler le bug.
// ═══════════════════════════════════════════════════════════════════════════

const noop = () => { throw new Error("Node API non disponible côté browser. Ne pas activer validateXsd dans le bundle web."); };

// node:fs
export const existsSync = noop;
export const statSync = noop;
export const readFileSync = noop;
export const readdirSync = noop;
export const promises = { readFile: noop, stat: noop, readdir: noop };

// node:path
export const join = (...parts) => parts.filter(Boolean).join("/");
export const dirname = (p) => { const s = String(p || ""); const i = s.lastIndexOf("/"); return i > 0 ? s.slice(0, i) : s; };
export const basename = (p) => { const s = String(p || ""); const i = s.lastIndexOf("/"); return i >= 0 ? s.slice(i + 1) : s; };
export const resolve = (...parts) => parts.filter(Boolean).join("/");
export const sep = "/";
export const extname = (p) => { const s = String(p || ""); const i = s.lastIndexOf("."); return i > 0 ? s.slice(i) : ""; };

// node:url
export const fileURLToPath = (u) => String(u || "").replace(/^file:\/\//, "");
export const pathToFileURL = (p) => new URL("file://" + String(p || ""));
export class URL extends globalThis.URL {}

// node:console — la lib factur-x fait `import console from 'console'`
// (qui re-pointe sur globalThis.console). On expose le console global.
export default globalThis.console;

// node:module
export const createRequire = () => () => { throw new Error("require() non disponible côté browser"); };
