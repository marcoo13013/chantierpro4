import React from 'react'
import ReactDOM from 'react-dom/client'

// ─── DÉTECTION FLOW INVITATION SUPABASE (avant import App) ─────────────────
// Le client Supabase a detectSessionInUrl: true → il parse window.location.hash
// puis le nettoie. Si on attend le mount de App pour lire le hash, il est
// déjà vide. On capture donc tout de suite le type d'auth flow et on stocke
// sur window pour que App le lise au mount.
try {
  if (typeof window !== 'undefined') {
    const h = window.location.hash || '';
    const q = new URLSearchParams(h.startsWith('#') ? h.slice(1) : h);
    const type = q.get('type'); // 'invite' | 'recovery' | 'signup' | 'magiclink'…
    const access = q.get('access_token');
    if ((type === 'invite' || type === 'recovery') && access) {
      window.__cp_auth_flow__ = { type, accessToken: access };
      console.info('[CP] Auth flow détecté :', type, '→ formulaire mot de passe attendu');
    }
  }
} catch (e) { /* noop */ }

import App from './App.jsx'

// ─── ANTI PULL-TO-REFRESH iOS (défense en profondeur) ──────────────────────
// CSS overscroll-behavior + touch-action ne suffisent pas toujours sur iOS
// Safari (notamment ≤16 ou en mode standalone). On bloque manuellement le
// touchmove quand l'utilisateur tire vers le bas alors que rien n'est
// scrollable au-dessus. On laisse passer tous les gestes légitimes :
// scroll vers le haut, scroll dans un conteneur enfant non au top, multi-touch.
(() => {
  if (typeof window === 'undefined') return;
  // Diagnostic mode d'affichage (PWA standalone vs Safari classique)
  try {
    const isStandalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
      || window.navigator.standalone === true;
    console.info('[CP] display-mode:', isStandalone ? 'standalone (PWA)' : 'browser (Safari)');
  } catch {}
  let startY = 0;
  let startTarget = null;
  window.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    startY = e.touches[0].clientY;
    startTarget = e.target;
  }, { passive: true });
  window.addEventListener('touchmove', (e) => {
    if (e.touches.length !== 1) return;
    const deltaY = e.touches[0].clientY - startY;
    if (deltaY <= 0) return; // mouvement vers le haut → scroll normal
    // Cherche un parent scrollable qui a déjà du scrollTop > 0 → laisse passer
    let el = startTarget;
    while (el && el !== document.body && el !== document.documentElement) {
      const cs = getComputedStyle(el);
      const scrollable = cs.overflowY === 'auto' || cs.overflowY === 'scroll';
      if (scrollable && el.scrollTop > 0) return;
      el = el.parentElement;
    }
    // Body / window au top + l'utilisateur tire vers le bas → on bloque
    if (e.cancelable) e.preventDefault();
  }, { passive: false });
})();

ReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>)
