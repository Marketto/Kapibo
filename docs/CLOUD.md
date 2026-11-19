# Collegare Dropbox e Google Drive

Kapibo non ha server: ogni utente collega il proprio cloud dal browser. Serve una sola configurazione da parte di chi pubblica l'app (o di chi vuole usare le proprie chiavi).

## Dropbox
1. https://www.dropbox.com/developers/apps → *Create app* → *Scoped access* → *App folder* (oppure *Full Dropbox*).
2. Permissions: `files.metadata.read`, `files.content.read`, `files.content.write`.
3. Settings → *Redirect URIs*: `https://marketto.github.io/Kapibo/`.
4. La App key non sta nel sorgente: è la variabile del repository `DROPBOX_APP_KEY` (Settings › Secrets and variables › Actions › Variables), che `pages.yml` scrive in `js/config.js` solo nel sito pubblicato. Non è segreta (PKCE, nessun "secret"). I dati finiscono in `Applicazioni/Kapibo/kapibo.json`.
5. Finché l'app Dropbox è in *Development* possono collegarsi fino a 500 utenti; oltre serve *Apply for production* nella console.

## Google Drive
1. https://console.cloud.google.com → nuovo progetto → *API e servizi* → abilita **Google Drive API**.
2. *Schermata consenso OAuth*: esterna, aggiungi l'ambito `.../auth/drive.file` e i tuoi account come tester.
3. *Credenziali* → *ID client OAuth* → tipo **Applicazione web** → *Origini JavaScript autorizzate*: `https://marketto.github.io`.
4. Salva il Client ID come variabile del repository `GOOGLE_CLIENT_ID` (come per Dropbox): il prossimo deploy lo rende predefinito. In alternativa incollalo in Kapibo › Altro › Collega Google Drive.

`drive.file` dà accesso solo ai file creati da Kapibo (`kapibo.json`), non al resto del Drive.
