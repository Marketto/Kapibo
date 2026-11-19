// Kapi, la capibara con lo yuzu in testa. SVG unico, animazioni in css/style.css (.kapi …).
import { list } from "./i18n.js";

export const KAPI_SVG = `
<svg class="kapi" viewBox="0 0 200 200" aria-hidden="true" focusable="false">
  <defs>
    <radialGradient id="kb" cx="50%" cy="38%" r="70%"><stop offset="0" stop-color="#c99263"/><stop offset="1" stop-color="#a8714a"/></radialGradient>
    <radialGradient id="ky" cx="35%" cy="30%" r="70%"><stop offset="0" stop-color="#ffe17a"/><stop offset="1" stop-color="#ffb129"/></radialGradient>
  </defs>
  <ellipse class="k-shadow" cx="100" cy="186" rx="58" ry="8"/>
  <g class="k-body">
    <ellipse cx="62" cy="176" rx="14" ry="9" fill="#8f5c3a"/><ellipse cx="138" cy="176" rx="14" ry="9" fill="#8f5c3a"/>
    <path d="M30 128c0-44 32-74 70-74s70 30 70 74c0 30-22 50-70 50s-70-20-70-50z" fill="url(#kb)"/>
    <ellipse cx="100" cy="148" rx="40" ry="26" fill="#d9a87d" opacity=".7"/>
    <g class="k-head">
      <g class="k-ear k-ear-l"><ellipse cx="62" cy="44" rx="10" ry="8" fill="#8f5c3a"/><ellipse cx="63" cy="45" rx="5" ry="4" fill="#d9918b"/></g>
      <g class="k-ear k-ear-r"><ellipse cx="138" cy="44" rx="10" ry="8" fill="#8f5c3a"/><ellipse cx="137" cy="45" rx="5" ry="4" fill="#d9918b"/></g>
      <path d="M40 88c0-34 24-50 60-50s60 16 60 50c0 30-24 42-60 42s-60-12-60-42z" fill="url(#kb)"/>
      <g class="k-yuzu"><circle cx="100" cy="30" r="16" fill="url(#ky)"/><circle cx="94" cy="24" r="4" fill="#fff6c9" opacity=".8"/>
        <path d="M100 15c4-9 14-10 18-6-5 5-11 7-18 6z" fill="#7cc576"/><path d="M100 16v-5" stroke="#6b4a2e" stroke-width="2.5" stroke-linecap="round"/></g>
      <g class="k-eyes">
        <g class="k-eye"><ellipse cx="70" cy="70" rx="10" ry="12" fill="#2b1d16"/><circle cx="74" cy="65" r="4.2" fill="#fff"/><circle cx="66" cy="75" r="2" fill="#fff"/></g>
        <g class="k-eye"><ellipse cx="130" cy="70" rx="10" ry="12" fill="#2b1d16"/><circle cx="134" cy="65" r="4.2" fill="#fff"/><circle cx="126" cy="75" r="2" fill="#fff"/></g>
      </g>
      <g class="k-closed" stroke="#2b1d16" stroke-width="3.5" stroke-linecap="round" fill="none"><path d="M60 72q10 8 20 0"/><path d="M120 72q10 8 20 0"/></g>
      <ellipse class="k-blush" cx="50" cy="98" rx="9" ry="5.5"/><ellipse class="k-blush" cx="150" cy="98" rx="9" ry="5.5"/>
      <rect x="64" y="86" width="72" height="42" rx="21" fill="#9c6a45"/>
      <rect x="70" y="89" width="60" height="18" rx="9" fill="#ad7a52" opacity=".7"/>
      <path d="M86 98q3-4 6 0M108 98q3-4 6 0" stroke="#3a261b" stroke-width="3.2" fill="none" stroke-linecap="round"/>
      <path class="k-mouth" d="M100 106v6M92 114q8 6 16 0" stroke="#3a261b" stroke-width="2.8" fill="none" stroke-linecap="round"/>
    </g>
  </g>
  <g class="k-fx"><text class="k-heart" x="150" y="40">💗</text><text class="k-heart k-h2" x="30" y="60">✨</text><text class="k-zz" x="150" y="44">z</text></g>
</svg>`;

let el = null, bubble = null, timer = 0;
export function mount(host, bubbleEl, onTap) {
  host.innerHTML = KAPI_SVG; el = host; bubble = bubbleEl;
  host.addEventListener("click", () => (onTap ? onTap() : (mood("happy"), say("kapi.tap"))));
  host.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); host.click(); } });
}
/** Stato d'animo: happy, think, sleep, wow, love (cuoricini), eat (yuzu saltellante), idle. Torna a idle da solo. */
export function mood(m, ms = 1800) {
  if (!el) return;
  el.dataset.mood = m;
  clearTimeout(el._m); if (m !== "idle" && m !== "think") el._m = setTimeout(() => (el.dataset.mood = "idle"), ms);
}
/** Fumetto: chiave con frasi separate da | (ne sceglie una) oppure testo già tradotto con raw. */
export function say(key, { raw = false, ms = 4200 } = {}) {
  if (!bubble) return;
  const opts = raw ? [key] : list(key), txt = opts[Math.floor(Math.random() * opts.length)] || "";
  bubble.textContent = txt; bubble.hidden = !txt; bubble.classList.remove("pop"); void bubble.offsetWidth; bubble.classList.add("pop");
  clearTimeout(timer); timer = setTimeout(() => (bubble.hidden = true), ms);
}
/** Coriandoli kawaii (si spengono con prefers-reduced-motion). */
export function confetti(n = 24) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const box = document.createElement("div"); box.className = "confetti"; box.setAttribute("aria-hidden", "true");
  const e = ["🌸", "💖", "⭐", "🍊", "✨", "💰"];
  for (let i = 0; i < n; i++) { const s = document.createElement("span"); s.textContent = e[i % e.length]; s.style.left = Math.random() * 100 + "%"; s.style.animationDelay = Math.random() * 0.4 + "s"; s.style.setProperty("--dx", (Math.random() * 80 - 40) + "px"); box.appendChild(s); }
  document.body.appendChild(box); setTimeout(() => box.remove(), 2200);
}

/** Scintille al punto di pressione (si spengono con prefers-reduced-motion). */
export function sparkle(x, y, n = 7, parent = document.body) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const box = document.createElement("div"); box.className = "sparkles"; box.setAttribute("aria-hidden", "true"); box.style.cssText = `left:${x}px;top:${y}px`;
  for (let i = 0; i < n; i++) { const s = document.createElement("i"), a = (i / n) * 6.283 + Math.random() * 0.6, d = 26 + Math.random() * 22; s.style.setProperty("--dx", Math.cos(a) * d + "px"); s.style.setProperty("--dy", Math.sin(a) * d + "px"); s.style.setProperty("--h", i % 2 ? "var(--c-yuzu)" : "var(--c-pri)"); box.appendChild(s); }
  parent.appendChild(box); setTimeout(() => box.remove(), 600);
}
