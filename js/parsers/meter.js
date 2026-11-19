// Foto del contatore → lettura (il numero più lungo, con decimali opzionali).
export function parseMeter(text) {
  const cand = (String(text).replace(/[oO]/g, "0").replace(/[lI|]/g, "1").match(/\d[\d\s]{2,}(?:[.,]\s?\d{1,3})?/g) || [])
    .map(s => s.replace(/\s/g, "")).map(s => ({ s, v: parseFloat(s.replace(",", ".")) })).filter(x => isFinite(x.v));
  cand.sort((a, b) => b.s.replace(/\D/g, "").length - a.s.replace(/\D/g, "").length);
  return { value: cand.length ? cand[0].v : null, options: cand.slice(0, 4).map(x => x.v) };
}
