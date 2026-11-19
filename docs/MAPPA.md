# Mappa del codice (leggi questa prima di aprire i file)

| File | Cosa | Funzioni chiave |
|---|---|---|
| `js/app.js` | UI. Sezioni con commento `// ---------- nome ----------`: avvio, azioni, mese, dialoghi, scansione, consumi, grafici, altro, sync, service worker | `render`, `onAction` (mappa `data-act`), `dialog`, `catChips`, `entryDialog`, `monthDialog`, `startScan`, `review*`, `saveReceipt`, `view*` |
| `js/store.js` | Schema, IndexedDB, merge, calcoli | `createStore` (`put`, `putMany`, `remove`, `setMonth`, `learn`, `cats`), `merge`, `monthSummary`, `monthsWithData` |
| `js/categories.js` | Categorie predefinite e parole chiave | `DEFAULT_CATS`, `guessCats`, `isGrocer`, `norm` |
| `js/money.js` | Importi | `parseAmount`, `findAmounts`, `fmt`, `fmtNum`, `round2` |
| `js/parsers/*.js` | Testo → dati (puri, testati) | `parseReceipt`, `parsePayslip`, `parseStatement`, `parseBill`, `parseMeter`, `util.parseMonth` |
| `js/ocr.js` | Ponte verso Tesseract/pdf.js di pdf-tiny-tools | `recognize`, `prepare`, `pdfText`, `ocrLang` |
| `js/importer.js` | Vecchio foglio → record | `readWorkbook`, `importSheets`, `fillMerges` |
| `js/stats.js` | Serie, medie, consumi, consigli | `series`, `catAverages`, `usage`, `unitPrice`, `tips`, `voucherBalance` |
| `js/charts.js` | SVG | `donut`, `hbars`, `timeline` |
| `js/mascot.js` | Kapi | `KAPI_SVG`, `mount`, `mood`, `say`, `confetti` |
| `js/sync/` | Cloud | `index.syncNow`, `dropbox.*`, `gdrive.*` |
| `js/ai.js` | Lettura avanzata facoltativa | `structureReceipt` |
| `js/i18n.js` | Lingue | `LANGS`, `t`, `setLang`, `monthLabel` |
| `tools/icons/icons.mjs` | Disegni delle icone Kapi (griglia 24, tratto 2) | `ICONS` → `npm run icons` |
| `tools/build-font.mjs` | Icone → font `fonts/kapi-icons.woff2` + `css/icons.css` + `fonts/anteprima.html` | potrace, verso dei contorni (`nonzero`) |
| `css/style.css` | Temi `[data-theme]`: `joy` (Capibara gioioso), `onsen`, `night`, `auto` | variabili `--c-*`, `--pattern` |
| `sw.js` | Offline | cache app (rete prima) + moduli pesanti (cache prima) |

Aggiungere un tipo di documento: skill `nuovo-parser`. Aggiungere testi: skill `traduzioni`.
