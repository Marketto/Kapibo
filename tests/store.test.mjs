// Entrate come voci (schema 2): migrazione dei vecchi campi del mese, totali per tipo, unione tra dispositivi. Dati inventati.
import test from "node:test";
import assert from "node:assert/strict";
import { normalize, merge, monthSummary, incomeTotals } from "../js/store.js";
import { voucherBalance } from "../js/stats.js";

const old = () => ({ schema: 1, entries: [{ id: "e1", m: "2030-03", d: "2030-03-04", cat: "food", amt: 40, u: 1 }],
  months: { "2030-03": { start: 1000, salary: 1500, extra: 50, refunds: 0, vIn: 80, vUsed: 16, u: 5 } } });

test("migrazione: i campi del mese diventano entrate con id fisso, il saldo iniziale resta nel mese", () => {
  const s = normalize(old());
  assert.equal(s.schema, 2);
  assert.deepEqual(s.months["2030-03"], { start: 1000, u: 5 });
  assert.deepEqual(s.incomes.map(r => [r.id, r.k, r.amt]).sort(), [["mig-2030-03-extra", "extra", 50], ["mig-2030-03-salary", "salary", 1500], ["mig-2030-03-vIn", "vIn", 80], ["mig-2030-03-vUsed", "vUsed", 16]]);
  const m = monthSummary(s, "2030-03");
  assert.equal(m.income, 1550); assert.equal(m.vIn, 80); assert.equal(m.vUsed, 16); assert.equal(m.start, 1000);
});

test("entrate: più voci dello stesso tipo nel mese si sommano", () => {
  const s = normalize({ incomes: [{ id: "a", m: "2030-04", d: "2030-04-01", k: "extra", amt: 20, u: 1 }, { id: "b", m: "2030-04", d: "2030-04-20", k: "extra", amt: 15.5, u: 2 },
    { id: "c", m: "2030-04", d: "2030-04-27", k: "salary", amt: 1400, u: 3 }, { id: "d", m: "2030-04", d: "2030-04-28", k: "salary", amt: 99, u: 4, del: 1 }] });
  assert.deepEqual(incomeTotals(s, "2030-04"), { salary: 1400, extra: 35.5, refunds: 0, vIn: 0, vUsed: 0 });
  assert.equal(monthSummary(s, "2030-04").income, 1435.5);
});

test("unione: due dispositivi che migrano lo stesso mese non creano doppioni; la modifica più recente vince", () => {
  const a = normalize(old()), b = normalize(old());
  b.incomes = b.incomes.map(r => (r.k === "salary" ? { ...r, amt: 1600, u: 9 } : r));
  const s = merge(a, b);
  assert.equal(s.incomes.filter(r => r.k === "salary").length, 1);
  assert.equal(incomeTotals(s, "2030-03").salary, 1600);
  // una copia vecchia (schema 1) che arriva dal cloud dopo non riporta indietro il valore modificato
  const again = merge(s, old());
  assert.equal(incomeTotals(again, "2030-03").salary, 1600);
});

test("buoni pasto: saldo dai movimenti", () => {
  assert.equal(voucherBalance(normalize(old())), 64);
});
