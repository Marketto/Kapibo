// Funzioni comuni ai parser (pure, senza DOM).
import { norm } from "../categories.js";
export { norm };

/** Righe pulite del testo OCR/PDF. */
export const lines = text => String(text || "").replace(/\r/g, "").split("\n")
  .map(l => l.replace(/[|_]{2,}/g, " ").replace(/\s+/g, " ").trim())
  // "1, 29" o "1 ,29" → "1,29" (errori tipici dell'OCR)
  .map(l => l.replace(/(\d)\s*([.,])\s+(\d{2})(?!\d)/g, "$1$2$3"))
  .filter(Boolean);

export const hasAny = (line, words) => { const n = " " + norm(line) + " "; return words.some(w => n.includes(" " + w + " ") || (w.length > 5 && n.includes(w))); };

/** Date: 19/11/2026, 19-11-26, 2026-11-19, 19.11.2026 → "2026-11-19". */
export function findDate(s) {
  let m = String(s).match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = String(s).match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/);
  if (m) { let y = +m[3]; if (y < 100) y += 2000; return iso(y, +m[2], +m[1]); }
  return null;
}
export function findDates(s) { const out = []; String(s).replace(/\b\d{1,4}[-/.]\d{1,2}[-/.]\d{2,4}\b/g, x => { const d = findDate(x); if (d) out.push(d); }); return out; }
function iso(y, mo, d) {
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// Nomi dei mesi in tutte le lingue supportate (per "novembre 2021", "Nov 2021", "11/2021")
const LOCS = ["it", "en", "es", "fr", "de", "pt", "nl", "pl", "ro", "cs", "sk", "sl", "hr", "hu", "sv", "da", "fi", "et", "lv", "lt", "el", "bg", "ru", "uk", "sr", "mk", "ca", "gl", "eu", "is", "nb", "ga", "mt", "sq", "bs", "tr", "be", "lb"];
let MONTHS = null;
function monthTable() {
  if (MONTHS) return MONTHS;
  MONTHS = [];
  for (const l of LOCS) for (const style of ["long", "short"]) {
    let f; try { f = new Intl.DateTimeFormat(l, { month: style }); } catch { continue; }
    for (let i = 0; i < 12; i++) { const n = norm(f.format(new Date(2021, i, 15))).replace(/\.$/, ""); if (n.length >= 3) MONTHS.push([n, i + 1]); }
  }
  MONTHS.sort((a, b) => b[0].length - a[0].length);
  return MONTHS;
}
/** "novembre 2021" · "Nov-21" · "11/2021" · Date Excel · "2021-11" → "2021-11" */
export function parseMonth(v) {
  if (v instanceof Date && !isNaN(v)) return v.getFullYear() + "-" + String(v.getMonth() + 1).padStart(2, "0");
  if (typeof v === "number" && v > 20000 && v < 80000) { const d = new Date(Math.round((v - 25569) * 864e5)); return d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0"); }
  const s = String(v || "").trim(); if (!s) return null;
  let m = s.match(/^(20\d{2})[-/.](\d{1,2})$/); if (m) return m[1] + "-" + m[2].padStart(2, "0");
  m = s.match(/^(\d{1,2})[-/.](20\d{2})$/); if (m) return m[2] + "-" + m[1].padStart(2, "0");
  const n = norm(s), ym = n.match(/\b(20\d{2}|\d{2})\b/);
  if (!ym) return null;
  let y = +ym[1]; if (y < 100) y += 2000;
  for (const [name, i] of monthTable()) if (n.includes(name)) return y + "-" + String(i).padStart(2, "0");
  return null;
}
