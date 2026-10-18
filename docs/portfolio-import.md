# Full reported portfolio contract

The admitted release covers three Q2 2026 SEC Form 13F filing families observed on 18 October 2026. A complete public table is not a complete economic portfolio or current holdings.

## Inputs and independent admission

`data-foundation/portfolios/input/*.normalized.json.gz` contains losslessly compressed normalized factual records, not raw filing XML. Decompression reproduces the exact independently reviewed input bytes. A sibling `*.review.json` binds an independent approval to that SHA-256 and records source identity, amendment discovery, row counts, dollar totals, share partition, spot checks and publication scope. The exporter rejects missing, stale or incomplete admission. No generated review approval is permitted.

Independent review mechanically compared every retained normalized row/field with official XML, rechecked primary-source bytes, spot-checked official rendered filings, and checked SEC submissions history for amendments. The audit discovered and corrected an equity-weight ETF class falsely treated as a warrant, and a debt note that the source tagged as SH. BlackRock's unresolved manager reference 0 remains reported without invented identity. State Street uses the restatement only; its original is preserved in the internal amendment ledger, never appended to the effective table.

## Deterministic projection

Run `npm run data:export-portfolios`; `npm run check` verifies byte-for-byte reproduction. Validation independently recomputes counts and integer-dollar totals, validates source URLs/row IDs and share eligibility, and checks source-scoped instrument consistency. Invalid rows are recorded under the excluded quarantine directory and withhold the batch. Source units are whole USD in schema X0202; no legacy thousands multiplier.

The share view includes SH rows without put/call, excludes explicit warrant/right classes, and excludes explicit NOTE/NOTES/DEB/DEBENTURE classes even if source-tagged SH. Fund shares, preferred shares, depositary receipts and reported units can remain; this is not a common-stock-only dataset. Equal-looking source lines and differing manager allocations are retained, not economically deduplicated.

## Public delivery and lineage

`data/portfolios.json` is a small summary/index. Each listed filer has an explicitly allowlisted compact JSON file. A groups dictionary preserves source-scoped instrument ID, source index, reported issuer label and class. Each row preserves ordinal, group index, value, quantity, discretion, manager references and voting authorities. Decoding reconstructs the exact source row ID. The app fetches only the selected filer's rows, groups source-scoped instruments for graph navigation, and retains all underlying rows for search and paginated inspection. No raw security identifiers, addresses, signatures, XML, API credentials or security-master/ticker joins are public.

The graph defaults to eight instruments, offers 20/40 and cannot exceed 45 nodes. A list page has at most 50 source rows. Group totals sum each original source row exactly once and do not multiply manager references. Cross-filer totals are not presented as unique issuers or exposure. Values do not size the bubbles.

Normalized inputs, admission files, documentation and quarantine are excluded by both the exact Pages artifact allowlist and legacy Jekyll `_config.yml` exclusions. Keep GitHub Actions as the supported Pages source.
