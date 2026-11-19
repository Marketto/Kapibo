# Collegare Dropbox e Google Drive

Kapibo non ha server: ogni utente collega il proprio cloud dal browser. Serve una sola configurazione da parte di chi pubblica l'app (o di chi vuole usare le proprie chiavi).

## Dropbox
1. https://www.dropbox.com/developers/apps → *Create app* → *Scoped access* → *App folder* (oppure *Full Dropbox*).
2. Permissions: `files.metadata.read`, `files.content.read`, `files.content.write`.
3. Settings → *Redirect URIs*: `https://marketto.github.io/kapibo/`.
4. Copia la *App key* e incollala in Kapibo › Altro › Collega Dropbox. (La app key non è segreta: PKCE, nessun "secret".)

## Google Drive
1. https://console.cloud.google.com → nuovo progetto → *API e servizi* → abilita **Google Drive API**.
2. *Schermata consenso OAuth*: esterna, aggiungi l'ambito `.../auth/drive.file` e i tuoi account come tester.
3. *Credenziali* → *ID client OAuth* → tipo **Applicazione web** → *Origini JavaScript autorizzate*: `https://marketto.github.io`.
4. Incolla il Client ID in Kapibo › Altro › Collega Google Drive.

`drive.file` dà accesso solo ai file creati da Kapibo (`kapibo.json`), non al resto del Drive.
