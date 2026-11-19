---
name: rilascio
description: Passi per pubblicare una nuova versione di Kapibo su GitHub Pages.
---
1. Aggiorna `APP_VERSION` e `CHANGELOG` in `js/version.js` (semver).
2. Agente `collaudatore` → tutto verde.
3. Commit su `main` e push: `.github/workflows/pages.yml` testa, controlla la privacy e pubblica.
4. Il service worker usa `APP_VERSION` come nome della cache: gli utenti ricevono l'avviso "Nuova versione".
