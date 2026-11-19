---
name: ui-kawaii
description: Stile visivo e regole UX/accessibilità di Kapibo (kawaii, mascotte capibara Kapi).
---
- Temi in `css/style.css` con `[data-theme]`: `joy` «Capibara gioioso» (predefinito), `onsen`, `night`, `auto` (segue il sistema). Ogni tema definisce tutte le `--c-*` e `--pattern`.
- Icone: solo font `kapi-icons` (`<i class="ki ki-nome" aria-hidden="true"></i>`, in JS `ic("nome")`). Elenco in `fonts/anteprima.html`. Nuova icona: aggiungila in `tools/icons/icons.mjs` (stesso stile: tratto 2 tondo, motivi capibara/yuzu/zampette) e lancia `npm run icons`. Emoji solo nei testi e nelle categorie create dall'utente.
- Pulsanti con solo icona: sempre `aria-label`.
- Forme tonde (raggio 20–28 px), ombre morbide, colori pastello; testo sempre ≥ 4.5:1.
- Animazioni: classi `.pop`, `.wiggle`, `.float`, `.confetti`; durata ≤ 600 ms per feedback. `@media (prefers-reduced-motion: reduce)` le spegne.
- Kapi (`js/mascot.js`): `kapi.say(chiave)`, `kapi.mood("happy"|"think"|"sleep"|"wow")`. SVG unico, nessuna immagine esterna.
- Dialoghi: `<dialog>` con titolo `aria-labelledby`, chiusura con Esc, focus al primo campo.
- Liste lunghe: niente animazioni per elemento oltre 30 elementi.
