// Installazione come app: prompt nativo dove esiste (Android, Chrome, Edge), istruzioni su iPhone/iPad.
let deferred = null;
const subs = new Set();
addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferred = e; subs.forEach(f => f()); });
addEventListener("appinstalled", () => { deferred = null; try { localStorage.setItem("kapibo.installed", "1"); } catch {} subs.forEach(f => f()); });
export const onChange = f => subs.add(f);
export const installed = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true || (() => { try { return localStorage.getItem("kapibo.installed") === "1"; } catch { return false; } })();
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
/** "prompt" = pulsante nativo, "ios" = istruzioni, null = non serve o non supportato. */
export const isAndroid = () => /android/i.test(navigator.userAgent);
/** "prompt" = pulsante nativo, "ios"/"android" = istruzioni (Android: senza prompt, per esempio dentro un'altra app), null = non serve. */
export const mode = () => (installed() ? null : deferred ? "prompt" : isIOS() ? "ios" : isAndroid() ? "android" : null);
export async function install() {
  if (!deferred) return false;
  deferred.prompt(); const r = await deferred.userChoice; deferred = null; subs.forEach(f => f());
  return r.outcome === "accepted";
}
