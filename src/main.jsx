import React from 'react'
import ReactDOM from 'react-dom/client'
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
