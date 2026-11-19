import test from "node:test";
import assert from "node:assert/strict";
import { pick, cmp, STEPS } from "../js/tour.js";

test("versioni", () => { assert.ok(cmp("1.10.0", "1.9.9") > 0); assert.equal(cmp("1.1.0", "1.1.0"), 0); });
test("primo avvio: tutti i passi fino alla versione corrente", () => {
  const s = pick("", "1.1.0"); assert.equal(s[0].id, "welcome"); assert.equal(s.length, STEPS.length);
  assert.ok(pick("", "1.0.0").every(x => x.v === "1.0.0"));
});
test("aggiornamento: solo le novità", () => {
  const s = pick("1.0.0", "1.1.0"); assert.equal(s[0].id, "news"); assert.ok(s.slice(1, -1).every(x => x.v === "1.1.0"));
});
test("aggiornamento senza novità: niente wizard", () => { assert.deepEqual(pick("1.1.0", "1.1.1"), []); });
