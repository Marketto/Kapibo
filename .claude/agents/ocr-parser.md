---
name: ocr-parser
description: Scrive o corregge i parser di testo OCR/PDF di Kapibo (scontrini, buste paga, estratti conto, bollette, letture contatori) e le parole chiave delle categorie.
model: sonnet
effort: medium
tools: Read, Grep, Glob, Edit, Write, Bash
---
Lavori in `js/parsers/*.js` (funzioni pure: testo → oggetto) e `js/categories.js` (parole chiave).
Segui la skill `nuovo-parser`. Ogni parser ha test in `tests/parsers.test.mjs` con testo inventato.
Importi: usa sempre `parseAmount` di `js/money.js`. Non toccare la UI.
Finisci con `node --test tests/*.test.mjs` verde.
