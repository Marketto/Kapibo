// Wizard delle funzioni: al primo avvio tutte, dopo un aggiornamento solo quelle nuove (campo v = versione di arrivo).
// Ogni passo evidenzia un elemento dell'app (sel) dopo aver aperto la sua scheda (tab). Passi senza elemento: saltati.
import { t } from "./i18n.js";

export const STEPS = [
  { id: "welcome", v: "1.0.0" },
  { id: "summary", v: "1.0.0", tab: "month", sel: "main .card .grid2" },
  { id: "add", v: "1.0.0", tab: "month", sel: 'main [data-act="add"]' },
  { id: "meta", v: "1.0.0", tab: "month", sel: 'main [data-act="meta"]' },
  { id: "monthNav", v: "1.0.0", sel: ".month-nav" },
  { id: "scan", v: "1.0.0", tab: "scan", sel: "main .kinds" },
  { id: "usage", v: "1.0.0", sel: '.tabs [data-tab="usage"]' },
  { id: "stats", v: "1.0.0", sel: '.tabs [data-tab="stats"]' },
  { id: "import", v: "1.0.0", tab: "more", sel: 'main [data-act="import"]' },
  { id: "cloud", v: "1.0.0", tab: "more", sel: "#cloud" },
  { id: "kapi", v: "1.1.0", sel: "#kapi" },
  { id: "jar", v: "1.1.0", tab: "month", sel: "main .jar, main [data-tour='jar']" },
  { id: "themes", v: "1.1.0", tab: "more", sel: "main .theme-pick" },
  { id: "stickers", v: "1.1.0", tab: "more", sel: "#stickers" },
  { id: "install", v: "1.1.0", tab: "more", sel: "#install" },
  { id: "costs", v: "1.2.0", tab: "usage", sel: "#costTrend" },
  { id: "trends", v: "1.3.0", tab: "stats", sel: "#trends" },
  { id: "end", v: "1.0.0" },
];
const LS = "kapibo.seen";
export const cmp = (a, b) => { const x = String(a).split(".").map(Number), y = String(b).split(".").map(Number); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); return 0; };
/** Passi da mostrare: tutti se seen è vuoto, altrimenti solo quelli con seen < v ≤ current (senza welcome/end se non ce ne sono altri). */
export function pick(seen, current, steps = STEPS) {
  if (!seen) return steps.filter(s => cmp(s.v, current) <= 0);
  const news = steps.filter(s => cmp(s.v, seen) > 0 && cmp(s.v, current) <= 0 && s.id !== "welcome" && s.id !== "end");
  return news.length ? [{ id: "news" }, ...news, { id: "end" }] : [];
}
export const seen = () => { try { return localStorage.getItem(LS) || ""; } catch { return ""; } };
export const markSeen = v => { try { localStorage.setItem(LS, v); } catch {} };

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
/** Avvia il wizard. go(tab) cambia scheda; kapiSvg è il disegno della mascotte. */
export function run(steps, { go, kapiSvg, onEnd } = {}) {
  if (!steps.length) return;
  const box = document.createElement("div"); box.className = "tour"; box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true"); box.setAttribute("aria-labelledby", "tourT");
  box.innerHTML = `<div class="tour-hole" aria-hidden="true"></div><div class="tour-card"><div class="tour-kapi" aria-hidden="true">${kapiSvg || ""}</div>
    <h2 id="tourT"></h2><p id="tourP"></p><div class="tour-dots" aria-hidden="true"></div><p class="sr" id="tourN" aria-live="polite"></p>
    <div class="btns"><button class="btn ghost small" data-t="skip"></button><button class="btn soft small" data-t="prev"></button><button class="btn small" data-t="next"></button></div></div>`;
  document.body.appendChild(box);
  const hole = box.querySelector(".tour-hole"), card = box.querySelector(".tour-card");
  let i = 0, prevFocus = document.activeElement;
  const visible = steps;
  async function show(dir = 1) {
    let s = visible[i];
    if (s.tab) go?.(s.tab);
    await new Promise(r => setTimeout(r, s.tab ? 260 : 40));
    const el = s.sel && document.querySelector(s.sel);
    if (s.sel && !el) { i += dir; if (i < 0) i = 0; if (i >= visible.length) return end(); return show(dir); }
    box.querySelector("#tourT").textContent = t(`tour.${s.id}.t`);
    box.querySelector("#tourP").textContent = t(`tour.${s.id}.p`);
    box.querySelector("#tourN").textContent = t("tour.step", { i: i + 1, n: visible.length });
    box.querySelector(".tour-dots").innerHTML = visible.map((_, k) => `<i class="${k === i ? "on" : ""}"></i>`).join("");
    box.querySelector('[data-t="prev"]').hidden = i === 0;
    box.querySelector('[data-t="skip"]').hidden = i === visible.length - 1;
    box.querySelector('[data-t="next"]').textContent = t(i === visible.length - 1 ? "tour.done" : "tour.next");
    box.querySelector('[data-t="prev"]').textContent = t("tour.prev");
    box.querySelector('[data-t="skip"]').textContent = t("tour.skip");
    if (el) {
      el.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      await new Promise(r => setTimeout(r, 320));
      const r = el.getBoundingClientRect(), pad = 8;
      Object.assign(hole.style, { display: "block", left: r.left - pad + "px", top: r.top - pad + "px", width: r.width + pad * 2 + "px", height: r.height + pad * 2 + "px" });
      const below = r.bottom + 230 < innerHeight;
      card.style.top = below ? Math.min(innerHeight - 220, r.bottom + 16) + "px" : ""; card.style.bottom = below ? "" : Math.max(16, innerHeight - r.top + 16) + "px";
      if (!below && innerHeight - r.top + 16 > innerHeight - 220) { card.style.bottom = ""; card.style.top = "16px"; }
      box.classList.add("spot");
    } else { hole.style.display = "none"; card.style.top = ""; card.style.bottom = ""; box.classList.remove("spot"); }
    card.classList.remove("pop"); void card.offsetWidth; card.classList.add("pop");
    box.querySelector('[data-t="next"]').focus();
  }
  function end() { box.remove(); removeEventListener("keydown", key, true); removeEventListener("resize", re); prevFocus?.focus?.(); onEnd?.(); }
  function key(e) {
    if (e.key === "Escape") { e.preventDefault(); end(); }
    if (e.key === "Tab") { const f = [...card.querySelectorAll("button:not([hidden])")]; const a = f.indexOf(document.activeElement); e.preventDefault(); f[(a + (e.shiftKey ? f.length - 1 : 1)) % f.length].focus(); }
  }
  const re = () => show(0);
  box.addEventListener("click", e => {
    const b = e.target.closest("[data-t]"); if (!b) return;
    if (b.dataset.t === "skip") return end();
    if (b.dataset.t === "prev") { i = Math.max(0, i - 1); return show(-1); }
    if (++i >= visible.length) return end(); show(1);
  });
  addEventListener("keydown", key, true); addEventListener("resize", re);
  show(1);
}
