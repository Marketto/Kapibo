// Facoltativo: con una chiave API Claude personale, il testo OCR (mai la foto) viene riordinato da un modello
// piccolo ed economico. La chiave resta solo su questo dispositivo. Senza chiave l'app usa i parser locali.
const LS = "kapibo.ai";
const MODEL = "claude-haiku-5-5"; // il più economico: basta per riordinare righe di testo
export const getKey = () => { try { return localStorage.getItem(LS) || ""; } catch { return ""; } };
export const setKey = k => { try { k ? localStorage.setItem(LS, k.trim()) : localStorage.removeItem(LS); } catch {} };
export const ready = () => !!getKey();

/** Testo dello scontrino → {items:[{name, amount, cats}], total, date, store} */
export async function structureReceipt(text, catIds, lang) {
  const sys = `Extract receipt line items. Reply ONLY with JSON: {"store":str|null,"date":"YYYY-MM-DD"|null,"total":num|null,"vouchers":num,"items":[{"name":str,"amount":num,"cats":[id]}]}. amount = final price after discounts on that line. Skip totals, VAT, payments. cats from: ${catIds.join(",")}. Names short, in ${lang}.`;
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": getKey(), "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
    body: JSON.stringify({ model: MODEL, max_tokens: 1500, system: sys, messages: [{ role: "user", content: text.slice(0, 6000) }] }),
  });
  if (!r.ok) throw Object.assign(new Error("ai"), { code: r.status === 401 ? "ai.key" : "ai.fail" });
  const j = await r.json(), txt = j.content?.map(c => c.text || "").join("") || "";
  const m = txt.match(/\{[\s\S]*\}/); if (!m) throw Object.assign(new Error("ai"), { code: "ai.fail" });
  const o = JSON.parse(m[0]);
  o.items = (o.items || []).filter(i => i && i.name && typeof i.amount === "number").map(i => ({ name: String(i.name).slice(0, 60), amount: Math.round(i.amount * 100) / 100, cats: (i.cats || []).filter(c => catIds.includes(c)) }));
  return o;
}
