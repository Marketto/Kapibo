// Dropbox dal browser (OAuth PKCE, nessun server). Token solo su questo dispositivo.
// Ripreso da Mochi Spesa, con la correzione della variabile `t` che nascondeva la funzione di traduzione.
const LS = "kapibo.dropbox";
const read = () => { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch { return {}; } };
const write = v => { try { localStorage.setItem(LS, JSON.stringify(v)); } catch {} };
const fail = code => Object.assign(new Error(code), { code });

export const redirectUri = () => location.origin + location.pathname;
export const isConnected = () => !!read().refresh_token;
export const path = () => read().path || "/Kapibo/kapibo.json";
export const setPath = p => write({ ...read(), path: p });
export const disconnect = () => { const d = read(); write({ path: d.path, appKey: d.appKey }); };
export const appKey = () => read().appKey || "";

const b64url = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export async function startAuth(key) {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(48)));
  const challenge = b64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
  const state = b64url(crypto.getRandomValues(new Uint8Array(16)));
  sessionStorage.setItem("kapibo.pkce", JSON.stringify({ verifier, state, key }));
  const u = new URL("https://www.dropbox.com/oauth2/authorize");
  Object.entries({ client_id: key, response_type: "code", code_challenge: challenge, code_challenge_method: "S256", token_access_type: "offline", redirect_uri: redirectUri(), state,
    scope: "files.metadata.read files.content.read files.content.write" }).forEach(([k, v]) => u.searchParams.set(k, v));
  location.assign(u.toString());
}

/** Completa l'accesso se l'URL contiene ?code=… Restituisce true se ha collegato. */
export async function handleRedirect() {
  const p = new URLSearchParams(location.search), code = p.get("code"), state = p.get("state");
  if (!code && !p.get("error")) return false;
  history.replaceState(null, "", redirectUri() + location.hash);
  if (!code) throw fail("dbx.cancelled");
  let saved; try { saved = JSON.parse(sessionStorage.getItem("kapibo.pkce")); } catch {}
  sessionStorage.removeItem("kapibo.pkce");
  if (!saved || saved.state !== state) throw fail("dbx.invalid");
  const r = await fetch("https://api.dropboxapi.com/oauth2/token", { method: "POST",
    body: new URLSearchParams({ code, grant_type: "authorization_code", code_verifier: saved.verifier, client_id: saved.key, redirect_uri: redirectUri() }) });
  if (!r.ok) throw fail("dbx.rejected");
  const tok = await r.json();
  write({ ...read(), appKey: saved.key, refresh_token: tok.refresh_token, access_token: tok.access_token, exp: Date.now() + (tok.expires_in - 60) * 1000 });
  return true;
}

async function token() {
  const d = read();
  if (!d.refresh_token) throw fail("sync.auth");
  if (d.access_token && d.exp > Date.now()) return d.access_token;
  const r = await fetch("https://api.dropboxapi.com/oauth2/token", { method: "POST", body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: d.refresh_token, client_id: d.appKey }) });
  if (r.status === 400 || r.status === 401) { disconnect(); throw fail("sync.auth"); }
  if (!r.ok) throw fail("sync.retry");
  const tok = await r.json();
  write({ ...d, access_token: tok.access_token, exp: Date.now() + (tok.expires_in - 60) * 1000 });
  return tok.access_token;
}
const apiArg = o => JSON.stringify(o).replace(/[\u007f-￿]/g, c => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));

export async function download() {
  const r = await fetch("https://content.dropboxapi.com/2/files/download", { method: "POST", headers: { Authorization: "Bearer " + await token(), "Dropbox-API-Arg": apiArg({ path: path() }) } });
  if (r.status === 409) return null;
  if (r.status === 401) { disconnect(); throw fail("sync.auth"); }
  if (!r.ok) throw fail("sync.retry");
  const meta = JSON.parse(r.headers.get("Dropbox-API-Result") || "{}");
  let data = null; try { data = JSON.parse(await r.text()); } catch {}
  return { data, rev: meta.rev };
}
export async function upload(data, rev) {
  const r = await fetch("https://content.dropboxapi.com/2/files/upload", { method: "POST",
    headers: { Authorization: "Bearer " + await token(), "Content-Type": "application/octet-stream",
      "Dropbox-API-Arg": apiArg({ path: path(), mode: rev ? { ".tag": "update", update: rev } : "add", autorename: false, mute: true }) },
    body: JSON.stringify(data) });
  if (r.status === 409) throw fail("conflict");
  if (!r.ok) throw fail("sync.retry");
  return (await r.json()).rev;
}
/** Carica un file qualsiasi (es. foto dello scontrino) nella cartella dell'app. */
export async function uploadFile(name, blob) {
  const dir = path().replace(/\/[^/]*$/, "");
  const r = await fetch("https://content.dropboxapi.com/2/files/upload", { method: "POST",
    headers: { Authorization: "Bearer " + await token(), "Content-Type": "application/octet-stream", "Dropbox-API-Arg": apiArg({ path: `${dir}/documenti/${name}`, mode: "add", autorename: true, mute: true }) }, body: blob });
  if (!r.ok) throw fail("sync.retry");
}
