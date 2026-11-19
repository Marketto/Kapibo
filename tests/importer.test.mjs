// Struttura simile al vecchio foglio, valori inventati.
import test from "node:test";
import assert from "node:assert/strict";
import { importSheets, fillMerges } from "../js/importer.js";
import { createStore, monthSummary, merge } from "../js/store.js";

const spese = { name: "Spese", rows: [
  ["Mese", "Alimentari", "Detergenti", "Luce", "Ristrutturaz...", "Cose strane", "Spese Totali", "Mutuo", "TOTALE", "Spesa effettiva", "Saldo inziale", "Stipendio", "Altre entrate", "Rimborsi", "Buoni Pasto", "Entrate Totali", "Risparmi", "Stile di vita"],
  ["novembre 2021", "€ 300,00", 20, 10, 0, 5, 335, 400, 735, 900, 10000, 2000, 50, 10, 80, 2060, 1100, "90%"],
  ["dicembre 2021", 250, 0, 0, 100, 0, 350, 400, 750, 800, 11150, 2100, 0, 0, 90, 2100, 1300, "80%"],
]};
const consumi = { name: "Consumi", rows: fillMerges([
  ["Mese", "Letture", null, "Consumi", null, "Bollette", null, null],
  [null, "Luce", "GAS", "Luce", "GAS", "Luce", null, "Luce cantina"],
  [null, "A1", null, "A1", null, "Consumo", "Costo", null],
  ["ottobre 2021", 1000.5, 300.25, 10, 5, 58, 14.5, 1],
  ["novembre 2021", 1010.5, 305.25, 10, 5, 60, null, 1],
], [{ s: { r: 0, c: 0 }, e: { r: 2, c: 0 } }, { s: { r: 0, c: 1 }, e: { r: 0, c: 2 } }, { s: { r: 0, c: 3 }, e: { r: 0, c: 4 } }, { s: { r: 0, c: 5 }, e: { r: 0, c: 7 } },
     { s: { r: 1, c: 2 }, e: { r: 2, c: 2 } }, { s: { r: 1, c: 4 }, e: { r: 2, c: 4 } }, { s: { r: 1, c: 5 }, e: { r: 1, c: 6 } }, { s: { r: 1, c: 7 }, e: { r: 2, c: 7 } }]) };

test("importa spese e consumi", () => {
  const r = importSheets([spese, consumi, { name: "Natale", rows: [["Regalo", "Costo"], ["x", 1]] }]);
  const nov = r.entries.filter(e => e.m === "2021-11");
  assert.deepEqual(nov.map(e => e.cat).sort(), ["c-cose-strane", "clean", "elec", "food", "mortgage"].sort());
  assert.equal(r.months["2021-11"].start, 10000);
  assert.equal(r.months["2021-11"].salary, 2000);
  assert.equal(r.months["2021-11"].vIn, 80);
  assert.equal(r.entries.find(e => e.m === "2021-12" && e.cat === "renovation").amt, 100);
  assert.equal(r.meters.length, 2);
  assert.equal(r.readings.length, 4);
  assert.equal(r.bills.find(b => b.m === "2021-10" && b.kind === "elec" && b.cons === 58).amount, 14.5);
  assert.ok(r.bills.some(b => b.name === "Luce cantina"));
  assert.equal(r.report[2].skipped, true);

  const st = createStore();
  st.set({ ...st.get(), months: r.months, entries: r.entries });
  const s = monthSummary(st.get(), "2021-11");
  assert.equal(s.tracked, 735);
  assert.equal(s.end, 11150);           // saldo iniziale del mese dopo
  assert.equal(s.effective, 10000 + 2060 - 11150);
  assert.equal(s.savings, 1150);
});

test("merge: vince la modifica più recente, tombstone inclusi", () => {
  const a = { entries: [{ id: "1", amt: 1, u: 1 }, { id: "2", amt: 2, u: 5 }] };
  const b = { entries: [{ id: "1", amt: 9, u: 3 }, { id: "2", del: 1, u: 4 }, { id: "3", amt: 3, u: 1 }] };
  const m = merge(a, b);
  assert.equal(m.entries.find(e => e.id === "1").amt, 9);
  assert.ok(!m.entries.find(e => e.id === "2").del);
  assert.equal(m.entries.length, 3);
});
