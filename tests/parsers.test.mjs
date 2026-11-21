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
