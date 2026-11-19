---
name: rilascio
description: Passi per pubblicare una nuova versione di Kapibo su GitHub Pages.
---
1. Aggiorna `APP_VERSION` e `CHANGELOG` in `js/version.js` (semver).
2. Passi del tour per le funzioni nuove in `js/tour.js` (`v` = nuova versione) con testi `tour.<id>.t/p`; nessun passo = nessun wizard, solo l'avviso «aggiornata».
3. Agente `collaudatore` → tutto verde.
4. Commit su `main` e push: `.github/workflows/pages.yml` testa, controlla la privacy e pubblica.
5. Il service worker usa `APP_VERSION` come nome della cache: l'app si aggiorna da sola e si ricarica appena l'utente è inattivo.
