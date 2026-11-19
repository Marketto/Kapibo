// Privacy e condizioni d'uso: da accettare al primo avvio e a ogni nuova versione del testo (POLICY_VERSION).
// Testi completi in locales/legal/<lingua>.json (riserva: inglese). Il consenso resta su questo dispositivo.
import { t, lang } from "./i18n.js";

export const POLICY_VERSION = "2026-11-19";
const LS = "kapibo.legal";
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const cache = {};
async function texts() {
  const l = lang(), get = c => (cache[c] ||= fetch(new URL(`../locales/legal/${c}.json`, import.meta.url)).then(r => (r.ok ? r.json() : null)).catch(() => null));
  return (await get(l)) || (await get("en"));
}
export const accepted = () => { try { return JSON.parse(localStorage.getItem(LS))?.v === POLICY_VERSION; } catch { return false; } };
const body = (L, part) => L[part].map(([k, s]) => (k === "h" ? `<h3>${esc(s)}</h3>` : `<p>${esc(s)}</p>`)).join("");

function sheet(id) {
  let d = document.getElementById(id);
  if (!d) { d = document.createElement("dialog"); d.id = id; d.className = "legal"; d.setAttribute("aria-labelledby", id + "T"); document.body.appendChild(d); }
  return d;
}

/** Mostra le condizioni da accettare; risolve quando l'utente accetta (non si chiude in altro modo). */
export async function gate(kapiSvg) {
  if (accepted()) return;
  const L = await texts(), d = sheet("gate");
  d.innerHTML = `<form method="dialog" class="gate">
    <div class="gate-kapi" aria-hidden="true">${kapiSvg}</div>
    <h2 id="gateT">${esc(t("gate.title"))}</h2><p>${esc(t("gate.intro"))}</p>
    <ul class="gate-sum">${L.summary.map(s => `<li>${esc(s)}</li>`).join("")}</ul>
    <details><summary>${esc(t("legal.privacy"))}</summary><div class="legal-body">${body(L, "privacy")}</div></details>
    <details><summary>${esc(t("legal.terms"))}</summary><div class="legal-body">${body(L, "terms")}</div></details>
    <p class="hint">${esc(L.updated)}</p>
    <label class="gate-ok"><input type="checkbox" id="gateChk" required> <span>${esc(t("gate.accept"))}</span></label>
    <button class="btn" id="gateGo" disabled>${esc(t("gate.go"))}</button></form>`;
  const chk = d.querySelector("#gateChk"), go = d.querySelector("#gateGo");
  chk.onchange = () => (go.disabled = !chk.checked);
  d.addEventListener("cancel", e => e.preventDefault()); // Esc non chiude: serve il consenso
  d.showModal();
  await new Promise(res => { d.querySelector("form").onsubmit = e => { if (!chk.checked) { e.preventDefault(); return; } res(); }; });
  try { localStorage.setItem(LS, JSON.stringify({ v: POLICY_VERSION, at: new Date().toISOString() })); } catch {}
  d.close();
}

/** Apre il testo completo (da Altro). */
export async function show() {
  const L = await texts(), d = sheet("legalView");
  d.innerHTML = `<form method="dialog"><div class="dlg-head"><h2 id="legalViewT">${esc(L.title)}</h2><button class="icon-btn" aria-label="${esc(t("ui.close"))}"><i class="ki ki-close" aria-hidden="true"></i></button></div>
    <h3>${esc(t("legal.privacy"))}</h3><div class="legal-body">${body(L, "privacy")}</div><h3>${esc(t("legal.terms"))}</h3><div class="legal-body">${body(L, "terms")}</div>
    <p class="hint">${esc(L.updated)}</p><div class="btns"><button class="btn">${esc(t("ui.close"))}</button></div></form>`;
  d.showModal();
}
