// Dati inventati: nessuno scontrino o documento reale.
import test from "node:test";
import assert from "node:assert/strict";
import { parseAmount, findAmounts } from "../js/money.js";
import { parseReceipt } from "../js/parsers/receipt.js";
import { parsePayslip } from "../js/parsers/payslip.js";
import { parseStatement } from "../js/parsers/statement.js";
import { parseBill } from "../js/parsers/bill.js";
import { parseMeter } from "../js/parsers/meter.js";
import { parseMonth } from "../js/parsers/util.js";
import { guessCats } from "../js/categories.js";

test("importi", () => {
  assert.equal(parseAmount("1.234,56"), 1234.56);
  assert.equal(parseAmount("1,234.56"), 1234.56);
  assert.equal(parseAmount("€ -12,30"), -12.3);
  assert.equal(parseAmount("4,50-"), -4.5);
  assert.equal(parseAmount("1 234,56"), 1234.56);
  assert.equal(parseAmount("abc"), null);
  assert.deepEqual(findAmounts("LATTE 4% 1,29"), [1.29]);
});

test("mesi", () => {
  assert.equal(parseMonth("novembre 2021"), "2021-11");
  assert.equal(parseMonth("Dec 2022"), "2022-12");
  assert.equal(parseMonth("11/2021"), "2021-11");
  assert.equal(parseMonth("März 2023"), "2023-03");
});

test("scontrino", () => {
  const r = parseReceipt(`SUPERMERCATO FANTASIA
VIA DEI SOGNI 1
DOCUMENTO COMMERCIALE
DESCRIZIONE IVA PREZZO
LATTE INTERO 1L 4% 1,29
PANE CASERECCIO 4% 2,10
DETERSIVO PIATTI 22% 1,99
SCONTO -0,50
2 x 0,89
YOGURT BIANCO 4% 1,78
SHAMPOO DELICATO 22% 3,49
SUBTOTALE 10,15
TOTALE COMPLESSIVO 10,15
BUONI PASTO 8,00
PAGAMENTO CONTANTE 2,15
19/11/2026 18:30`);
  assert.equal(r.items.length, 5);
  assert.equal(r.total, 10.15);
  assert.equal(r.sum, 10.15);
  assert.equal(r.vouchers, 8);
  assert.equal(r.date, "2026-11-19");
  assert.equal(r.items[2].amount, 1.49);
  assert.deepEqual(guessCats(r.items[0].name), ["food"]);
  assert.deepEqual(guessCats(r.items[2].name), ["clean"]);
  assert.deepEqual(guessCats(r.items[4].name), ["hygiene"]);
});

test("busta paga", () => {
  const r = parsePayslip(`AZIENDA ESEMPIO SRL
Cedolino mese di Ottobre 2026
TOTALE COMPETENZE 3.000,00
BUONI PASTO 20 8,00
NETTO IN BUSTA 1.987,65`);
  assert.equal(r.net, 1987.65);
  assert.equal(r.month, "2026-10");
  assert.equal(r.vouchers, 160);
});

test("estratto conto", () => {
  const r = parseStatement(`02/11/2026 PAGAMENTO POS SUPERMERCATO FANTASIA 45,20
05/11/2026 ACCREDITO STIPENDIO AZIENDA ESEMPIO 1.987,65
07/11/2026 ADDEBITO SDD FORNITORE LUCE 60,00
SALDO FINALE 3.000,00`);
  assert.equal(r.rows.length, 3);
  assert.equal(r.rows[0].amount, -45.2);
  assert.equal(r.rows[1].salary, true);
  assert.equal(r.rows[2].amount, -60);
  assert.deepEqual(guessCats(r.rows[0].desc), ["food"]);
});

test("bolletta", () => {
  const r = parseBill(`Bolletta energia elettrica
Periodo dal 01/09/2026 al 31/10/2026
Consumo fatturato 250 kWh
Totale da pagare € 95,40
Scadenza 20/11/2026`);
  assert.equal(r.kind, "elec");
  assert.equal(r.amount, 95.4);
  assert.equal(r.cons, 250);
  assert.equal(r.freq, "2m");
  assert.equal(r.period.to, "2026-10-31");
});

test("contatore", () => {
  assert.equal(parseMeter("A1 0 1 2 3 4,5 kWh").value !== null, true);
  assert.equal(parseMeter("03280,051").value, 3280.051);
  assert.equal(parseMeter("03280,05\nGAS 03280,051 m3").value, 3280.051);
});

test("scontrino: catena dal sito, quantità 'PZ x' sopra il prodotto", () => {
  const r = parseReceipt(`*EURO* *SN*
VIA INVENTATA 9 - CITTA' FINTA
www.eurospin.it
CASSA 2
DOCUMENTO COMMERCIALE
DESCRIZIONE PREZZO(€) IVA
SHOPPER CARTA 0.15 L
3 PZ x 1.20 EUR/PZ
ACQUA NATURALE 1,5L 3.60 L
TOTALE COMPLESSIVO 3.75
PAGAMENTO ELETTRONICO 3.75
02/01/26 10:00`);
  assert.equal(r.store, "Eurospin");
  assert.equal(r.items.length, 2);
  assert.equal(r.items[1].qty, 3);
  assert.equal(r.items[1].amount, 3.6);
  assert.equal(r.sum, 3.75);
  assert.equal(r.total, 3.75);
});

test("scontrino: catena scritta nel testo", async () => {
  const { findChain } = await import("../js/parsers/receipt.js");
  assert.equal(findChain("ESSELUNGA S.p.A.\nVIA FINTA 1"), "Esselunga");
  assert.equal(findChain("Grazie e arrivederci\nwww.negoziofinto.it"), "Negoziofinto");
  assert.equal(findChain("SUPERMERCATO FANTASIA"), null);
});

test("scontrino: nome sopra il prezzo, codici articolo, simboli nei nomi", () => {
  const r = parseReceipt(`NEGOZIO DI MOBILI FINTO
VIA INVENTATA 1
DOCUMENTO COMMERCIALE
Art/Ean 10000001
6 polp verdure/pure     6,00  1
 Salsa alla panna,
Art/Ean C0000002
Aranciata
   3 x   2,00           6,00  1
Art/Ean 10000003
| wrap pollo »          4,50  1
Art/Ean 10000004
Torta mele
                        3,20  1
Un buono da gustare!
TOTALE COMPLESSIVO     19,70
di cui IVA              1,79`);
  assert.deepEqual(r.items.map(i => [i.name, i.amount, i.qty || 1]), [["6 Polp Verdure/pure", 6, 1], ["Aranciata", 6, 3], ["Wrap Pollo", 4.5, 1], ["Torta Mele", 3.2, 1]]);
  assert.equal(r.sum, 19.7);
  assert.equal(r.total, 19.7);
});

test("categorie: prodotti e negozio insieme", async () => {
  const { guessReceipt, storeCat, storeKey } = await import("../js/categories.js");
  const food = [{ name: "6 Polp Verdure/pure", amount: 6 }, { name: "Aranciata", amount: 6 }, { name: "Wrap Pollo", amount: 4.5 }, { name: "Xyzq Abc", amount: 3.2 }];
  const a = guessReceipt(food, "IKEA");
  assert.deepEqual(a.cats.map(c => c[0]), ["food", "food", "food", "food"]); // la riga ignota segue la maggioranza
  assert.equal(a.main, "food");
  const b = guessReceipt([{ name: "Xyzq", amount: 30 }, { name: "Kallax Q", amount: 50 }], "IKEA");
  assert.deepEqual(b.cats.map(c => c[0]), ["home", "home"]); // nulla di riconosciuto: vale il negozio
  assert.equal(storeCat("Supermercato Finto"), "food");
  assert.equal(storeCat("Eurospin"), "food");
  const rules = { [storeKey("Bottega Finta")]: ["gifts"] };
  assert.equal(guessReceipt([{ name: "Xyzq", amount: 5 }], "Bottega Finta", rules).main, "gifts");
});

test("scontrino: totale con lo zero letto come %", () => {
  const r = parseReceipt("PANE 1,00\nLATTE 29,90\nTOTALE COMPLESSIVO     30,9%");
  assert.equal(r.total, 30.9);
});

test("ocr: ritaglio del foglio chiaro su un fondo colorato", async () => {
  globalThis.location ??= { origin: "http://localhost" };
  const { paperBox } = await import("../js/ocr.js");
  const w = 100, h = 160, d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4, paper = x >= 35 && x < 65 && y >= 30 && y < 130;
    const ink = paper && y % 6 === 0 && x > 38 && x < 60;
    [d[i], d[i + 1], d[i + 2], d[i + 3]] = ink ? [40, 40, 50, 255] : paper ? [215, 222, 232, 255] : [205, 160, 110, 255];
  }
  const b = paperBox(d, w, h, 10, 10);
  assert.ok(b && b.x >= 300 && b.x <= 350 && b.w >= 300 && b.w <= 400 && b.h >= 1000 && b.h <= 1100, JSON.stringify(b));
  // foglio che riempie la foto: nessun ritaglio
  for (let i = 0; i < w * h; i++) [d[i * 4], d[i * 4 + 1], d[i * 4 + 2]] = [220, 225, 230];
  assert.equal(paperBox(d, w, h), null);
});

test("scontrino: più letture unite riga per riga finché la somma torna", async () => {
  const { mergeReceipts } = await import("../js/parsers/receipt.js");
  const a = parseReceipt("NEGOZIO\nVIA FINTA\nX\nPane comune     1,20 1\nBiscotti avena  4,50 1\nLatte intero    1,10 1\nTOTALE COMPLESSIVO 3,80");
  const b = parseReceipt("NEGOZIO\nVIA FINTA\nX\nPane comune     1,20 1\nBiscotti avena  1,50 4\nTOTALE COMPLESSIVO 3,80");
  const m = mergeReceipts([a, b]);
  assert.deepEqual(m.items.map(i => [i.name, i.amount]), [["Pane Comune", 1.2], ["Biscotti Avena", 1.5], ["Latte Intero", 1.1]]);
  assert.equal(m.sum, 3.8);
  assert.equal(mergeReceipts([b, a]).sum, 3.8);
});
