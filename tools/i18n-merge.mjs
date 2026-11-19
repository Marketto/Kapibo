// node tools/i18n-merge.mjs <lingua> <file.json> → unisce le chiavi nel file della lingua, nell'ordine di en.json
import fs from "node:fs";
const [lang, file] = process.argv.slice(2);
const dir = new URL("../locales/", import.meta.url), en = JSON.parse(fs.readFileSync(new URL("en.json", dir)));
const f = new URL(lang + ".json", dir), cur = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f)) : {}, add = JSON.parse(fs.readFileSync(file));
const all = { ...cur, ...add }, out = {};
for (const k of Object.keys(en)) if (k in all) out[k] = all[k];
fs.writeFileSync(f, JSON.stringify(out, null, 0).replace(/","/g, '",\n"') + "\n");
console.log(lang, Object.keys(out).length + "/" + Object.keys(en).length);
