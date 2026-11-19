// Sincronizzazione: scarica, unisce (vince la modifica più recente per record), ricarica se serve.
import * as dbx from "./dropbox.js";
import * as gd from "./gdrive.js";
import { merge, sig } from "../store.js";

export const providers = { dropbox: dbx, gdrive: gd };
export const connected = () => Object.entries(providers).filter(([, p]) => p.isConnected()).map(([k]) => k);

let busy = null;
export function syncNow(store) {
  if (busy) return busy;
  busy = (async () => {
    const res = {};
    for (const name of connected()) {
      const p = providers[name];
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const remote = await p.download();
          const local = store.get(), merged = remote?.data ? merge(local, remote.data) : local;
          if (sig(merged) !== sig(local)) store.set(merged);
          if (!remote?.data || sig(merged) !== sig(remote.data)) await p.upload(merged, remote?.rev);
          res[name] = "ok"; break;
        } catch (e) { if (e.code === "conflict" && attempt < 2) continue; res[name] = e.code || "sync.retry"; break; }
      }
    }
    return res;
  })().finally(() => { busy = null; });
  return busy;
}
