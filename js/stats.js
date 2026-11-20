// Statistiche e consigli di risparmio (regole semplici, tutto in locale).
import { monthSummary, monthsWithData, prevMonth, live } from "./store.js";
import { round2 } from "./money.js";
import { norm } from "./categories.js";

export function series(s, lastN = 12, upTo) {
  let ms = monthsWithData(s);
  if (upTo) ms = ms.filter(m => m <= upTo);
  return ms.slice(-lastN).map(m => monthSummary(s, m));
}

/** Media per categoria sui mesi indicati (esclude il mese corrente). */
export function catAverages(list) {
  const tot = {}, n = list.length || 1;
  for (const x of list) for (const [c, v] of Object.entries(x.byCat)) tot[c] = (tot[c] || 0) + v;
  for (const c in tot) tot[c] = round2(tot[c] / n);
  return tot;
}

/** Consumi mensili per contatore (differenza tra letture consecutive). */
export function usage(s, meterId) {
  const rs = live(s.readings).filter(r => r.meter === meterId).sort((a, b) => (a.d < b.d ? -1 : 1));
  const out = [];
  for (let i = 1; i < rs.length; i++) { const d = rs[i].value - rs[i - 1].value; if (d >= 0) out.push({ m: rs[i].m, d: rs[i].d, use: round2(d) }); }
  return out;
}

const FREQ = { m: 1, "2m": 2, q: 3, "6m": 6, y: 12 };
export const monthDiff = (a, b) => (+b.slice(0, 4) - +a.slice(0, 4)) * 12 + (+b.slice(5, 7) - +a.slice(5, 7));

/** Consumo medio mensile dai contatori di un tipo (ultimi 12 mesi), o null. */
export function meterMonthly(s, kind) {
  let tot = 0, n = 0;
  for (const mt of live(s.meters).filter(m => m.kind === kind)) { const u = usage(s, mt.id).slice(-12); if (u.length) { tot += u.reduce((a, x) => a + x.use, 0) / u.length; n++; } }
  return n ? tot : null;
}

/** Bollette di un tipo con i mesi che coprono: frequenza indicata, altrimenti distanza dalla bolletta precedente,
 *  e per la prima stima dal consumo medio dei contatori. */
export function billMonths(s, kind) {
  const bs = live(s.bills).filter(b => b.kind === kind && b.amount > 0).sort((a, b) => (a.m < b.m ? -1 : 1));
  const mUse = meterMonthly(s, kind);
  // la distanza si misura tra bollette della stessa fornitura (es. «Luce» e «Luce cantina» sono serie diverse)
  const prev = {};
  return bs.map(b => {
    const key = norm(b.name || b.kind), p = prev[key]; prev[key] = b;
    const k = b.freq && b.freq !== "m" ? FREQ[b.freq] : p ? monthDiff(p.m, b.m) : b.cons > 0 && mUse ? Math.round(b.cons / mUse) : FREQ[b.freq] || 1;
    return { ...b, months: Math.min(24, Math.max(1, k || 1)) };
  });
}

/** Prezzo unitario medio pagato e stima annua, dalle bollette con consumo degli ultimi ~12 mesi. */
export function unitPrice(s, kind) {
  const bs = billMonths(s, kind).filter(b => b.cons > 0), take = [];
  let months = 0;
  for (let i = bs.length - 1; i >= 0 && months < 12; i--) { take.push(bs[i]); months += bs[i].months; }
  if (!take.length) return null;
  const a = take.reduce((x, b) => x + b.amount, 0), c = take.reduce((x, b) => x + b.cons, 0);
  return { price: a / c, yearCons: (c / months) * 12, yearCost: (a / months) * 12 };
}

/** Spesa mensile stimata per tipo: ogni bolletta è distribuita sui mesi che copre. */
export function billCostByMonth(s, kind, monthsList) {
  const out = Object.fromEntries(monthsList.map(m => [m, 0]));
  for (const b of billMonths(s, kind)) for (const m of monthsList) { const d = monthDiff(m, b.m); if (d >= 0 && d < b.months) out[m] += b.amount / b.months; }
  return monthsList.map(m => round2(out[m]));
}

// ---------- andamento: ultimi N mesi rispetto agli N precedenti ----------
export const TREND_WINDOWS = [3, 6, 9, 12];
const back = (m, n) => { for (let i = 0; i < n; i++) m = prevMonth(m); return m; };
/** Ultimo mese "completo" da analizzare: il mese scelto, ma se è quello in corso si usa il precedente. */
export const trendEnd = (cur, thisMonth) => (cur >= thisMonth ? prevMonth(thisMonth) : cur);
const monthsBetween = (from, to) => { const out = []; for (let m = from; m <= to; m = nextOf(m)) out.push(m); return out; };
const nextOf = m => { const [y, mo] = m.split("-").map(Number); const d = new Date(y, mo, 1); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); };

/** Spesa media mensile per categoria nei due periodi; solo se ci sono dati in entrambi. */
export function catTrends(s, end, n) {
  const recent = monthsBetween(back(end, n - 1), end), prev = monthsBetween(back(end, 2 * n - 1), back(end, n));
  const have = new Set(live(s.entries).map(e => e.m));
  if (prev.filter(m => have.has(m)).length < Math.ceil(n / 2) || recent.filter(m => have.has(m)).length < Math.ceil(n / 2)) return null;
  const sum = (ms, c) => live(s.entries).filter(e => ms.includes(e.m) && (!c || e.cat === c)).reduce((a, e) => a + e.amt, 0);
  const cats = [...new Set(live(s.entries).filter(e => recent.includes(e.m) || prev.includes(e.m)).map(e => e.cat))];
  const rows = cats.map(c => {
    const now = round2(sum(recent, c) / n), before = round2(sum(prev, c) / n);
    return { cat: c, now, before, diff: round2(now - before), pct: before > 0 ? Math.round((now / before - 1) * 100) : null };
  }).filter(r => r.now >= 5 || r.before >= 5).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
  const tNow = round2(sum(recent) / n), tBefore = round2(sum(prev) / n);
  return { n, recent, prev, rows, total: { now: tNow, before: tBefore, pct: tBefore > 0 ? Math.round((tNow / tBefore - 1) * 100) : null } };
}

/** Prezzi dei prodotti negli scontrini: prezzo medio per acquisto nei due periodi (almeno 2 acquisti per periodo). */
export function productTrends(s, end, n) {
  const recent = new Set(monthsBetween(back(end, n - 1), end)), prev = new Set(monthsBetween(back(end, 2 * n - 1), back(end, n)));
  const acc = new Map();
  for (const e of live(s.entries)) {
    if (!e.items?.length) continue;
    const side = recent.has(e.m) ? "r" : prev.has(e.m) ? "p" : null; if (!side) continue;
    for (const it of e.items) {
      const k = norm(it.n); if (!k || !(it.a > 0)) continue;
      const o = acc.get(k) || { name: it.n, r: [], p: [] }; o[side].push(it.a); acc.set(k, o);
    }
  }
  const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
  return [...acc.values()].filter(o => o.r.length >= 2 && o.p.length >= 2).map(o => {
    const now = avg(o.r), before = avg(o.p);
    return { name: o.name, now: round2(now), before: round2(before), pct: Math.round((now / before - 1) * 100), count: o.r.length };
  }).filter(o => Math.abs(o.pct) >= 5).sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));
}

/** Consigli dall'andamento: per ogni categoria la finestra più significativa; aumenti → attenzione, riduzioni → complimenti. */
export function trendTips(s, end) {
  const out = [], used = new Set();
  for (const n of TREND_WINDOWS) {
    const tr = catTrends(s, end, n); if (!tr) continue;
    for (const r of tr.rows) {
      if (used.has(r.cat) || r.pct == null) continue;
      if (r.pct >= 15 && r.diff >= 15) { out.push({ key: "tip.trendUp", vars: { cat: r.cat, pct: r.pct, n, diff: r.diff }, weight: r.diff * 1.2, icon: "stats", tone: "watch" }); used.add(r.cat); }
      else if (r.pct <= -10 && r.diff <= -10) { out.push({ key: "tip.trendDown", vars: { cat: r.cat, pct: Math.abs(r.pct), n, diff: Math.abs(r.diff) }, weight: Math.abs(r.diff), icon: "heart", tone: "good" }); used.add(r.cat); }
    }
    if (n === 3 && tr.total.pct != null) {
      if (tr.total.pct <= -5) out.push({ key: "tip.totalDown", vars: { pct: Math.abs(tr.total.pct), n, diff: round2(tr.total.before - tr.total.now) }, weight: 80, icon: "piggy", tone: "good" });
      else if (tr.total.pct >= 10) out.push({ key: "tip.totalUp", vars: { pct: tr.total.pct, n, diff: round2(tr.total.now - tr.total.before) }, weight: 70, icon: "stats", tone: "watch" });
    }
  }
  const pr = productTrends(s, end, 3).concat(productTrends(s, end, 6));
  const seen = new Set();
  for (const p of pr) {
    const k = norm(p.name); if (seen.has(k)) continue; seen.add(k);
    if (p.pct >= 8) out.push({ key: "tip.priceUp", vars: { name: p.name, pct: p.pct, before: p.before, now: p.now }, weight: 25 + p.pct, icon: "receipt", tone: "watch" });
    else if (p.pct <= -8) out.push({ key: "tip.priceDown", vars: { name: p.name, pct: Math.abs(p.pct) }, weight: 15 + Math.abs(p.pct), icon: "sparkle", tone: "good" });
    if (seen.size >= 3) break;
  }
  return out;
}

/** Consigli: [{key, vars, weight, icon}] da tradurre con t(key, vars). */
export function tips(s, m, fmt, opts = {}) {
  const out = [], cur = monthSummary(s, m);
  const prev = series(s, 7, prevMonth(m)).filter(x => x.m < m).slice(-6);
  const avg = catAverages(prev);
  // categorie in crescita
  for (const [c, v] of Object.entries(cur.byCat)) {
    const a = avg[c]; if (!a || a < 20) continue;
    if (v > a * 1.3 && v - a > 25) out.push({ key: "tip.up", vars: { cat: c, pct: Math.round((v / a - 1) * 100), diff: fmt(v - a) }, weight: v - a, icon: "stats" });
  }
  // tabacco: costo annuo
  const tob = prev.concat(cur).reduce((x, y) => x + (y.byCat.tobacco || 0), 0) / Math.max(1, prev.length + 1);
  if (tob > 20) out.push({ key: "tip.tobacco", vars: { year: fmt(tob * 12) }, weight: tob * 3, icon: "c-tobacco" });
  // abbonamenti
  const subs = avg.subs || cur.byCat.subs || 0;
  if (subs > 15) out.push({ key: "tip.subs", vars: { year: fmt(subs * 12) }, weight: subs * 2, icon: "c-subs" });
  // uscite e cibo fuori
  if ((avg.fun || 0) > 150) out.push({ key: "tip.fun", vars: { save: fmt(avg.fun * 0.2 * 12) }, weight: avg.fun * 0.2, icon: "c-fun" });
  // spese non segnate
  if (cur.untracked != null && cur.untracked > 100 && cur.effective > 0 && cur.untracked / cur.effective > 0.1)
    out.push({ key: "tip.untracked", vars: { amt: fmt(cur.untracked) }, weight: cur.untracked / 2, icon: "search" });
  // tasso di risparmio
  if (cur.rate != null && cur.income > 0 && cur.rate < 0.1) out.push({ key: "tip.rate", vars: { pct: Math.round(cur.rate * 100), goal: fmt(cur.income * 0.2) }, weight: 60, icon: "piggy" });
  // buoni pasto accumulati
  const vb = voucherBalance(s);
  if (vb > 100) out.push({ key: "tip.vouchers", vars: { amt: fmt(vb) }, weight: 30, icon: "ticket" });
  // offerte luce/gas salvate: risparmio potenziale
  for (const o of live(s.offers)) {
    const up = unitPrice(s, o.kind); if (!up || !o.unitPrice) continue;
    const offerYear = up.yearCons * o.unitPrice + (o.fixedYear || 0), save = up.yearCost - offerYear;
    if (save > 20) out.push({ key: "tip.offer", vars: { name: o.name || o.kind, save: fmt(save) }, weight: save / 6, icon: "usage" });
  }
  // consumi anomali rispetto allo stesso mese dell'anno prima
  for (const mt of live(s.meters)) {
    const u = usage(s, mt.id), now = u.find(x => x.m === m), ly = u.find(x => x.m === String(+m.slice(0, 4) - 1) + m.slice(4));
    if (now && ly && ly.use > 0 && now.use > ly.use * 1.25) out.push({ key: "tip.meter", vars: { meter: mt.name, pct: Math.round((now.use / ly.use - 1) * 100) }, weight: 20, icon: "meter" });
  }
  // andamento rispetto ai 3/6/9/12 mesi precedenti (vale per categoria: non ripete i consigli già dati sopra)
  const have = new Set(out.map(x => x.vars?.cat).filter(Boolean));
  const money = v => (typeof v === "number" ? fmt(v) : v);
  for (const x of trendTips(s, opts.end || prevMonth(m))) if (!x.vars.cat || !have.has(x.vars.cat)) out.push({ ...x, vars: { ...x.vars, diff: money(x.vars.diff), before: money(x.vars.before), now: money(x.vars.now) } });
  if (!out.length) out.push({ key: cur.tracked ? "tip.good" : "tip.start", vars: {}, weight: 0, icon: "capy" });
  // in testa i più importanti, ma sempre almeno un complimento se c'è
  const top = out.sort((a, b) => b.weight - a.weight).slice(0, 7), good = out.find(x => x.tone === "good");
  if (good && !top.includes(good)) top[top.length - 1] = good;
  return top;
}

/** Saldo buoni pasto: entrati − usati di sempre. */
export function voucherBalance(s) {
  if (!Object.values(s.months).some(x => x.vUsed)) return 0;
  let b = 0; for (const k in s.months) { const x = s.months[k]; if (x.del) continue; b += (x.vIn || 0) - (x.vUsed || 0); }
  return round2(Math.max(0, b));
}
