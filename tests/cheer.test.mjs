import test from "node:test";
import assert from "node:assert/strict";
import { streakOf, milestoneCrossed } from "../js/cheer.js";
import { jarFill } from "../js/jar.js";

test("streak: giorni consecutivi che finiscono oggi", () => {
  assert.equal(streakOf(["2026-03-10", "2026-03-09", "2026-03-08", "2026-03-05"], "2026-03-10"), 3);
  assert.equal(streakOf(["2026-03-10", "2026-03-10"], "2026-03-10"), 1);
  assert.equal(streakOf(["2026-03-09"], "2026-03-10"), 0);
  assert.equal(streakOf([], "2026-03-10"), 0);
  assert.equal(streakOf(["2026-02-28", "2026-03-01"], "2026-03-01"), 2);
  assert.equal(streakOf(["2026-03-29", "2026-03-28", "2026-03-30"], "2026-03-30"), 3); // cambio ora legale
});
test("traguardi: il più alto superato", () => {
  assert.equal(milestoneCrossed(9, 10), 10);
  assert.equal(milestoneCrossed(10, 11), null);
  assert.equal(milestoneCrossed(48, 52), 50);
  assert.equal(milestoneCrossed(0, 60), 50);
  assert.equal(milestoneCrossed(999, 1000), 1000);
  assert.equal(milestoneCrossed(5, 5), null);
});
test("barattolo: 0% vuoto, 30% o più pieno", () => {
  assert.equal(jarFill(null), 0); assert.equal(jarFill(-0.2), 0);
  assert.ok(Math.abs(jarFill(0.15) - 0.5) < 1e-9); assert.equal(jarFill(0.6), 1);
});
