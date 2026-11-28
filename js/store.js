// Stato dell'app: schema, salvataggio locale (IndexedDB), unione con la copia nel cloud, calcoli del mese.
import { DEFAULT_CATS, norm } from "./categories.js";
import { round2 } from "./money.js";

export const SCHEMA = 2;
const COLL = ["cats", "entries", "incomes", "meters", "readings", "bills", "offers"]; // array di record {id,u,del}
const MAPS = ["months", "rules"];                                         // oggetti chiave → record {u}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
export const now = () => Date.now();
export const monthOf = d => String(d).slice(0, 7);
export const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);

export function emptyState() {
  return {
    schema: SCHEMA, settings: { currency: "EUR", voucher: 8, u: 0 },
    cats: [], entries: [], incomes: [], meters: [], readings: [], bills: [], offers: [], months: {}, rules: {},
  };
}

/** Riempie i campi mancanti e applica le migrazioni. */
export function normalize(s) {
  const e = emptyState();
  if (!s || typeof s !== "object") return e;
  const out = { ...e, ...s, settings: { ...e.settings, ...(s.settings || {}) } };
  for (const k of COLL) out[k] = Array.isArray(s[k]) ? s[k].filter(r => r && r.id) : [];
  for (const k of MAPS) out[k] = s[k] && typeof s[k] === "object" ? s[k] : {};
  migrateIncomes(out);
  out.schema = SCHEMA;
  return out;
}

/** Tipi di entrata (raccolta incomes, record {id,m,d,k,amt,note,src}); vUsed = buoni pasto spesi. Il saldo iniziale
 *  resta nel mese (months[m].start): è un saldo, non una somma. */
export const INC_KINDS = ["salary", "extra", "refunds", "vIn", "vUsed"];
/** Schema 1 → 2: i campi del mese (stipendio, extra, rimborsi, buoni) diventano entrate con id fisso "mig-<mese>-<tipo>",
 *  così due dispositivi che migrano lo stesso mese non creano doppioni; una modifica più recente dell'entrata vince. */
function migrateIncomes(out) {
  const byId = new Map(out.incomes.map(r => [r.id, r]));
  for (const [m, meta] of Object.entries(out.months)) {
    if (!meta || !INC_KINDS.some(k => k in meta)) continue;
    const rest = { ...meta };
    for (const k of INC_KINDS) {
      if (!(k in rest)) continue;
      const v = rest[k]; delete rest[k];
      if (typeof v !== "number" || !isFinite(v) || !v || meta.del) continue;
      const id = "mig-" + m + "-" + k, old = byId.get(id);
      if (old && (old.u || 0) >= (meta.u || 0)) continue;
      const r = { id, m, d: m + "-01", k, amt: v, src: "migr", u: meta.u || 0 };
      byId.set(id, r);
    }
    out.months[m] = rest;
  }
  out.incomes = [...byId.values()];
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

/** Totali del mese per tipo di entrata (più gli eventuali campi vecchi non ancora migrati). */
export function incomeTotals(s, m) {
  const meta = s.months?.[m] || {}, o = {};
  for (const k of INC_KINDS) o[k] = typeof meta[k] === "number" && isFinite(meta[k]) ? meta[k] : 0;
  for (const r of s.incomes || []) if (!r.del && r.m === m && o[r.k] != null) o[r.k] += r.amt;
  for (const k of INC_KINDS) o[k] = round2(o[k]);
  return o;
}

/** Riepilogo di un mese. */
export function monthSummary(s, m) {
  const meta = s.months[m] || {};
  const byCat = {};
  let tracked = 0;
  for (const e of s.entries) if (!e.del && e.m === m) { byCat[e.cat] = round2((byCat[e.cat] || 0) + e.amt); tracked += e.amt; }
  const num = v => (typeof v === "number" && isFinite(v) ? v : null);
  const start = num(meta.start) ?? num(s.months[prevMonth(m)]?.end);
  const end = num(meta.end) ?? num(s.months[nextMonth(m)]?.start);
  const inc = incomeTotals(s, m);
  const { salary, extra, refunds, vIn, vUsed } = inc;
  const income = round2(salary + extra + refunds);
  // spesa reale dal conto: quanto è uscito davvero (saldo iniziale + entrate − saldo finale)
  const effective = start != null && end != null ? round2(start + income - end) : null;
  const savings = start != null && end != null ? round2(end - start) : income > 0 ? round2(income - tracked + vUsed) : null;
  // spese pagate con i buoni non escono dal conto: si aggiungono prima del confronto
  const untracked = effective != null ? round2(effective + vUsed - tracked) : null;
  return { m, meta, byCat, inc, tracked: round2(tracked), start, end, salary, extra, refunds, income, vIn, vUsed, effective, savings, untracked,
    rate: income > 0 && savings != null ? savings / income : null };
}

export function monthsWithData(s) {
  const set = new Set(Object.keys(s.months).filter(k => !s.months[k].del));
  for (const e of s.entries) if (!e.del) set.add(e.m);
  for (const e of s.incomes || []) if (!e.del) set.add(e.m);
  return [...set].filter(Boolean).sort();
}
