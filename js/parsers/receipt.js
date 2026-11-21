// Scontrino → voci con importo, totale, data, negozio, pagamento con buoni pasto.
import { findAmounts, round2 } from "../money.js";
import { lines, hasAny, findDate, norm } from "./util.js";

const TOTAL = ["totale", "totale complessivo", "total", "totaal", "summe", "gesamt", "gesamtbetrag", "zu zahlen", "importe", "a pagar", "somme", "montant", "razem", "suma", "celkem", "osszesen", "yhteensa", "summa", "totalt", "итог", "итого", "всего", "сума", "σύνολο", "合計", "合计", "总计", "합계", "المجموع", "toplam", "iomlan"];
const SKIP = ["subtotale", "subtotal", "iva", "di cui iva", "imponibile", "vat", "mwst", "tva", "ндс", "pagamento", "contante", "contanti", "resto", "carta di credito", "carta credito", "carta di debito", "pagato con carta", "bancomat", "pos", "credito", "debito", "elettronico", "visa", "mastercard", "maestro", "change", "cash", "rückgeld", "wechselgeld", "monnaie", "cambio", "documento commerciale", "scontrino", "cassa", "cassiere", "operatore", "transazione", "punti", "saldo punti", "fidaty", "tessera", "partita iva", "p iva", "piva", "tel", "via", "grazie", "arrivederci", "rt", "n doc", "doc n", "importo pagato", "totale euro", "non riscosso", "sconto in fattura"];
const VOUCHER = ["buoni pasto", "buono pasto", "ticket restaurant", "ticket", "edenred", "pluxee", "sodexo", "day", "up day", "yes ticket", "meal voucher", "tickets restaurant", "essen", "gutschein"];
const DISCOUNT = ["sconto", "sc ", "promo", "offerta", "coupon", "risparmio", "rabatt", "remise", "descuento", "discount", "скидка", "割引", "할인"];
const CODE = /^\W*(?:art\.?\s*\/?\s*ean|ean|cod(?:ice)?\.?|plu|sku|rif\.?)\b\s*[:.]?\s*[\w-]*\d{4,}/i;
// "2 x 0,89", "5 PZ x 0.89 EUR/PZ", "0,512 KG x 2,49 €/KG"
const QTY = /^(\d+(?:[.,]\d+)?)\s*(?:pz|pezzi|pc|pcs|n|nr|st|stk|kg|g|lt?)?\.?\s*[x×*]\s*(\d+[.,]\d{2,3})/i;
const UNIT = /\b(?:eur|euro|€)?\s*\/?\s*(?:pz|pezzo|pezzi|kg|lt?|cad|pc|stk)\b|€|\beur(?:o)?\b/gi;
// Catene note: il nome si cerca in tutto lo scontrino (il logo spesso non si legge), poi il sito www.<nome>.it
const CHAINS = [["eurospin", "Eurospin"], ["esselunga", "Esselunga"], ["ipercoop", "Ipercoop"], ["coop", "Coop"], ["conad", "Conad"], ["lidl", "Lidl"], ["aldi", "Aldi"], ["carrefour", "Carrefour"], ["penny", "Penny"], ["despar", "Despar"], ["eurospar", "Eurospar"], ["interspar", "Interspar"], ["tigros", "Tigros"], ["famila", "Famila"], ["bennet", "Bennet"], ["unes", "Unes"], ["crai", "Crai"], ["todis", "Todis"], ["naturasi", "NaturaSì"], ["tuodi", "Tuodì"], ["in's mercato", "In's"], ["md spa", "MD"], ["pam panorama", "Pam"], ["panorama", "Panorama"], ["simply", "Simply"], ["sigma", "Sigma"], ["iper la grande", "Iper"], ["decathlon", "Decathlon"], ["ikea", "IKEA"], ["leroy merlin", "Leroy Merlin"], ["mediaworld", "MediaWorld"], ["unieuro", "Unieuro"], ["euronics", "Euronics"], ["tigota", "Tigotà"], ["acqua & sapone", "Acqua & Sapone"], ["acqua e sapone", "Acqua & Sapone"], ["rewe", "REWE"], ["edeka", "EDEKA"], ["mercadona", "Mercadona"], ["auchan", "Auchan"], ["leclerc", "E.Leclerc"], ["tesco", "Tesco"], ["sainsbury", "Sainsbury's"]];
export function findChain(text) {
  const n = norm(text).replace(/\s+/g, " ");
  for (const [k, name] of CHAINS) if (new RegExp(`(^|[^a-z])${k.replace(/[&']/g, m => "\\" + m)}([^a-z]|$)`).test(n)) return name;
  const w = String(text).match(/www\s?\.\s?([a-z0-9-]{3,30})\.(?:it|com|de|fr|es|eu|co\.uk)/i);
  return w ? w[1].charAt(0).toUpperCase() + w[1].slice(1).toLowerCase() : null;
}

/** @returns {{items:{name,amount,qty}[], total:number|null, date:string|null, store:string|null, vouchers:number, sum:number}} */
export function parseReceipt(text) {
  const L = lines(text), items = [];
  let total = null, vouchers = 0, date = null, store = findChain(text), stop = false, pendingQty = null, lastName = null;
  const push = (name, amount, qty) => {
    if (amount <= 0 || amount > 5000) return;
    const it = { name: titleCase(cleanName(name) || "?"), amount: round2(amount) };
    if (qty) { it.qty = qty; it.qtyDone = 1; } else if (pendingQty) { it.qty = pendingQty; it.qtyDone = 1; pendingQty = null; }
    items.push(it); lastName = null;
  };
  for (let i = 0; i < L.length; i++) {
    const l = L[i];
    // codici articolo (IKEA "Art/Ean 123", "Cod. 456"): non sono prodotti e non interrompono il nome sopra
    if (CODE.test(l)) continue;
    if (!date) date = findDate(l);
    if (!store && i < 4 && /[a-z]{3}/i.test(l) && !/\d{3,}/.test(l)) store = l.slice(0, 40);
    const am = findAmounts(l);
    if (hasAny(l, VOUCHER) && am.length) { vouchers = round2(vouchers + Math.abs(am[am.length - 1])); continue; }
    if (hasAny(l, TOTAL) && !hasAny(l, ["subtotale", "subtotal"])) {
      // OCR: lo zero finale del totale letto come "%", "o", "°" ("30,9%")
      const tam = am.length ? am : findAmounts(l.replace(/(\d[.,]\d)[%°oO](?!\w)/g, "$10"));
      if (tam.length && total == null) total = Math.abs(tam[tam.length - 1]); stop = true; continue;
    }
    if (stop) continue;
    if (!am.length) {
      // riga di solo nome (il prezzo è sotto, es. "Crodino" / "3 x 2,50 7,50")
      lastName = items.length || i > 3 ? (/\p{L}{3}/u.test(l) && !hasAny(l, SKIP) && !/\d{5,}/.test(l) ? l : null) : null;
      continue;
    }
    if (hasAny(l, SKIP)) { lastName = null; continue; }
    let amount = am[am.length - 1];
    let name = l.replace(/-?\s?\d{1,3}(?:[.\s]\d{3})*[.,]\d{2}-?.*$/, "").replace(/\b\d{1,2}([.,]\d+)?\s?%/g, "").replace(/[*#€]+/g, " ").trim();
    const q = l.match(QTY);
    // riga "2 x 1,29" sotto il nome: l'importo appartiene alla voce successiva o precedente
    if (q && !/\p{L}{3}/u.test(l.replace(QTY, "").replace(UNIT, ""))) {
      const qty = parseFloat(q[1].replace(",", ".")), next = L[i + 1], prev = items[items.length - 1];
      if (lastName) { push(lastName, am.length > 1 ? am[am.length - 1] : qty * am[0], qty); continue; }
      // il prodotto (con il totale) è sulla riga dopo: la quantità va a lui
      if (next && findAmounts(next).length && /\p{L}{3}/u.test(next)) { pendingQty = qty; continue; }
      if (prev && !prev.qtyDone) { prev.qty = qty; prev.qtyDone = 1; }
      continue;
    }
    const isDisc = amount < 0 || hasAny(l, DISCOUNT);
    if (isDisc) { const prev = items[items.length - 1]; if (prev) { prev.amount = round2(prev.amount - Math.abs(amount)); prev.discount = round2((prev.discount || 0) + Math.abs(amount)); } continue; }
    if (!/\p{L}{2}/u.test(cleanName(name))) {
      // solo importo: appartiene al nome sulla riga sopra
      if (lastName) { push(lastName, amount); continue; }
      if (i > 0 && items.length === 0) continue;
    }
    push(name, amount);
  }
  items.forEach(it => delete it.qtyDone);
  const sum = round2(items.reduce((a, b) => a + b.amount, 0));
  return { items, total, date, store, vouchers, sum };
}

// "|", "»", "_", "~", "=" e altri segni lasciati dall'OCR o dalla stampa
export const cleanName = s => String(s || "").replace(/[^\p{L}\p{N}\s.,'’/%&()+-]+/gu, " ").replace(/\s+([.,])/g, "$1").replace(/^[\s\p{P}\d]{0,3}(?=\p{L})/u, m => (/\d/.test(m) ? m.replace(/[^\d ]/g, "") : "")).replace(/[\s\p{P}]+$/u, "").replace(/\s+/g, " ").trim();
const titleCase = s => s.toLowerCase().replace(/(^|\s)(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
export { norm };
