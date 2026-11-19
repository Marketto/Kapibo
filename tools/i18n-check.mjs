// Controllo traduzioni: chiavi usate nel codice presenti in en/it; chiavi mancanti per lingua.
// node tools/i18n-check.mjs            → riepilogo
// node tools/i18n-check.mjs --json xx  → JSON {chiave: testo inglese} delle chiavi mancanti in xx
import fs from "node:fs";
const dir = new URL("../locales/", import.meta.url), read = f => JSON.parse(fs.readFileSync(new URL(f, dir)));
const en = read("en.json"), keys = Object.keys(en);
const src = fs.readdirSync(new URL("../js/", import.meta.url), { recursive: true }).filter(f => f.endsWith(".js")).map(f => fs.readFileSync(new URL("../js/" + f, import.meta.url), "utf8")).join("\n") + fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const used = new Set([...src.matchAll(/\bt\("([\w.]+)"/g)].map(m => m[1]).concat([...src.matchAll(/data-i18n="([\w.]+)"/g)].map(m => m[1]), [...src.matchAll(/:([a-z]+\.[\w.]+)/g)].map(m => m[1]).filter(k => k in en)));
const args = process.argv.slice(2);
if (args[0] === "--json") {
  const f = new URL(args[1] + ".json", dir), have = fs.existsSync(f) ? read(args[1] + ".json") : {};
  console.log(JSON.stringify(Object.fromEntries(keys.filter(k => !(k in have)).map(k => [k, en[k]])), null, 1)); process.exit(0);
}
let bad = 0;
const miss = [...used].filter(k => !(k in en) && k.includes(".") && !k.endsWith("."));
if (miss.length) { bad = 1; console.log("Chiavi usate ma assenti in en.json:", miss.join(", ")); }
const { LANGS } = await import("../js/i18n.js").catch(() => ({ LANGS: null })) ;
for (const f of fs.readdirSync(dir).filter(f => f.endsWith(".json"))) {
  const d = read(f), m = keys.filter(k => !(k in d)), extra = Object.keys(d).filter(k => !(k in en));
  const ph = keys.filter(k => k in d && (en[k].match(/\{\w+\}/g) || []).sort().join() !== (d[k].match(/\{\w+\}/g) || []).sort().join());
  if (m.length || extra.length || ph.length) { bad = 1; console.log(`${f}: ${m.length} mancanti, ${extra.length} in più, ${ph.length} segnaposto diversi${ph.length ? " (" + ph.slice(0, 5).join(",") + ")" : ""}`); }
}
console.log(bad ? "Traduzioni da completare" : "Traduzioni OK");
process.exit(bad);
