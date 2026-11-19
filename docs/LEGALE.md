# Privacy e condizioni: come sono costruite

Testi: `locales/legal/<lingua>.json` (originale: `it.json`). Versione: `POLICY_VERSION` in `js/legal.js`; cambiandola tutti devono riaccettare.
Non è un parere legale: prima di diffondere l'app è consigliata una revisione da parte di un avvocato.

## Informativa privacy (art. 13 GDPR)
Contiene tutti gli elementi dell'elenco dell'art. 13: identità e contatti, finalità e basi giuridiche, destinatari, trasferimenti extra UE e garanzie, conservazione, diritti (artt. 15-22), reclamo all'autorità, obbligatorietà, decisioni automatizzate.
Scelte:
- I dati inseriti restano sul dispositivo: lo sviluppatore non è titolare di quei dati; l'uso domestico rientra nell'art. 2(2)(c) GDPR.
- IndexedDB/localStorage sono strettamente necessari → nessun consenso (art. 122 Codice privacy / art. 5(3) direttiva ePrivacy).
- Fornitori esterni (GitHub Pages registra gli IP per sicurezza, jsDelivr, Dropbox, Google, Anthropic) come titolari autonomi; trasferimenti USA su DPF (decisione 2023/1795) o clausole contrattuali standard "secondo le loro informative" (non affermiamo noi certificazioni che possono cambiare).
- Statistiche future: anonime, facoltative, spente finché l'utente non le accende, da descrivere nell'informativa (nuova `POLICY_VERSION`) prima di attivarle. Preferire strumenti senza cookie e senza dati personali.

## Condizioni d'uso
- Clausola sull'uso lecito e sulla responsabilità dell'utente (dati di terzi solo con diritto o consenso).
- Esclusione di garanzie e limitazione di responsabilità "nei limiti di legge", con salvezza esplicita di dolo e colpa grave (art. 1229 c.c.), danni alla persona e diritti inderogabili del consumatore (artt. 33-36 Codice del consumo): una clausola che pretende di escludere tutto rischia la nullità.
- Foro: per i consumatori resta quello di residenza (art. 66-bis Codice del consumo).

## Accettazione
- Prima casella: lettura e accettazione di informativa e condizioni.
- Seconda casella separata: approvazione specifica delle clausole onerose (artt. 1341-1342 c.c.: 3, 8, 9, 10, 11).
- Si registrano sul dispositivo versione, data, lingua e le due approvazioni.
- Limite noto: secondo la giurisprudenza di Cassazione la sola spunta di una casella può non bastare per l'approvazione specifica delle clausole vessatorie (nei contratti tra imprese è richiesta almeno una firma elettronica). Per un'app gratuita senza account la doppia casella separata è la soluzione più robusta praticabile; la tutela principale resta il fatto che le clausole sono scritte nei limiti di legge.
