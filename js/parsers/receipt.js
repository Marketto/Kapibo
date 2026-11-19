// Scontrino → voci con importo, totale, data, negozio, pagamento con buoni pasto.
import { findAmounts, round2 } from "../money.js";
import { lines, hasAny, findDate, norm } from "./util.js";

const TOTAL = ["totale", "totale complessivo", "total", "totaal", "summe", "gesamt", "gesamtbetrag", "zu zahlen", "importe", "a pagar", "somme", "montant", "razem", "suma", "celkem", "osszesen", "yhteensa", "summa", "totalt", "итог", "итого", "всего", "сума", "σύνολο", "合計", "合计", "总计", "합계", "المجموع", "toplam", "iomlan"];
const SKIP = ["subtotale", "subtotal", "iva", "di cui iva", "imponibile", "vat", "mwst", "tva", "ндс", "pagamento", "contante", "contanti", "resto", "carta", "bancomat", "pos", "credito", "debito", "elettronico", "visa", "mastercard", "maestro", "change", "cash", "rückgeld", "wechselgeld", "monnaie", "cambio", "documento commerciale", "scontrino", "cassa", "cassiere", "operatore", "transazione", "punti", "saldo punti", "fidaty", "tessera", "partita iva", "p iva", "piva", "tel", "via", "grazie", "arrivederci", "rt", "n doc", "doc n", "importo pagato", "totale euro", "non riscosso", "sconto in fattura"];
const VOUCHER = ["buoni pasto", "buono pasto", "ticket restaurant", "ticket", "edenred", "pluxee", "sodexo", "day", "up day", "yes ticket", "meal voucher", "tickets restaurant", "essen", "gutschein"];
const DISCOUNT = ["sconto", "sc ", "promo", "offerta", "coupon", "risparmio", "rabatt", "remise", "descuento", "discount", "скидка", "割引", "할인"];
const QTY = /^(\d+(?:[.,]\d+)?)\s*[x×*]\s*(\d+[.,]\d{2})/i;

/** @returns {{items:{name,amount,qty}[], total:number|null, date:string|null, store:string|null, vouchers:number, sum:number}} */
export function parseReceipt(text) {
  const L = lines(text), items = [];
  let total = null, vouchers = 0, date = null, store = null, stop = false;
  for (let i = 0; i < L.length; i++) {
    const l = L[i];
    if (!date) date = findDate(l);
    if (!store && i < 4 && /[a-z]{3}/i.test(l) && !/\d{3,}/.test(l)) store = l.slice(0, 40);
    const am = findAmounts(l);
    if (hasAny(l, VOUCHER) && am.length) { vouchers = round2(vouchers + Math.abs(am[am.length - 1])); continue; }
    if (hasAny(l, TOTAL) && !hasAny(l, ["subtotale", "subtotal"])) { if (am.length && total == null) total = Math.abs(am[am.length - 1]); stop = true; continue; }
    if (stop || !am.length) continue;
    if (hasAny(l, SKIP)) continue;
    let amount = am[am.length - 1];
    let name = l.replace(/-?\s?\d{1,3}(?:[.\s]\d{3})*[.,]\d{2}-?.*$/, "").replace(/\b\d{1,2}([.,]\d+)?\s?%/g, "").replace(/[*#€]+/g, " ").trim();
    const q = l.match(QTY);
    // riga "2 x 1,29" sotto il nome: l'importo appartiene alla voce successiva o precedente
    if (q && !/[a-z]{3}/i.test(name.replace(QTY, ""))) {
      const next = L[i + 1], prev = items[items.length - 1];
      if (next && findAmounts(next).length && /[a-z]{3}/i.test(next)) continue; // il totale è sulla riga dopo
      if (prev && !prev.qtyDone) { prev.qty = parseFloat(q[1].replace(",", ".")); prev.qtyDone = 1; }
      continue;
    }
    const isDisc = amount < 0 || hasAny(l, DISCOUNT);
    if (isDisc) { const prev = items[items.length - 1]; if (prev) { prev.amount = round2(prev.amount - Math.abs(amount)); prev.discount = round2((prev.discount || 0) + Math.abs(amount)); } continue; }
    if (name.length < 2 || !/\p{L}{2}/u.test(name)) { if (!/\p{L}/u.test(name) && i > 0 && items.length === 0) continue; name = name || "?"; }
    if (amount <= 0 || amount > 5000) continue;
    items.push({ name: titleCase(name), amount: round2(amount) });
  }
  items.forEach(it => delete it.qtyDone);
  const sum = round2(items.reduce((a, b) => a + b.amount, 0));
  return { items, total, date, store, vouchers, sum };
}

const titleCase = s => s.toLowerCase().replace(/(^|\s)(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
export { norm };
