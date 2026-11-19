---
name: ui-kawaii
description: Stile visivo e regole UX/accessibilità di Kapibo (kawaii, mascotte capibara Kapi).
---
- Palette in `:root` di `css/style.css` (variabili `--c-*`); tema scuro con `prefers-color-scheme`.
- Forme tonde (raggio 20–28 px), ombre morbide, colori pastello; testo sempre ≥ 4.5:1.
- Animazioni: classi `.pop`, `.wiggle`, `.float`, `.confetti`; durata ≤ 600 ms per feedback. `@media (prefers-reduced-motion: reduce)` le spegne.
- Kapi (`js/mascot.js`): `kapi.say(chiave)`, `kapi.mood("happy"|"think"|"sleep"|"wow")`. SVG unico, nessuna immagine esterna.
- Dialoghi: `<dialog>` con titolo `aria-labelledby`, chiusura con Esc, focus al primo campo.
- Liste lunghe: niente animazioni per elemento oltre 30 elementi.
