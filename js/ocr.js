// Ponte verso il motore di Schiaccia PDF (pdf-tiny-tools): Tesseract e pdf.js pubblicati sullo stesso
// dominio (marketto.github.io/pdf-tiny-tools/vendor/). Se non raggiungibili si usa la CDN jsDelivr.
// Pulizia della foto (luce del foglio, inclinazione) ripresa dalla sezione «scansione» di Schiaccia PDF.

const SHARED = new URL("/pdf-tiny-tools/vendor/", location.origin).href;
const CDN = {
  tess: "https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/",
  core: "https://cdn.jsdelivr.net/npm/tesseract.js-core@6.1.2/",
  lang: l => `https://cdn.jsdelivr.net/npm/@tesseract.js-data/${l}/4.0.0_best_int`,
  pdf: "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/",
};
// lingue presenti in pdf-tiny-tools/vendor/tesseract/lang
const LOCAL = new Set("ara bel bos bul ces chi_sim dan deu ell eng est fin fra gle hrv hun isl ita lav lit mkd mlt nld nor pol por ron rus slk slv spa sqi srp swe ukr".split(" "));
const TESS = { it: "ita", en: "eng", es: "spa", fr: "fra", pt: "por", de: "deu", nl: "nld", pl: "pol", ro: "ron", cs: "ces", sk: "slk", sl: "slv", hr: "hrv", hu: "hun", sv: "swe", da: "dan", fi: "fin", et: "est", lv: "lav", lt: "lit", el: "ell", bg: "bul", ru: "rus", uk: "ukr", sr: "srp", mk: "mkd", be: "bel", ga: "gle", mt: "mlt", is: "isl", no: "nor", sq: "sqi", bs: "bos", ca: "cat", eu: "eus", gl: "glg", lb: "ltz", tr: "tur", zh: "chi_sim", ja: "jpn", ko: "kor", ar: "ara" };
export const ocrLang = appLang => TESS[appLang] || "eng";

let shared = null;
async function sharedOk() {
  if (shared != null) return shared;
  try { shared = (await fetch(SHARED + "tesseract/tesseract.min.js", { method: "HEAD" })).ok; } catch { shared = false; }
  return shared;
}
const scripts = {};
const loadScript = src => (scripts[src] ||= new Promise((res, rej) => document.head.appendChild(Object.assign(document.createElement("script"), { src, onload: res, onerror: () => { delete scripts[src]; rej(new Error("load " + src)); } }))));

let worker = null, workerKey = "", idle = 0, sharedW = false;
async function getWorker(lang, onStatus) {
  // un motore solo: quello di Schiaccia PDF (Scansione.ocrRecWorker), per le lingue che ha; il nostro solo come riserva
  const S = LOCAL.has(lang) ? await scansione() : null;
  if (S) { try { const w = await S.ocrRecWorker(lang); sharedW = true; if (worker) { const o = worker; worker = null; workerKey = ""; (await o).terminate(); } return w; } catch { /* riserva sotto */ } }
  sharedW = false;
  const local = await sharedOk();
  const key = lang + (local ? "L" : "C");
  if (worker && workerKey === key) return worker;
  if (worker) { (await worker).terminate(); worker = null; }
  const tb = local ? SHARED + "tesseract/" : CDN.tess;
  await loadScript(tb + "tesseract.min.js");
  const opts = local
    ? { workerPath: tb + "worker.min.js", corePath: tb + "tesseract-core-simd.wasm.js", langPath: LOCAL.has(lang) ? tb + "lang" : CDN.lang(lang), workerBlobURL: false }
    : { workerPath: tb + "worker.min.js", corePath: CDN.core, langPath: CDN.lang(lang) };
  opts.logger = m => onStatus && onStatus(m.status, m.progress);
  workerKey = key;
  worker = window.Tesseract.createWorker(lang, 1, opts);
  worker.catch(() => { worker = null; workerKey = ""; });
  return worker;
}
/** Chiude i motori (il nostro e quello di Schiaccia): dopo uno schermo spento si riparte puliti. */
export function reset() {
  clearTimeout(idle);
  if (worker) { const w = worker; worker = null; workerKey = ""; Promise.resolve(w).then(x => x.terminate()).catch(() => {}); }
  try { window.Scansione?.ocrFree(); } catch { /* niente */ }
}
function touch() { if (sharedW) return window.Scansione?.ocrTouch(); clearTimeout(idle); idle = setTimeout(async () => { if (worker) { const w = worker; worker = null; workerKey = ""; (await w).terminate(); } }, 60000); }

/** OCR di un'immagine (File/Blob/canvas). mode "digits" per i contatori. */
export async function recognize(src, { lang = "eng", mode = "text", onStatus, scale = 1, psm = "6" } = {}) {
  const cv = src instanceof HTMLCanvasElement ? src : await prepare(src, mode, scale);
  const w = await getWorker(lang, onStatus);
  await w.setParameters(mode === "digits" ? { tessedit_char_whitelist: "0123456789.,", tessedit_pageseg_mode: "7" } : { tessedit_char_whitelist: "", tessedit_pageseg_mode: psm, preserve_interword_spaces: "1" });
  const r = await w.recognize(cv, {}, { text: true, blocks: mode !== "digits" });
  if (mode === "digits") await w.setParameters({ tessedit_char_whitelist: "" });
  touch();
  // righe con le parole e le loro posizioni (per gli scontrini arricciati: vedi layoutText in parsers/receipt.js)
  const lines = [];
  for (const b of r.data.blocks || []) for (const p of b.paragraphs || []) for (const l of p.lines || [])
    lines.push({ bbox: l.bbox, words: (l.words || []).map(w => ({ text: w.text, bbox: w.bbox })) });
  return { text: r.data.text, conf: r.data.confidence, canvas: cv, lines, width: cv.width };
}

// ---------- foglio da una foto: la scansione di Schiaccia PDF (R-APP-21) ----------
// Bordi del foglio (anche azzurro, storto o in prospettiva), pieghe, ombre, orientamento: window.Scansione da
// /pdf-tiny-tools/scansione.js sullo stesso dominio. Se non c'è (sviluppo, CDN) si usa la preparazione qui sotto.
let scanP = null;
export function scansione() {
  return (scanP ||= (async () => {
    if (!(await sharedOk())) return null;
    if (!window.CONFIG) await loadScript(new URL("/pdf-tiny-tools/config.js", location.origin).href);
    await loadScript(new URL("/pdf-tiny-tools/scansione.js", location.origin).href);
    return window.Scansione?.pagina ? window.Scansione : null;
  })().catch(() => null));
}
/** Copia per l'OCR (grigio, contrasto, ingrandita di k): Scansione.perOcr di Schiaccia. */
export const variant = (cv, k = 1) => window.Scansione.perOcr(cv, k);
/** Parole con la posizione, a fasce raddrizzate sui fogli piegati (Scansione.parole, R-SCN-37), come righe per layoutText. */
export async function words(cv, { lang = "eng", columns } = {}) {
  const ws = await window.Scansione.parole(cv, { lingua: lang, psm: "6", colonne: columns }), by = new Map();
  for (const w of ws) { if (!by.has(w.line)) by.set(w.line, []); by.get(w.line).push({ text: w.t, bbox: { x0: w.x, y0: w.y, x1: w.x1, y1: w.y1 } }); }
  return { lines: [...by.values()].map(words => ({ words })), width: cv.width };
}
/** La pagina raddrizzata e pulita (canvas), o null se la scansione di Schiaccia non c'è o non riesce. */
export async function page(file, { max = 4000 } = {}) {
  const S = await scansione(); if (!S) return null;
  try { return (await S.pagina(file, { max, stile: "doc" })).canvas; } catch { return null; }
}





// ---------- preparazione della foto (riserva, senza Schiaccia) ----------
export async function toCanvas(file, max = 2400, { crop = false, scale = 1 } = {}) {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(async () => {
    const img = new Image(); img.src = URL.createObjectURL(file); await img.decode(); return img;
  });
  // ritaglio sul foglio: via tavolo, legno e mani, che l'OCR legge come lettere a caso
  const r = crop ? findPaper(bmp) : null, sx = r ? r.x : 0, sy = r ? r.y : 0, sw = r ? r.w : bmp.width, sh = r ? r.h : bmp.height;
    let k = Math.min(1, max / Math.max(sw, sh));
  // foto ritagliata: si tiene la risoluzione piena del foglio (prima si rimpiccioliva tutta la foto a 2400 px)
  if (crop) k = Math.min(scale, 4200 / Math.max(sw, sh), Math.sqrt(8e6 / (sw * sh)));
  const c = document.createElement("canvas"); c.width = Math.round(sw * k); c.height = Math.round(sh * k);
  const g = c.getContext("2d"); g.imageSmoothingQuality = "high";
  g.drawImage(bmp, sx, sy, sw, sh, 0, 0, c.width, c.height);
  return c;
}

/** Riquadro del foglio (chiaro e poco colorato) più grande nella foto, o null se occupa già quasi tutta l'immagine. */
export function findPaper(bmp) {
  const W = 240, k = W / Math.max(bmp.width, bmp.height), w = Math.max(8, Math.round(bmp.width * k)), h = Math.max(8, Math.round(bmp.height * k));
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d", { willReadFrequently: true }); g.drawImage(bmp, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h).data;
  return paperBox(d, w, h, bmp.width / w, bmp.height / h);
}
export function paperBox(d, w, h, fx = 1, fy = 1) {
  const n = w * h, V = new Float32Array(n), Sat = new Float32Array(n);
  let vmax = 0;
  for (let i = 0; i < n; i++) { const r = d[i * 4], gg = d[i * 4 + 1], b = d[i * 4 + 2], mx = Math.max(r, gg, b), mn = Math.min(r, gg, b); V[i] = mx; Sat[i] = mx ? (mx - mn) / mx : 0; if (mx > vmax) vmax = mx; }
  const m = new Uint8Array(n); for (let i = 0; i < n; i++) m[i] = Sat[i] < 0.26 && V[i] > vmax * 0.42 ? 1 : 0;
  // componente connessa più grande
  const lab = new Int32Array(n).fill(-1), st = []; let best = null;
  for (let i = 0; i < n; i++) {
    if (!m[i] || lab[i] >= 0) continue;
    let cnt = 0, x0 = w, y0 = h, x1 = 0, y1 = 0; st.push(i); lab[i] = i;
    while (st.length) {
      const j = st.pop(), x = j % w, y = (j / w) | 0; cnt++;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (const q of [j - 1, j + 1, j - w, j + w]) { if (q < 0 || q >= n || lab[q] >= 0 || !m[q] || (q % w === 0 && j % w === w - 1) || (j % w === 0 && q % w === w - 1)) continue; lab[q] = i; st.push(q); }
    }
    if (!best || cnt > best.cnt) best = { cnt, x0, y0, x1, y1 };
  }
  if (!best) return null;
  const bw = best.x1 - best.x0 + 1, bh = best.y1 - best.y0 + 1, area = (bw * bh) / n;
  if (area < 0.06 || area > 0.85 || best.cnt < bw * bh * 0.45) return null;
  const mx = Math.round(bw * 0.03) + 1, my = Math.round(bh * 0.015) + 1;
  const x = Math.max(0, best.x0 - mx), y = Math.max(0, best.y0 - my), X = Math.min(w, best.x1 + 1 + mx), Y = Math.min(h, best.y1 + 1 + my);
  return { x: Math.round(x * fx), y: Math.round(y * fy), w: Math.round((X - x) * fx), h: Math.round((Y - y) * fy) };
}

/** Grigio, luce del foglio uniforme (massimo per riquadri 16×16, sfumato), contrasto, raddrizzamento. */
export async function prepare(file, mode = "text", scale = 1, crop = mode !== "digits") {
  const c = await toCanvas(file, mode === "digits" ? 1600 : 2400, { crop, scale });
  // luce uniforme e inclinazione: quelle di Schiaccia PDF (Scansione.luceUniforme, findSkew); senza Schiaccia la foto così com'è
  const S = await scansione(); if (!S) return c;
  const u = S.luceUniforme(c, { sfondo: mode !== "digits" }), skew = S.findSkew(u);
  return skew ? S.turnCanvas(u, 0, -skew) : u;
}


// ---------- PDF ----------
let pdfjs = null;
async function pdfLib() {
  if (pdfjs) return pdfjs;
  const base = (await sharedOk()) ? SHARED + "pdfjs/" : CDN.pdf;
  pdfjs = await import(base + "pdf.min.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = base + "pdf.worker.min.mjs";
  return pdfjs;
}
/** Testo di un PDF, riga per riga. Se una pagina non ha testo (scansione) la si legge con l'OCR. */
export async function pdfText(file, { lang = "eng", onStatus, maxPages = 12 } = {}) {
  const lib = await pdfLib();
  const doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  let out = [];
  for (let p = 1; p <= Math.min(doc.numPages, maxPages); p++) {
    const page = await doc.getPage(p), tc = await page.getTextContent();
    const rows = new Map();
    for (const it of tc.items) { if (!it.str?.trim()) continue; const y = Math.round(it.transform[5] / 3); const r = rows.get(y) || []; r.push([it.transform[4], it.str]); rows.set(y, r); }
    if (rows.size > 3) {
      out.push([...rows.entries()].sort((a, b) => b[0] - a[0]).map(([, r]) => r.sort((a, b) => a[0] - b[0]).map(x => x[1]).join(" ")).join("\n"));
    } else {
      const vp = page.getViewport({ scale: 2 }), c = document.createElement("canvas"); c.width = vp.width; c.height = vp.height;
      await page.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
      out.push((await recognize(c, { lang, onStatus })).text);
    }
  }
  return out.join("\n");
}
