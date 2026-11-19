// Barattolo di yuzu: si riempie in base al tasso di risparmio del mese (0 % vuoto, 30 % o più pieno).
const FULL = 0.3;
export const jarFill = rate => (rate == null || !isFinite(rate) ? 0 : Math.max(0, Math.min(1, rate / FULL)));

/** SVG inline decorativo (aria-hidden): il testo accessibile sta nel contenitore con role="img". */
export function jarSVG(rate) {
  const f = jarFill(rate), h = 82 * f, y = 134 - h;
  const liquid = f > 0 ? `<g clip-path="url(#jarClip)"><g class="jar-liq"><rect x="14" y="${y}" width="92" height="${h + 4}" fill="url(#jarGrad)"/>
    <path class="jar-wave" d="M-40 ${y}q15-7 30 0t30 0 30 0 30 0 30 0 30 0 30 0 30 0v6h-240z" fill="#ffd45e"/>
    <circle class="jar-b" cx="38" cy="${y + h - 8}" r="4" fill="#fff6c9" opacity=".8"/><circle class="jar-b jar-b2" cx="70" cy="${y + h - 6}" r="3" fill="#fff6c9" opacity=".8"/><circle class="jar-b jar-b3" cx="88" cy="${y + h - 10}" r="2.5" fill="#fff6c9" opacity=".8"/></g></g>` : "";
  return `<svg class="jar-svg" viewBox="0 0 120 150" aria-hidden="true" focusable="false"><defs><clipPath id="jarClip"><path d="M24 48h72a12 12 0 0 1 12 12v66a12 12 0 0 1-12 12H24a12 12 0 0 1-12-12V60a12 12 0 0 1 12-12z"/></clipPath>
    <linearGradient id="jarGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd45e"/><stop offset="1" stop-color="#ffab1f"/></linearGradient></defs>
    <rect class="jar-lid" x="22" y="26" width="76" height="22" rx="9"/><path class="jar-leaf" d="M60 26c3-9 13-11 18-7-5 6-11 8-18 7z" fill="#7cc576"/>
    <path class="jar-glass" d="M24 48h72a12 12 0 0 1 12 12v66a12 12 0 0 1-12 12H24a12 12 0 0 1-12-12V60a12 12 0 0 1 12-12z"/>${liquid}
    <rect x="30" y="86" width="60" height="38" rx="14" fill="#fffdf8" stroke="#a8714a" stroke-width="2"/>
    <circle cx="44" cy="96" r="4.5" fill="#8f5c3a"/><circle cx="76" cy="96" r="4.5" fill="#8f5c3a"/><ellipse cx="60" cy="108" rx="21" ry="14" fill="#a8714a"/><ellipse cx="60" cy="112" rx="12" ry="7" fill="#9c6a45"/>
    <circle cx="51" cy="104" r="2.4" fill="#2b1d16"/><circle cx="69" cy="104" r="2.4" fill="#2b1d16"/><path d="M57 111h6M56 114q4 3 8 0" stroke="#3a261b" stroke-width="1.6" fill="none" stroke-linecap="round"/>
    <ellipse cx="46" cy="110" rx="4" ry="2.5" fill="#ff9fb1" opacity=".8"/><ellipse cx="74" cy="110" rx="4" ry="2.5" fill="#ff9fb1" opacity=".8"/>
    <path class="jar-shine" d="M20 62v40" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".6"/></svg>`;
}
