# 🐹🍊 Kapibo

**I conti di casa con Kapi, la capibara con lo yuzu in testa.** PWA installabile, gratuita, senza server.

👉 **https://marketto.github.io/Kapibo/**

- 📸 **Scansiona** scontrini, buste paga, estratti conto, bollette e contatori: Kapi legge il documento (OCR sul telefono), riconosce le voci e le divide per categoria. Tu escludi righe o cambi/aggiungi categorie (una voce può averne più di una: l'importo si divide).
- ✍️ **Inserimento manuale** sempre possibile, con aggiunta veloce per categoria.
- 🎫 **Buoni pasto** entrati e usati, **stipendio**, **entrate extra**, **rimborsi**, **saldo iniziale e finale**: Kapibo calcola risparmio e "spese non segnate".
- 💡 **Consumi**: letture di luce (anche fasce), gas, acqua, cantina; bollette mensili, bimestrali, annuali; prezzo medio pagato e **confronto offerte**.
- 📊 **Grafici e consigli** su dove risparmiare.
- 📥 **Importa il vecchio foglio** (Excel/ODS/CSV, anche da Google Fogli → File › Scarica › xlsx): mesi, categorie, entrate, letture e bollette su intestazioni a più righe.
- ☁️ **Dropbox e/o Google Drive** per sincronizzare tra dispositivi (unione per record, vince la modifica più recente).
- 🌍 **42 lingue**: tutte le europee + russo, cinese, giapponese, coreano, arabo (RTL).
- 🐹 **Kapi ti incoraggia**: commenta ogni azione con frasi motivazionali, saluta in base all'ora, festeggia serie e traguardi; **adesivi** da collezionare e **barattolo dello yuzu** che si riempie col risparmio.
- 📲 **Installabile** (Android, desktop, iPhone/iPad), **si aggiorna da sola** e mostra un **tour**: tutto al primo avvio, solo le novità dopo un aggiornamento.
- 📜 **Privacy e condizioni** da accettare al primo avvio (in tutte le lingue).
- 🎨 **Set di icone capibara in formato font** (`kapi-icons`, 76 icone) e **temi**: Capibara gioioso, Onsen, Notte di capibara, automatico.
- ♿ Accessibile (contrasto AA, tastiera, lettori di schermo, `prefers-reduced-motion`), tema scuro automatico.

## Motore di lettura
OCR (Tesseract) e PDF (pdf.js) sono quelli di [Schiaccia PDF](https://github.com/Marketto/pdf-tiny-tools), pubblicati sullo stesso dominio: Kapibo li usa direttamente da `/pdf-tiny-tools/vendor/` (scaricati una volta, poi offline), con riserva CDN. Pulizia della foto e raddrizzamento vengono dalla sua sezione «scansione».
Facoltativo: con una propria chiave API Claude il testo (mai la foto) viene riordinato da un modello piccolo ed economico.

## Sviluppo
Nessuna build. Servire la cartella superiore che contiene `kapibo/` e `pdf-tiny-tools/` (come su GitHub Pages):
```sh
node --test tests/*.test.mjs   # parser, import, merge
node tools/i18n-check.mjs      # traduzioni
node tools/privacy-check.mjs   # niente dati personali nel repo
npm i && npm run icons         # font di icone + icone dell'app
```
Documentazione: `docs/MAPPA.md` (dove sta cosa), `docs/DATI.md` (formato), `docs/CLOUD.md` (Dropbox/Drive), `CLAUDE.md` (router per gli agenti).

## Privacy
Nessun server, nessun tracciamento, caratteri ospitati sul sito (niente Google Fonts). Dati in IndexedDB sul dispositivo e, se vuoi, nel tuo cloud. Testi completi: `locales/legal/`.

Licenza MIT · [Marketto](https://github.com/Marketto)
