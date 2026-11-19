// Busta paga → netto, buoni pasto maturati, mese di competenza.
import { findAmounts, round2 } from "../money.js";
import { lines, hasAny, parseMonth } from "./util.js";

const NET = ["netto in busta", "netto a pagare", "netto del mese", "netto busta", "netto da pagare", "totale netto", "netto", "net pay", "net salary", "nettolohn", "auszahlungsbetrag", "net a payer", "salaire net", "liquido", "a percibir", "liquido a receber", "nettoloon", "wynagrodzenie netto", "к выплате"];
const GROSS = ["lordo", "imponibile", "gross", "brutto", "brut"];
const VOUCH = ["buoni pasto", "buono pasto", "ticket", "meal voucher", "pluxee", "edenred"];

export function parsePayslip(text) {
  const L = lines(text);
  let net = null, gross = null, month = null, vCount = null, vValue = null;
  for (let i = 0; i < L.length; i++) {
    const l = L[i], am = findAmounts(l);
    if (!month) month = parseMonth(l.replace(/.*?(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre|january|february|march|april|may|june|july|august|september|october|november|december)/i, "$1")) || null;
    if (hasAny(l, NET)) {
      const a = am.length ? am[am.length - 1] : (findAmounts(L[i + 1] || "")[0] ?? null);
      if (a != null && a > 0 && (net == null || /netto in busta|netto a pagare|netto del mese|net pay/i.test(l))) net = a;
    } else if (gross == null && hasAny(l, GROSS) && am.length) gross = am[am.length - 1];
    if (hasAny(l, VOUCH)) {
      const c = l.match(/(?:^|\s)(\d{1,2})(?:[.,]00)?\s*(?:gg|n|pz|x)?\s/i);
      if (c && +c[1] <= 31) vCount = +c[1];
      const small = am.filter(x => x > 0 && x <= 20); if (small.length) vValue = small[0];
    }
  }
  const vouchers = vCount && vValue ? round2(vCount * vValue) : null;
  return { net, gross, month, vouchers, vCount, vValue };
}
