// Adesivi (obiettivi). Puri: ricevono lo stato e dicono quali sono meritati. L'UI sta in app.js.
import { live, monthSummary, monthsWithData } from "./store.js";
import { streakOf } from "./cheer.js";

/** id, icona (font kapi-icons), chiavi: st.k.<id> nome, st.kd.<id> come ottenerlo. */
export const STICKERS = [
  ["first", "star"], ["receipt", "receipt"], ["scan5", "scan"], ["payslip", "payslip"], ["meter", "meter"], ["bill", "bill"], ["import", "sheet"],
  ["streak3", "heart"], ["streak7", "yuzu"], ["save", "piggy"], ["entries100", "capy"], ["allcats", "palette"], ["theme", "sparkle"], ["sync", "cloud"],
].map(([id, icon]) => ({ id, icon }));

/** Adesivi che lo stato già merita (gli eventi `payslip`, `import`, `theme`, `sync` si segnano a parte con unlock). */
export function earned(s, todayStr) {
  const es = live(s.entries), out = new Set();
  if (es.length) out.add("first");
  if (es.some(e => e.src === "receipt")) out.add("receipt");
  if ((s.settings.scans || 0) >= 5) out.add("scan5");
  if (live(s.readings).length) out.add("meter");
  if (live(s.bills).length) out.add("bill");
  if (es.length >= 100) out.add("entries100");
  if (new Set(es.map(e => e.cat)).size >= 10) out.add("allcats");
  const st = streakOf(es.map(e => e.d), todayStr);
  if (st >= 3) out.add("streak3"); if (st >= 7) out.add("streak7");
  if (monthsWithData(s).some(m => (monthSummary(s, m).savings ?? 0) > 0)) out.add("save");
  return out;
}
