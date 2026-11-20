// Importazione dal vecchio foglio (xlsx, ods, csv; Google Sheets → File › Scarica › xlsx).
// Riconosce: scheda "spese" (una riga per mese, una colonna per categoria/entrata) e
// scheda "consumi" (intestazioni su più righe: Letture / Consumi / Bollette).
import { norm, guessCats, DEFAULT_CATS } from "./categories.js";
import { parseAmount, round2 } from "./money.js";
import { parseMonth } from "./parsers/util.js";

const ALIAS = {
  alimentari: "food", spesa: "food", cibo: "food", groceries: "food", food: "food",
  detergenti: "clean", pulizia: "clean", igiene: "hygiene", "igiene personale": "hygiene",
  luce: "elec", elettricita: "elec", energia: "elec", gas: "gas", acqua: "water", internet: "internet", telefono: "internet",
  abbonamenti: "subs", "canone rai": "tvfee", "canone tv": "tvfee", rifiuti: "waste", tari: "waste",
  movida: "fun", uscite: "fun", svago: "fun", ristoranti: "fun", vacanze: "holiday", viaggi: "holiday",
  sigarette: "tobacco", tabacco: "tobacco", casa: "home", regali: "gifts", giocattoli: "toys", animali: "pets",
  elettronica: "tech", ristrutturazione: "renovation", ristrutturaz: "renovation", mobili: "furniture",
  abbigliamento: "clothes", vestiti: "clothes", "sanita e cura": "health", sanita: "health", salute: "health",
  condominio: "condo", burocrazia: "admin", trasporto: "transport", trasporti: "transport", auto: "transport",
  istruzione: "school", scuola: "school", donazioni: "donations", mutuo: "mortgage", affitto: "mortgage", rent: "mortgage",
};
const FIELD = [
  [/^saldo ini|^saldo inz|opening|^start/, "start"], [/^saldo fin|closing|^end/, "end"],
  [/^stipend|^salar|^gehalt|^salaire|^sueldo/, "salary"], [/^altre entrate|^entrate extra|^extra|^other income/, "extra"],
  [/^rimbors|^refund/, "refunds"], [/buoni.*(usat|spes)|vouchers? used/, "vUsed"], [/^buoni|^ticket|voucher/, "vIn"],
];
const IGNORE = /^(mese|month|spese totali|totale|total|spesa effettiva|entrate totali|risparmi|savings|stile di vita|saldo$|media)/;

const toNum = v => (typeof v === "number" ? v : parseAmount(String(v ?? "").replace(/[a-zA-Z³²/]+/g, "")));

/** Riempie le celle unite (SheetJS lascia vuote tutte tranne la prima). */
export function fillMerges(rows, merges = []) {
  for (const m of merges) {
    const v = rows[m.s.r]?.[m.s.c];
    for (let r = m.s.r; r <= m.e.r; r++) { rows[r] ||= []; for (let c = m.s.c; c <= m.e.c; c++) if (rows[r][c] == null || rows[r][c] === "") rows[r][c] = v; }
  }
  return rows;
}

/** @param sheets [{name, rows}] (array di righe, celle unite già riempite) */
export function importSheets(sheets, existingCats = []) {
  const out = { months: {}, entries: [], meters: [], readings: [], bills: [], cats: [], report: [], drop: { meters: [] } };
  const catByName = new Map(existingCats.map(c => [norm(c.name || ""), c.id]));
  for (const sh of sheets) {
    const rows = sh.rows || [];
    const first = rows.findIndex(r => r && parseMonth(r[0]));
    if (first < 1) { out.report.push({ sheet: sh.name, skipped: true }); continue; }
    const head = rows.slice(0, first);
    const paths = (head[0] || []).map((_, c) => head.map(r => String(r?.[c] ?? "").trim()).filter((v, i, a) => v && a.indexOf(v) === i));
    const width = Math.max(...rows.map(r => (r || []).length));
    for (let c = paths.length; c < width; c++) paths[c] = [];
    const multi = head.length > 1 || paths.some(p => /letture|consumi|bollette|readings|bills/i.test(p[0] || ""));
    const n = multi ? importUsage(rows.slice(first), paths, out) : importSpese(rows.slice(first), paths, out, catByName);
    out.report.push({ sheet: sh.name, rows: n, kind: multi ? "usage" : "spese" });
  }
  return out;
}

function importSpese(rows, paths, out, catByName) {
  const cols = paths.map(p => {
    const h = p[p.length - 1] || "", k = norm(h);
    if (!k || IGNORE.test(k)) return null;
    for (const [re, f] of FIELD) if (re.test(k)) return { field: f };
    const alias = ALIAS[k] || Object.entries(ALIAS).find(([a]) => k.startsWith(a) && a.length >= 5)?.[1];
    if (alias) return { cat: alias, label: h };
    if (catByName.has(k)) return { cat: catByName.get(k), label: h };
    const g = guessCats(h, {}, null)[0];
    if (g) return { cat: g, label: h };
    const id = "c-" + k.replace(/\s/g, "-").slice(0, 24);
    if (!out.cats.some(c => c.id === id)) out.cats.push({ id, name: h, emoji: "🏷️", color: "#c9b3e6", kind: "var" });
    catByName.set(k, id);
    return { cat: id, label: h };
  });
  let n = 0;
  for (const r of rows) {
    const m = parseMonth(r?.[0]); if (!m) continue; n++;
    const meta = out.months[m] ||= {};
    cols.forEach((col, c) => {
      if (!col) return; const v = toNum(r[c]); if (v == null || v === 0) return;
      if (col.field) meta[col.field] = round2((meta[col.field] || 0) + v);
      else out.entries.push({ id: `imp-${m}-${c}`, d: m + "-01", m, amt: round2(v), cat: col.cat, note: col.label, src: "import" });
    });
  }
  return n;
}

const meterKind = s => { const k = norm(s); return /gas|metano/.test(k) ? "gas" : /acqua|water/.test(k) ? "water" : /luce|elet|kw|energ/.test(k) ? "elec" : "other"; };
const unitOf = kind => (kind === "elec" ? "kWh" : "m³");

function importUsage(rows, paths, out) {
  // Letture: le colonne con lo stesso servizio (es. Luce › A1, A2, A3, A4) diventano UN contatore che somma le fasce.
  const groups = new Map(), bills = new Map();
  paths.forEach((p, c) => {
    const top = norm(p[0] || "");
    if (/letture|readings|lettura/.test(top)) {
      const util = p[1] || p[0], key = norm(util);
      const g = groups.get(key) || { util, cols: [] };
      g.cols.push({ c, band: p[2] || "", oldId: "m-" + norm(p.slice(1).join(" ") || p[0]).replace(/\s/g, "-") });
      groups.set(key, g);
    } else if (/bollett|bills|fattur/.test(top)) {
      const util = p[1] || p[0], field = norm(p[2] || "costo");
      const key = norm(util);
      const b = bills.get(key) || { util, kind: meterKind(util), cols: {} };
      b.cols[/consum/.test(field) ? "cons" : /prezzo|price/.test(field) ? "price" : "amount"] = c;
      bills.set(key, b);
    }
  });
  const meters = [];
  for (const [key, g] of groups) {
    const kind = meterKind(g.util), id = "m-" + key.replace(/\s/g, "-");
    // fasce = colonne con un numero (A1…A4, F1…F3); la colonna del totale (A) si usa solo se non ci sono fasce
    const bands = g.cols.length > 1 ? g.cols.filter(x => /\d\s*$/.test(x.band)) : [];
    const use = bands.length ? bands : g.cols.slice(0, 1);
    meters.push({ id, name: g.util, kind, unit: unitOf(kind), cols: use, bands: bands.map(x => x.band) });
    out.drop.meters.push(...g.cols.map(x => x.oldId).filter(o => o !== id));
  }
  out.meters.push(...meters.map(({ cols, ...m }) => (m.bands.length ? m : (delete m.bands, m))));
  let n = 0;
  for (const r of rows) {
    const m = parseMonth(r?.[0]); if (!m) continue; n++;
    for (const mt of meters) {
      const vals = mt.cols.map(x => toNum(r[x.c]));
      if (vals.some(v => v == null || v <= 0)) continue; // lettura completa solo se ci sono tutte le fasce
      const rd = { id: `imp-${mt.id}-${m}`, meter: mt.id, m, d: m + "-01", value: round2(vals.reduce((a, b) => a + b, 0) * 1000) / 1000 };
      if (mt.bands.length) rd.bands = Object.fromEntries(mt.cols.map((x, i) => [x.band, vals[i]]));
      out.readings.push(rd);
    }
    for (const [key, b] of bills) {
      const amount = toNum(r[b.cols.amount]), cons = b.cols.cons != null ? toNum(r[b.cols.cons]) : null;
      if (!amount && !cons) continue;
      // frequenza sconosciuta: i mesi coperti si stimano dalla distanza tra le bollette (stats.billMonths)
      out.bills.push({ id: `imp-${key.replace(/\s/g, "-")}-${m}`, kind: b.kind, name: b.util, m, amount: amount || null, cons: cons || null, unit: unitOf(b.kind), freq: null });
    }
  }
  return n;
}

/** Legge un file con SheetJS (caricato al primo uso). */
export async function readWorkbook(file) {
  if (!window.XLSX) await new Promise((res, rej) => { const s = Object.assign(document.createElement("script"), { src: new URL("../vendor/xlsx.full.min.js", import.meta.url).href, onload: res, onerror: rej }); document.head.appendChild(s); });
  const wb = window.XLSX.read(await file.arrayBuffer(), { cellDates: true });
  return wb.SheetNames.map(name => {
    const ws = wb.Sheets[name];
    const rows = window.XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
    return { name, rows: fillMerges(rows, ws["!merges"]) };
  });
}
export const KNOWN_CATS = DEFAULT_CATS.map(c => c.id);
