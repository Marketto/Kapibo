# Kapibo — guida per agenti (router)

PWA statica (nessuna build, nessun framework) per i conti di casa. Pubblicata su GitHub Pages da `main`.
Lingua di lavoro: italiano. Tono conciso.

## Regola d'oro sui token
1. Non leggere file interi: parti da `docs/MAPPA.md` (file → funzioni), poi `grep -n` e leggi solo le righe utili.
2. Non leggere mai `vendor/`, `locales/*.json` diversi da `it.json`/`en.json`, `icons/`.
3. Delega il lavoro al sotto-agente giusto (tabella sotto): costa meno e usa il modello adatto.

## Router: chi fa cosa
| Richiesta | Agente (`.claude/agents/`) | Modello / effort |
|---|---|---|
| Decisioni di architettura, schema dati, sync, sicurezza | `architetto` | opus / high |
| Nuovo parser o fix OCR (scontrini, buste paga, estratti, bollette, contatori) | `ocr-parser` | sonnet / medium |
| UI, CSS, animazioni, mascotte Kapi, accessibilità | `ui-kawaii` | sonnet / medium |
| Testi nuovi o modificati → tutte le lingue | `traduttore` | sonnet / low |
| Lanciare test, controllare errori, verificare dati sensibili | `collaudatore` | haiku / low |
| Ricerca rapida "dove sta X" | `Explore` integrato | haiku |

Skill (`.claude/skills/`): `nuovo-parser`, `traduzioni`, `ui-kawaii`, `rilascio`. Comandi: `/funzione`, `/traduci`, `/verifica`.

## Regole fisse
- **Nessun dato personale nel repo**: niente importi reali, nomi, indirizzi, IBAN, chiavi. Solo il nickname GitHub `Marketto` e l'email dell'autore nei commit. Esempi e test usano dati inventati.
- Ogni testo visibile passa da `t("chiave")`; nuove chiavi in `locales/it.json` e `locales/en.json`, poi `traduttore`.
- Accessibilità: contrasto AA, target ≥ 44 px, `aria-*` corretti, `prefers-reduced-motion` rispettato, RTL per `ar`.
- Motore OCR/PDF e scansione: quelli di Schiaccia PDF sullo stesso dominio, senza copie. `/pdf-tiny-tools/scansione.js` (`window.Scansione`: `pagina` per bordi/prospettiva/pieghe/ombre/orientamento, `parole` per la lettura a fasce raddrizzate, `perOcr`, `ocrRecWorker` = un solo motore Tesseract) e `/pdf-tiny-tools/vendor/`; riserva CDN e preparazione propria solo se mancano. Ciò che serve a più app va in Schiaccia (`scansione.js`), qui resta solo la logica degli scontrini (`js/parsers/receipt.js`: `layoutText`, `orderText`, `mergeReceipts`). Vedi `js/ocr.js`.
- Test: `node --test tests/*.test.mjs` deve passare prima di ogni commit.
- Versione: `js/version.js` (semver) + voce in `CHANGELOG` (chiave `news.<versione>`).
- Ogni funzione nuova e visibile ha un passo in `js/tour.js` (`STEPS`) con `v` = nuova versione: gli utenti aggiornati vedono solo quei passi.
- Cambio di privacy/condizioni: aggiorna `locales/legal/*.json` e `POLICY_VERSION` in `js/legal.js` (tutti dovranno riaccettare).
- Kapi commenta le azioni con `cheer(evento)` di `js/cheer.js`: frasi in `kapi.ev.<evento>` (più varianti separate da `|`), tono incoraggiante, mai giudicante.
