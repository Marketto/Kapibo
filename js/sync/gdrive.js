// Google Drive dal browser (Google Identity Services, permesso drive.file: solo i file creati da Kapibo).
// Serve un "Client ID OAuth" di tipo Web con origine https://marketto.github.io (vedi docs/CLOUD.md).
import { CONFIG } from "../config.js";
const LS = "kapibo.gdrive";
const read = () => { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch { return {}; } };
const write = v => { try { localStorage.setItem(LS, JSON.stringify(v)); } catch {} };
const fail = code => Object.assign(new Error(code), { code });
const NAME = "kapibo.json";

export const isConnected = () => !!read().on;
export const clientId = () => read().clientId || CONFIG.googleClientId;
export const disconnect = () => { const d = read(); if (d.token && window.google) google.accounts.oauth2.revoke(d.token, () => {}); write({ clientId: d.clientId }); };

let gis = null;
const loadGis = () => (gis ||= new Promise((res, rej) => document.head.appendChild(Object.assign(document.createElement("script"), { src: "https://accounts.google.com/gsi/client", onload: res, onerror: () => { gis = null; rej(fail("sync.retry")); } }))));

/** Carica in anticipo lo script di Google, così la finestra di accesso si apre subito al tocco. */
export const preload = () => { if (clientId()) loadGis().catch(() => {}); };

/** Chiede il permesso (finestra Google). interactive=false prova senza finestra. */
export async function connect(cid, interactive = true, { sync = true } = {}) {
  await loadGis();
  const d = read();
  return new Promise((res, rej) => {
    const tc = google.accounts.oauth2.initTokenClient({ client_id: cid || d.clientId, scope: "https://www.googleapis.com/auth/drive.file",
      callback: r => { if (r.error) return rej(fail("sync.auth")); write({ ...read(), clientId: cid || d.clientId, ...(sync ? { on: 1 } : {}), token: r.access_token, exp: Date.now() + (r.expires_in - 60) * 1000 }); res(true); },
      error_callback: () => rej(fail("sync.auth")) });
    tc.requestAccessToken({ prompt: interactive ? (d.on || d.token ? "" : "consent") : "none" });
  });
}
async function token() {
  const d = read();
  if (!d.on) throw fail("sync.auth");
  if (d.token && d.exp > Date.now()) return d.token;
  await connect(d.clientId, true);
  return read().token;
}
async function api(url, opt = {}) {
  const r = await fetch(url, { ...opt, headers: { Authorization: "Bearer " + await token(), ...(opt.headers || {}) } });
  if (r.status === 401) { write({ ...read(), token: null }); throw fail("sync.auth"); }
  if (!r.ok) throw fail("sync.retry");
  return r;
}
async function fileId() {
  const d = read(); if (d.fileId) return d.fileId;
  const q = encodeURIComponent(`name='${NAME}' and trashed=false and appProperties has { key='kapibo' and value='1' }`);
  const j = await (await api(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)&spaces=drive`)).json();
  const id = j.files?.[0]?.id || null; if (id) write({ ...read(), fileId: id }); return id;
}
export async function download() {
  const id = await fileId(); if (!id) return null;
  const r = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`, { headers: { Authorization: "Bearer " + await token() } });
  if (r.status === 404) { write({ ...read(), fileId: null }); return null; }
  if (!r.ok) throw fail("sync.retry");
  let data = null; try { data = await r.json(); } catch {}
  return { data };
}
export async function upload(data) {
  const id = await fileId(), body = JSON.stringify(data);
  if (id) { await api(`https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=media`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body }); return; }
  const meta = { name: NAME, mimeType: "application/json", appProperties: { kapibo: "1" } };
  const fd = new FormData(); fd.append("metadata", new Blob([JSON.stringify(meta)], { type: "application/json" })); fd.append("file", new Blob([body], { type: "application/json" }));
  const j = await (await api("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id", { method: "POST", body: fd })).json();
  write({ ...read(), fileId: j.id });
}

// ---------- importazione di un foglio da Drive (Google Picker) ----------
// L'utente sceglie il file nella finestra di Google: drive.file dà accesso solo a quel file.
// Fogli Google vengono esportati in .xlsx; .xlsx/.ods/.csv si scaricano così come sono.
export const canPick = () => !!(clientId() && CONFIG.googleApiKey);
let gapiP = null;
const loadPicker = () => (gapiP ||= new Promise((res, rej) => document.head.appendChild(Object.assign(document.createElement("script"), {
  src: "https://apis.google.com/js/api.js", onload: () => window.gapi.load("picker", { callback: res, onerror: rej }), onerror: () => { gapiP = null; rej(fail("sync.retry")); } }))));
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
export async function pickSpreadsheet(locale = "it") {
  const d = read();
  if (!d.token || !(d.exp > Date.now())) await connect(clientId(), true, { sync: false });
  await loadPicker();
  const tok = read().token, P = window.google.picker;
  const doc = await new Promise(res => {
    const sheets = new P.DocsView(P.ViewId.SPREADSHEETS).setMode(P.DocsViewMode.LIST);
    const files = new P.DocsView(P.ViewId.DOCS).setMimeTypes([XLSX_MIME, "application/vnd.ms-excel", "application/vnd.oasis.opendocument.spreadsheet", "text/csv"].join(",")).setMode(P.DocsViewMode.LIST);
    new P.PickerBuilder().addView(sheets).addView(files).setOAuthToken(tok).setDeveloperKey(CONFIG.googleApiKey)
      .setAppId(clientId().split("-")[0]).setLocale(locale).setCallback(r => { if (r.action === P.Action.PICKED) res(r.docs[0]); else if (r.action === P.Action.CANCEL) res(null); })
      .build().setVisible(true);
  });
  if (!doc) return null;
  const native = doc.mimeType === "application/vnd.google-apps.spreadsheet";
  const url = native ? `https://www.googleapis.com/drive/v3/files/${doc.id}/export?mimeType=${encodeURIComponent(XLSX_MIME)}` : `https://www.googleapis.com/drive/v3/files/${doc.id}?alt=media`;
  const r = await fetch(url, { headers: { Authorization: "Bearer " + tok } });
  if (!r.ok) throw fail("sync.retry");
  return new File([await r.blob()], doc.name + (native ? ".xlsx" : ""), { type: native ? XLSX_MIME : doc.mimeType });
}
