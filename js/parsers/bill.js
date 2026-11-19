// Bolletta → tipo, totale, periodo, consumo e prezzo unitario.
import { findAmounts, parseAmount, round2 } from "../money.js";
import { lines, hasAny, findDates, norm } from "./util.js";

const KIND = {
  elec: ["energia elettrica", "kwh", "luce", "electricity", "strom", "electricite", "electricidad", "energia"],
  gas: ["gas naturale", "smc", "metano", "gas", "erdgas"],
  water: ["servizio idrico", "acquedotto", "acqua", "water", "wasser", "eau", "agua"],
  internet: ["fibra", "adsl", "internet", "linea fissa", "broadband"],
  waste: ["tari", "rifiuti", "waste"],
};
const TOTAL = ["totale da pagare", "importo da pagare", "totale bolletta", "totale fattura", "da pagare", "amount due", "total due", "zu zahlen", "montant a payer", "total a pagar", "totale"];

export function parseBill(text) {
  const L = lines(text), all = norm(text);
  let kind = "other", best = 0;
  for (const [k, words] of Object.entries(KIND)) {
    const sc = words.reduce((a, w) => a + (all.split(w).length - 1) * (w.length > 4 ? 2 : 1), 0);
    if (sc > best) { best = sc; kind = k; }
  }
  let amount = null, cons = null, unit = null;
  for (const l of L) {
    if (amount == null && hasAny(l, TOTAL)) { const a = findAmounts(l); if (a.length) amount = Math.abs(a[a.length - 1]); }
    const c = l.match(/(\d{1,3}(?:[.\s]\d{3})*(?:[.,]\d{1,3})?|\d+(?:[.,]\d{1,3})?)\s*(kwh|smc|m3|m³|mc)\b/i);
    if (c && /consum|fatturat|totale|usage|verbrauch/i.test(l)) { const v = parseAmount(c[1].replace(/\s/g, "")); if (v != null && v > 0 && (cons == null || v > cons)) { cons = v; unit = c[2].toLowerCase() === "kwh" ? "kWh" : "m³"; } }
  }
  if (amount == null) { const a = L.flatMap(findAmounts).filter(x => x > 0); if (a.length) amount = Math.max(...a); }
  const ds = findDates(text).sort(), period = /dal|periodo|from|period|zeitraum/i.test(text) && ds.length >= 2 ? { from: ds[0], to: ds[ds.length - 1] } : null;
  let months = null;
  if (period) { const [a, b] = [new Date(period.from), new Date(period.to)]; months = Math.max(1, Math.round((b - a) / (30.4 * 864e5))); }
  const freq = months == null ? null : months >= 11 ? "y" : months >= 5 ? "6m" : months >= 3 ? "q" : months >= 2 ? "2m" : "m";
  return { kind, amount, cons, unit, period, freq, unitPrice: amount && cons ? round2(amount / cons * 1000) / 1000 : null };
}
