// Blocca il commit/pubblicazione se nel repo finiscono dati sensibili.
import fs from "node:fs";
import { execSync } from "node:child_process";
const files = execSync("git ls-files -co --exclude-standard", { encoding: "utf8" }).split("\n").filter(f => f && !f.startsWith("vendor/") && f !== "package-lock.json" && !/\.(png|jpg|woff2?)$/.test(f));
const RULES = [
  [/sk-ant-[A-Za-z0-9_-]{20,}/, "chiave API Anthropic"],
  [/\bIT\d{2}[A-Z]\d{10}[0-9A-Z]{12}\b/, "IBAN"],
  [/\b[A-Z]{6}\d{2}[A-EHLMPR-T]\d{2}[A-Z]\d{3}[A-Z]\b/, "codice fiscale"],
  [/[A-Za-z0-9._%+-]+@(?!anthropic\.com)[A-Za-z0-9.-]+\.[a-z]{2,}/, "email"],
  [/"(access|refresh)_token"\s*:\s*"[^"]{20,}/, "token"],
];
const ALLOW_EMAIL = /marco\.ricupero@gmail\.com|noreply@anthropic\.com|user@example\.com/;
let bad = 0;
for (const f of files) {
  if (!fs.existsSync(f) || f === "tools/privacy-check.mjs") continue;
  const txt = fs.readFileSync(f, "utf8");
  for (const [re, what] of RULES) { const m = txt.match(new RegExp(re, "g")); if (!m) continue; const hits = m.filter(x => !(what === "email" && ALLOW_EMAIL.test(x))); if (hits.length) { bad = 1; console.log(`${f}: ${what} → ${hits[0].slice(0, 12)}…`); } }
}
if (fs.existsSync("config.local.js")) { console.log("config.local.js non va pubblicato"); }
console.log(bad ? "Dati sensibili trovati!" : "Privacy OK");
process.exit(bad);
