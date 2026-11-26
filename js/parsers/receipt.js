// Scontrino → voci con importo, totale, data, negozio, pagamento con buoni pasto.
import { findAmounts, round2 } from "../money.js";
import { lines, hasAny, findDate, norm } from "./util.js";

const TOTAL = ["totale", "totale complessivo", "total", "totaal", "summe", "gesamt", "gesamtbetrag", "zu zahlen", "importe", "a pagar", "somme", "montant", "razem", "suma", "celkem", "osszesen", "yhteensa", "summa", "totalt", "итог", "итого", "всего", "сума", "σύνολο", "合計", "合计", "总计", "합계", "المجموع", "toplam", "iomlan"];
const SKIP = ["subtotale", "subtotal", "articoli", "totale articoli", "n. pezzi", "pezzi", "iva", "di cui iva", "imponibile", "vat", "mwst", "tva", "ндс", "pagamento", "contante", "contanti", "resto", "carta di credito", "carta credito", "carta di debito", "pagato con carta", "bancomat", "pos", "credito", "debito", "elettronico", "visa", "mastercard", "maestro", "change", "cash", "rückgeld", "wechselgeld", "monnaie", "cambio", "documento commerciale", "scontrino", "cassa", "cassiere", "operatore", "transazione", "punti", "saldo punti", "fidaty", "tessera", "partita iva", "p iva", "piva", "tel", "via", "grazie", "arrivederci", "rt", "n doc", "doc n", "importo pagato", "totale euro", "non riscosso", "sconto in fattura"];
const VOUCHER = ["buoni pasto", "buono pasto", "ticket restaurant", "ticket", "edenred", "pluxee", "sodexo", "day", "up day", "yes ticket", "meal voucher", "tickets restaurant", "essen", "gutschein"];
const DISCOUNT = ["sconto", "sc ", "promo", "offerta", "coupon", "risparmio", "rabatt", "remise", "descuento", "discount", "скидка", "割引", "할인"];
const CODE = /^\W*art\s*\/|^\W*(?:art\.?\s*\/?\s*ean|ean|cod(?:ice)?\.?|plu|sku|rif\.?)\b\s*[:.]?\s*[\w-]*\d{4,}/i;
// "2 x 0,89", "5 PZ x 0.89 EUR/PZ", "0,512 KG x 2,49 €/KG"
// "2 x 1,29", "Pz. 1 x 0,10" (OCR: "z. 1 Xx = 0,10")
const QTY = /^(?:(?:p?z|pz|nr?)\.?\s*)?(\d+(?:[.,]\d+)?)\s*(?:pz|pezzi|pc|pcs|n|nr|st|stk|kg|g|lt?)?\.?\s*[x×*]+[\s=]*(\d+[.,]\d{2,3})/i;
// riga del peso sotto il nome letta sporca ("(Pî<‘2 pogy1©'"9  29,44"): non è un nome
const junk = s => /^\s*\(/.test(s) || (s.match(/[<>©®"“”‘|{}[\]=^~]/g) || []).length >= 2 || (s.match(/\d/g) || []).length >= (s.match(/\p{L}/gu) || []).length;
const UNIT = /\b(?:eur|euro|€)?\s*\/?\s*(?:pz|pezzo|pezzi|kg|lt?|cad|pc|stk)\b|€|\beur(?:o)?\b/gi;
// Catene note: il nome si cerca in tutto lo scontrino (il logo spesso non si legge), poi il sito www.<nome>.it
const CHAINS = [["eurospin", "Eurospin"], ["esselunga", "Esselunga"], ["ipercoop", "Ipercoop"], ["coop", "Coop"], ["conad", "Conad"], ["lidl", "Lidl"], ["aldi", "Aldi"], ["carrefour", "Carrefour"], ["penny", "Penny"], ["despar", "Despar"], ["eurospar", "Eurospar"], ["interspar", "Interspar"], ["tigros", "Tigros"], ["famila", "Famila"], ["bennet", "Bennet"], ["unes", "Unes"], ["crai", "Crai"], ["todis", "Todis"], ["naturasi", "NaturaSì"], ["tuodi", "Tuodì"], ["in's mercato", "In's"], ["md spa", "MD"], ["pam panorama", "Pam"], ["panorama", "Panorama"], ["simply", "Simply"], ["sigma", "Sigma"], ["iper la grande", "Iper"], ["decathlon", "Decathlon"], ["ikea", "IKEA"], ["leroy merlin", "Leroy Merlin"], ["mediaworld", "MediaWorld"], ["unieuro", "Unieuro"], ["euronics", "Euronics"], ["tigota", "Tigotà"], ["acqua & sapone", "Acqua & Sapone"], ["acqua e sapone", "Acqua & Sapone"], ["rewe", "REWE"], ["edeka", "EDEKA"], ["mercadona", "Mercadona"], ["auchan", "Auchan"], ["leclerc", "E.Leclerc"], ["tesco", "Tesco"], ["sainsbury", "Sainsbury's"], ["emisfero", "Emisfero"], ["misfero", "Emisfero"], ["sfero", "Emisfero"], ["gros", "GROS"], ["elite", "Elite"], ["prix", "Prix"], ["deco", "Decò"], ["dpiu", "Dpiù"], ["mercato", null]].filter(c => c[1]);
const lcs = (a, b) => { let best = 0; for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) { let k = 0; while (a[i + k] && a[i + k] === b[j + k]) k++; if (k > best) best = k; } return best; };
export function findChain(text) {
  const n = norm(text).replace(/\s+/g, " ");
  // nomi lunghi: basta l'inizio della parola ("sferoò" letto dal logo); corti: parola intera
  for (const [k, name] of CHAINS) if (new RegExp(`(^|[^a-z])${k.replace(/[&']/g, m => "\\" + m)}${k.length >= 5 ? "" : "([^a-z]|$)"}`).test(n)) return name;
  // logo letto male ("CMISFEF" per EMISFERO): nelle prime righe, una parola che ha in comune con il nome della catena
  // un pezzo di almeno 5 lettere, pari ad almeno il 60% del nome (solo nomi lunghi, per non sbagliare)
  const head = norm(String(text).split("\n").slice(0, 8).join(" ")).split(/\s+/).filter(w => w.length >= 5);
  for (const [k, name] of CHAINS) { if (k.length < 7 || /\s/.test(k)) continue; for (const w of head) { const L = lcs(w, k); if (L >= 5 && L >= k.length * 0.6) return name; } }
  const w = String(text).match(/www\s?\.\s?([a-z0-9-]{3,30})\.(?:it|com|de|fr|es|eu|co\.uk)/i);
  return w ? w[1].charAt(0).toUpperCase() + w[1].slice(1).toLowerCase() : null;
}

/** @returns {{items:{name,amount,qty}[], total:number|null, date:string|null, store:string|null, vouchers:number, sum:number}} */
export function parseReceipt(text) {
  const L = lines(text), items = [];
  let total = null, vouchers = 0, date = null, store = findChain(text), stop = false, pendingQty = null, lastName = null;
  const push = (name, amount, qty) => {
    if (amount <= 0 || amount > 5000) return;
    const it = { name: titleCase(tidy(cleanName(name)) || cleanName(name) || "?"), amount: round2(amount) };
    if (qty) { it.qty = qty; it.qtyDone = 1; } else if (pendingQty) { it.qty = pendingQty; it.qtyDone = 1; pendingQty = null; }
    items.push(it); lastName = null;
  };
  for (let i = 0; i < L.length; i++) {
    // OCR: il codice IVA dopo il prezzo attaccato al prezzo ("7,001" = 7,00 + 1); non per pesi e quantità ("0,512 kg x")
    // OCR: virgola letta come "°" ("0° 86" = 0,86)
    const l0 = L[i].replace(/(\b\d{1,3})\s?[°º]\s?(\d{2})\b/g, "$1,$2");
    const l = /\b(?:kg|g|lt?)\b|[x×*]/i.test(l0) ? l0 : l0.replace(/(\d[.,]\d{2})\d(?=[^\d]*$)/, "$1 ");
    // codici articolo (IKEA "Art/Ean 123", "Cod. 456"): non sono prodotti e non interrompono il nome sopra
    if (CODE.test(l)) continue;
    if (!date) date = findDate(l);
    if (!store && i < 4 && /[a-z]{3}/i.test(l) && !/\d{3,}/.test(l)) store = l.slice(0, 40);
    const am = findAmounts(l);
    if (hasAny(l, VOUCHER) && am.length) { vouchers = round2(vouchers + Math.abs(am[am.length - 1])); continue; }
    if (hasAny(l, TOTAL) && !hasAny(l, ["subtotale", "subtotal"])) {
      // OCR: lo zero finale del totale letto come "%", "o", "°" ("30,9%")
      const tam = am.length ? am : findAmounts(l.replace(/(\d[.,]\d)[%°oO](?!\w)/g, "$10"));
      if (tam.length && total == null) total = Math.abs(tam[tam.length - 1]); stop = true; continue;
    }
    if (stop) continue;
    if (!am.length) {
      // riga di solo nome (il prezzo è sotto, es. "Crodino" / "3 x 2,50 7,50")
      lastName = items.length || i > 3 ? (/\p{L}{3}/u.test(l) && !hasAny(l, SKIP) && !/\d{5,}/.test(l) ? l : null) : null;
      continue;
    }
    if (hasAny(l, SKIP)) { lastName = null; continue; }
    let amount = am[am.length - 1];
    let name = l.replace(/-?\s?\d{1,3}(?:[.\s]\d{3})*[.,]\d{2}-?.*$/, "").replace(/\b\d{1,2}([.,]\d+)?\s?%/g, "").replace(/[*#€]+/g, " ").trim();
    const q = l.match(QTY);
    // riga "2 x 1,29" sotto il nome: l'importo appartiene alla voce successiva o precedente
    if (q && !/\p{L}{3}/u.test(l.replace(QTY, "").replace(UNIT, ""))) {
      const qty = parseFloat(q[1].replace(",", ".")), next = L[i + 1], prev = items[items.length - 1];
      if (lastName) { push(lastName, am.length > 1 ? am[am.length - 1] : qty * am[0], qty); continue; }
      // il prodotto (con il totale) è sulla riga dopo: la quantità va a lui
      if (next && findAmounts(next).length && /\p{L}{3}/u.test(next)) { pendingQty = qty; continue; }
      if (prev && !prev.qtyDone) { prev.qty = qty; prev.qtyDone = 1; }
      continue;
    }
    const isDisc = amount < 0 || hasAny(l, DISCOUNT);
    if (isDisc) { const prev = items[items.length - 1]; if (prev) { prev.amount = round2(prev.amount - Math.abs(amount)); prev.discount = round2((prev.discount || 0) + Math.abs(amount)); } continue; }
    if (lastName && junk(name)) { push(lastName, amount); continue; }
    if (!/\p{L}{2}/u.test(cleanName(name))) {
      // solo importo: appartiene al nome sulla riga sopra
      if (lastName) { push(lastName, amount); continue; }
      if (i > 0 && items.length === 0) continue;
    }
    push(name, amount);
  }
  items.forEach(it => delete it.qtyDone);
  const sum = round2(items.reduce((a, b) => a + b.amount, 0));
  return { items, total, date, store, vouchers, sum };
}

// "|", "»", "_", "~", "=" e altri segni lasciati dall'OCR o dalla stampa
export const cleanName = s => String(s || "").replace(/[^\p{L}\p{N}\s.,'’/%&()+-]+/gu, " ").replace(/\s+([.,])/g, "$1").replace(/^[\s\p{P}\d]{0,3}(?=\p{L})/u, m => (/\d/.test(m) ? m.replace(/[^\d ]/g, "") : "")).replace(/[\s\p{P}]+$/u, "").replace(/\s+/g, " ").trim();
// segni sparsi del bordo letti come lettere: "I Pat piccole È", "Crodino I"
const tidy = s => s.replace(/^(?:[|Il!1]\s+)+(?=\p{L}{2})/u, "").replace(/(?:\s+(?:[^\p{Ll}\d\s]|\p{Lu}\p{Ll}?))+$/u, m => (/^\s+\p{Lu}\p{Ll}$/u.test(m) ? m : "")).trim();
const titleCase = s => s.toLowerCase().replace(/(^|\s)(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
export { norm };

/**
 * Unisce più letture dello stesso scontrino (OCR con impostazioni diverse): ogni lettura sbaglia righe diverse.
 * Le righe si allineano per nome; per ognuna vince l'importo più votato; se la somma non torna col totale,
 * prova le alternative viste (e le righe viste una volta sola) finché torna. Restituisce il risultato di parseReceipt.
 */
export function mergeReceipts(list) {
  list = list.filter(r => r && r.items);
  if (!list.length) return null;
  const ok = r => r.total != null && Math.abs(r.total - r.sum) < 0.02;
  const good = list.find(ok); if (good) return good;
  const key = n => norm(n).split(" ").filter(w => w.length > 2 && !/\d/.test(w)).slice(0, 3);
  const sim = (a, b) => { const A = key(a), B = key(b); if (!A.length || !B.length) return 0; const hit = A.filter(w => B.some(v => v === w || (w.length > 4 && v.length > 4 && (v.startsWith(w.slice(0, 4)) || w.startsWith(v.slice(0, 4)))))).length; return hit / Math.max(A.length, B.length); };
  // allineamento (come diff) di ogni lettura sulla lista unita
  const base = [...list].sort((a, b) => b.items.length - a.items.length)[0];
  let slots = base.items.map(it => ({ name: it.name, amts: [it.amount], qty: it.qty, seen: 1 }));
  for (const r of list) {
    if (r === base) continue;
    const A = slots, B = r.items, n = A.length, m = B.length, D = Array.from({ length: n + 1 }, () => new Float64Array(m + 1));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) { const s = sim(A[i].name, B[j].name); D[i][j] = Math.max(D[i + 1][j], D[i][j + 1], s >= 0.5 ? D[i + 1][j + 1] + s : -1); }
    const out = []; let i = 0, j = 0;
    while (i < n || j < m) {
      const s = i < n && j < m ? sim(A[i].name, B[j].name) : 0;
      if (i < n && j < m && s >= 0.5 && D[i][j] === D[i + 1][j + 1] + s) { A[i].amts.push(B[j].amount); A[i].seen++; if (!A[i].qty && B[j].qty) A[i].qty = B[j].qty; if (B[j].name.length < A[i].name.length) A[i].name = B[j].name; out.push(A[i]); i++; j++; }
      else if (j >= m || (i < n && D[i + 1][j] >= D[i][j + 1])) { out.push(A[i]); i++; }
      else { out.push({ name: B[j].name, amts: [B[j].amount], qty: B[j].qty, seen: 1 }); j++; }
    }
    slots = out;
  }
  // totale: il più votato tra quelli possibili (non più piccolo della voce più cara vista in almeno due letture)
  const tmax = Math.max(0, ...list.map(r => r.total || 0));
  const big = Math.max(0, ...slots.filter(s => s.amts.length > 1).map(s => Math.min(...s.amts)).filter(a => a <= tmax));
  const totals = list.map(r => r.total).filter(x => x != null && x >= big - 0.01), total = totals.length ? mode(totals) : null;
  // una "voce" che vale quanto il totale è la riga del totale finita sul nome sbagliato
  if (total != null && slots.length > 1) slots = slots.filter(s => !s.amts.every(a => Math.abs(a - total) < 0.01));
  for (const s of slots) { const c = {}; s.amts.forEach(a => (c[a] = (c[a] || 0) + 1)); s.cands = Object.entries(c).sort((a, b) => b[1] - a[1]).map(([a]) => +a); s.pick = s.cands[0]; s.on = true; }
  // una voce più cara del totale è letta male: un'altra lettura, o la stessa senza la cifra in più ("93,25" → 9,25)
  if (total != null) for (const s of slots) if (s.pick > total + 0.01) {
    const ok = s.cands.filter(a => a <= total + 0.01);
    if (ok.length) s.pick = ok[0];
    else { const [ip, dp = "00"] = s.pick.toFixed(2).split("."), alt = [...ip].map((_, i) => +(ip.slice(0, i) + ip.slice(i + 1) + "." + dp)).filter(v => v > 0 && v <= total); if (alt.length) { s.pick = Math.max(...alt); s.cands = [s.pick, ...s.cands]; } }
  }
  const sum = () => round2(slots.reduce((a, s) => a + (s.on ? s.pick : 0), 0));
  if (total != null && Math.abs(sum() - total) >= 0.02) {
    // ricerca piccola: alternative degli importi e righe viste una sola volta (quando le letture sono più di una)
    const vars = slots.filter(s => s.cands.length > 1 || (s.seen === 1 && list.length > 1)).slice(0, 12);
    const opts = vars.map(s => [...s.cands.map(a => ({ on: true, a })), ...(s.seen === 1 && list.length > 1 ? [{ on: false, a: s.pick }] : [])]);
    let best = null; const fixed = round2(slots.filter(s => !vars.includes(s)).reduce((a, s) => a + s.pick, 0));
    const rec = (k, acc, ch) => {
      if (best && best.cost === 0) return;
      if (k === vars.length) { if (Math.abs(round2(acc) - total) < 0.02) { const cost = ch.reduce((a, c, i) => a + (opts[i].indexOf(c) ? 1 : 0), 0); if (!best || cost < best.cost) best = { cost, ch: [...ch] }; } return; }
      for (const o of opts[k]) { ch.push(o); rec(k + 1, acc + (o.on ? o.a : 0), ch); ch.pop(); }
    };
    if (opts.reduce((a, o) => a * o.length, 1) <= 50000) rec(0, fixed, []);
    if (best) best.ch.forEach((c, i) => { vars[i].on = c.on; vars[i].pick = c.a; });
    // nessuna combinazione torna: con molte letture si tengono le righe viste almeno due volte e con un nome vero
    else if (list.length >= 4) slots = slots.filter(s => s.seen >= 2 && /\p{L}{3}/u.test(s.name));
  }
  let items = slots.filter(s => s.on).map(s => ({ name: s.name, amount: s.pick, ...(s.qty ? { qty: s.qty } : {}) }));
  // i conti non tornano comunque (totale letto male): se una lettura da sola è più vicina al totale dell'unione, vince
  // lei (le letture sporche non aggiungono voci a quella buona)
  if (total != null) {
    const off = its => Math.abs(round2(its.reduce((a, b) => a + b.amount, 0)) - total);
    if (off(items) >= 0.02) { const one = list.filter(r => r.items.length).sort((a, b) => off(a.items) - off(b.items) || b.items.length - a.items.length)[0]; if (one && off(one.items) < off(items) - 0.01) items = one.items.map(x => ({ ...x })); }
  }
  const r0 = list.find(r => r.total === total) || base;
  // negozio: quello riconosciuto come catena nel maggior numero di letture
  const chains = list.map(r => r.store).filter(x => x && CHAINS.some(c => c[1] === x)), store = chains.length ? mode2(chains) : r0.store;
  return { ...r0, store, items, total, sum: round2(items.reduce((a, b) => a + b.amount, 0)), merged: list.length };
}
const mode2 = a => { const c = {}; a.forEach(x => (c[x] = (c[x] || 0) + 1)); return Object.entries(c).sort((x, y) => y[1] - x[1])[0][0]; };
const mode = a => { const c = {}; a.forEach(x => (c[x] = (c[x] || 0) + 1)); return +Object.entries(c).sort((x, y) => y[1] - x[1])[0][0]; };

/**
 * Testo ricostruito dalle posizioni delle parole: ogni importo della colonna di destra va alla riga di testo più vicina
 * (centro verticale), saltando le righe di codici articolo, che non hanno mai un prezzo. Serve per gli scontrini
 * arricciati o fotografati storti, dove il prezzo non sta sulla stessa riga del nome.
 * lines: [{ words: [{ text, bbox: {x0,y0,x1,y1} }] }], width: larghezza dell'immagine.
 */
export function layoutText(lines, width) {
  const AM = /^-?\d{1,4}[.,]\d{2}$/, rows = [], prices = [];
  for (const l of lines || []) {
    const keep = [];
    for (const w of l.words || []) {
      const t = String(w.text || "").replace(/[^\d.,-]+$/, "").replace(/^[^\d-]+/, "");
      if (AM.test(t) && w.bbox.x0 > width * 0.5) prices.push({ t, y: (w.bbox.y0 + w.bbox.y1) / 2, x: w.bbox.x0 });
      else if (!(w.bbox.x0 > width * 0.6 && /^[\d|il!]{1,2}\W?$/i.test(w.text))) keep.push(w); // codice IVA "1" in fondo
    }
    if (!keep.length) continue;
    const y0 = Math.min(...keep.map(w => w.bbox.y0)), y1 = Math.max(...keep.map(w => w.bbox.y1));
    const text = keep.map(w => w.text).join(" ");
    // retta per i centri delle parole: una riga inclinata (carta piegata) si prolunga fino alla colonna dei prezzi
    const P = keep.map(w => [(w.bbox.x0 + w.bbox.x1) / 2, (w.bbox.y0 + w.bbox.y1) / 2]), n = P.length, mx = P.reduce((a, q) => a + q[0], 0) / n, my = P.reduce((a, q) => a + q[1], 0) / n;
    const vx = P.reduce((a, q) => a + (q[0] - mx) ** 2, 0), slope = n > 1 && vx > 0 ? Math.max(-0.12, Math.min(0.12, P.reduce((a, q) => a + (q[0] - mx) * (q[1] - my), 0) / vx)) : 0;
    const hh = Math.max(...keep.map(w => w.bbox.y1 - w.bbox.y0));
    rows.push({ text, y: (y0 + y1) / 2, at: x => my + slope * (x - mx), h: hh, code: CODE.test(text), price: [] });
  }
  for (const p of prices) {
    let best = null, bd = Infinity;
    for (const r of rows) { if (r.code) continue; const d = Math.abs(r.at(p.x) - p.y); if (d < bd) { bd = d; best = r; } }
    if (best && bd < Math.max(best.h, 12) * 1.6) best.price.push(p);
    else rows.push({ text: "", y: p.y, at: () => p.y, h: 0, code: true, price: [p] });
  }
  rows.sort((a, b) => a.y - b.y);
  return rows.map(r => [r.text, ...r.price.sort((a, b) => a.x - b.x).map(p => p.t)].join("   ").trim()).filter(Boolean).join("\n");
}

/**
 * Nomi e prezzi abbinati per ordine (il primo nome col primo prezzo…), tra l'intestazione e la riga del TOTALE.
 * Per la carta stropicciata, dove la colonna dei prezzi è spostata rispetto ai nomi e la posizione inganna.
 * Vale solo se i nomi e i prezzi sono tanti uguali; altrimenti "". lines/width come layoutText.
 */
export function orderText(lines, width) {
  const AM = /^-?\d{1,4}[.,]\d{2}$/, left = [], am = [];
  for (const l of lines || []) {
    const ws = [];
    for (const w of l.words || []) {
      const t = String(w.text || "").replace(/[^\d.,-]+$/, "").replace(/^[^\d-]+/, ""), y = (w.bbox.y0 + w.bbox.y1) / 2;
      if (w.bbox.x0 > width * 0.5) { if (AM.test(t)) am.push({ t, y }); } else ws.push(w);
    }
    if (ws.length) left.push({ text: ws.map(w => w.text).join(" "), y: ws.reduce((a, w) => a + (w.bbox.y0 + w.bbox.y1) / 2, 0) / ws.length });
  }
  left.sort((a, b) => a.y - b.y); am.sort((a, b) => a.y - b.y);
  const ti = left.findIndex(r => hasAny(r.text, TOTAL) && !hasAny(r.text, ["subtotale", "subtotal", "articoli"]));
  if (ti < 1) return "";
  // intestazione delle colonne: in qualunque colonna, anche spezzata dall'OCR ("DESCRIZI ONE", "PREZZOCE)")
  const HEAD = /descri\s?zi|prezz|price|preis|prix|precio|documento\s?comm/i;
  let yH = null; for (const l of lines || []) { const t = (l.words || []).map(w => w.text).join(" "), y = (l.words || []).reduce((a, w) => a + (w.bbox.y0 + w.bbox.y1) / 2, 0) / ((l.words || []).length || 1); if (HEAD.test(t) && y < left[ti].y && (yH == null || y > yH)) yH = y; }
  if (yH == null) return "";
  const hi = left.reduce((k, r, i) => (r.y <= yH + 5 ? i : k), -1);
  const names = left.slice(hi + 1, ti).filter(r => /\p{L}{3}/u.test(r.text) && !CODE.test(r.text) && !hasAny(r.text, SKIP) && !/^\W*artic/i.test(r.text));
  const yT = left[ti].y, tot = am.reduce((b, a) => (!b || Math.abs(a.y - yT) < Math.abs(b.y - yT) ? a : b), null);
  if (!tot) return "";
  const prices = am.filter(a => a.y > yH && a.y < tot.y);
  if (!names.length || names.length !== prices.length) return "";
  return [...left.slice(0, hi + 1).map(r => r.text), ...names.map((r, i) => r.text + "   " + prices[i].t), "TOTALE COMPLESSIVO   " + tot.t].join("\n");
}
