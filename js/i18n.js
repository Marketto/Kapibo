// Testi: un JSON piatto per lingua in locales/<codice>.json; inglese come riserva.
// Markup: data-i18n="chiave" (testo), data-i18n-attr="aria-label:chiave|placeholder:chiave".

export const LANGS = {
  sq: "Shqip", eu: "Euskara", be: "Беларуская", bs: "Bosanski", bg: "Български", ca: "Català",
  hr: "Hrvatski", cs: "Čeština", da: "Dansk", nl: "Nederlands", en: "English", et: "Eesti",
  fi: "Suomi", fr: "Français", gl: "Galego", de: "Deutsch", el: "Ελληνικά", hu: "Magyar",
  is: "Íslenska", ga: "Gaeilge", it: "Italiano", lv: "Latviešu", lt: "Lietuvių", lb: "Lëtzebuergesch",
  mk: "Македонски", mt: "Malti", no: "Norsk", pl: "Polski", pt: "Português", ro: "Română",
  ru: "Русский", sr: "Српски", sk: "Slovenčina", sl: "Slovenščina", es: "Español", sv: "Svenska",
  tr: "Türkçe", uk: "Українська", zh: "简体中文", ja: "日本語", ko: "한국어", ar: "العربية",
};
export const RTL = new Set(["ar"]);
const LOCALE = { zh: "zh-CN", pt: "pt-PT", en: "en-GB", no: "nb-NO", sr: "sr-Cyrl" };
const FONTS = { ar: "Baloo+Bhaijaan+2:wght@400;600;800", ko: "Jua", zh: "ZCOOL+KuaiLe" };

let cur = "en", dict = {}, fallback = {};
const cache = {};
const load = code => (cache[code] ||= fetch(new URL(`../locales/${code}.json`, import.meta.url)).then(r => (r.ok ? r.json() : {})).catch(() => ({})));

export function detect(saved) {
  if (saved && LANGS[saved]) return saved;
  for (const l of navigator.languages || [navigator.language || "en"]) {
    let c = (l || "").toLowerCase().split("-")[0];
    if (c === "nb" || c === "nn") c = "no";
    if (LANGS[c]) return c;
  }
  return "en";
}

export async function setLang(code) {
  if (!LANGS[code]) code = "en";
  [fallback, dict] = await Promise.all([load("en"), load(code)]);
  cur = code;
  const html = document.documentElement;
  html.lang = LOCALE[code] || code;
  html.dir = RTL.has(code) ? "rtl" : "ltr";
  if (FONTS[code] && !document.getElementById("font-" + code)) {
    const l = Object.assign(document.createElement("link"), { id: "font-" + code, rel: "stylesheet", href: `https://fonts.googleapis.com/css2?family=${FONTS[code]}&display=swap` });
    document.head.appendChild(l);
  }
  apply(document);
}

export const lang = () => cur;
export const locale = () => LOCALE[cur] || cur;

export function t(key, vars) {
  let s = dict[key] ?? fallback[key] ?? key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
  return s;
}
export const has = key => key in dict || key in fallback;
export const list = key => t(key).split("|").map(s => s.trim()).filter(Boolean);

export function apply(root) {
  root.querySelectorAll("[data-i18n]").forEach(el => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll("[data-i18n-attr]").forEach(el => {
    for (const pair of el.dataset.i18nAttr.split("|")) { const [a, k] = pair.split(":"); if (a && k) el.setAttribute(a, t(k)); }
  });
}

/** Nome del mese "2026-11" → "novembre 2026" nella lingua corrente. */
export const monthLabel = (m, opt = { month: "long", year: "numeric" }) => {
  const [y, mo] = m.split("-").map(Number);
  return new Intl.DateTimeFormat(locale(), opt).format(new Date(y, mo - 1, 15));
};
