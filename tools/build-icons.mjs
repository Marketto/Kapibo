// Genera icons/icon.svg e i PNG (192, 512, maskable) dal disegno di Kapi in js/mascot.js.
// Uso: node tools/build-icons.mjs  (richiede sharp: npm i -g sharp)
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
let sharp; try { sharp = require("sharp"); } catch { sharp = require(process.env.SHARP_PATH || "/opt/npm-tools/node_modules/sharp"); }
const src = fs.readFileSync(new URL("../js/mascot.js", import.meta.url), "utf8");
let k = src.match(/KAPI_SVG = `([\s\S]*?)`;/)[1];
k = k.replace(/<g class="k-closed"[\s\S]*?<\/g>/, "").replace(/<g class="k-fx">[\s\S]*?<\/g>/, "").replace(/<ellipse class="k-shadow"[^>]*\/>/, "")
  .replace(/class="k-blush"/g, 'fill="#ff9fb1" opacity=".7"').replace(/<svg class="kapi"[^>]*>/, "").replace(/<\/svg>\s*$/, "");
const icon = (pad, round) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe3c9"/><stop offset="1" stop-color="#ffc79e"/></linearGradient></defs>
<rect width="512" height="512" rx="${round}" fill="url(#bg)"/><circle cx="420" cy="96" r="22" fill="#fff" opacity=".55"/><circle cx="88" cy="410" r="14" fill="#fff" opacity=".45"/>
<svg x="${pad}" y="${pad - 8}" width="${512 - 2 * pad}" height="${512 - 2 * pad}" viewBox="0 0 200 200">${k}</svg></svg>`;
fs.writeFileSync(new URL("../icons/icon.svg", import.meta.url), icon(40, 112));
const out = (name, svg, size) => sharp(Buffer.from(svg)).resize(size, size).png().toFile(new URL("../icons/" + name, import.meta.url).pathname);
await out("icon-192.png", icon(40, 112), 192);
await out("icon-512.png", icon(40, 112), 512);
await out("icon-maskable.png", icon(96, 0), 512);
console.log("icone ok");
