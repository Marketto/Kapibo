---
name: traduzioni
description: Regole per testi e lingue di Kapibo (42 lingue, RTL arabo).
---
- File piatti `locales/<codice>.json`; riserva: `en`. Elenco lingue in `js/i18n.js` (`LANGS`).
- `node tools/i18n-check.mjs` → chiavi mancanti o in più per lingua; `--json <lang>` stampa le mancanti con il testo inglese.
- Scrivi le traduzioni con `node tools/i18n-merge.mjs <lang> <file.json>` (unisce senza riscrivere il resto).
- Mantieni `{x}`, emoji, `|` (liste di frasi della mascotte). Max ~1,3× la lunghezza inglese.
- Nomi categoria (`cat.*`): termini comuni di casa, non letterali.
