# Formato dei dati (schema 1)

Un unico JSON (`kapibo.json` nel cloud, chiave `state` in IndexedDB).

```
settings { currency, voucher, u }
months   { "AAAA-MM": { start, end, salary, extra, refunds, vIn, vUsed, u } }   // importi; vIn/vUsed = buoni in valuta
entries  [{ id, d:"AAAA-MM-GG", m:"AAAA-MM", amt, cat, note, src, items?:[{n,a}], doc?, u, del? }]
cats     [{ id, name?, emoji, color, kind:"var"|"fix", hidden?, u }]           // personalizzazioni + categorie nuove
meters   [{ id, name, kind:"elec"|"gas"|"water"|"other", unit, u }]
readings [{ id, meter, d, m, value, u }]
bills    [{ id, kind, name?, m, amount, cons, unit, freq:"m"|"2m"|"q"|"6m"|"y", from?, to?, entry?, u }]
offers   [{ id, kind, name, unitPrice, fixedYear, u }]
rules    { "nome normalizzato": { cats:[id], u } }                               // categorie imparate
```
- `src`: `manual` · `receipt` · `statement` · `bill` · `import`.
- Merge: per ogni record vince `u` più alto; cancellazione = `del: 1` (tombstone).
- Calcoli del mese (`monthSummary`): spesa reale = saldo iniziale + entrate − saldo finale; non segnate = reale + buoni usati − segnate. Il saldo finale, se manca, è il saldo iniziale del mese dopo (come nel vecchio foglio).
- Id deterministici per import (`imp-…`) ed estratti conto (`st-…`): reimportare aggiorna, non duplica.
