// Grafici SVG leggeri e accessibili (role="img" + descrizione; i dati sono anche in tabella nella pagina).
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/** Ciambella. slices: [{label, value, color}] */
export function donut(slices, { label = "", center = "" } = {}) {
  const tot = slices.reduce((a, s) => a + Math.max(0, s.value), 0) || 1, R = 70, r = 44;
  let a0 = -Math.PI / 2, paths = "";
  for (const s of slices) {
    const a1 = a0 + (Math.max(0, s.value) / tot) * Math.PI * 2, big = a1 - a0 > Math.PI ? 1 : 0;
    const p = (rad, a) => [100 + rad * Math.cos(a), 100 + rad * Math.sin(a)].map(n => n.toFixed(2)).join(" ");
    if (a1 - a0 >= Math.PI * 2 - 1e-6) paths += `<circle cx="100" cy="100" r="${(R + r) / 2}" fill="none" stroke="${s.color}" stroke-width="${R - r}"/>`;
    else paths += `<path class="seg" d="M${p(R, a0)}A${R} ${R} 0 ${big} 1 ${p(R, a1)}L${p(r, a1)}A${r} ${r} 0 ${big} 0 ${p(r, a0)}Z" fill="${s.color}"><title>${esc(s.label)}</title></path>`;
    a0 = a1;
  }
  return `<svg class="chart donut" viewBox="0 0 200 200" role="img" aria-label="${esc(label)}">${paths}<text x="100" y="106" text-anchor="middle" class="c-center">${esc(center)}</text></svg>`;
}

/** Barre orizzontali. rows: [{label, value, color, note}] */
export function hbars(rows, fmt) {
  const max = Math.max(1, ...rows.map(r => r.value));
  return `<ul class="hbars">${rows.map(r => `<li><span class="hb-l">${esc(r.label)}</span><span class="hb-t"><span class="hb-b" style="--w:${(r.value / max) * 100}%;--c:${r.color}"></span></span><span class="hb-v">${esc(fmt(r.value))}${r.note ? ` <small>${esc(r.note)}</small>` : ""}</span></li>`).join("")}</ul>`;
}

/** Linee/colonne nel tempo. series: [{name, color, values, type:"bar"|"line"}], labels: [] */
export function timeline(series, labels, { label = "", fmt = v => v } = {}) {
  const W = 340, H = 180, P = { l: 8, r: 8, t: 12, b: 26 }, n = labels.length || 1;
  const all = series.flatMap(s => s.values.filter(v => v != null));
  const max = Math.max(1, ...all), min = Math.min(0, ...all), span = max - min || 1;
  const x = i => P.l + ((i + 0.5) * (W - P.l - P.r)) / n, y = v => P.t + ((max - v) * (H - P.t - P.b)) / span;
  const bw = ((W - P.l - P.r) / n) * 0.62 / Math.max(1, series.filter(s => s.type === "bar").length);
  let out = `<line x1="${P.l}" x2="${W - P.r}" y1="${y(0)}" y2="${y(0)}" class="c-axis"/>`, bi = 0;
  for (const s of series) {
    if (s.type === "bar") {
      out += s.values.map((v, i) => v == null ? "" : `<rect class="c-bar" x="${x(i) - bw * (series.filter(z => z.type === "bar").length / 2) + bw * bi}" y="${Math.min(y(v), y(0))}" width="${bw - 1}" height="${Math.abs(y(v) - y(0))}" rx="3" fill="${s.color}"><title>${esc(labels[i])}: ${esc(fmt(v))}</title></rect>`).join("");
      bi++;
    } else {
      const pts = s.values.map((v, i) => (v == null ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`)).filter(Boolean);
      out += `<polyline class="c-line" points="${pts.join(" ")}" fill="none" stroke="${s.color}"/>` + s.values.map((v, i) => v == null ? "" : `<circle cx="${x(i)}" cy="${y(v)}" r="3.5" fill="${s.color}"><title>${esc(labels[i])}: ${esc(fmt(v))}</title></circle>`).join("");
    }
  }
  const step = Math.ceil(n / 6);
  out += labels.map((l, i) => (i % step ? "" : `<text x="${x(i)}" y="${H - 8}" text-anchor="middle" class="c-lbl">${esc(l)}</text>`)).join("");
  return `<svg class="chart tl" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">${out}</svg>`;
}
