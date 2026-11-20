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

test("fasce della luce sommate in un solo contatore e bollette pluri-mensili", async () => {
  const { unitPrice, billCostByMonth } = await import("../js/stats.js");
  const sh = { name: "Consumi", rows: fillMerges([
    ["Mese", "Letture", null, null, null, null, null, "Bollette", null],
    [null, "Luce", null, null, null, "Acqua", null, "Acqua", null],
    [null, "A", "A1", "A2", "A3", null, null, "Consumo", "Costo"],
    ...["gennaio 2026", "febbraio 2026", "marzo 2026", "aprile 2026", "maggio 2026", "giugno 2026", "luglio 2026", "agosto 2026", "settembre 2026", "ottobre 2026", "novembre 2026"]
      .map((m, i) => [m, 300 + i * 30, 100 + i * 10, 100 + i * 10, 100 + i * 10, 1000 + i * 10, null, i === 9 ? 100 : null, i === 9 ? 300 : null]),
  ], [{ s: { r: 0, c: 1 }, e: { r: 0, c: 6 } }, { s: { r: 0, c: 7 }, e: { r: 0, c: 8 } }, { s: { r: 1, c: 1 }, e: { r: 1, c: 4 } }, { s: { r: 1, c: 5 }, e: { r: 2, c: 5 } }, { s: { r: 1, c: 7 }, e: { r: 1, c: 8 } }]) };
  const r = importSheets([sh]);
  const luce = r.meters.find(m => m.name === "Luce");
  assert.deepEqual(luce.bands, ["A1", "A2", "A3"]);
  assert.equal(r.readings.find(x => x.meter === luce.id && x.m === "2026-01").value, 300); // A1+A2+A3, non A
  assert.ok(r.drop.meters.includes("m-luce-a1"));
  const st = createStore(); st.set({ ...st.get(), meters: r.meters, readings: r.readings, bills: r.bills });
  const up = unitPrice(st.get(), "water");
  assert.equal(up.price, 3);                        // 300 € / 100 m³
  assert.ok(Math.abs(up.yearCons - 120) < 1);       // 100 m³ in ~10 mesi (10 m³/mese dal contatore) → 120 l'anno, non 1200
  const cost = billCostByMonth(st.get(), "water", ["2026-09", "2026-10", "2026-11"]);
  assert.deepEqual(cost, [30, 30, 0]);
});

test("andamento: aumenti, riduzioni, prezzi dei prodotti", async () => {
  const { catTrends, productTrends, trendTips } = await import("../js/stats.js");
  const ms = ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"], E = [];
  ms.forEach((m, i) => {
    const late = i >= 3;
    E.push({ id: "f" + m, m, d: m + "-10", cat: "food", amt: late ? 400 : 300, items: [{ n: "Latte intero", a: late ? 1.5 : 1.2 }, { n: "Latte intero", a: late ? 1.5 : 1.2 }] });
    E.push({ id: "t" + m, m, d: m + "-11", cat: "tobacco", amt: late ? 40 : 80 });
  });
  const st = createStore(); st.set({ ...st.get(), entries: E });
  const tr = catTrends(st.get(), "2026-06", 3);
  assert.equal(tr.rows.find(r => r.cat === "food").pct, 33);
  assert.equal(tr.rows.find(r => r.cat === "tobacco").pct, -50);
  assert.equal(productTrends(st.get(), "2026-06", 3)[0].pct, 25);
  const tt = trendTips(st.get(), "2026-06");
  assert.ok(tt.some(x => x.key === "tip.trendUp" && x.vars.cat === "food"));
  assert.ok(tt.some(x => x.key === "tip.trendDown" && x.vars.cat === "tobacco" && x.tone === "good"));
  assert.ok(tt.some(x => x.key === "tip.priceUp"));
  assert.equal(catTrends(st.get(), "2026-06", 6), null); // servono 12 mesi
});
