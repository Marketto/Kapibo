// Kapi commenta le azioni: frasi da locale `kapi.ev.<evento>` (separate da |), mai la stessa due volte di fila.
// Parti pure (streak, traguardi) senza DOM: testate in tests/cheer.test.mjs.
import { t, has, list } from "./i18n.js";
import * as kapi from "./mascot.js";
import { KAPI_SVG } from "./mascot.js";

export const MILESTONES = [10, 50, 100, 250, 500, 1000];
const DAY = 864e5, ymd = d => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));

/** Giorni consecutivi con almeno una voce, che finiscono oggi. */
export function streakOf(dates, todayStr) {
  const set = new Set(dates.map(d => ymd(String(d)))); let day = ymd(todayStr), n = 0;
  if (!set.has(day)) return 0;
  while (set.has(day)) { n++; day -= DAY; }
  return n;
}
/** Il traguardo più alto superato passando da `before` a `after` voci (null se nessuno). */
export const milestoneCrossed = (before, after) => MILESTONES.filter(m => before < m && after >= m).pop() ?? null;

const MOOD = { receipt: "wow", receiptBig: "happy", payslip: "wow", import: "wow", milestone: "wow", streak: "wow", saveUp: "love", sticker: "love", sync: "happy", "add.food": "eat", saveDown: "idle", delete: "idle", idle: "sleep", wake: "wow", morning: "happy", afternoon: "happy", evening: "happy", night: "sleep", tap: "happy" };
const last = {}, seenTabs = new Set();
let lastAt = 0, asleep = false, idleT = 0;
const pick = (ev, arr) => { let s; do s = arr[Math.floor(Math.random() * arr.length)]; while (arr.length > 1 && s === last[ev]); return (last[ev] = s); };

/** Frase scelta (senza mostrarla), con {variabili} sostituite. */
export function phrase(event, vars = {}) {
  const arr = list("kapi.ev." + event); if (!arr.length) return "";
  return pick(event, arr).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
}
/** Kapi commenta. `big`: salta il limite di 2,5 s e appare anche Kapi amica. */
export function cheer(event, vars = {}, { big = false } = {}) {
  const now = Date.now(); if (!big && now - lastAt < 2500) return false;
  const txt = phrase(event, vars); if (!txt) return false;
  lastAt = now; asleep = false;
  kapi.mood(MOOD[event] || "happy");
  if (big && friend.ok()) friend.show(txt); else kapi.say(txt, { raw: true });
  return true;
}
/** Evento di una nuova spesa: per categoria se esiste, altrimenti generico. */
export const addEvent = cat => (has("kapi.ev.add." + cat) ? "add." + cat : "add");
export const cheerTab = tab => { if (seenTabs.has(tab)) return; seenTabs.add(tab); cheer("tab." + tab); };
export const greet = (big = false) => { const h = new Date().getHours(); return cheer(h < 5 ? "night" : h < 12 ? "morning" : h < 18 ? "afternoon" : h < 23 ? "evening" : "night", {}, { big }); };
export const tap = () => { kapi.mood("happy"); kapi.say(phrase("tap"), { raw: true }); lastAt = Date.now(); };

/** Dopo 45 s senza interazioni Kapi si addormenta; qualsiasi gesto la sveglia. */
export function watchIdle(ms = 45000) {
  const arm = () => { clearTimeout(idleT); idleT = setTimeout(() => { asleep = true; kapi.mood("sleep", 36e5); kapi.say(phrase("idle"), { raw: true, ms: 6000 }); }, ms); };
  const act = () => { if (asleep) { asleep = false; kapi.mood("wow"); kapi.say(phrase("wake"), { raw: true, ms: 3000 }); lastAt = Date.now(); } arm(); };
  for (const ev of ["pointerdown", "keydown", "scroll", "touchstart"]) addEventListener(ev, act, { passive: true });
  arm();
}

// ---------- Kapi amica: appare dall'angolo in basso con il suo fumetto per i momenti speciali ----------
export const friend = (() => {
  let box, bub, live, timer = 0, busy = false; const queue = [];
  const hide = () => { clearTimeout(timer); box.dataset.show = "0"; setTimeout(next, 700); };
  const next = () => { busy = false; if (queue.length) show(queue.shift()); };
  function show(txt) {
    if (busy) { if (queue.length < 3) queue.push(txt); return; }
    busy = true; bub.textContent = txt; live.textContent = ""; box.dataset.show = "1";
    setTimeout(() => (live.textContent = txt), 50); timer = setTimeout(hide, 3500);
  }
  function mount(host = document.body) {
    if (box) return;
    box = document.createElement("div"); box.className = "kfriend"; box.dataset.show = "0";
    box.innerHTML = `<p class="kf-bubble" aria-hidden="true"></p><span class="sr" role="status" aria-live="polite"></span><button type="button" class="kf-btn" aria-label="${t("kapi.friend").replace(/"/g, "&quot;")}">${KAPI_SVG}</button>`;
    bub = box.querySelector(".kf-bubble"); live = box.querySelector("[role=status]");
    box.querySelector("button").addEventListener("click", () => busy && hide());
    host.appendChild(box);
  }
  return { mount, show, ok: () => !!box, label: () => box && box.querySelector("button").setAttribute("aria-label", t("kapi.friend")) };
})();
