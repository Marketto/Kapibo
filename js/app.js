// Kapibo — interfaccia. Sezioni: avvio · utilità · mese · scansione · consumi · grafici · altro · dialoghi · sync.
import { t, setLang, detect, lang, locale, LANGS, monthLabel, apply } from "./i18n.js";
import { createStore, idbGet, idbSet, monthSummary, prevMonth, nextMonth, monthOf, today, uid, live, normalize, merge } from "./store.js";
import { guessCats, catName, catIcon, norm, isGrocer } from "./categories.js";
import { fmt as fmtMoney, parseAmount, round2, fmtNum } from "./money.js";
import * as kapi from "./mascot.js";
import { series, catAverages, tips, usage, unitPrice, voucherBalance, billCostByMonth, billMonths, catTrends, productTrends, trendEnd, trendTips, TREND_WINDOWS, yoy, meterYoy } from "./stats.js";
import { donut, hbars, timeline } from "./charts.js";
import { APP_VERSION, CHANGELOG } from "./version.js";
import * as sync from "./sync/index.js";
import * as dbx from "./sync/dropbox.js";
import * as gd from "./sync/gdrive.js";
import * as ai from "./ai.js";
import * as legal from "./legal.js";
import * as tour from "./tour.js";
import * as inst from "./install.js";
import * as ch from "./cheer.js";
import { STICKERS, earned } from "./stickers.js";
import { jarSVG } from "./jar.js";
import { CONFIG } from "./config.js";

// ---------- utilità ----------
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const store = createStore();
const S = () => store.get();
let cur = monthOf(today()), tab = "month", scanState = null;
const money = n => fmtMoney(n, locale(), S().settings.currency || "EUR");
const cats = () => store.cats();
const catById = id => cats().find(c => c.id === id) || { id, emoji: "✨", color: "#bdbdbd", name: id };
const cname = c => catName(c, t);
const num = v => { const n = parseAmount(v); return n == null ? null : n; };
const ic = n => `<i class="ki ki-${n}" aria-hidden="true"></i>`;
const lsGet = k => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch {} };

function toast(msg, action) {
  const el = $("#toast"); el.innerHTML = `<span>${esc(msg)}</span>`; el.hidden = false;
  if (action) { const b = document.createElement("button"); b.textContent = action.label; b.onclick = () => { el.hidden = true; action.run(); }; el.appendChild(b); }
  clearTimeout(el._t); el._t = setTimeout(() => (el.hidden = true), action ? 9000 : 3200);
}
const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const ssGet = k => { try { return sessionStorage.getItem(k); } catch { return null; } };
const ssSet = k => { try { sessionStorage.setItem(k, "1"); } catch {} };
const nLive = () => live(S().entries).length;

// ---------- Kapi commenta, adesivi ----------
/** Sblocca gli adesivi meritati (più quelli segnalati da un evento) con coriandoli e Kapi amica. */
function unlock(...ev) {
  const have = S().settings.stickers || {}, ids = new Set(STICKERS.map(x => x.id));
  const fresh = [...new Set([...earned(S(), today()), ...ev])].filter(id => ids.has(id) && !have[id]);
  if (!fresh.length) return;
  const at = Date.now(); store.setSettings({ stickers: { ...have, ...Object.fromEntries(fresh.map(id => [id, at])) } });
  kapi.confetti(30); fresh.forEach(id => ch.cheer("sticker", { name: t("st.k." + id) }, { big: true }));
}
/** Categoria del mese ancora sotto la sua media a 6 mesi (una volta per categoria e mese, per sessione). */
function underAvg(c, m) {
  const key = "ua" + m + c; if (ssGet(key)) return false;
  const a = catAverages(series(S(), 7, prevMonth(m)).filter(x => x.m < m).slice(-6))[c], v = monthSummary(S(), m).byCat[c];
  if (!(a > 20 && v > 0 && v < a)) return false;
  ssSet(key); return true;
}
/** Dopo un salvataggio: un commento in più (traguardo, serie di giorni, sotto la media), poi gli adesivi. */
function afterSave({ say, before = nLive(), cats = [], m = cur, ev = [] }) {
  const mile = ch.milestoneCrossed(before, nLive()), days = ch.streakOf(live(S().entries).map(e => e.d), today()), sk = "st" + today();
  let extra = null;
  if (mile) extra = ["milestone", { n: mile }, 1];
  else if (days >= 3 && !ssGet(sk)) { ssSet(sk); extra = ["streak", { n: days }, 1]; }
  else { const c = cats.find(x => underAvg(x, m)); if (c) extra = ["underAvg", { cat: cname(catById(c)) }, 0]; }
  const run = a => a && ch.cheer(a[0], a[1] || {}, { big: !!a[2] });
  if (!say || say[2]) { run(say); if (extra?.[2]) run(extra); } else run(extra || say);
  unlock(...ev);
}
const buzz = () => { if (S().settings.buzz) navigator.vibrate?.(12); };
const addSay = c => [ch.addEvent(c), {}, 0];

// ---------- avvio ----------
async function boot() {
  const saved = await idbGet("state");
  store.set(normalize(saved), { silent: true });
  await setLang(detect(lsGet("kapibo.lang")));
  kapi.mount($("#kapi"), $("#bubble"), ch.tap);
  ch.friend.mount(); ch.watchIdle();
  store.on(persist);
  bindChrome();
  try { if (await dbx.handleRedirect()) { toast(t("sync.connected", { p: "Dropbox" })); doSync(); } } catch (e) { toast(t(e.code || "sync.retry")); }
  const h = location.hash.slice(1); if (["month", "usage", "scan", "stats", "more"].includes(h)) tab = h;
  render();
  await legal.gate(kapi.KAPI_SVG);
  startTour(false);
  inst.onChange(() => tab === "more" && render());
  setTimeout(gd.preload, 3000);
  if (sync.connected().length) doSync();
  if ("serviceWorker" in navigator && location.protocol === "https:") registerSW();
}

let saveT = 0, syncT = 0;
function persist(state) {
  clearTimeout(saveT); saveT = setTimeout(() => idbSet("state", state), 250);
  if (sync.connected().length) { clearTimeout(syncT); syncT = setTimeout(doSync, 5000); }
  render();
}

function bindChrome() {
  document.querySelectorAll(".tabs button").forEach(b => b.addEventListener("click", () => go(b.dataset.tab)));
  $("#mPrev").onclick = () => { cur = prevMonth(cur); render(); };
  $("#mNext").onclick = () => { cur = nextMonth(cur); render(); };
  $("#mLabel").onclick = async () => {
    const r = await dialog(t("month.pick"), `<label class="f">${t("month.pick")}<input type="month" name="m" value="${cur}" required></label>`);
    if (r?.m) { cur = r.m; render(); }
  };
  $("#syncBtn").onclick = () => (sync.connected().length ? doSync(true) : go("more", "#cloud"));
  $("#main").addEventListener("click", onAction);
  bindHero();
  window.addEventListener("hashchange", () => { const h = location.hash.slice(1); if (h && h !== tab) go(h); });
}
/** Testata grande in cima alla pagina (versione, Condividi, Ko-fi); scorrendo resta quella discreta. */
const kofiUrl = () => CONFIG.kofi ? "https://ko-fi.com/" + encodeURIComponent(CONFIG.kofi) : "";
function bindHero() {
  const top = document.querySelector(".top"), row = $("#heroRow"); if (!top || !row) return;
  $("#verTxt").textContent = "v" + APP_VERSION;
  const k = $("#kofiBtn"); if (kofiUrl()) { k.href = kofiUrl(); k.hidden = false; }
  row.addEventListener("click", e => { const b = e.target.closest("[data-act]"); if (b) onAction({ target: b }); });
  let raf = 0, on = null;
  const set = v => { if (v === on) return; on = v; top.classList.toggle("expanded", v); row.inert = !v; };
  const check = () => { raf = 0; const y = window.scrollY; set(y < 4 ? true : y > 24 ? false : (on ?? true)); };
  window.addEventListener("scroll", () => { if (!raf) raf = requestAnimationFrame(check); }, { passive: true });
  check();
}
async function shareApp() {
  const url = location.origin + location.pathname;
  try {
    if (navigator.share) { await navigator.share({ title: "Kapibo", text: t("share.text"), url }); ch.cheer("share", {}, { big: true }); }
    else { await navigator.clipboard.writeText(url); toast(t("share.copied")); ch.cheer("share", {}, { big: true }); }
  } catch (e) { if (e?.name === "AbortError") return; try { await navigator.clipboard.writeText(url); toast(t("share.copied")); } catch { toast(t("share.copied") + " " + url); } }
}
function go(next, focusSel) {
  tab = next; history.replaceState(null, "", "#" + next);
  if (next !== "scan") scanState = scanState?.busy ? scanState : null;
  render(); ch.cheerTab(next); window.scrollTo({ top: 0, behavior: "smooth" });
  if (next === "stats") { const good = trendTips(S(), trendEnd(cur, monthOf(today()))).find(x => x.tone === "good" && x.vars.cat); if (good) setTimeout(() => ch.cheer("trendGood", { cat: cname(catById(good.vars.cat)), pct: good.vars.pct }, { big: true }), 900); }
  if (focusSel) setTimeout(() => $(focusSel)?.scrollIntoView({ behavior: "smooth" }), 80); else $("#main").focus({ preventScroll: true });
}

let lastView = "";
const counts = {};
/** Numeri grandi che salgono in 600 ms (dal valore mostrato prima); niente con prefers-reduced-motion. */
function countUp(root) {
  root.querySelectorAll("[data-count]").forEach(el => {
    const k = el.dataset.count, to = +el.dataset.v, from = counts[k] ?? 0; counts[k] = to;
    if (calm() || from === to) return;
    const t0 = performance.now();
    const step = now => { const p = Math.min(1, (now - t0) / 600); el.textContent = money(from + (to - from) * (1 - Math.pow(1 - p, 3))); if (p < 1 && el.isConnected) requestAnimationFrame(step); else if (el.isConnected) el.textContent = money(to); };
    requestAnimationFrame(step);
  });
}
function render() {
  const vb = $("#verBtn"); if (vb) vb.setAttribute("aria-label", t("app.version", { v: APP_VERSION }) + " — " + t("o.news"));
  $("#mLabel").textContent = monthLabel(cur);
  document.querySelectorAll(".tabs button").forEach(b => (b.dataset.tab === tab ? b.setAttribute("aria-current", "page") : b.removeAttribute("aria-current")));
  const v = { month: viewMonth, scan: viewScan, usage: viewUsage, stats: viewStats, more: viewMore }[tab] || viewMonth;
  const main = $("#main"), y = window.scrollY;
  main.innerHTML = `<section>${v()}</section>`;
  apply(main);
  if (tab === "month") countUp(main);
  const vk = tab + cur;
  if (vk !== lastView && !calm()) main.querySelectorAll(".card, .list > li").forEach((el, i) => { if (i < 20) { el.classList.add("stg"); el.style.setProperty("--i", i); } });
  lastView = vk;
  if (tab === "scan" && scanState?.after) scanState.after();
  window.scrollTo(0, y);
}

// ---------- azioni (delegazione) ----------
async function onAction(e) {
  const b = e.target.closest("[data-act]"); if (!b) return;
  const a = b.dataset.act, id = b.dataset.id;
  const acts = {
    add: () => entryDialog({ cat: b.dataset.cat }),
    edit: () => entryDialog(S().entries.find(x => x.id === id)),
    meta: monthDialog, album: () => go("more", "#stickers"),
    cat: () => catDetail(id),
    kind: () => startScan(b.dataset.kind, b.dataset.cam === "1"),
    scanBack: () => { scanState = null; render(); },
    meter: () => meterDialog(S().meters.find(x => x.id === id)),
    reading: () => readingDialog(id),
    bill: () => billDialog(S().bills.find(x => x.id === id)),
    offer: () => offerDialog(S().offers.find(x => x.id === id)),
    import: () => $("#fileXls").click(), importDrive,
    backup: exportBackup, restore: () => $("#fileJson").click(),
    dbx: dropboxConnect, dbxOff: () => { dbx.disconnect(); render(); }, gd: gdriveConnect, gdOff: () => { gd.disconnect(); render(); },
    sync: () => doSync(true), newCat: () => catDialog(), editCat: () => catDialog(catById(id)),
    aiKey: aiDialog, news: newsDialog, share: shareApp, wipe: wipeAll,
    install: async () => { if (await inst.install()) { toast(t("inst.done")); kapi.confetti(30); kapi.mood("love"); } render(); },
    legal: () => legal.show(), tour: () => startTour(true),
  };
  acts[a]?.();
}

// ---------- mese ----------
function viewMonth() {
  const s = monthSummary(S(), cur), list = cats();
  const rows = Object.entries(s.byCat).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...rows.map(r => r[1]));
  const recent = live(S().entries).filter(e => e.m === cur).sort((a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : (b.u || 0) - (a.u || 0))).slice(0, 8);
  const sv = s.savings, unt = s.untracked;
  const got = Object.keys(S().settings.stickers || {}).length, pct = Math.round(Math.max(0, Math.min(100, (s.rate ?? 0) * 100)));
  const jar = `<div class="card jar-card"><div class="jar" role="img" aria-label="${esc(s.rate == null ? t("jar.ariaEmpty") : t("jar.aria", { pct }))}">${jarSVG(s.rate)}</div>
    <div><h3>${t("jar.title")}</h3><p class="muted">${s.rate == null ? t("jar.empty") : t("jar.label", { pct })}</p>
    <button class="chip stk-chip" data-act="album" aria-label="${esc(t("st.chip", { n: got, tot: STICKERS.length }))}">${ic("star")} ${got}/${STICKERS.length}</button></div></div>`;
  return `
  <div class="card">
    <div class="grid2">
      <div class="stat big"><small>${t("m.spent")}</small><b data-count="spent" data-v="${s.tracked}">${money(s.tracked)}</b></div>
      <div class="stat big"><small>${t("m.saved")}</small><b class="${sv == null ? "" : sv >= 0 ? "pos" : "neg"}" ${sv == null ? "" : `data-count="saved" data-v="${sv}"`}>${sv == null ? "—" : money(sv)}</b></div>
      <div class="stat"><small>${t("m.income")}</small><b>${money(s.income)}</b></div>
      <div class="stat"><small>${t("m.vouchers")}</small><b>${money(s.vUsed)} <span class="muted">/ ${money(s.vIn)}</span></b></div>
      <div class="stat"><small>${t("m.start")}</small><b>${s.start == null ? "—" : money(s.start)}</b></div>
      <div class="stat"><small>${t("m.end")}</small><b>${s.end == null ? "—" : money(s.end)}</b></div>
    </div>
    ${unt != null && Math.abs(unt) >= 1 ? `<p class="muted" style="margin:.8em 0 0">${t(unt > 0 ? "m.untracked" : "m.overtracked", { amt: money(Math.abs(unt)) })}</p>` : ""}
    <div class="btns"><button class="btn" data-act="add">${ic("plus")} ${t("m.addExpense")}</button><button class="btn soft" data-act="meta">${ic("coin")} ${t("m.editMeta")}</button></div>
  </div>
  ${jar}
  <div class="card"><h2>${t("m.byCat")}</h2>
    ${rows.length ? `<ul class="list">${rows.map(([id, v]) => { const c = catById(id); return `<li><button class="item" data-act="cat" data-id="${esc(id)}" style="--c:${c.color}">
      <span class="emo">${catIcon(c)}</span><span class="name">${esc(cname(c))}<span class="bar"><i style="--w:${(v / max) * 100}%;--c:${c.color}"></i></span></span><span class="amt">${money(v)}</span></button></li>`; }).join("")}</ul>`
    : empty("m.empty")}
  </div>
  ${recent.length ? `<div class="card"><h2>${t("m.recent")}</h2><ul class="list">${recent.map(entryRow).join("")}</ul></div>` : ""}
  <div class="card"><h3>${t("m.quick")}</h3><div class="chips">${list.filter(c => c.kind === "var").slice(0, 8).map(c => `<button class="chip" data-act="add" data-cat="${c.id}">${catIcon(c)}${esc(cname(c))}</button>`).join("")}</div></div>`;
}
const entryRow = e => { const c = catById(e.cat); return `<li><button class="item" data-act="edit" data-id="${e.id}" style="--c:${c.color}"><span class="emo">${catIcon(c)}</span>
  <span class="name">${esc(e.note || cname(c))}<br><small class="muted">${esc(new Date(e.d).toLocaleDateString(locale(), { day: "numeric", month: "short" }))} · ${esc(cname(c))}${e.items ? " · " + t("m.items", { n: e.items.length }) : ""}</small></span><span class="amt">${money(e.amt)}</span></button></li>`; };
const empty = key => `<div class="empty"><div class="hero-kapi">${kapi.KAPI_SVG}</div><p>${t(key)}</p></div>`;

async function catDetail(id) {
  const c = catById(id), es = live(S().entries).filter(e => e.m === cur && e.cat === id).sort((a, b) => (a.d < b.d ? 1 : -1));
  const r = await dialog(`${cname(c)}`, `<ul class="list">${es.map(entryRow).join("")}</ul>`, { ok: t("m.addHere"), cancel: t("ui.close") });
  if (r) entryDialog({ cat: id });
}

// ---------- dialoghi ----------
/** Apre il dialogo con campi HTML; risolve con i valori del modulo o null. */
function dialog(title, body, { ok = t("ui.save"), cancel = t("ui.cancel"), extra = "", onOpen } = {}) {
  const d = $("#dlg"), f = $("#dlgForm");
  f.innerHTML = `<div class="dlg-head"><h2 id="dlgTitle">${esc(title)}</h2><button class="icon-btn" value="cancel" formnovalidate aria-label="${esc(t("ui.close"))}">${ic("close")}</button></div>
    ${body}<div class="btns">${extra}${cancel ? `<button class="btn ghost" value="cancel" formnovalidate>${esc(cancel)}</button>` : ""}${ok ? `<button class="btn" value="ok">${esc(ok)}</button>` : ""}</div>`;
  apply(f);
  return new Promise(res => {
    let val = null;
    f.onsubmit = ev => {
      const sub = ev.submitter?.value || "ok";
      if (sub === "ok") { val = Object.fromEntries(new FormData(f)); f.querySelectorAll("[data-multi]").forEach(g => (val[g.dataset.multi] = [...g.querySelectorAll('[aria-pressed="true"]')].map(x => x.dataset.v))); }
      else if (sub !== "cancel") val = { _btn: sub };
    };
    d.onclose = () => res(val);
    d.showModal(); onOpen?.(f);
    setTimeout(() => f.querySelector("input:not([type=hidden]),select,textarea")?.focus(), 30);
  });
}
// chip a scelta singola o multipla dentro un dialogo
function catChips(name, sel = [], multi = false) {
  return `<div class="catgrid" data-multi="${name}" data-single="${multi ? "" : 1}" role="group">${cats().map(c => `<button type="button" class="chip" data-v="${c.id}" aria-pressed="${sel.includes(c.id)}">${catIcon(c)}${esc(cname(c))}</button>`).join("")}</div>`;
}
document.addEventListener("click", e => {
  const chip = e.target.closest("[data-multi] .chip"); if (!chip) return;
  const g = chip.closest("[data-multi]");
  if (g.dataset.single) g.querySelectorAll(".chip").forEach(x => x.setAttribute("aria-pressed", x === chip));
  else chip.setAttribute("aria-pressed", chip.getAttribute("aria-pressed") !== "true");
  chip.classList.remove("pop"); void chip.offsetWidth; chip.classList.add("pop");
});

async function entryDialog(e = {}) {
  const isNew = !e.id;
  const r = await dialog(isNew ? t("e.new") : t("e.edit"), `
    <label class="f">${t("e.amount")}<input class="amt" name="amt" inputmode="decimal" autocomplete="off" required value="${e.amt != null ? fmtNum(e.amt, locale()) : ""}" placeholder="0,00"></label>
    <fieldset><legend>${t("e.cat")}</legend>${catChips("cat", [e.cat || "food"])}</fieldset>
    <div class="grid2"><label class="f">${t("e.date")}<input type="date" name="d" value="${e.d || (cur === monthOf(today()) ? today() : cur + "-01")}" required></label>
    <label class="f">${t("e.note")}<input name="note" value="${esc(e.note || "")}" maxlength="80"></label></div>
    ${e.items ? `<details><summary>${t("m.items", { n: e.items.length })}</summary><ul>${e.items.map(i => `<li>${esc(i.n)} — ${money(i.a)}</li>`).join("")}</ul></details>` : ""}`,
    { extra: isNew ? "" : `<button class="btn danger" value="del" formnovalidate>${t("ui.delete")}</button>` });
  if (!r) return;
  if (r._btn === "del") { store.remove("entries", e.id); ch.cheer("delete"); toast(t("e.deleted"), { label: t("ui.undo"), run: () => store.put("entries", { ...e, del: 0 }) }); return; }
  const amt = num(r.amt); if (amt == null) return toast(t("e.badAmount"));
  const before = nLive(), cat = r.cat?.[0] || "other";
  store.put("entries", { ...e, amt: round2(amt), cat, d: r.d, m: monthOf(r.d), note: r.note.trim(), src: e.src || "manual" });
  if (r.note.trim()) store.learn(r.note, [r.cat?.[0]]);
  if (isNew && monthOf(r.d) !== cur) { cur = monthOf(r.d); render(); }
  if (isNew) afterSave({ say: addSay(cat), before, cats: [cat], m: monthOf(r.d) }); else { ch.cheer("edit"); unlock(); }
}

async function monthDialog() {
  const m = S().months[cur] || {}, s = monthSummary(S(), cur), vv = S().settings.voucher || 8;
  const f = (k, v, hint = "") => `<label class="f">${t("meta." + k)}${hint ? ` <span class="hint">${hint}</span>` : ""}<input name="${k}" inputmode="decimal" value="${v != null ? fmtNum(v, locale()) : ""}"></label>`;
  const r = await dialog(t("meta.title", { m: monthLabel(cur) }), `
    <div class="grid2">${f("start", m.start ?? s.start, m.start == null && s.start != null ? t("meta.auto") : "")}${f("end", m.end)}</div>
    <div class="grid2">${f("salary", m.salary)}${f("extra", m.extra)}</div>${f("refunds", m.refunds)}
    <fieldset><legend>${ic("ticket")} ${t("meta.vouchers")}</legend><div class="grid2">${f("vIn", m.vIn)}${f("vUsed", m.vUsed)}</div>
    <p class="hint">${t("meta.vhint", { v: money(vv) })}</p></fieldset>`);
  if (!r) return;
  const patch = {};
  for (const k of ["start", "end", "salary", "extra", "refunds", "vIn", "vUsed"]) {
    const raw = String(r[k] || "").trim();
    // "5x" o "5 x" = numero di buoni × valore
    const cnt = raw.match(/^(\d+)\s*[x×*]$/i);
    patch[k] = raw === "" ? null : cnt ? round2(+cnt[1] * vv) : num(raw);
  }
  store.setMonth(cur, patch);
  const sv = monthSummary(S(), cur).savings;
  afterSave({ say: sv == null ? ["meta"] : sv > 0 ? ["saveUp", { amt: money(sv) }, 1] : sv < 0 ? ["saveDown"] : ["meta"] });
}

async function catDialog(c) {
  const r = await dialog(c ? t("c.edit") : t("c.new"), `
    <div class="grid2"><label class="f">${t("c.emoji")}<input name="emoji" value="${esc(c?.emoji || "🏷️")}" maxlength="4" required></label>
    <label class="f">${t("c.color")}<input type="color" name="color" value="${c?.color || "#c9b3e6"}"></label></div>
    <label class="f">${t("c.name")}<input name="name" value="${esc(c ? cname(c) : "")}" maxlength="30" required></label>
    <label class="f"><select name="kind"><option value="var">${t("c.var")}</option><option value="fix" ${c?.kind === "fix" ? "selected" : ""}>${t("c.fix")}</option></select></label>`,
    { extra: c ? `<button class="btn danger" value="hide" formnovalidate>${t("c.hide")}</button>` : "" });
  if (!r) return;
  if (r._btn === "hide") return store.put("cats", { ...(S().cats.find(x => x.id === c.id) || { id: c.id }), hidden: 1 });
  const base = S().cats.find(x => x.id === c?.id) || { id: c?.id || "c-" + uid() };
  const isDefault = c && !c.id.startsWith("c-") && r.name === t("cat." + c.id);
  store.put("cats", { ...base, emoji: r.emoji, color: r.color, kind: r.kind, name: isDefault ? undefined : r.name.trim(), custom: c && c.icon && r.emoji !== c.emoji ? 1 : base.custom });
}

// ---------- scansione ----------
const KINDS = [["receipt", "receipt"], ["payslip", "payslip"], ["statement", "bank"], ["bill", "bill"], ["meter", "meter"]];
function viewScan() {
  if (scanState) return scanView();
  return `<div class="card"><h2>${t("s.title")}</h2><p class="muted">${t("s.intro")}</p>
    <div class="kinds">${KINDS.map(([k, e]) => `<button class="kind" data-act="kind" data-kind="${k}" data-cam="1"><span>${ic(e)}</span>${t("s.k." + k)}<small>${t("s.kd." + k)}</small></button>`).join("")}
    <button class="kind" data-act="add"><span>${ic("hand")}</span>${t("s.manual")}<small>${t("s.manuald")}</small></button></div></div>
    <div class="card"><h3>${ic("file")} ${t("s.fromFile")}</h3><div class="chips">${KINDS.map(([k, e]) => `<button class="chip" data-act="kind" data-kind="${k}">${ic(e)} ${t("s.k." + k)}</button>`).join("")}</div>
    <p class="hint">${t("s.privacy")}</p></div>`;
}

function pickFile(cam) {
  const inp = cam ? $("#fileCam") : $("#fileAny");
  return new Promise(res => { inp.value = ""; inp.onchange = () => res(inp.files[0] || null); inp.oncancel = () => res(null); inp.click(); });
}

async function startScan(kind, cam) {
  const file = await pickFile(cam); if (!file) return;
  scanState = { kind, busy: true, pct: 3, file, url: file.type.startsWith("image/") ? URL.createObjectURL(file) : null };
  kapi.mood("think"); kapi.say("kapi.think"); render();
  const ocr = await import("./ocr.js");
  const lng = ocr.ocrLang(lang()), onStatus = (st, p) => { if (scanState) { scanState.pct = Math.round((/recogn/.test(st) ? 40 + p * 58 : 5 + (p || 0) * 35)); const bar = $("#scanBar"); if (bar) bar.style.setProperty("--w", scanState.pct + "%"); } };
  try {
    let text;
    if (file.type === "application/pdf") text = await ocr.pdfText(file, { lang: lng, onStatus });
    else text = (await ocr.recognize(file, { lang: lng, mode: kind === "meter" ? "digits" : "text", onStatus })).text;
    // contatori: due letture (solo cifre e normale), il parser sceglie il numero più completo
    if (kind === "meter" && file.type !== "application/pdf") text += "\n" + (await ocr.recognize(file, { lang: lng, mode: "text", onStatus })).text;
    const P = await import(`./parsers/${kind}.js`);
    const fn = { receipt: "parseReceipt", payslip: "parsePayslip", statement: "parseStatement", bill: "parseBill", meter: "parseMeter" }[kind];
    let res = P[fn](text);
    if (kind === "receipt" && ai.ready()) { try { const o = await ai.structureReceipt(text, cats().map(c => c.id), LANGS[lang()]); if (o.items.length) res = { ...res, ...o, ai: true }; } catch (e) { toast(t(e.code || "ai.fail")); } }
    scanState = { ...scanState, busy: false, text, res };
    if (kind === "receipt") prepReceipt();
    kapi.mood("wow");
    if (hasResult()) {
      const n = (S().settings.scans || 0) + 1; store.setSettings({ scans: n });
      if (n === 1) ch.cheer("firstScan", {}, { big: true }); else kapi.say("kapi.found");
      unlock();
    } else kapi.say("kapi.notFound");
  } catch (err) {
    console.error(err); scanState = { ...scanState, busy: false, error: true }; kapi.mood("idle"); kapi.say("kapi.oops");
  }
  render();
}
const hasResult = () => { const r = scanState?.res; if (!r) return false; return !!(r.items?.length || r.net || r.rows?.length || r.amount || r.value); };

function prepReceipt() {
  const r = scanState.res, rules = store.rulesMap(), grocer = isGrocer(r.store || "") || isGrocer(scanState.text.slice(0, 200));
  r.items = r.items.map((it, i) => ({ ...it, i, on: true, cats: it.cats?.length ? it.cats : guessCats(it.name, rules, grocer ? "food" : "other") }));
  r.date ||= today();
}

function scanView() {
  const st = scanState, back = `<button class="btn ghost small" data-act="scanBack">${ic("back")} ${t("ui.back")}</button>`;
  if (st.busy) return `<div class="card" aria-busy="true"><h2>${t("s.reading")}</h2><div class="progress" role="progressbar" aria-label="${esc(t("s.reading"))}"><i id="scanBar" style="--w:${st.pct}%"></i></div>
    ${st.url ? `<img class="preview" src="${st.url}" alt="">` : ""}<p class="muted">${t("s.firstTime")}</p></div>`;
  if (st.error) return `<div class="card"><p class="warn">${t("s.error")}</p><div class="btns">${back}<button class="btn" data-act="kind" data-kind="${st.kind}" data-cam="1">${t("s.retry")}</button></div></div>`;
  const body = { receipt: reviewReceipt, payslip: reviewPayslip, statement: reviewStatement, bill: reviewBill, meter: reviewMeter }[st.kind]();
  return `${body}<div class="card"><details><summary>${t("s.rawText")}</summary><pre style="white-space:pre-wrap;font-size:.8rem">${esc(st.text)}</pre></details>${back}</div>`;
}

function reviewReceipt() {
  const r = scanState.res, on = r.items.filter(i => i.on), sum = round2(on.reduce((a, b) => a + b.amount, 0));
  const diff = r.total != null ? round2(r.total - round2(r.items.reduce((a, b) => a + b.amount, 0))) : null;
  scanState.after = bindReceipt;
  return `<div class="card"><h2>${ic("receipt")} ${t("s.k.receipt")}</h2>
    ${scanState.url ? `<img class="preview" src="${scanState.url}" alt="${esc(t("s.photoAlt"))}">` : ""}
    <div class="grid2"><label class="f">${t("e.date")}<input type="date" id="rDate" value="${r.date}"></label><label class="f">${t("s.store")}<input id="rStore" value="${esc(r.store || "")}"></label></div>
    ${r.total != null ? (Math.abs(diff) < 0.02 ? `<p class="okbox">${ic("check")} ${t("s.totalOk", { tot: money(r.total) })}</p>` : `<p class="warn">${t("s.totalDiff", { tot: money(r.total), diff: money(diff) })}</p>`) : ""}
    <p class="muted">${t("s.tapHint")}</p>
    <div id="rItems">${r.items.map(itemRow).join("")}</div>
    <button class="btn soft small" id="rAdd" type="button">${ic("plus")} ${t("s.addLine")}</button>
    <label class="f">${ic("ticket")} ${t("s.vouchersPaid")}<input id="rVouch" inputmode="decimal" value="${r.vouchers ? fmtNum(r.vouchers, locale()) : ""}"></label>
    <div class="card" style="background:var(--c-bg)"><b>${t("s.summary")}</b>${receiptGroups(on)}<p><b>${t("s.selected", { n: on.length, sum: money(sum) })}</b></p></div>
    <div class="btns"><button class="btn" id="rSave" ${on.length ? "" : "disabled"}>${ic("check")} ${t("s.addAll", { n: on.length })}</button></div></div>`;
}
const itemRow = it => `<div class="ritem ${it.on ? "" : "off"}" data-i="${it.i}">
  <input type="checkbox" class="chk" ${it.on ? "checked" : ""} aria-label="${esc(t("s.include", { name: it.name }))}">
  <input class="inp" data-f="name" value="${esc(it.name)}" aria-label="${esc(t("s.itemName"))}">
  <input class="inp" data-f="amount" inputmode="decimal" value="${fmtNum(it.amount, locale())}" aria-label="${esc(t("e.amount"))}">
  <div class="chips">${it.cats.map(c => { const k = catById(c); return `<button type="button" class="chip" data-cat-edit aria-pressed="true">${catIcon(k)} ${esc(cname(k))}</button>`; }).join("")}
  <button type="button" class="chip add" data-cat-edit aria-label="${esc(t("s.changeCat"))}">${ic("edit")}</button></div></div>`;
function receiptGroups(on) {
  const g = {}; for (const it of on) for (const c of it.cats) g[c] = round2((g[c] || 0) + it.amount / it.cats.length);
  return `<ul class="legend">${Object.entries(g).map(([c, v]) => { const k = catById(c); return `<li><i style="--c:${k.color}"></i>${catIcon(k)} ${esc(cname(k))} <b>${money(v)}</b></li>`; }).join("")}</ul>`;
}
function bindReceipt() {
  const r = scanState.res, box = $("#rItems"); if (!box) return;
  const refresh = () => { const y = scrollY; render(); scrollTo(0, y); };
  box.onchange = e => {
    const row = e.target.closest(".ritem"), it = r.items.find(x => x.i == row.dataset.i);
    if (e.target.type === "checkbox") { it.on = e.target.checked; return refresh(); }
    if (e.target.dataset.f === "name") it.name = e.target.value;
    if (e.target.dataset.f === "amount") { const v = num(e.target.value); if (v != null) it.amount = round2(v); refresh(); }
  };
  box.onclick = async e => {
    const b = e.target.closest("[data-cat-edit]"); if (!b) return;
    const it = r.items.find(x => x.i == b.closest(".ritem").dataset.i);
    const res = await dialog(t("s.catsFor", { name: it.name }), `<p class="hint">${t("s.multiHint")}</p>${catChips("cats", it.cats, true)}`, { ok: t("ui.ok") });
    if (res?.cats?.length) { it.cats = res.cats; it.changed = true; refresh(); }
  };
  $("#rAdd").onclick = () => { r.items.push({ i: Date.now(), name: "", amount: 0, on: true, cats: ["other"] }); refresh(); };
  $("#rDate").onchange = e => (r.date = e.target.value);
  $("#rStore").onchange = e => (r.store = e.target.value);
  $("#rVouch").onchange = e => (r.vouchers = num(e.target.value) || 0);
  $("#rSave").onclick = saveReceipt;
}
function saveReceipt() {
  const r = scanState.res, on = r.items.filter(i => i.on && i.amount), d = r.date || today(), m = monthOf(d), doc = uid(), before = nLive();
  const g = {};
  for (const it of on) { for (const c of it.cats) { g[c] ||= { amt: 0, items: [] }; g[c].amt += it.amount / it.cats.length; g[c].items.push({ n: it.name, a: round2(it.amount / it.cats.length) }); } store.learn(it.name, it.cats); }
  store.putMany("entries", Object.entries(g).map(([cat, x]) => ({ d, m, cat, amt: round2(x.amt), items: x.items, note: r.store || t("s.k.receipt"), src: "receipt", doc })));
  if (r.vouchers) { const mm = S().months[m] || {}; store.setMonth(m, { vUsed: round2((mm.vUsed || 0) + r.vouchers) }); }
  const sum = round2(on.reduce((a, i) => a + i.amount, 0));
  scanState = null; cur = m; tab = "month"; kapi.confetti(); go("month");
  afterSave({ say: [sum > 100 ? "receiptBig" : "receipt", { n: on.length, sum: money(sum) }, 1], before, cats: Object.keys(g), m });
  toast(t("s.saved", { n: Object.keys(g).length }));
}

function reviewPayslip() {
  const r = scanState.res; scanState.after = () => ($("#pSave").onclick = () => {
    const m = $("#pMonth").value, net = num($("#pNet").value), v = num($("#pV").value);
    if (!m || net == null) return toast(t("e.badAmount"));
    const patch = { salary: net }; if (v != null) patch.vIn = v;
    store.setMonth(m, patch); scanState = null; cur = m; kapi.confetti(); go("month");
    afterSave({ say: ["payslip", { net: money(net) }, 1], ev: ["payslip"] });
  });
  return `<div class="card"><h2>${ic("payslip")} ${t("s.k.payslip")}</h2>
    <label class="f">${t("s.month")}<input type="month" id="pMonth" value="${r.month || cur}"></label>
    <label class="f">${t("s.net")}<input id="pNet" class="amt" inputmode="decimal" value="${r.net != null ? fmtNum(r.net, locale()) : ""}"></label>
    <label class="f">${ic("ticket")} ${t("s.vouchersIn")} <span class="hint">${r.vCount ? `${r.vCount} × ${money(r.vValue)}` : ""}</span><input id="pV" inputmode="decimal" value="${r.vouchers != null ? fmtNum(r.vouchers, locale()) : ""}"></label>
    ${r.net == null ? `<p class="warn">${t("s.notFoundField")}</p>` : ""}<div class="btns"><button class="btn" id="pSave">${ic("check")} ${t("ui.save")}</button></div></div>`;
}

function reviewStatement() {
  const r = scanState.res, rules = store.rulesMap();
  r.rows.forEach((x, i) => { x.i ??= i; x.on ??= x.amount < 0 || x.salary; x.cat ??= x.amount < 0 ? guessCats(x.desc, rules)[0] : x.salary ? "_salary" : "_extra"; });
  scanState.after = () => {
    const box = $("#stRows"); if (!box) return;
    box.onchange = e => { const row = r.rows[e.target.closest(".ritem").dataset.i]; if (e.target.type === "checkbox") row.on = e.target.checked; else if (e.target.tagName === "SELECT") row.cat = e.target.value; };
    $("#stSave").onclick = () => {
      const es = [], months = {};
      for (const x of r.rows.filter(x => x.on)) {
        const m = monthOf(x.date);
        if (x.cat === "_salary" || x.cat === "_extra") { const k = x.cat === "_salary" ? "salary" : "extra"; months[m] ||= {}; months[m][k] = round2((months[m][k] || 0) + Math.abs(x.amount)); continue; }
        es.push({ id: "st-" + x.date + "-" + norm(x.desc).replace(/\s/g, "").slice(0, 20) + "-" + Math.round(Math.abs(x.amount) * 100), d: x.date, m, cat: x.cat, amt: round2(Math.abs(x.amount)), note: x.desc, src: "statement" });
        store.learn(x.desc, [x.cat]);
      }
      const before = nLive(); if (es.length) store.putMany("entries", es);
      for (const [m, p] of Object.entries(months)) { const old = S().months[m] || {}; store.setMonth(m, { salary: p.salary != null ? p.salary : old.salary, extra: p.extra != null ? round2((old.extra || 0) + p.extra) : old.extra }); }
      scanState = null; kapi.confetti(); go("month"); toast(t("s.savedRows", { n: es.length }));
      afterSave({ say: ["statement", { n: es.length }], before, cats: [...new Set(es.map(x => x.cat))], m: cur });
    };
  };
  const opts = sel => `<option value="_salary" ${sel === "_salary" ? "selected" : ""}>💼 ${t("meta.salary")}</option><option value="_extra" ${sel === "_extra" ? "selected" : ""}>🌟 ${t("meta.extra")}</option>` + cats().map(c => `<option value="${c.id}" ${sel === c.id ? "selected" : ""}>${c.custom || !c.icon ? c.emoji + " " : ""}${esc(cname(c))}</option>`).join("");
  return `<div class="card"><h2>${ic("bank")} ${t("s.k.statement")}</h2><p class="muted">${t("s.stHint")}</p>
    <div id="stRows">${r.rows.map(x => `<div class="ritem ${x.on ? "" : "off"}" data-i="${x.i}"><input type="checkbox" class="chk" ${x.on ? "checked" : ""} aria-label="${esc(x.desc)}">
      <span>${esc(x.desc)}<br><small class="muted">${esc(x.date)}</small></span><b class="${x.amount < 0 ? "" : "pos"}">${money(x.amount)}</b>
      <select class="inp" style="grid-column:2/4" aria-label="${esc(t("e.cat"))}">${opts(x.cat)}</select></div>`).join("") || `<p class="warn">${t("s.notFoundField")}</p>`}</div>
    <div class="btns"><button class="btn" id="stSave">${ic("check")} ${t("ui.save")}</button></div></div>`;
}

const BILL_CAT = { elec: "elec", gas: "gas", water: "water", internet: "internet", waste: "waste", other: "other" };
function reviewBill() {
  const r = scanState.res;
  scanState.after = () => ($("#bSave").onclick = () => {
    const f = Object.fromEntries(["bKind", "bAmt", "bCons", "bMonth", "bFreq"].map(k => [k, $("#" + k).value]));
    const amount = num(f.bAmt); if (amount == null) return toast(t("e.badAmount"));
    const before = nLive(), m = f.bMonth, entry = store.put("entries", { d: m + "-" + (m === monthOf(today()) ? today().slice(8) : "01"), m, cat: BILL_CAT[f.bKind] || "other", amt: amount, note: t("u.k." + f.bKind), src: "bill" });
    store.put("bills", { kind: f.bKind, amount, cons: num(f.bCons), unit: f.bKind === "elec" ? "kWh" : "m³", m, freq: f.bFreq, from: r.period?.from, to: r.period?.to, entry: entry.id });
    scanState = null; cur = m; kapi.confetti(); go("usage");
    afterSave({ say: ["bill"], before, cats: [BILL_CAT[f.bKind] || "other"], m });
  });
  return `<div class="card"><h2>${ic("bill")} ${t("s.k.bill")}</h2>${billFields({ ...r, m: r.period?.to ? monthOf(r.period.to) : cur })}<div class="btns"><button class="btn" id="bSave">${ic("check")} ${t("ui.save")}</button></div></div>`;
}
const billFields = b => `<div class="grid2"><label class="f">${t("u.kind")}<select id="bKind" name="kind">${["elec", "gas", "water", "internet", "waste", "other"].map(k => `<option value="${k}" ${b.kind === k ? "selected" : ""}>${t("u.k." + k)}</option>`).join("")}</select></label>
  <label class="f">${t("u.freq")}<select id="bFreq" name="freq">${["m", "2m", "q", "6m", "y"].map(k => `<option value="${k}" ${(b.freq || "m") === k ? "selected" : ""}>${t("u.f." + k)}</option>`).join("")}</select></label></div>
  <div class="grid2"><label class="f">${t("e.amount")}<input id="bAmt" name="amount" inputmode="decimal" value="${b.amount != null ? fmtNum(b.amount, locale()) : ""}" required></label>
  <label class="f">${t("u.cons")} <span class="hint">kWh / m³</span><input id="bCons" name="cons" inputmode="decimal" value="${b.cons != null ? fmtNum(b.cons, locale(), 3) : ""}"></label></div>
  <label class="f">${t("s.month")}<input type="month" id="bMonth" name="m" value="${b.m || cur}" required></label>
  ${b.unitPrice ? `<p class="muted">${t("u.unitPrice", { p: money(b.unitPrice), u: b.unit })}</p>` : ""}`;

function reviewMeter() {
  const r = scanState.res, ms = live(S().meters);
  scanState.after = () => ($("#mtSave").onclick = async () => {
    let id = $("#mtMeter").value; const v = num($("#mtVal").value.replace(/\s/g, "")); if (v == null) return toast(t("e.badAmount"));
    if (id === "_new") { const m = await meterDialog(); if (!m) return; id = m.id; }
    const d = $("#mtDate").value; store.put("readings", { meter: id, value: v, d, m: monthOf(d) });
    scanState = null; kapi.confetti(); go("usage"); afterSave({ say: ["reading"] });
  });
  return `<div class="card"><h2>${ic("meter")} ${t("s.k.meter")}</h2>${scanState.url ? `<img class="preview" src="${scanState.url}" alt="${esc(t("s.photoAlt"))}">` : ""}
    <label class="f">${t("u.meter")}<select id="mtMeter">${ms.map(m => `<option value="${m.id}">${esc(m.name)}</option>`).join("")}<option value="_new">+ ${t("u.newMeter")}</option></select></label>
    <label class="f">${t("u.reading")} <span class="hint">${t("s.checkDigits")}</span><input id="mtVal" class="amt" inputmode="decimal" value="${r.value != null ? r.value : ""}"></label>
    ${r.options?.length > 1 ? `<div class="chips">${r.options.map(o => `<button type="button" class="chip" onclick="document.getElementById('mtVal').value='${o}'">${o}</button>`).join("")}</div>` : ""}
    <label class="f">${t("e.date")}<input type="date" id="mtDate" value="${today()}"></label><div class="btns"><button class="btn" id="mtSave">${ic("check")} ${t("ui.save")}</button></div></div>`;
}

// ---------- consumi ----------
function viewUsage() {
  const s = S(), ms = live(s.meters), bills = live(s.bills).sort((a, b) => (a.m < b.m ? 1 : -1));
  const meterCard = m => {
    const u = usage(s, m.id).filter(x => x.m <= cur).slice(-12), tot = round2(u.reduce((a, x) => a + x.use, 0)), last = live(s.readings).filter(r => r.meter === m.id).sort((a, b) => (a.d < b.d ? 1 : -1))[0];
    const col = { elec: "#f7b500", gas: "#ff8a3d", water: "#38a8e8" }[m.kind] || "#a07cf0";
    return `<div class="card"><div class="row"><h3 class="grow">${ic({ elec: "c-elec", gas: "c-gas", water: "c-water" }[m.kind] || "meter")} ${esc(m.name)}</h3><button class="btn small soft" data-act="meter" data-id="${m.id}" aria-label="${esc(t("u.editMeter"))}">${ic("edit")}</button></div>
      <p class="muted">${last ? t("u.last", { v: fmtNum(last.value, locale(), 3), u: m.unit, d: new Date(last.d).toLocaleDateString(locale()) }) : t("u.noReadings")}</p>
      ${m.bands?.length ? `<p class="hint">${t("u.bandsSum", { list: m.bands.join(" + ") })}</p>` : ""}
      ${u.length ? `<p><b>${t("u.sum12", { v: fmtNum(tot, locale(), 0), u: m.unit })}</b></p>` : ""}
      ${(() => { const y = meterYoy(s, m.id, cur), has = y.prev.some(v => v != null); if (!u.length) return "";
        const ser = [{ name: m.name, color: col, values: y.now, type: "bar" }]; if (has) ser.unshift({ name: t("st.lastYear"), color: "#c9b8a8", values: y.prev, type: "bar" });
        return timeline(ser, y.months.map(x => monthLabel(x, { month: "short" })), { label: t("u.chart", { name: m.name }), fmt: v => fmtNum(v, locale()) + " " + m.unit })
          + (has ? `<ul class="legend"><li><i style="--c:#c9b8a8"></i>${t("st.lastYear")}</li><li><i style="--c:${col}"></i>${t("st.thisYear")}</li></ul>` : "")
          + (y.pairs && y.pct != null ? `<p class="muted">${t("u.yoy", { now: fmtNum(y.sumNow, locale(), 0), before: fmtNum(y.sumPrev, locale(), 0), u: m.unit, n: y.pairs })} ${y.pct > 0 ? `<b class="neg">▲ ${y.pct}%</b>` : y.pct < 0 ? `<b class="pos">▼ ${-y.pct}%</b>` : "="}</p>` : ""); })()}
      <div class="btns"><button class="btn small" data-act="reading" data-id="${m.id}">${ic("plus")} ${t("u.addReading")}</button><button class="btn small soft" data-act="kind" data-kind="meter" data-cam="1">${ic("scan")} ${t("u.photo")}</button></div></div>`;
  };
  const prices = ["elec", "gas", "water"].map(k => [k, unitPrice(s, k)]).filter(x => x[1]);
  // frequenza: quella indicata, altrimenti i mesi stimati dalla distanza tra le bollette
  const cov = new Map(["elec", "gas", "water", "internet", "waste", "other"].flatMap(k => billMonths(s, k).map(b => [b.id, b.months])));
  const F = { 1: "m", 2: "2m", 3: "q", 6: "6m", 12: "y" };
  const freqLabel = b => { const f = b.freq || F[cov.get(b.id)]; return f ? t("u.f." + f) : ""; };
  // spesa delle bollette negli ultimi 12 mesi fino al mese scelto (bollette pluri-mensili distribuite sui mesi)
  const last12 = []; for (let m = cur, i = 0; i < 12; i++, m = prevMonth(m)) last12.unshift(m);
  const COL = { elec: "#f7b500", gas: "#ff8a3d", water: "#38a8e8" };
  const costSeries = ["elec", "gas", "water"].map(k => ({ name: t("u.k." + k), color: COL[k], values: billCostByMonth(s, k, last12), type: "bar" })).filter(x => x.values.some(v => v > 0));
  const costCard = costSeries.length ? `<div class="card" id="costTrend"><h3>${ic("stats")} ${t("u.costTrend")}</h3>
    ${timeline(costSeries, last12.map(m => monthLabel(m, { month: "short" })), { label: t("u.costTrend"), fmt: money })}
    <ul class="legend">${costSeries.map(x => `<li><i style="--c:${x.color}"></i>${esc(x.name)} <b>${money(x.values.reduce((a, b) => a + b, 0))}</b></li>`).join("")}</ul><p class="hint">${t("u.costHint")}</p></div>` : "";
  return `<div class="card"><h2>${t("u.title")}</h2><p class="muted">${t("u.intro")}</p><div class="btns"><button class="btn" data-act="meter">${ic("plus")} ${t("u.newMeter")}</button><button class="btn soft" data-act="bill">${ic("plus")} ${t("u.addBill")}</button></div></div>
    ${ms.map(meterCard).join("") || `<div class="card">${empty("u.empty")}</div>`}
    ${costCard}
    ${prices.length ? `<div class="card"><h3>${ic("coin")} ${t("u.prices")}</h3>${prices.map(([k, p]) => `<p>${t("u.k." + k)}: <b>${money(p.price)}</b> / ${k === "elec" ? "kWh" : "m³"} · ${t("u.year", { c: fmtNum(p.yearCons, locale(), 0), y: money(p.yearCost) })}</p>`).join("")}
      <button class="btn small soft" data-act="offer">${ic("search")} ${t("u.compare")}</button>${live(s.offers).map(o => `<button class="chip" data-act="offer" data-id="${o.id}">${ic("usage")} ${esc(o.name || t("u.k." + o.kind))}</button>`).join(" ")}</div>` : ""}
    ${bills.length ? `<div class="card"><h3>${ic("bill")} ${t("u.bills")}</h3><table class="t"><thead><tr><th>${t("s.month")}</th><th>${t("u.kind")}</th><th class="n">${t("u.cons")}</th><th class="n">${t("e.amount")}</th></tr></thead><tbody>
      ${bills.slice(0, 24).map(b => `<tr data-act="bill" data-id="${b.id}" style="cursor:pointer"><td>${esc(monthLabel(b.m, { month: "short", year: "2-digit" }))}</td><td>${esc(b.name || t("u.k." + b.kind))} <small class="muted">${freqLabel(b)}</small></td><td class="n">${b.cons ? fmtNum(b.cons, locale()) + " " + b.unit : "—"}</td><td class="n">${b.amount ? money(b.amount) : "—"}</td></tr>`).join("")}</tbody></table></div>` : ""}`;
}

async function meterDialog(m) {
  const r = await dialog(m ? t("u.editMeter") : t("u.newMeter"), `<label class="f">${t("c.name")}<input name="name" value="${esc(m?.name || "")}" placeholder="${esc(t("u.meterPh"))}" required maxlength="40"></label>
    <div class="grid2"><label class="f">${t("u.kind")}<select name="kind">${["elec", "gas", "water", "other"].map(k => `<option value="${k}" ${m?.kind === k ? "selected" : ""}>${t("u.k." + k)}</option>`).join("")}</select></label>
    <label class="f">${t("u.unit")}<input name="unit" value="${esc(m?.unit || "kWh")}" maxlength="8"></label></div>`, { extra: m ? `<button class="btn danger" value="del" formnovalidate>${t("ui.delete")}</button>` : "" });
  if (!r) return null;
  if (r._btn === "del") { store.remove("meters", m.id); return null; }
  return store.put("meters", { ...(m || {}), name: r.name.trim(), kind: r.kind, unit: r.unit || (r.kind === "elec" ? "kWh" : "m³") });
}
async function readingDialog(meterId) {
  const m = S().meters.find(x => x.id === meterId);
  const r = await dialog(t("u.addReading") + " · " + (m?.name || ""), `<label class="f">${t("u.reading")} (${esc(m?.unit || "")})<input name="v" class="amt" inputmode="decimal" required></label><label class="f">${t("e.date")}<input type="date" name="d" value="${today()}" required></label>`);
  const v = r && num(r.v); if (v == null) return;
  store.put("readings", { meter: meterId, value: v, d: r.d, m: monthOf(r.d) }); afterSave({ say: ["reading"] });
}
async function billDialog(b) {
  const r = await dialog(b ? t("u.editBill") : t("u.addBill"), billFields(b || { m: cur }), { extra: b ? `<button class="btn danger" value="del" formnovalidate>${t("ui.delete")}</button>` : "" });
  if (!r) return;
  if (r._btn === "del") { store.remove("bills", b.id); if (b.entry) store.remove("entries", b.entry); return; }
  const amount = num(r.amount); if (amount == null) return toast(t("e.badAmount"));
  let entry = b?.entry; const before = nLive();
  if (!b || b.entry) { const e = store.put("entries", { ...(S().entries.find(x => x.id === b?.entry) || {}), d: r.m + "-01", m: r.m, cat: BILL_CAT[r.kind], amt: amount, note: t("u.k." + r.kind), src: "bill" }); entry = e.id; }
  store.put("bills", { ...(b || {}), kind: r.kind, freq: r.freq, amount, cons: num(r.cons), unit: r.kind === "elec" ? "kWh" : "m³", m: r.m, entry }); afterSave({ say: ["bill"], before, cats: [BILL_CAT[r.kind]], m: r.m });
}
async function offerDialog(o) {
  const r = await dialog(t("u.compare"), `<p class="hint">${t("u.offerHint")}</p><label class="f">${t("c.name")}<input name="name" value="${esc(o?.name || "")}" maxlength="40"></label>
    <label class="f">${t("u.kind")}<select name="kind">${["elec", "gas", "water"].map(k => `<option value="${k}" ${o?.kind === k ? "selected" : ""}>${t("u.k." + k)}</option>`).join("")}</select></label>
    <div class="grid2"><label class="f">${t("u.offerPrice")}<input name="p" inputmode="decimal" value="${o?.unitPrice ?? ""}" required></label><label class="f">${t("u.offerFixed")}<input name="f" inputmode="decimal" value="${o?.fixedYear ?? ""}"></label></div>`,
    { extra: o ? `<button class="btn danger" value="del" formnovalidate>${t("ui.delete")}</button>` : "" });
  if (!r) return;
  if (r._btn === "del") return store.remove("offers", o.id);
  const p = num(r.p); if (p == null) return;
  const rec = store.put("offers", { ...(o || {}), name: r.name, kind: r.kind, unitPrice: p, fixedYear: num(r.f) || 0 });
  const up = unitPrice(S(), r.kind);
  if (up) { const save = up.yearCost - (up.yearCons * p + (rec.fixedYear || 0)); toast(t(save > 0 ? "u.offerSave" : "u.offerNo", { s: money(Math.abs(save)) })); kapi.mood(save > 0 ? "happy" : "think"); }
}

// ---------- grafici ----------
function viewStats() {
  const s = S(), list = series(s, 12, cur), m = monthSummary(s, cur);
  if (!list.length) return `<div class="card">${empty("st.empty")}</div>`;
  const labels = list.map(x => monthLabel(x.m, { month: "short" }));
  const slices = Object.entries(m.byCat).sort((a, b) => b[1] - a[1]).map(([id, v]) => { const c = catById(id); return { label: `${cname(c)} ${money(v)}`, value: v, color: c.color, c }; });
  const prev = list.filter(x => x.m < cur), avg = catAverages(prev.length ? prev : list);
  const avgRows = Object.entries(avg).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([id, v]) => { const c = catById(id); return { label: cname(c), icon: catIcon(c) + " ", value: v, color: c.color }; });
  const end = trendEnd(cur, monthOf(today())), tps = tips(s, cur, money, { end, monthName: m => monthLabel(m, { month: "long", year: "numeric" }) });
  const rates = list.filter(x => x.rate != null);
  return `<div class="card"><h2>${ic("capy")} ${t("st.tips")}</h2>${tps.map(x => `<div class="tip ${x.tone || ""}"><span>${ic(x.icon)}</span><p style="margin:0">${esc(t(x.key, { ...x.vars, cat: x.vars.cat ? cname(catById(x.vars.cat)) : "" }))}</p></div>`).join("")}</div>
    ${trendCard(s, end)}
    ${yoyCard(s, end)}
    <div class="card"><h2>${t("st.trend")}</h2>${timeline([{ name: t("m.spent"), color: "#ff9f6b", values: list.map(x => x.tracked), type: "bar" }, { name: t("m.income"), color: "#4caf7d", values: list.map(x => x.income || null), type: "line" }], labels, { label: t("st.trendLabel"), fmt: money })}
      <ul class="legend"><li><i style="--c:#ff9f6b"></i>${t("m.spent")}</li><li><i style="--c:#4caf7d"></i>${t("m.income")}</li></ul>
      ${rates.length ? `<p class="muted">${t("st.rate", { r: Math.round((rates.reduce((a, b) => a + b.rate, 0) / rates.length) * 100) })}</p>` : ""}</div>
    ${slices.length ? `<div class="card"><h2>${t("st.month", { m: monthLabel(cur) })}</h2>${donut(slices, { label: t("st.donutLabel"), center: money(m.tracked) })}<ul class="legend">${slices.map(x => `<li><i style="--c:${x.color}"></i>${catIcon(x.c)} ${esc(x.label)}</li>`).join("")}</ul></div>` : ""}
    <div class="card"><h2>${t("st.avg")}</h2>${hbars(avgRows, money)}</div>
    <div class="card"><details><summary>${t("st.table")}</summary><table class="t"><thead><tr><th>${t("s.month")}</th><th class="n">${t("m.income")}</th><th class="n">${t("m.spent")}</th><th class="n">${t("m.saved")}</th></tr></thead>
      <tbody>${list.slice().reverse().map(x => `<tr><td>${esc(monthLabel(x.m, { month: "short", year: "2-digit" }))}</td><td class="n">${money(x.income)}</td><td class="n">${money(x.tracked)}</td><td class="n ${x.savings >= 0 ? "pos" : "neg"}">${x.savings == null ? "—" : money(x.savings)}</td></tr>`).join("")}</tbody></table></details></div>`;
}

// andamento per categoria e prezzi dei prodotti: ultimi N mesi rispetto agli N precedenti
let trendN = 3;
function trendCard(s, end) {
  const tr = catTrends(s, end, trendN), pr = productTrends(s, end, trendN).slice(0, 8);
  const chips = TREND_WINDOWS.map(n => `<button type="button" class="chip" data-trend="${n}" aria-pressed="${n === trendN}">${t("st.months", { n })}</button>`).join("");
  const arrow = p => (p == null ? "" : p > 0 ? `<b class="neg">▲ ${p}%</b>` : p < 0 ? `<b class="pos">▼ ${Math.abs(p)}%</b>` : "=");
  const body = !tr ? `<p class="muted">${t("st.noTrend", { n2: trendN * 2 })}</p>` : `
    <p class="hint">${t("st.trendsHint", { n: trendN, from: monthLabel(tr.recent[0], { month: "short", year: "2-digit" }), to: monthLabel(end, { month: "short", year: "2-digit" }) })}</p>
    <p><b>${t("st.trendTotal")}</b>: ${money(tr.total.before)} → ${money(tr.total.now)} ${arrow(tr.total.pct)}</p>
    <table class="t"><thead><tr><th>${t("e.cat")}</th><th class="n">${t("st.before")}</th><th class="n">${t("st.now")}</th><th class="n">%</th></tr></thead><tbody>
    ${tr.rows.slice(0, 12).map(r => { const c = catById(r.cat); return `<tr><td>${catIcon(c)} ${esc(cname(c))}</td><td class="n">${money(r.before)}</td><td class="n">${money(r.now)}</td><td class="n">${r.pct == null ? `<span class="muted">${t("st.new")}</span>` : arrow(r.pct)}</td></tr>`; }).join("")}</tbody></table>
    ${pr.length ? `<h3 style="margin-top:1em">${ic("receipt")} ${t("st.products")}</h3><p class="hint">${t("st.prodHint", { n: trendN })}</p><table class="t"><tbody>${pr.map(p => `<tr><td>${esc(p.name)}</td><td class="n">${money(p.before)}</td><td class="n">${money(p.now)}</td><td class="n">${arrow(p.pct)}</td></tr>`).join("")}</tbody></table>` : ""}`;
  return `<div class="card" id="trends"><h2>${ic("stats")} ${t("st.trends")}</h2><div class="chips" role="group" aria-label="${esc(t("st.trends"))}">${chips}</div>${body}</div>`;
}
document.addEventListener("click", e => { const b = e.target.closest("[data-trend]"); if (!b) return; trendN = +b.dataset.trend; render(); });

// confronto mese per mese con lo stesso mese dell'anno prima (totale o una categoria)
let yoyCat = "";
function yoyCard(s, end) {
  const y = yoy(s, end, yoyCat || null);
  const top = Object.entries(live(s.entries).filter(e => y.months.includes(e.m)).reduce((o, e) => ((o[e.cat] = (o[e.cat] || 0) + e.amt), o), {})).sort((a, b) => b[1] - a[1]).slice(0, 6).map(x => x[0]);
  if (yoyCat && !top.includes(yoyCat)) top.push(yoyCat);
  const chips = [`<button type="button" class="chip" data-yoy="" aria-pressed="${!yoyCat}">${t("st.all")}</button>`, ...top.map(c => { const k = catById(c); return `<button type="button" class="chip" data-yoy="${esc(c)}" aria-pressed="${yoyCat === c}">${catIcon(k)} ${esc(cname(k))}</button>`; })].join("");
  const arrow = p => (p == null ? "" : p > 0 ? `<b class="neg">▲ ${p}%</b>` : p < 0 ? `<b class="pos">▼ ${Math.abs(p)}%</b>` : "=");
  const body = !y.pairs ? `<p class="muted">${t("st.yoyNone")}</p>` : `
    ${timeline([{ name: t("st.lastYear"), color: "#c9b8a8", values: y.prev, type: "bar" }, { name: t("st.thisYear"), color: "#ff9f6b", values: y.now, type: "bar" }], y.months.map(m => monthLabel(m, { month: "short" })), { label: t("st.yoy"), fmt: money })}
    <ul class="legend"><li><i style="--c:#c9b8a8"></i>${t("st.lastYear")}</li><li><i style="--c:#ff9f6b"></i>${t("st.thisYear")}</li></ul>
    <p><b>${t("st.yoySum", { now: money(y.sumNow), before: money(y.sumPrev), n: y.pairs })}</b> ${arrow(y.pct)}</p>
    <details><summary>${t("st.table")}</summary><table class="t"><thead><tr><th>${t("s.month")}</th><th class="n">${t("st.lastYear")}</th><th class="n">${t("st.thisYear")}</th><th class="n">%</th></tr></thead><tbody>
    ${y.months.map((m, i) => y.now[i] == null && y.prev[i] == null ? "" : `<tr><td>${esc(monthLabel(m, { month: "short", year: "2-digit" }))}</td><td class="n">${y.prev[i] == null ? "—" : money(y.prev[i])}</td><td class="n">${y.now[i] == null ? "—" : money(y.now[i])}</td><td class="n">${y.prev[i] > 0 && y.now[i] != null ? arrow(Math.round((y.now[i] / y.prev[i] - 1) * 100)) : ""}</td></tr>`).reverse().join("")}</tbody></table></details>`;
  return `<div class="card" id="yoy"><h2>${ic("calendar")} ${t("st.yoy")}</h2><p class="hint">${t("st.yoyHint")}</p><div class="chips" role="group" aria-label="${esc(t("st.yoy"))}">${chips}</div>${body}</div>`;
}
document.addEventListener("click", e => { const b = e.target.closest("[data-yoy]"); if (!b) return; yoyCat = b.dataset.yoy; render(); });

// ---------- altro ----------
function viewMore() {
  const st = S().settings, vb = voucherBalance(S());
  return `<div class="card"><h2>${ic("more")} ${t("o.title")}</h2>
    <label class="f">${ic("globe")} ${t("o.lang")}<select id="oLang">${Object.entries(LANGS).sort((a, b) => a[1].localeCompare(b[1])).map(([k, v]) => `<option value="${k}" ${k === lang() ? "selected" : ""} lang="${k}">${v}</option>`).join("")}</select></label>
    <fieldset><legend>${ic("palette")} ${t("o.theme")}</legend><div class="theme-pick" role="radiogroup">${THEMES.map(([k, a, b]) => `<button type="button" class="chip" role="radio" data-theme-set="${k}" aria-checked="${theme() === k}"><span class="swatch" style="background:linear-gradient(135deg,${a} 50%,${b} 50%)"></span>${t("theme." + k)}</button>`).join("")}</div></fieldset>
    <div class="grid2"><label class="f">${ic("coin")} ${t("o.currency")}<select id="oCur">${["EUR", "CHF", "GBP", "USD", "PLN", "CZK", "HUF", "RON", "SEK", "DKK", "NOK", "BGN", "ISK", "RSD", "MKD", "ALL", "BAM", "UAH", "RUB", "TRY", "CNY", "JPY", "KRW", "AED", "SAR", "EGP", "MAD"].map(c => `<option ${c === st.currency ? "selected" : ""}>${c}</option>`).join("")}</select></label>
    <label class="f">${ic("ticket")} ${t("o.voucher")}<input id="oVouch" inputmode="decimal" value="${fmtNum(st.voucher || 8, locale())}"></label></div>
    <label class="f sw"><input type="checkbox" class="chk" id="oBuzz" ${st.buzz ? "checked" : ""}> ${t("o.buzz")}</label>
    ${vb ? `<p class="muted">${t("o.vBalance", { v: money(vb) })}</p>` : ""}</div>
  ${albumCard()}
  <div class="card"><h2>${ic("sheet")} ${t("o.import")}</h2><p class="muted">${t("o.importHint")}</p><p class="hint">${t("o.impHint2")}</p><div class="btns"><button class="btn" data-act="import">${ic("sheet")} ${t("o.importBtn")}</button>${gd.canPick() ? `<button class="btn soft" data-act="importDrive">${ic("cloud")} ${t("o.importDrive")}</button>` : ""}</div></div>
  ${installCard()}
  <div class="card" id="cloud"><h2>${ic("cloud")} ${t("o.cloud")}</h2><p class="muted">${t("o.cloudHint")}</p>
    <h3>Dropbox ${dbx.isConnected() ? ic("check") : ""}</h3>${dbx.isConnected() ? `<p class="muted">${esc(dbx.path())}</p><div class="btns"><button class="btn small" data-act="sync">${ic("sync")} ${t("o.syncNow")}</button><button class="btn small ghost" data-act="dbxOff">${t("o.disconnect")}</button></div>`
      : `<button class="btn soft" data-act="dbx">${t("o.connect", { p: "Dropbox" })}</button>`}
    <h3>Google Drive ${gd.isConnected() ? ic("check") : ""}</h3>${gd.isConnected() ? `<div class="btns"><button class="btn small" data-act="sync">${ic("sync")} ${t("o.syncNow")}</button><button class="btn small ghost" data-act="gdOff">${t("o.disconnect")}</button></div>`
      : `<button class="btn soft" data-act="gd">${t("o.connect", { p: "Google Drive" })}</button>`}
    <p class="hint">${t("o.cloudPrivacy")}</p></div>
  <div class="card"><h2>${ic("palette")} ${t("o.cats")}</h2><div class="chips">${cats().map(c => `<button class="chip" data-act="editCat" data-id="${c.id}">${catIcon(c)} ${esc(cname(c))}</button>`).join("")}<button class="chip add" data-act="newCat">${ic("plus")} ${t("c.new")}</button></div></div>
  <div class="card"><h2>${ic("robot")} ${t("o.ai")}</h2><p class="muted">${t("o.aiHint")}</p><button class="btn soft small" data-act="aiKey">${ai.ready() ? ic("check") + " " + t("o.aiOn") : t("o.aiSet")}</button></div>
  <div class="card"><h2>${ic("check")} ${t("o.backup")}</h2><div class="btns"><button class="btn soft" data-act="backup">${ic("download")} ${t("o.export")}</button><button class="btn soft" data-act="restore">${ic("upload")} ${t("o.restore")}</button></div>
    <details><summary>${t("o.danger")}</summary><button class="btn danger" data-act="wipe">${t("o.wipe")}</button></details></div>
  <div class="card"><h2>${ic("capy")} Kapibo ${APP_VERSION}</h2><p class="muted">${t("o.about")}</p>
    <div class="btns"><button class="btn small soft" data-act="tour">${ic("capy")} ${t("o.tour")}</button><button class="btn small soft" data-act="legal">${ic("lock")} ${t("o.legal")}</button><button class="btn small soft" data-act="news">${ic("sparkle")} ${t("o.news")}</button><a class="btn small ghost" href="../mochi-spesa/" rel="noopener">🍡 Mochi Spesa</a><a class="btn small ghost" href="../pdf-tiny-tools/" rel="noopener">🗜️ Schiaccia PDF</a>
    <a class="btn small ghost" href="https://github.com/Marketto/kapibo" rel="noopener">GitHub</a>
    <button class="btn small soft" data-act="share">${ic("share")} ${t("share.btn")}</button>${kofiUrl() ? `<a class="btn small kofi" href="${kofiUrl()}" target="_blank" rel="noopener" aria-label="${esc(t("kofi.label"))}">${ic("heart")} ${t("kofi.btn")}</a>` : ""}</div></div>`;
}
function albumCard() {
  const have = S().settings.stickers || {}, n = STICKERS.filter(x => have[x.id]).length;
  return `<div class="card" id="stickers"><h2>${ic("star")} ${t("st.title")}</h2><p class="muted">${t("st.hint")} · ${t("st.count", { n, tot: STICKERS.length })}</p>
    <ul class="stk-grid">${STICKERS.map((x, i) => { const on = !!have[x.id]; return `<li class="stk ${on ? "on" : "off"}" style="--tilt:${((i % 5) - 2) * 2.5}deg"><span class="stk-ic">${ic(on ? x.icon : "lock")}</span><b>${t("st.k." + x.id)}</b><small>${t("st.kd." + x.id)}</small><span class="sr">${t(on ? "st.got" : "st.locked")}</span></li>`; }).join("")}</ul></div>`;
}
document.addEventListener("change", async e => {
  if (e.target.id === "oLang") { lsSet("kapibo.lang", e.target.value); await setLang(e.target.value); render(); ch.friend.label(); ch.greet(); }
  if (e.target.id === "oBuzz") { store.setSettings({ buzz: e.target.checked }); if (e.target.checked) navigator.vibrate?.(12); }
  if (e.target.id === "oCur") store.setSettings({ currency: e.target.value });
  if (e.target.id === "oVouch") { const v = num(e.target.value); if (v) store.setSettings({ voucher: v }); }
});

// scintille e vibrazione sui pulsanti che salvano o aggiungono
const SAVE_BTN = '.btn[value="ok"], #pSave, #stSave, #bSave, #mtSave';
document.addEventListener("pointerdown", e => { const b = e.target.closest?.(".btn"); if (b && (b.matches(SAVE_BTN) || b.dataset.act === "add")) kapi.sparkle(e.clientX, e.clientY, 7, b.closest("dialog") || document.body); });
document.addEventListener("click", e => { if (e.target.closest?.(SAVE_BTN)) buzz(); });

// temi
const THEMES = [["joy", "#fff4e3", "#ffb627"], ["onsen", "#eef8f5", "#1c7568"], ["night", "#231c27", "#ffb07a"], ["auto", "#fff4e3", "#231c27"]];
const theme = () => document.documentElement.dataset.theme || "auto";
document.addEventListener("click", e => {
  const b = e.target.closest("[data-theme-set]"); if (!b) return;
  document.documentElement.dataset.theme = b.dataset.themeSet; lsSet("kapibo.theme", b.dataset.themeSet);
  render(); ch.cheer("theme"); unlock("theme");
});

// importazione Excel
$("#fileXls").addEventListener("change", e => { const f = e.target.files[0]; e.target.value = ""; if (f) importFile(f); });
async function importDrive() {
  try { const f = await gd.pickSpreadsheet(lang()); if (f) importFile(f); } catch (e) { toast(t(e.code || "o.impError")); }
}
async function importFile(f) {
  kapi.mood("think"); kapi.say("kapi.think");
  try {
    const { readWorkbook, importSheets } = await import("./importer.js");
    const res = importSheets(await readWorkbook(f), S().cats);
    const sum = res.report.filter(r => !r.skipped).map(r => `<li>${esc(r.sheet)}: ${t(r.kind === "usage" ? "o.impUsage" : "o.impMonths", { n: r.rows })}</li>`).join("");
    const r = await dialog(t("o.importBtn"), `<ul>${sum || `<li>${t("o.impNothing")}</li>`}</ul><p>${t("o.impCounts", { e: res.entries.length, m: Object.keys(res.months).length, r: res.readings.length, b: res.bills.length })}</p>
      ${res.cats.length ? `<p class="muted">${t("o.impNewCats", { list: res.cats.map(c => c.name).join(", ") })}</p>` : ""}<p class="hint">${t("o.impSafe")}</p>`, { ok: t("o.impGo") });
    kapi.mood("idle");
    if (!r || !res.entries.length && !res.readings.length) return;
    const tm = Date.now(), stamp = arr => arr.map((x, i) => ({ ...x, u: tm + i }));
    const months = {}; for (const [k, v] of Object.entries(res.months)) months[k] = { ...(S().months[k] || {}), ...v, u: tm };
    const before = nLive();
    // contatori di una vecchia importazione (una colonna per fascia) sostituiti da quello che somma le fasce
    const drop = new Set(res.drop?.meters || []);
    const gone = { meters: S().meters.filter(x => drop.has(x.id) && !x.del).map(x => ({ ...x, del: 1 })), readings: S().readings.filter(x => drop.has(x.meter) && !x.del).map(x => ({ ...x, del: 1 })) };
    store.set(merge(S(), { cats: stamp(res.cats), entries: stamp(res.entries), meters: stamp([...res.meters, ...gone.meters]), readings: stamp([...res.readings, ...gone.readings]), bills: stamp(res.bills), months }));
    const last = Object.keys(res.months).sort().pop(); if (last) cur = last;
    kapi.confetti(40); go("stats"); afterSave({ say: ["import", { m: Object.keys(res.months).length || Math.max(0, ...res.report.map(r => r.rows || 0)) }, 1], before, ev: ["import"] });
  } catch (err) { console.error(err); toast(t("o.impError")); kapi.say("kapi.oops"); }
}

// backup
function exportBackup() {
  const blob = new Blob([JSON.stringify(S())], { type: "application/json" }), a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = `kapibo-${today()}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
$("#fileJson").addEventListener("change", async e => {
  const f = e.target.files[0]; if (!f) return; e.target.value = "";
  try { const data = JSON.parse(await f.text()); store.set(merge(S(), data)); toast(t("o.restored")); ch.cheer("import", { m: Object.keys(S().months).length }, { big: true }); unlock(); } catch { toast(t("o.impError")); }
});
async function wipeAll() {
  const r = await dialog(t("o.wipe"), `<p>${t("o.wipeSure")}</p>`, { ok: t("o.wipe") });
  if (r) { store.set(normalize({})); toast(t("o.wiped")); }
}
async function aiDialog() {
  const r = await dialog(t("o.ai"), `<p class="hint">${t("o.aiHint2")}</p><label class="f">API key<input name="k" type="password" autocomplete="off" value="${ai.getKey() ? "••••••••" : ""}"></label>`, { extra: ai.ready() ? `<button class="btn danger" value="del" formnovalidate>${t("ui.delete")}</button>` : "" });
  if (!r) return; if (r._btn === "del") ai.setKey(""); else if (r.k && !r.k.startsWith("•")) ai.setKey(r.k);
  render();
}
async function newsDialog() {
  await dialog(t("o.news"), `<ul>${CHANGELOG.map(c => `<li><b>${c.v}</b> — ${t(c.key)}</li>`).join("")}</ul>`, { ok: "", cancel: t("ui.close") });
}

// ---------- sync ----------
async function dropboxConnect() {
  // chiave pubblicata col sito: un tocco e via; il dialogo con i campi serve solo se manca (sviluppo locale)
  if (dbx.DEFAULT_KEY) return dbx.startAuth(dbx.appKey());
  const r = await dialog(t("o.connect", { p: "Dropbox" }), `<p class="hint">${t("o.dbxHint", { uri: dbx.redirectUri() })}</p><label class="f">App key<input name="k" required autocomplete="off"></label>`, { ok: t("o.connectGo") });
  if (r?.k) dbx.startAuth(r.k.trim());
}
async function gdriveConnect() {
  let cid = gd.clientId();
  if (!cid) {
    const r = await dialog(t("o.connect", { p: "Google Drive" }), `<p class="hint">${t("o.gdHint", { origin: location.origin })}</p><label class="f">OAuth Client ID<input name="k" required autocomplete="off"></label>`, { ok: t("o.connectGo") });
    if (!r?.k) return; cid = r.k.trim();
  }
  try { await gd.connect(cid); toast(t("sync.connected", { p: "Google Drive" })); render(); doSync(true); } catch (e) { toast(t(e.code || "sync.retry")); }
}
async function doSync(manual) {
  const btn = $("#syncBtn"); btn.dataset.state = "busy";
  const res = await sync.syncNow(store), bad = Object.values(res).find(v => v !== "ok");
  btn.dataset.state = !Object.keys(res).length ? "off" : bad ? "err" : "on";
  btn.setAttribute("aria-label", t(bad ? "sync.err" : "sync.ok"));
  if (manual) toast(t(bad || "sync.ok"));
  if (!bad && Object.keys(res).length) { if (manual) ch.cheer("sync"); unlock("sync"); }
}

// ---------- wizard delle funzioni ----------
/** Primo avvio: tutto il tour; dopo un aggiornamento: solo le novità (o niente). all=true lo ripete per intero. */
function startTour(all) {
  const seen = all ? "" : tour.seen(), steps = tour.pick(seen, APP_VERSION), back = tab;
  const greet = () => setTimeout(() => (S().entries.length ? ch.greet() : kapi.say("kapi.welcome", { ms: 6000 })), 400);
  if (!steps.length) { if (seen && tour.cmp(seen, APP_VERSION) < 0) toast(t("upd.done", { v: APP_VERSION })); tour.markSeen(APP_VERSION); return greet(); }
  tour.run(steps, { go: n => { if (n !== tab) go(n); }, kapiSvg: kapi.KAPI_SVG, onEnd: () => { tour.markSeen(APP_VERSION); if (tab !== back) go(back); kapi.mood("happy"); greet(); } });
}

// ---------- installazione ----------
function installCard() {
  const m = inst.mode();
  if (inst.installed()) return "";
  return `<div class="card" id="install"><h2>${ic("download")} ${t("inst.title")}</h2><p class="muted">${t("inst.hint")}</p>
    ${m === "prompt" ? `<div class="btns"><button class="btn" data-act="install">${ic("download")} ${t("inst.btn")}</button></div>`
      : m === "android" ? `<ol class="install-steps"><li>${ic("globe")} ${t("inst.and1")}</li><li>${ic("more")} ${t("inst.and2")}</li><li>${ic("capy")} ${t("inst.ios3")}</li></ol>`
      : m === "ios" ? `<p><b>${t("inst.ios")}</b></p><ol class="install-steps"><li>${ic("upload")} ${t("inst.ios1")}</li><li>${ic("plus")} ${t("inst.ios2")}</li><li>${ic("capy")} ${t("inst.ios3")}</li></ol>`
      : `<p class="hint">${t("inst.none")}</p>`}</div>`;
}

// ---------- service worker e aggiornamenti ----------
function registerSW() {
  // Aggiornamento automatico: la nuova versione si attiva subito e la pagina si ricarica appena l'utente non sta facendo nulla.
  navigator.serviceWorker.register("sw.js").then(reg => {
    const activate = nw => nw?.addEventListener("statechange", () => { if (nw.state === "installed" && navigator.serviceWorker.controller) nw.postMessage("skip"); });
    if (reg.waiting && navigator.serviceWorker.controller) reg.waiting.postMessage("skip");
    reg.addEventListener("updatefound", () => activate(reg.installing));
    const check = () => reg.update().catch(() => {});
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") check(); });
    setInterval(check, 30 * 60 * 1000);
  }).catch(() => {});
  let pending = false;
  const safe = () => !document.querySelector("dialog[open], .tour") && !scanState && !document.activeElement?.matches?.("input, textarea, select");
  const reloadWhenSafe = () => { if (safe()) location.reload(); else setTimeout(reloadWhenSafe, 2000); };
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (!pending) { pending = true; reloadWhenSafe(); } });
}

boot();
