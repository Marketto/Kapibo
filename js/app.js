// Kapibo — interfaccia. Sezioni: avvio · utilità · mese · scansione · consumi · grafici · altro · dialoghi · sync.
import { t, setLang, detect, lang, locale, LANGS, monthLabel, apply } from "./i18n.js";
import { createStore, idbGet, idbSet, monthSummary, prevMonth, nextMonth, monthOf, today, uid, live, normalize, merge } from "./store.js";
import { guessCats, catName, norm, isGrocer } from "./categories.js";
import { fmt as fmtMoney, parseAmount, round2, fmtNum } from "./money.js";
import * as kapi from "./mascot.js";
import { series, catAverages, tips, usage, unitPrice, voucherBalance } from "./stats.js";
import { donut, hbars, timeline } from "./charts.js";
import { APP_VERSION, CHANGELOG } from "./version.js";
import * as sync from "./sync/index.js";
import * as dbx from "./sync/dropbox.js";
import * as gd from "./sync/gdrive.js";
import * as ai from "./ai.js";

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
const lsGet = k => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch {} };

function toast(msg, action) {
  const el = $("#toast"); el.innerHTML = `<span>${esc(msg)}</span>`; el.hidden = false;
  if (action) { const b = document.createElement("button"); b.textContent = action.label; b.onclick = () => { el.hidden = true; action.run(); }; el.appendChild(b); }
  clearTimeout(el._t); el._t = setTimeout(() => (el.hidden = true), action ? 9000 : 3200);
}
const celebrate = (key = "kapi.added") => { kapi.mood("happy"); kapi.say(key); };

// ---------- avvio ----------
async function boot() {
  const saved = await idbGet("state");
  store.set(normalize(saved), { silent: true });
  await setLang(detect(lsGet("kapibo.lang")));
  kapi.mount($("#kapi"), $("#bubble"));
  store.on(persist);
  bindChrome();
  try { if (await dbx.handleRedirect()) { toast(t("sync.connected", { p: "Dropbox" })); doSync(); } } catch (e) { toast(t(e.code || "sync.retry")); }
  const h = location.hash.slice(1); if (["month", "usage", "scan", "stats", "more"].includes(h)) tab = h;
  render();
  setTimeout(() => kapi.say(S().entries.length ? "kapi.hello" : "kapi.welcome", { ms: 6000 }), 600);
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
  window.addEventListener("hashchange", () => { const h = location.hash.slice(1); if (h && h !== tab) go(h); });
}
function go(next, focusSel) {
  tab = next; history.replaceState(null, "", "#" + next);
  if (next !== "scan") scanState = scanState?.busy ? scanState : null;
  render(); window.scrollTo({ top: 0, behavior: "smooth" });
  if (focusSel) setTimeout(() => $(focusSel)?.scrollIntoView({ behavior: "smooth" }), 80); else $("#main").focus({ preventScroll: true });
}

function render() {
  $("#mLabel").textContent = monthLabel(cur);
  document.querySelectorAll(".tabs button").forEach(b => (b.dataset.tab === tab ? b.setAttribute("aria-current", "page") : b.removeAttribute("aria-current")));
  const v = { month: viewMonth, scan: viewScan, usage: viewUsage, stats: viewStats, more: viewMore }[tab] || viewMonth;
  const main = $("#main"), y = window.scrollY;
  main.innerHTML = `<section>${v()}</section>`;
  apply(main);
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
    meta: monthDialog,
    cat: () => catDetail(id),
    kind: () => startScan(b.dataset.kind, b.dataset.cam === "1"),
    scanBack: () => { scanState = null; render(); },
    meter: () => meterDialog(S().meters.find(x => x.id === id)),
    reading: () => readingDialog(id),
    bill: () => billDialog(S().bills.find(x => x.id === id)),
    offer: () => offerDialog(S().offers.find(x => x.id === id)),
    import: () => $("#fileXls").click(),
    backup: exportBackup, restore: () => $("#fileJson").click(),
    dbx: dropboxConnect, dbxOff: () => { dbx.disconnect(); render(); }, gd: gdriveConnect, gdOff: () => { gd.disconnect(); render(); },
    sync: () => doSync(true), newCat: () => catDialog(), editCat: () => catDialog(catById(id)),
    aiKey: aiDialog, news: newsDialog, wipe: wipeAll,
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
  return `
  <div class="card">
    <div class="grid2">
      <div class="stat big"><small>${t("m.spent")}</small><b>${money(s.tracked)}</b></div>
      <div class="stat big"><small>${t("m.saved")}</small><b class="${sv == null ? "" : sv >= 0 ? "pos" : "neg"}">${sv == null ? "—" : money(sv)}</b></div>
      <div class="stat"><small>${t("m.income")}</small><b>${money(s.income)}</b></div>
      <div class="stat"><small>${t("m.vouchers")}</small><b>${money(s.vUsed)} <span class="muted">/ ${money(s.vIn)}</span></b></div>
      <div class="stat"><small>${t("m.start")}</small><b>${s.start == null ? "—" : money(s.start)}</b></div>
      <div class="stat"><small>${t("m.end")}</small><b>${s.end == null ? "—" : money(s.end)}</b></div>
    </div>
    ${unt != null && Math.abs(unt) >= 1 ? `<p class="muted" style="margin:.8em 0 0">${t(unt > 0 ? "m.untracked" : "m.overtracked", { amt: money(Math.abs(unt)) })}</p>` : ""}
    <div class="btns"><button class="btn" data-act="add">＋ ${t("m.addExpense")}</button><button class="btn soft" data-act="meta">💶 ${t("m.editMeta")}</button></div>
  </div>
  <div class="card"><h2>${t("m.byCat")}</h2>
    ${rows.length ? `<ul class="list">${rows.map(([id, v]) => { const c = catById(id); return `<li><button class="item" data-act="cat" data-id="${esc(id)}" style="--c:${c.color}">
      <span class="emo" aria-hidden="true">${c.emoji}</span><span class="name">${esc(cname(c))}<span class="bar"><i style="--w:${(v / max) * 100}%;--c:${c.color}"></i></span></span><span class="amt">${money(v)}</span></button></li>`; }).join("")}</ul>`
    : empty("m.empty")}
  </div>
  ${recent.length ? `<div class="card"><h2>${t("m.recent")}</h2><ul class="list">${recent.map(entryRow).join("")}</ul></div>` : ""}
  <div class="card"><h3>${t("m.quick")}</h3><div class="chips">${list.filter(c => c.kind === "var").slice(0, 8).map(c => `<button class="chip" data-act="add" data-cat="${c.id}"><span aria-hidden="true">${c.emoji}</span>${esc(cname(c))}</button>`).join("")}</div></div>`;
}
const entryRow = e => { const c = catById(e.cat); return `<li><button class="item" data-act="edit" data-id="${e.id}" style="--c:${c.color}"><span class="emo" aria-hidden="true">${c.emoji}</span>
  <span class="name">${esc(e.note || cname(c))}<br><small class="muted">${esc(new Date(e.d).toLocaleDateString(locale(), { day: "numeric", month: "short" }))} · ${esc(cname(c))}${e.items ? " · " + t("m.items", { n: e.items.length }) : ""}</small></span><span class="amt">${money(e.amt)}</span></button></li>`; };
const empty = key => `<div class="empty"><div class="hero-kapi">${kapi.KAPI_SVG}</div><p>${t(key)}</p></div>`;

async function catDetail(id) {
  const c = catById(id), es = live(S().entries).filter(e => e.m === cur && e.cat === id).sort((a, b) => (a.d < b.d ? 1 : -1));
  const r = await dialog(`${c.emoji} ${cname(c)}`, `<ul class="list">${es.map(entryRow).join("")}</ul>`, { ok: t("m.addHere"), cancel: t("ui.close") });
  if (r) entryDialog({ cat: id });
}

// ---------- dialoghi ----------
/** Apre il dialogo con campi HTML; risolve con i valori del modulo o null. */
function dialog(title, body, { ok = t("ui.save"), cancel = t("ui.cancel"), extra = "", onOpen } = {}) {
  const d = $("#dlg"), f = $("#dlgForm");
  f.innerHTML = `<div class="dlg-head"><h2 id="dlgTitle">${esc(title)}</h2><button class="icon-btn" value="cancel" formnovalidate aria-label="${esc(t("ui.close"))}">✕</button></div>
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
  return `<div class="catgrid" data-multi="${name}" data-single="${multi ? "" : 1}" role="group">${cats().map(c => `<button type="button" class="chip" data-v="${c.id}" aria-pressed="${sel.includes(c.id)}"><span aria-hidden="true">${c.emoji}</span>${esc(cname(c))}</button>`).join("")}</div>`;
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
  if (r._btn === "del") { store.remove("entries", e.id); toast(t("e.deleted"), { label: t("ui.undo"), run: () => store.put("entries", { ...e, del: 0 }) }); return; }
  const amt = num(r.amt); if (amt == null) return toast(t("e.badAmount"));
  store.put("entries", { ...e, amt: round2(amt), cat: r.cat?.[0] || "other", d: r.d, m: monthOf(r.d), note: r.note.trim(), src: e.src || "manual" });
  if (r.note.trim()) store.learn(r.note, [r.cat?.[0]]);
  celebrate(); if (isNew && monthOf(r.d) !== cur) { cur = monthOf(r.d); render(); }
}

async function monthDialog() {
  const m = S().months[cur] || {}, s = monthSummary(S(), cur), vv = S().settings.voucher || 8;
  const f = (k, v, hint = "") => `<label class="f">${t("meta." + k)}${hint ? ` <span class="hint">${hint}</span>` : ""}<input name="${k}" inputmode="decimal" value="${v != null ? fmtNum(v, locale()) : ""}"></label>`;
  const r = await dialog(t("meta.title", { m: monthLabel(cur) }), `
    <div class="grid2">${f("start", m.start ?? s.start, m.start == null && s.start != null ? t("meta.auto") : "")}${f("end", m.end)}</div>
    <div class="grid2">${f("salary", m.salary)}${f("extra", m.extra)}</div>${f("refunds", m.refunds)}
    <fieldset><legend>🎫 ${t("meta.vouchers")}</legend><div class="grid2">${f("vIn", m.vIn)}${f("vUsed", m.vUsed)}</div>
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
  celebrate(patch.end != null && patch.start != null && patch.end > patch.start ? "kapi.saving" : "kapi.saved");
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
  store.put("cats", { ...base, emoji: r.emoji, color: r.color, kind: r.kind, name: isDefault ? undefined : r.name.trim() });
}

// ---------- scansione ----------
const KINDS = [["receipt", "🧾"], ["payslip", "💼"], ["statement", "🏦"], ["bill", "📄"], ["meter", "🔢"]];
function viewScan() {
  if (scanState) return scanView();
  return `<div class="card"><h2>${t("s.title")}</h2><p class="muted">${t("s.intro")}</p>
    <div class="kinds">${KINDS.map(([k, e]) => `<button class="kind" data-act="kind" data-kind="${k}" data-cam="1"><span aria-hidden="true">${e}</span>${t("s.k." + k)}<small>${t("s.kd." + k)}</small></button>`).join("")}
    <button class="kind" data-act="add"><span aria-hidden="true">✍️</span>${t("s.manual")}<small>${t("s.manuald")}</small></button></div></div>
    <div class="card"><h3>📁 ${t("s.fromFile")}</h3><div class="chips">${KINDS.map(([k, e]) => `<button class="chip" data-act="kind" data-kind="${k}">${e} ${t("s.k." + k)}</button>`).join("")}</div>
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
    if (kind === "meter" && !/\d{3}/.test(text)) text += "\n" + (await ocr.recognize(file, { lang: lng, mode: "text", onStatus })).text;
    const P = await import(`./parsers/${kind}.js`);
    const fn = { receipt: "parseReceipt", payslip: "parsePayslip", statement: "parseStatement", bill: "parseBill", meter: "parseMeter" }[kind];
    let res = P[fn](text);
    if (kind === "receipt" && ai.ready()) { try { const o = await ai.structureReceipt(text, cats().map(c => c.id), LANGS[lang()]); if (o.items.length) res = { ...res, ...o, ai: true }; } catch (e) { toast(t(e.code || "ai.fail")); } }
    scanState = { ...scanState, busy: false, text, res };
    if (kind === "receipt") prepReceipt();
    kapi.mood("wow"); kapi.say(hasResult() ? "kapi.found" : "kapi.notFound");
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
  const st = scanState, back = `<button class="btn ghost small" data-act="scanBack">← ${t("ui.back")}</button>`;
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
  return `<div class="card"><h2>🧾 ${t("s.k.receipt")}</h2>
    ${scanState.url ? `<img class="preview" src="${scanState.url}" alt="${esc(t("s.photoAlt"))}">` : ""}
    <div class="grid2"><label class="f">${t("e.date")}<input type="date" id="rDate" value="${r.date}"></label><label class="f">${t("s.store")}<input id="rStore" value="${esc(r.store || "")}"></label></div>
    ${r.total != null ? (Math.abs(diff) < 0.02 ? `<p class="okbox">✓ ${t("s.totalOk", { tot: money(r.total) })}</p>` : `<p class="warn">${t("s.totalDiff", { tot: money(r.total), diff: money(diff) })}</p>`) : ""}
    <p class="muted">${t("s.tapHint")}</p>
    <div id="rItems">${r.items.map(itemRow).join("")}</div>
    <button class="btn soft small" id="rAdd" type="button">＋ ${t("s.addLine")}</button>
    <label class="f">🎫 ${t("s.vouchersPaid")}<input id="rVouch" inputmode="decimal" value="${r.vouchers ? fmtNum(r.vouchers, locale()) : ""}"></label>
    <div class="card" style="background:var(--c-bg)"><b>${t("s.summary")}</b>${receiptGroups(on)}<p><b>${t("s.selected", { n: on.length, sum: money(sum) })}</b></p></div>
    <div class="btns"><button class="btn" id="rSave" ${on.length ? "" : "disabled"}>💾 ${t("s.addAll", { n: on.length })}</button></div></div>`;
}
const itemRow = it => `<div class="ritem ${it.on ? "" : "off"}" data-i="${it.i}">
  <input type="checkbox" class="chk" ${it.on ? "checked" : ""} aria-label="${esc(t("s.include", { name: it.name }))}">
  <input class="inp" data-f="name" value="${esc(it.name)}" aria-label="${esc(t("s.itemName"))}">
  <input class="inp" data-f="amount" inputmode="decimal" value="${fmtNum(it.amount, locale())}" aria-label="${esc(t("e.amount"))}">
  <div class="chips">${it.cats.map(c => { const k = catById(c); return `<button type="button" class="chip" data-cat-edit aria-pressed="true">${k.emoji} ${esc(cname(k))}</button>`; }).join("")}
  <button type="button" class="chip add" data-cat-edit aria-label="${esc(t("s.changeCat"))}">✎</button></div></div>`;
function receiptGroups(on) {
  const g = {}; for (const it of on) for (const c of it.cats) g[c] = round2((g[c] || 0) + it.amount / it.cats.length);
  return `<ul class="legend">${Object.entries(g).map(([c, v]) => { const k = catById(c); return `<li><i style="--c:${k.color}"></i>${k.emoji} ${esc(cname(k))} <b>${money(v)}</b></li>`; }).join("")}</ul>`;
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
  const r = scanState.res, on = r.items.filter(i => i.on && i.amount), d = r.date || today(), m = monthOf(d), doc = uid();
  const g = {};
  for (const it of on) { for (const c of it.cats) { g[c] ||= { amt: 0, items: [] }; g[c].amt += it.amount / it.cats.length; g[c].items.push({ n: it.name, a: round2(it.amount / it.cats.length) }); } store.learn(it.name, it.cats); }
  store.putMany("entries", Object.entries(g).map(([cat, x]) => ({ d, m, cat, amt: round2(x.amt), items: x.items, note: r.store || t("s.k.receipt"), src: "receipt", doc })));
  if (r.vouchers) { const mm = S().months[m] || {}; store.setMonth(m, { vUsed: round2((mm.vUsed || 0) + r.vouchers) }); }
  scanState = null; cur = m; tab = "month"; kapi.confetti(); celebrate("kapi.receiptSaved"); go("month");
  toast(t("s.saved", { n: Object.keys(g).length }));
}

function reviewPayslip() {
  const r = scanState.res; scanState.after = () => ($("#pSave").onclick = () => {
    const m = $("#pMonth").value, net = num($("#pNet").value), v = num($("#pV").value);
    if (!m || net == null) return toast(t("e.badAmount"));
    const patch = { salary: net }; if (v != null) patch.vIn = v;
    store.setMonth(m, patch); scanState = null; cur = m; kapi.confetti(); celebrate("kapi.salary"); go("month");
  });
  return `<div class="card"><h2>💼 ${t("s.k.payslip")}</h2>
    <label class="f">${t("s.month")}<input type="month" id="pMonth" value="${r.month || cur}"></label>
    <label class="f">${t("s.net")}<input id="pNet" class="amt" inputmode="decimal" value="${r.net != null ? fmtNum(r.net, locale()) : ""}"></label>
    <label class="f">🎫 ${t("s.vouchersIn")} <span class="hint">${r.vCount ? `${r.vCount} × ${money(r.vValue)}` : ""}</span><input id="pV" inputmode="decimal" value="${r.vouchers != null ? fmtNum(r.vouchers, locale()) : ""}"></label>
    ${r.net == null ? `<p class="warn">${t("s.notFoundField")}</p>` : ""}<div class="btns"><button class="btn" id="pSave">💾 ${t("ui.save")}</button></div></div>`;
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
      if (es.length) store.putMany("entries", es);
      for (const [m, p] of Object.entries(months)) { const old = S().months[m] || {}; store.setMonth(m, { salary: p.salary != null ? p.salary : old.salary, extra: p.extra != null ? round2((old.extra || 0) + p.extra) : old.extra }); }
      scanState = null; kapi.confetti(); celebrate(); go("month"); toast(t("s.savedRows", { n: es.length }));
    };
  };
  const opts = sel => `<option value="_salary" ${sel === "_salary" ? "selected" : ""}>💼 ${t("meta.salary")}</option><option value="_extra" ${sel === "_extra" ? "selected" : ""}>🌟 ${t("meta.extra")}</option>` + cats().map(c => `<option value="${c.id}" ${sel === c.id ? "selected" : ""}>${c.emoji} ${esc(cname(c))}</option>`).join("");
  return `<div class="card"><h2>🏦 ${t("s.k.statement")}</h2><p class="muted">${t("s.stHint")}</p>
    <div id="stRows">${r.rows.map(x => `<div class="ritem ${x.on ? "" : "off"}" data-i="${x.i}"><input type="checkbox" class="chk" ${x.on ? "checked" : ""} aria-label="${esc(x.desc)}">
      <span>${esc(x.desc)}<br><small class="muted">${esc(x.date)}</small></span><b class="${x.amount < 0 ? "" : "pos"}">${money(x.amount)}</b>
      <select class="inp" style="grid-column:2/4" aria-label="${esc(t("e.cat"))}">${opts(x.cat)}</select></div>`).join("") || `<p class="warn">${t("s.notFoundField")}</p>`}</div>
    <div class="btns"><button class="btn" id="stSave">💾 ${t("ui.save")}</button></div></div>`;
}

const BILL_CAT = { elec: "elec", gas: "gas", water: "water", internet: "internet", waste: "waste", other: "other" };
function reviewBill() {
  const r = scanState.res;
  scanState.after = () => ($("#bSave").onclick = () => {
    const f = Object.fromEntries(["bKind", "bAmt", "bCons", "bMonth", "bFreq"].map(k => [k, $("#" + k).value]));
    const amount = num(f.bAmt); if (amount == null) return toast(t("e.badAmount"));
    const m = f.bMonth, entry = store.put("entries", { d: m + "-" + (m === monthOf(today()) ? today().slice(8) : "01"), m, cat: BILL_CAT[f.bKind] || "other", amt: amount, note: t("u.k." + f.bKind), src: "bill" });
    store.put("bills", { kind: f.bKind, amount, cons: num(f.bCons), unit: f.bKind === "elec" ? "kWh" : "m³", m, freq: f.bFreq, from: r.period?.from, to: r.period?.to, entry: entry.id });
    scanState = null; cur = m; kapi.confetti(); celebrate(); go("usage");
  });
  return `<div class="card"><h2>📄 ${t("s.k.bill")}</h2>${billFields({ ...r, m: r.period?.to ? monthOf(r.period.to) : cur })}<div class="btns"><button class="btn" id="bSave">💾 ${t("ui.save")}</button></div></div>`;
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
    scanState = null; kapi.confetti(); celebrate(); go("usage");
  });
  return `<div class="card"><h2>🔢 ${t("s.k.meter")}</h2>${scanState.url ? `<img class="preview" src="${scanState.url}" alt="${esc(t("s.photoAlt"))}">` : ""}
    <label class="f">${t("u.meter")}<select id="mtMeter">${ms.map(m => `<option value="${m.id}">${esc(m.name)}</option>`).join("")}<option value="_new">＋ ${t("u.newMeter")}</option></select></label>
    <label class="f">${t("u.reading")} <span class="hint">${t("s.checkDigits")}</span><input id="mtVal" class="amt" inputmode="decimal" value="${r.value != null ? r.value : ""}"></label>
    ${r.options?.length > 1 ? `<div class="chips">${r.options.map(o => `<button type="button" class="chip" onclick="document.getElementById('mtVal').value='${o}'">${o}</button>`).join("")}</div>` : ""}
    <label class="f">${t("e.date")}<input type="date" id="mtDate" value="${today()}"></label><div class="btns"><button class="btn" id="mtSave">💾 ${t("ui.save")}</button></div></div>`;
}

// ---------- consumi ----------
function viewUsage() {
  const s = S(), ms = live(s.meters), bills = live(s.bills).sort((a, b) => (a.m < b.m ? 1 : -1));
  const meterCard = m => {
    const u = usage(s, m.id).slice(-12), last = live(s.readings).filter(r => r.meter === m.id).sort((a, b) => (a.d < b.d ? 1 : -1))[0];
    const col = { elec: "#f7b500", gas: "#ff8a3d", water: "#38a8e8" }[m.kind] || "#a07cf0";
    return `<div class="card"><div class="row"><h3 class="grow">${{ elec: "⚡", gas: "🔥", water: "💧" }[m.kind] || "🔢"} ${esc(m.name)}</h3><button class="btn small soft" data-act="meter" data-id="${m.id}">✎</button></div>
      <p class="muted">${last ? t("u.last", { v: fmtNum(last.value, locale(), 3), u: m.unit, d: new Date(last.d).toLocaleDateString(locale()) }) : t("u.noReadings")}</p>
      ${u.length ? timeline([{ name: m.name, color: col, values: u.map(x => x.use), type: "bar" }], u.map(x => monthLabel(x.m, { month: "short" })), { label: t("u.chart", { name: m.name }), fmt: v => fmtNum(v, locale()) + " " + m.unit }) : ""}
      <div class="btns"><button class="btn small" data-act="reading" data-id="${m.id}">＋ ${t("u.addReading")}</button><button class="btn small soft" data-act="kind" data-kind="meter" data-cam="1">📸 ${t("u.photo")}</button></div></div>`;
  };
  const prices = ["elec", "gas", "water"].map(k => [k, unitPrice(s, k)]).filter(x => x[1]);
  return `<div class="card"><h2>${t("u.title")}</h2><p class="muted">${t("u.intro")}</p><div class="btns"><button class="btn" data-act="meter">＋ ${t("u.newMeter")}</button><button class="btn soft" data-act="bill">＋ ${t("u.addBill")}</button></div></div>
    ${ms.map(meterCard).join("") || `<div class="card">${empty("u.empty")}</div>`}
    ${prices.length ? `<div class="card"><h3>💶 ${t("u.prices")}</h3>${prices.map(([k, p]) => `<p>${t("u.k." + k)}: <b>${money(p.price)}</b> / ${k === "elec" ? "kWh" : "m³"} · ${t("u.year", { c: fmtNum(p.yearCons, locale(), 0), y: money(p.yearCost) })}</p>`).join("")}
      <button class="btn small soft" data-act="offer">🔎 ${t("u.compare")}</button>${live(s.offers).map(o => `<button class="chip" data-act="offer" data-id="${o.id}">💡 ${esc(o.name || t("u.k." + o.kind))}</button>`).join(" ")}</div>` : ""}
    ${bills.length ? `<div class="card"><h3>📄 ${t("u.bills")}</h3><table class="t"><thead><tr><th>${t("s.month")}</th><th>${t("u.kind")}</th><th class="n">${t("u.cons")}</th><th class="n">${t("e.amount")}</th></tr></thead><tbody>
      ${bills.slice(0, 24).map(b => `<tr data-act="bill" data-id="${b.id}" style="cursor:pointer"><td>${esc(monthLabel(b.m, { month: "short", year: "2-digit" }))}</td><td>${esc(b.name || t("u.k." + b.kind))} <small class="muted">${t("u.f." + (b.freq || "m"))}</small></td><td class="n">${b.cons ? fmtNum(b.cons, locale()) + " " + b.unit : "—"}</td><td class="n">${b.amount ? money(b.amount) : "—"}</td></tr>`).join("")}</tbody></table></div>` : ""}`;
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
  store.put("readings", { meter: meterId, value: v, d: r.d, m: monthOf(r.d) }); celebrate();
}
async function billDialog(b) {
  const r = await dialog(b ? t("u.editBill") : t("u.addBill"), billFields(b || { m: cur }), { extra: b ? `<button class="btn danger" value="del" formnovalidate>${t("ui.delete")}</button>` : "" });
  if (!r) return;
  if (r._btn === "del") { store.remove("bills", b.id); if (b.entry) store.remove("entries", b.entry); return; }
  const amount = num(r.amount); if (amount == null) return toast(t("e.badAmount"));
  let entry = b?.entry;
  if (!b || b.entry) { const e = store.put("entries", { ...(S().entries.find(x => x.id === b?.entry) || {}), d: r.m + "-01", m: r.m, cat: BILL_CAT[r.kind], amt: amount, note: t("u.k." + r.kind), src: "bill" }); entry = e.id; }
  store.put("bills", { ...(b || {}), kind: r.kind, freq: r.freq, amount, cons: num(r.cons), unit: r.kind === "elec" ? "kWh" : "m³", m: r.m, entry }); celebrate();
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
  const avgRows = Object.entries(avg).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([id, v]) => { const c = catById(id); return { label: `${c.emoji} ${cname(c)}`, value: v, color: c.color }; });
  const tps = tips(s, cur, money);
  const rates = list.filter(x => x.rate != null);
  return `<div class="card"><h2>💡 ${t("st.tips")}</h2>${tps.map(x => `<div class="tip"><span aria-hidden="true">${x.icon}</span><p style="margin:0">${esc(t(x.key, { ...x.vars, cat: x.vars.cat ? cname(catById(x.vars.cat)) : "" }))}</p></div>`).join("")}</div>
    <div class="card"><h2>${t("st.trend")}</h2>${timeline([{ name: t("m.spent"), color: "#ff9f6b", values: list.map(x => x.tracked), type: "bar" }, { name: t("m.income"), color: "#4caf7d", values: list.map(x => x.income || null), type: "line" }], labels, { label: t("st.trendLabel"), fmt: money })}
      <ul class="legend"><li><i style="--c:#ff9f6b"></i>${t("m.spent")}</li><li><i style="--c:#4caf7d"></i>${t("m.income")}</li></ul>
      ${rates.length ? `<p class="muted">${t("st.rate", { r: Math.round((rates.reduce((a, b) => a + b.rate, 0) / rates.length) * 100) })}</p>` : ""}</div>
    ${slices.length ? `<div class="card"><h2>${t("st.month", { m: monthLabel(cur) })}</h2>${donut(slices, { label: t("st.donutLabel"), center: money(m.tracked) })}<ul class="legend">${slices.map(x => `<li><i style="--c:${x.color}"></i>${x.c.emoji} ${esc(x.label)}</li>`).join("")}</ul></div>` : ""}
    <div class="card"><h2>${t("st.avg")}</h2>${hbars(avgRows, money)}</div>
    <div class="card"><details><summary>${t("st.table")}</summary><table class="t"><thead><tr><th>${t("s.month")}</th><th class="n">${t("m.income")}</th><th class="n">${t("m.spent")}</th><th class="n">${t("m.saved")}</th></tr></thead>
      <tbody>${list.slice().reverse().map(x => `<tr><td>${esc(monthLabel(x.m, { month: "short", year: "2-digit" }))}</td><td class="n">${money(x.income)}</td><td class="n">${money(x.tracked)}</td><td class="n ${x.savings >= 0 ? "pos" : "neg"}">${x.savings == null ? "—" : money(x.savings)}</td></tr>`).join("")}</tbody></table></details></div>`;
}

// ---------- altro ----------
function viewMore() {
  const st = S().settings, vb = voucherBalance(S());
  return `<div class="card"><h2>⚙️ ${t("o.title")}</h2>
    <label class="f">🌍 ${t("o.lang")}<select id="oLang">${Object.entries(LANGS).sort((a, b) => a[1].localeCompare(b[1])).map(([k, v]) => `<option value="${k}" ${k === lang() ? "selected" : ""} lang="${k}">${v}</option>`).join("")}</select></label>
    <div class="grid2"><label class="f">💱 ${t("o.currency")}<select id="oCur">${["EUR", "CHF", "GBP", "USD", "PLN", "CZK", "HUF", "RON", "SEK", "DKK", "NOK", "BGN", "ISK", "RSD", "MKD", "ALL", "BAM", "UAH", "RUB", "TRY", "CNY", "JPY", "KRW", "AED", "SAR", "EGP", "MAD"].map(c => `<option ${c === st.currency ? "selected" : ""}>${c}</option>`).join("")}</select></label>
    <label class="f">🎫 ${t("o.voucher")}<input id="oVouch" inputmode="decimal" value="${fmtNum(st.voucher || 8, locale())}"></label></div>
    ${vb ? `<p class="muted">${t("o.vBalance", { v: money(vb) })}</p>` : ""}</div>
  <div class="card"><h2>📥 ${t("o.import")}</h2><p class="muted">${t("o.importHint")}</p><div class="btns"><button class="btn" data-act="import">📊 ${t("o.importBtn")}</button></div></div>
  <div class="card" id="cloud"><h2>☁️ ${t("o.cloud")}</h2><p class="muted">${t("o.cloudHint")}</p>
    <h3>Dropbox ${dbx.isConnected() ? "✅" : ""}</h3>${dbx.isConnected() ? `<p class="muted">${esc(dbx.path())}</p><div class="btns"><button class="btn small" data-act="sync">🔄 ${t("o.syncNow")}</button><button class="btn small ghost" data-act="dbxOff">${t("o.disconnect")}</button></div>`
      : `<button class="btn soft" data-act="dbx">${t("o.connect", { p: "Dropbox" })}</button>`}
    <h3>Google Drive ${gd.isConnected() ? "✅" : ""}</h3>${gd.isConnected() ? `<div class="btns"><button class="btn small" data-act="sync">🔄 ${t("o.syncNow")}</button><button class="btn small ghost" data-act="gdOff">${t("o.disconnect")}</button></div>`
      : `<button class="btn soft" data-act="gd">${t("o.connect", { p: "Google Drive" })}</button>`}
    <p class="hint">${t("o.cloudPrivacy")}</p></div>
  <div class="card"><h2>🏷️ ${t("o.cats")}</h2><div class="chips">${cats().map(c => `<button class="chip" data-act="editCat" data-id="${c.id}">${c.emoji} ${esc(cname(c))}</button>`).join("")}<button class="chip add" data-act="newCat">＋ ${t("c.new")}</button></div></div>
  <div class="card"><h2>🤖 ${t("o.ai")}</h2><p class="muted">${t("o.aiHint")}</p><button class="btn soft small" data-act="aiKey">${ai.ready() ? "✅ " + t("o.aiOn") : t("o.aiSet")}</button></div>
  <div class="card"><h2>💾 ${t("o.backup")}</h2><div class="btns"><button class="btn soft" data-act="backup">⬇️ ${t("o.export")}</button><button class="btn soft" data-act="restore">⬆️ ${t("o.restore")}</button></div>
    <details><summary>${t("o.danger")}</summary><button class="btn danger" data-act="wipe">${t("o.wipe")}</button></details></div>
  <div class="card"><h2>🐹 Kapibo ${APP_VERSION}</h2><p class="muted">${t("o.about")}</p>
    <div class="btns"><button class="btn small soft" data-act="news">🎉 ${t("o.news")}</button><a class="btn small ghost" href="../mochi-spesa/" rel="noopener">🍡 Mochi Spesa</a><a class="btn small ghost" href="../pdf-tiny-tools/" rel="noopener">🗜️ Schiaccia PDF</a>
    <a class="btn small ghost" href="https://github.com/Marketto/kapibo" rel="noopener">GitHub</a></div></div>`;
}
document.addEventListener("change", async e => {
  if (e.target.id === "oLang") { lsSet("kapibo.lang", e.target.value); await setLang(e.target.value); render(); kapi.say("kapi.hello"); }
  if (e.target.id === "oCur") store.setSettings({ currency: e.target.value });
  if (e.target.id === "oVouch") { const v = num(e.target.value); if (v) store.setSettings({ voucher: v }); }
});

// importazione Excel
$("#fileXls").addEventListener("change", async e => {
  const f = e.target.files[0]; if (!f) return; e.target.value = "";
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
    store.set(merge(S(), { cats: stamp(res.cats), entries: stamp(res.entries), meters: stamp(res.meters), readings: stamp(res.readings), bills: stamp(res.bills), months }));
    const last = Object.keys(res.months).sort().pop(); if (last) cur = last;
    kapi.confetti(40); celebrate("kapi.imported"); go("stats");
  } catch (err) { console.error(err); toast(t("o.impError")); kapi.say("kapi.oops"); }
});

// backup
function exportBackup() {
  const blob = new Blob([JSON.stringify(S())], { type: "application/json" }), a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = `kapibo-${today()}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
$("#fileJson").addEventListener("change", async e => {
  const f = e.target.files[0]; if (!f) return; e.target.value = "";
  try { const data = JSON.parse(await f.text()); store.set(merge(S(), data)); toast(t("o.restored")); celebrate(); } catch { toast(t("o.impError")); }
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
  const r = await dialog(t("o.connect", { p: "Dropbox" }), `<p class="hint">${t("o.dbxHint", { uri: dbx.redirectUri() })}</p><label class="f">App key<input name="k" value="${esc(dbx.appKey())}" required autocomplete="off"></label>
    <label class="f">${t("o.dbxPath")}<input name="p" value="${esc(dbx.path())}" required></label>`, { ok: t("o.connectGo") });
  if (!r) return; dbx.setPath(r.p.startsWith("/") ? r.p : "/" + r.p); dbx.startAuth(r.k.trim());
}
async function gdriveConnect() {
  const r = await dialog(t("o.connect", { p: "Google Drive" }), `<p class="hint">${t("o.gdHint", { origin: location.origin })}</p><label class="f">OAuth Client ID<input name="k" value="${esc(gd.clientId())}" required autocomplete="off"></label>`, { ok: t("o.connectGo") });
  if (!r) return;
  try { await gd.connect(r.k.trim()); toast(t("sync.connected", { p: "Google Drive" })); render(); doSync(true); } catch (e) { toast(t(e.code || "sync.retry")); }
}
async function doSync(manual) {
  const btn = $("#syncBtn"); btn.dataset.state = "busy";
  const res = await sync.syncNow(store), bad = Object.values(res).find(v => v !== "ok");
  btn.dataset.state = !Object.keys(res).length ? "off" : bad ? "err" : "on";
  btn.setAttribute("aria-label", t(bad ? "sync.err" : "sync.ok"));
  if (manual) toast(t(bad || "sync.ok"));
}

// ---------- service worker e aggiornamenti ----------
function registerSW() {
  navigator.serviceWorker.register("sw.js").then(reg => {
    reg.addEventListener("updatefound", () => {
      const nw = reg.installing;
      nw?.addEventListener("statechange", () => { if (nw.state === "installed" && navigator.serviceWorker.controller) toast(t("o.update"), { label: t("o.updateBtn"), run: () => nw.postMessage("skip") }); });
    });
  }).catch(() => {});
  let reloaded = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (!reloaded) { reloaded = true; location.reload(); } });
}

boot();
