# NBIM global equity holdings layer

Tracking: #77 (batch 6 of docs/sovereign-institution-coverage-gaps.md).

The share map only holds Norges Bank's Form 13F, which covers US-listed 13(f) securities. This layer adds the full equity list that Norges Bank Investment Management publishes for the Government Pension Fund Global, on the same date as the 13F snapshot: **30 June 2026**.

## Source

- Page: https://www.nbim.no/en/investments/all-investments/ (retrieved 25 October 2026)
- Data file: https://www.nbim.no/api/investments/v2/2026-06-30.json, 1,586,126 bytes, SHA-256 `2faa6aaefdebfe46abe1cf72a4152ced830ab9112872570b5a328b6f356f7c76`. The raw file is not committed.
- Field meanings were confirmed from NBIM's own front-end code: `a.e` is shown with the label USD, `a.n` is NOK, `o` is ownership and `eq.v` is voting.
- Raw contents: 7,077 equity, 1,664 fixed-income, 47 unlisted real-estate and 9 renewable-infrastructure entries. Only equities are published here.

## Reuse

NBIM publishes the data free of charge. Its holdings-data terms (https://www.nbim.no/en/terms-of-use-holdings-data-in-snowflake-marketplace/) allow non-chargeable redistribution with NBIM identified as the source. They forbid implying investment advice and building financial products. Those terms formally attach to the Snowflake copy of the same dataset; the website file states no separate licence. Use here is non-commercial, attributed and for factual navigation only.

## What the layer shows

Per holding: name as NBIM spells it, country, incorporation country where published, sector, listing code where published, market value in USD and NOK as published, ownership % and voting %. Voting is kept separate from ownership (e.g. Alphabet 1.17% ownership, 0.52% voting). An ownership of 0 is shown as published, not as evidence of no holding.

The fund invests only outside Norway, so there are no Norwegian rows.

## Boundaries

- Separate layer. Rows never join 13F instruments, issuer identities, the shared network or portfolio totals. There is no name or ticker matching to the 13F data.
- No totals. NBIM notes that summed holdings can differ from its official aggregates.
- The list loads only when the layer is opened (722 KB); it is not requested on initial page load.
- Norges Bank's 13F details panel links to this list.

## Reproduce and check

```sh
node scripts/import-nbim.mjs --raw /outside/repo/2026-06-30.json   # verifies pinned hash, writes data/nbim-equities-2026-06-30.json
node scripts/import-nbim.mjs --check                              # part of npm run check
```

`data-foundation/nbim/manifest.json` pins the raw hash and size, raw counts and the output hash. `src/nbim-data.js` validates schema, ids, countries, sectors, integer values, two-decimal percentages and ordering.
