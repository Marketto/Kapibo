// Statistiche e consigli di risparmio (regole semplici, tutto in locale).
import { monthSummary, monthsWithData, prevMonth, live } from "./store.js";
import { round2 } from "./money.js";

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

/** Prezzo unitario medio pagato (bollette con consumo) per tipo, ultimi 12 mesi. */
export function unitPrice(s, kind) {
  const bs = live(s.bills).filter(b => b.kind === kind && b.amount > 0 && b.cons > 0).sort((a, b) => (a.m < b.m ? -1 : 1)).slice(-12);
  const a = bs.reduce((x, b) => x + b.amount, 0), c = bs.reduce((x, b) => x + b.cons, 0);
  return c ? { price: a / c, yearCons: c * (12 / Math.max(1, bs.length)), yearCost: a * (12 / Math.max(1, bs.length)) } : null;
}

/** Consigli: [{key, vars, weight, icon}] da tradurre con t(key, vars). */
export function tips(s, m, fmt) {
  const out = [], cur = monthSummary(s, m);
  const prev = series(s, 7, prevMonth(m)).filter(x => x.m < m).slice(-6);
  const avg = catAverages(prev);
  // categorie in crescita
  for (const [c, v] of Object.entries(cur.byCat)) {
    const a = avg[c]; if (!a || a < 20) continue;
    if (v > a * 1.3 && v - a > 25) out.push({ key: "tip.up", vars: { cat: c, pct: Math.round((v / a - 1) * 100), diff: fmt(v - a) }, weight: v - a, icon: "📈" });
  }
  // tabacco: costo annuo
  const tob = prev.concat(cur).reduce((x, y) => x + (y.byCat.tobacco || 0), 0) / Math.max(1, prev.length + 1);
  if (tob > 20) out.push({ key: "tip.tobacco", vars: { year: fmt(tob * 12) }, weight: tob * 3, icon: "🚭" });
  // abbonamenti
  const subs = avg.subs || cur.byCat.subs || 0;
  if (subs > 15) out.push({ key: "tip.subs", vars: { year: fmt(subs * 12) }, weight: subs * 2, icon: "📺" });
  // uscite e cibo fuori
  if ((avg.fun || 0) > 150) out.push({ key: "tip.fun", vars: { save: fmt(avg.fun * 0.2 * 12) }, weight: avg.fun * 0.2, icon: "🍹" });
  // spese non segnate
  if (cur.untracked != null && cur.untracked > 100 && cur.effective > 0 && cur.untracked / cur.effective > 0.1)
    out.push({ key: "tip.untracked", vars: { amt: fmt(cur.untracked) }, weight: cur.untracked / 2, icon: "🔍" });
  // tasso di risparmio
  if (cur.rate != null && cur.income > 0 && cur.rate < 0.1) out.push({ key: "tip.rate", vars: { pct: Math.round(cur.rate * 100), goal: fmt(cur.income * 0.2) }, weight: 60, icon: "🐷" });
  // buoni pasto accumulati
  const vb = voucherBalance(s);
  if (vb > 100) out.push({ key: "tip.vouchers", vars: { amt: fmt(vb) }, weight: 30, icon: "🎫" });
  // offerte luce/gas salvate: risparmio potenziale
  for (const o of live(s.offers)) {
    const up = unitPrice(s, o.kind); if (!up || !o.unitPrice) continue;
    const offerYear = up.yearCons * o.unitPrice + (o.fixedYear || 0), save = up.yearCost - offerYear;
    if (save > 20) out.push({ key: "tip.offer", vars: { name: o.name || o.kind, save: fmt(save) }, weight: save / 6, icon: "💡" });
  }
  // consumi anomali rispetto allo stesso mese dell'anno prima
  for (const mt of live(s.meters)) {
    const u = usage(s, mt.id), now = u.find(x => x.m === m), ly = u.find(x => x.m === String(+m.slice(0, 4) - 1) + m.slice(4));
    if (now && ly && ly.use > 0 && now.use > ly.use * 1.25) out.push({ key: "tip.meter", vars: { meter: mt.name, pct: Math.round((now.use / ly.use - 1) * 100) }, weight: 20, icon: "⚡" });
  }
  if (!out.length) out.push({ key: cur.tracked ? "tip.good" : "tip.start", vars: {}, weight: 0, icon: "🌸" });
  return out.sort((a, b) => b.weight - a.weight).slice(0, 6);
}

/** Saldo buoni pasto: entrati − usati di sempre. */
export function voucherBalance(s) {
  if (!Object.values(s.months).some(x => x.vUsed)) return 0;
  let b = 0; for (const k in s.months) { const x = s.months[k]; if (x.del) continue; b += (x.vIn || 0) - (x.vUsed || 0); }
  return round2(Math.max(0, b));
}
