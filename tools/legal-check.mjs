// Ogni lingua dell'app deve avere privacy e condizioni nella stessa struttura dell'inglese.
import fs from "node:fs";
const dir = new URL("../locales/", import.meta.url), en = JSON.parse(fs.readFileSync(new URL("legal/en.json", dir)));
let bad = 0;
for (const f of fs.readdirSync(dir).filter(f => f.endsWith(".json"))) {
  const p = new URL("legal/" + f, dir);
  if (!fs.existsSync(p)) { console.log("manca legal/" + f); bad = 1; continue; }
  const d = JSON.parse(fs.readFileSync(p));
  for (const k of ["privacy", "terms", "summary"]) if (!Array.isArray(d[k]) || d[k].length !== en[k].length) { console.log(`legal/${f}: ${k} diverso`); bad = 1; }
  if (!d.title || !d.updated) { console.log(`legal/${f}: titolo o data mancanti`); bad = 1; }
}
console.log(bad ? "Testi legali incompleti" : "Testi legali OK"); process.exit(bad);
