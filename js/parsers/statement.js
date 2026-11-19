// Estratto conto → movimenti con data, descrizione, importo (uscite negative), stipendio riconosciuto.
import { findAmounts } from "../money.js";
import { lines, findDate, hasAny } from "./util.js";

const SALARY = ["stipendio", "emolumenti", "competenze", "salary", "payroll", "gehalt", "salaire", "nomina", "salario", "retribuzione"];
const OUT_HINT = ["pagamento", "addebito", "prelievo", "bonifico a", "pos", "carta", "sdd", "rid", "commissione", "acquisto", "payment", "card", "withdrawal", "lastschrift", "achat", "compra"];
const IN_HINT = ["accredito", "bonifico da", "bonifico a vostro favore", "rimborso", "giroconto", "credit", "refund", "gutschrift", "virement recu"];
const SKIP = ["saldo iniziale", "saldo finale", "saldo contabile", "saldo disponibile", "opening balance", "closing balance", "totale"];

export function parseStatement(text) {
  const L = lines(text), rows = [];
  for (let i = 0; i < L.length; i++) {
    const l = L[i], d = findDate(l); if (!d) continue;
    if (hasAny(l, SKIP)) continue;
    let am = findAmounts(l), desc = l;
    // descrizione su più righe: unisci la riga dopo se non ha data
    if (L[i + 1] && !findDate(L[i + 1]) && !findAmounts(L[i + 1]).length) { desc += " " + L[i + 1]; }
    if (!am.length) { const nx = L[i + 1] && findAmounts(L[i + 1]); if (nx && nx.length) am = nx; else continue; }
    // con colonne dare/avere ci possono essere due importi (movimento + saldo): il primo è il movimento
    let amt = am[0];
    desc = desc.replace(/\b\d{1,4}[-/.]\d{1,2}[-/.]\d{2,4}\b/g, "").replace(/-?\d{1,3}(?:[.\s]\d{3})*[.,]\d{2}-?/g, "").replace(/\s+/g, " ").trim();
    if (amt > 0 && hasAny(desc, OUT_HINT) && !hasAny(desc, IN_HINT)) amt = -amt;
    rows.push({ date: d, desc: desc.slice(0, 80), amount: amt, salary: amt > 0 && hasAny(desc, SALARY) });
  }
  return { rows };
}
