// Stato dell'app: schema, salvataggio locale (IndexedDB), unione con la copia nel cloud, calcoli del mese.
import { DEFAULT_CATS, norm } from "./categories.js";
import { round2 } from "./money.js";

export const SCHEMA = 1;
const COLL = ["cats", "entries", "meters", "readings", "bills", "offers"]; // array di record {id,u,del}
const MAPS = ["months", "rules"];                                         // oggetti chiave → record {u}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
export const now = () => Date.now();
export const monthOf = d => String(d).slice(0, 7);
export const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);

export function emptyState() {
  return {
    schema: SCHEMA, settings: { currency: "EUR", voucher: 8, u: 0 },
    cats: [], entries: [], meters: [], readings: [], bills: [], offers: [], months: {}, rules: {},
  };
}

/** Riempie i campi mancanti e applica le migrazioni. */
export function normalize(s) {
  const e = emptyState();
  if (!s || typeof s !== "object") return e;
  const out = { ...e, ...s, settings: { ...e.settings, ...(s.settings || {}) } };
  for (const k of COLL) out[k] = Array.isArray(s[k]) ? s[k].filter(r => r && r.id) : [];
  for (const k of MAPS) out[k] = s[k] && typeof s[k] === "object" ? s[k] : {};
  out.schema = SCHEMA;
  return out;
}

/** Unione di due copie (locale e cloud): per ogni record vince la modifica più recente. */
export function merge(a, b) {
  a = normalize(a); b = normalize(b);
  const out = emptyState();
  out.settings = (b.settings.u || 0) > (a.settings.u || 0) ? b.settings : a.settings;
  for (const k of COLL) {
    const m = new Map();
    for (const r of [...a[k], ...b[k]]) { const o = m.get(r.id); if (!o || (r.u || 0) > (o.u || 0)) m.set(r.id, r); }
    out[k] = [...m.values()];
  }
  for (const k of MAPS) {
    out[k] = { ...a[k] };
    for (const [key, r] of Object.entries(b[k])) if (!out[k][key] || (r.u || 0) > (out[k][key].u || 0)) out[k][key] = r;
  }
  return out;
}

export const live = arr => arr.filter(r => !r.del);
/** Firma per capire se due stati sono uguali (evita caricamenti inutili). */
export const sig = s => JSON.stringify(s).length + ":" + [...COLL, ...MAPS].map(k => Object.values(s[k] || {}).reduce((m, r) => Math.max(m, r.u || 0), 0)).join(",");

// ---------- IndexedDB minimale ----------
const DB = "kapibo", OS = "kv";
function db() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(OS);
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
export async function idbGet(k) {
  try { const d = await db(); return await new Promise((res, rej) => { const q = d.transaction(OS).objectStore(OS).get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); }
  catch { try { return JSON.parse(localStorage.getItem("kapibo." + k)); } catch { return null; } }
}
export async function idbSet(k, v) {
  try { const d = await db(); await new Promise((res, rej) => { const tx = d.transaction(OS, "readwrite"); tx.objectStore(OS).put(v, k); tx.oncomplete = res; tx.onerror = () => rej(tx.error); }); }
  catch { try { localStorage.setItem("kapibo." + k, JSON.stringify(v)); } catch {} }
}

// ---------- store con eventi ----------
export function createStore(initial) {
  let state = normalize(initial);
  const subs = new Set();
  const api = {
    get: () => state,
    set(next, { silent } = {}) { state = normalize(next); if (!silent) subs.forEach(f => f(state)); return state; },
    on: f => (subs.add(f), () => subs.delete(f)),
    /** Inserisce o aggiorna un record in una collezione. */
    put(coll, rec) {
      const r = { ...rec, id: rec.id || uid(), u: now() };
      const arr = state[coll].filter(x => x.id !== r.id); arr.push(r);
      api.set({ ...state, [coll]: arr }); return r;
    },
    putMany(coll, recs) {
      const t = now(), ids = new Set(), add = recs.map((r, i) => { const x = { ...r, id: r.id || uid(), u: t + i }; ids.add(x.id); return x; });
      api.set({ ...state, [coll]: [...state[coll].filter(x => !ids.has(x.id)), ...add] }); return add;
    },
    remove(coll, id) { const r = state[coll].find(x => x.id === id); if (r) api.put(coll, { ...r, del: 1 }); },
    setMonth(m, patch) { api.set({ ...state, months: { ...state.months, [m]: { ...(state.months[m] || {}), ...patch, u: now() } } }); },
    setSettings(patch) { api.set({ ...state, settings: { ...state.settings, ...patch, u: now() } }); },
    /** Impara la categoria scelta dall'utente per un nome. */
    learn(name, cats) {
      const n = norm(name); if (!n || !cats?.length) return;
      api.set({ ...state, rules: { ...state.rules, [n]: { cats, u: now() } } }, { silent: true });
    },
    rulesMap() { const o = {}; for (const [k, r] of Object.entries(state.rules)) if (!r.del) o[k] = r.cats; return o; },
    cats() {
      const custom = new Map(state.cats.map(c => [c.id, c]));
      const list = DEFAULT_CATS.map(c => ({ ...c, ...(custom.get(c.id) || {}) }));
      for (const c of state.cats) if (!DEFAULT_CATS.some(d => d.id === c.id)) list.push(c);
      return list.filter(c => !c.del && !c.hidden);
    },
  };
  return api;
}

// ---------- calcoli ----------
const prevMonth = m => { const [y, mo] = m.split("-").map(Number); const d = new Date(y, mo - 2, 1); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); };
export const nextMonth = m => { const [y, mo] = m.split("-").map(Number); const d = new Date(y, mo, 1); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); };
export { prevMonth };

/** Riepilogo di un mese. */
export function monthSummary(s, m) {
  const meta = s.months[m] || {};
  const byCat = {};
  let tracked = 0;
  for (const e of s.entries) if (!e.del && e.m === m) { byCat[e.cat] = round2((byCat[e.cat] || 0) + e.amt); tracked += e.amt; }
  const num = v => (typeof v === "number" && isFinite(v) ? v : null);
  const start = num(meta.start) ?? num(s.months[prevMonth(m)]?.end);
  const end = num(meta.end) ?? num(s.months[nextMonth(m)]?.start);
  const salary = num(meta.salary) || 0, extra = num(meta.extra) || 0, refunds = num(meta.refunds) || 0;
  const vIn = num(meta.vIn) || 0, vUsed = num(meta.vUsed) || 0;
  const income = round2(salary + extra + refunds);
  // spesa reale dal conto: quanto è uscito davvero (saldo iniziale + entrate − saldo finale)
  const effective = start != null && end != null ? round2(start + income - end) : null;
  const savings = start != null && end != null ? round2(end - start) : income > 0 ? round2(income - tracked + vUsed) : null;
  // spese pagate con i buoni non escono dal conto: si aggiungono prima del confronto
  const untracked = effective != null ? round2(effective + vUsed - tracked) : null;
  return { m, meta, byCat, tracked: round2(tracked), start, end, salary, extra, refunds, income, vIn, vUsed, effective, savings, untracked,
    rate: income > 0 && savings != null ? savings / income : null };
}

export function monthsWithData(s) {
  const set = new Set(Object.keys(s.months).filter(k => !s.months[k].del));
  for (const e of s.entries) if (!e.del) set.add(e.m);
  return [...set].filter(Boolean).sort();
}
