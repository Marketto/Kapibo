---
name: nuovo-parser
description: Come aggiungere o migliorare un parser di documenti (scontrino, busta paga, estratto conto, bolletta, contatore) in Kapibo.
---
1. Un parser è una funzione pura in `js/parsers/<tipo>.js`: `parse<Tipo>(text, {lang}) → {...}`. Niente DOM.
2. Righe: `lines(text)` di `js/parsers/util.js` (pulisce spazi, unisce importi spezzati).
3. Importi: `parseAmount` / `findAmounts` di `js/money.js` (gestisce 1.234,56 · 1,234.56 · −, €).
4. Parole chiave multilingua in costanti in testa al file (minuscole, senza accenti: usa `norm()`).
5. Categorie: `guessCats(nome)` di `js/categories.js`; le correzioni dell'utente diventano regole (`store.learn`).
6. Test: aggiungi un caso in `tests/parsers.test.mjs` con testo **inventato** (mai scontrini reali).
7. Registra il tipo in `js/scan.js` (`KINDS`) se nuovo.
