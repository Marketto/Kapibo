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

let worker = null, workerKey = "", idle = 0;
async function getWorker(lang, onStatus) {
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
function touch() { clearTimeout(idle); idle = setTimeout(async () => { if (worker) { const w = worker; worker = null; workerKey = ""; (await w).terminate(); } }, 60000); }

/** OCR di un'immagine (File/Blob/canvas). mode "digits" per i contatori. */
export async function recognize(src, { lang = "eng", mode = "text", onStatus } = {}) {
  const cv = src instanceof HTMLCanvasElement ? src : await prepare(src, mode);
  const w = await getWorker(lang, onStatus);
  await w.setParameters(mode === "digits" ? { tessedit_char_whitelist: "0123456789.,", tessedit_pageseg_mode: "7" } : { tessedit_char_whitelist: "", tessedit_pageseg_mode: "6" });
  const r = await w.recognize(cv);
  touch();
  return { text: r.data.text, conf: r.data.confidence, canvas: cv };
}

// ---------- preparazione della foto ----------
export async function toCanvas(file, max = 2400) {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(async () => {
    const img = new Image(); img.src = URL.createObjectURL(file); await img.decode(); return img;
  });
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas"); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  return c;
}

/** Grigio, luce del foglio uniforme (massimo per riquadri 16×16, sfumato), contrasto, raddrizzamento. */
export async function prepare(file, mode = "text") {
  let c = await toCanvas(file, mode === "digits" ? 1600 : 2400);
  const g = c.getContext("2d", { willReadFrequently: true }), w = c.width, h = c.height;
  const img = g.getImageData(0, 0, w, h), d = img.data, n = w * h, L = new Float32Array(n);
  for (let i = 0; i < n; i++) L[i] = d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11;
  if (mode !== "digits") {
    const S = 16, bw = Math.ceil(w / S), bh = Math.ceil(h / S), bg = new Float32Array(bw * bh), tmp = new Float32Array(bw * bh);
    for (let by = 0; by < bh; by++) for (let bx = 0; bx < bw; bx++) {
      let mx = 0; for (let y = by * S; y < Math.min(h, by * S + S); y += 2) for (let x = bx * S; x < Math.min(w, bx * S + S); x += 2) { const v = L[y * w + x]; if (v > mx) mx = v; }
      bg[by * bw + bx] = mx;
    }
    const pass = (src, dst, dx, dy, r, useMax) => { for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) { let a = 0, k = 0; for (let s = -r; s <= r; s++) { const X = x + dx * s, Y = y + dy * s; if (X < 0 || Y < 0 || X >= bw || Y >= bh) continue; const v = src[Y * bw + X]; if (useMax) a = Math.max(a, v); else { a += v; k++; } } dst[y * bw + x] = useMax ? a : a / k; } };
    pass(bg, tmp, 1, 0, 2, true); pass(tmp, bg, 0, 1, 2, true);
    for (let it = 0; it < 2; it++) { pass(bg, tmp, 1, 0, 3, false); pass(tmp, bg, 0, 1, 3, false); }
    for (let y = 0; y < h; y++) {
      const gy = Math.min(bh - 1.001, Math.max(0, y / S - 0.5)), y0 = gy | 0, fy = gy - y0;
      for (let x = 0; x < w; x++) {
        const gx = Math.min(bw - 1.001, Math.max(0, x / S - 0.5)), x0 = gx | 0, fx = gx - x0, j = y0 * bw + x0;
        const b = (bg[j] * (1 - fx) + bg[j + 1] * fx) * (1 - fy) + (bg[j + bw] * (1 - fx) + bg[j + bw + 1] * fx) * fy;
        L[y * w + x] = Math.min(255, (L[y * w + x] * 248) / Math.max(b, 40));
      }
    }
  }
  // livelli: 1° e 99° percentile → 0..255
  const hist = new Uint32Array(256); for (let i = 0; i < n; i++) hist[L[i] | 0]++;
  const pct = p => { let a = 0; for (let i = 0; i < 256; i++) { a += hist[i]; if (a >= n * p) return i; } return 255; };
  const lo = pct(0.01), hi = Math.max(lo + 1, pct(0.99));
  for (let i = 0; i < n; i++) { const v = Math.max(0, Math.min(255, ((L[i] - lo) * 255) / (hi - lo))); d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; }
  g.putImageData(img, 0, 0);
  const skew = findSkew(c);
  return skew ? turn(c, -skew) : c;
}

function findSkew(cv) {
  const k = Math.min(1, 1000 / Math.max(cv.width, cv.height)), c = document.createElement("canvas");
  c.width = Math.round(cv.width * k); c.height = Math.round(cv.height * k);
  const g = c.getContext("2d", { willReadFrequently: true }); g.drawImage(cv, 0, 0, c.width, c.height);
  const w = c.width, h = c.height, d = g.getImageData(0, 0, w, h).data, xs = [], ys = [];
  let sum = 0; for (let i = 0; i < w * h; i++) sum += d[i * 4];
  const lim = Math.min(150, sum / (w * h) - 45);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x += 2) if (d[(y * w + x) * 4] < lim) { xs.push(x - w / 2); ys.push(y - h / 2); }
  if (xs.length < 400) return 0;
  const diag = Math.ceil(Math.hypot(w, h)), bins = new Float64Array(diag + 2);
  const score = a => { const r = (a * Math.PI) / 180, sn = Math.sin(r), cs = Math.cos(r); bins.fill(0); for (let j = 0; j < xs.length; j++) { const b = Math.round(ys[j] * cs - xs[j] * sn + diag / 2); if (b >= 0 && b <= diag) bins[b]++; } let s2 = 0; for (let j = 1; j <= diag; j++) { const df = bins[j] - bins[j - 1]; s2 += df * df; } return s2; };
  let best = 0, bs = score(0); const s0 = bs;
  for (let a = -10; a <= 10; a += 0.5) if (a) { const sc = score(a); if (sc > bs) { bs = sc; best = a; } }
  let b2 = best; for (let a = best - 0.5; a <= best + 0.5; a += 0.1) { const sc = score(a); if (sc > bs) { bs = sc; b2 = a; } }
  return Math.abs(b2) >= 0.2 && bs > s0 * 1.05 ? Math.round(b2 * 10) / 10 : 0;
}
function turn(src, deg) {
  const c = document.createElement("canvas"); c.width = src.width; c.height = src.height;
  const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
  g.translate(c.width / 2, c.height / 2); g.rotate((deg * Math.PI) / 180); g.drawImage(src, -src.width / 2, -src.height / 2);
  return c;
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
