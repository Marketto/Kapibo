// Importi: lettura robusta da testo OCR/Excel e formattazione nella lingua dell'utente.

/** "1.234,56" · "1,234.56" · "€ -12,3" · "12.50-" · "1 234,56" → numero (o null). */
export function parseAmount(s) {
  if (typeof s === "number") return isFinite(s) ? s : null;
  if (s == null) return null;
  let str = String(s).replace(/[  \s']/g, "").replace(/[€$£¥₩₽]|eur|usd|chf/gi, "");
  let neg = /^[-−–(]/.test(str) || /[-−–)]$/.test(str);
  str = str.replace(/[-−–()+]/g, "").replace(/[Oo](?=\d)|(?<=\d)[Oo]/g, "0");
  if (!/^\d[\d.,]*$/.test(str)) return null;
  const lc = str.lastIndexOf(","), ld = str.lastIndexOf(".");
  const dec = Math.max(lc, ld);
  let int = str, frac = "";
  if (dec >= 0) {
    const after = str.length - dec - 1;
    const sep = str[dec], other = sep === "," ? "." : ",";
    // un solo separatore seguito da 3 cifre e senza l'altro: migliaia (1.234) — tranne per i decimali tipici dei contatori
    if (after === 3 && !str.includes(other) && str.split(sep).length === 2 && str.length > 4 && sep === ".") { int = str.replace(/\./g, ""); }
    else if (after === 0) int = str.slice(0, -1);
    else { int = str.slice(0, dec).replace(/[.,]/g, ""); frac = str.slice(dec + 1); }
  }
  const n = parseFloat(int + (frac ? "." + frac : ""));
  if (!isFinite(n)) return null;
  return neg ? -n : n;
}

/** Tutti gli importi con due decimali presenti in una riga, nell'ordine. */
export function findAmounts(line) {
  const re = /-?\s?\d{1,3}(?:[.\s]\d{3})*[.,]\d{2}(?!\d)-?|-?\d+[.,]\d{2}(?!\d)-?/g;
  return (String(line).match(re) || []).map(m => parseAmount(m)).filter(n => n != null);
}

export const round2 = n => Math.round((n + Number.EPSILON) * 100) / 100;

let fmtCache = {};
export function fmt(n, locale = "it-IT", currency = "EUR") {
  const k = locale + currency;
  fmtCache[k] ||= new Intl.NumberFormat(locale, { style: "currency", currency });
  return fmtCache[k].format(n || 0);
}
export function fmtNum(n, locale = "it-IT", d = 2) {
  return new Intl.NumberFormat(locale, { minimumFractionDigits: d === 2 && n % 1 ? 2 : 0, maximumFractionDigits: d }).format(n || 0);
}
