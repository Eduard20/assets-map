# Manager / fund overlap: executable acceptance increment

Related: [issue #9](https://github.com/Eduard20/assets-map/issues/9). This is a bounded regression suite, not completion of the broader manager/fund pilot. No new filings, fund portfolios, identities or production code are admitted by this change.

Run `node --test tests/manager-overlap.test.mjs`, or the existing `npm test` command. The suite imports the actual decoder, portfolio model, details renderers and network implementation; it does not implement a parallel aggregation algorithm in place of production code.

## Synthetic walkthrough

All names, source identifiers and values below are test-only, not factual holdings. The fixture's example.com source is a placeholder, not evidence of a real position.

The reporting manager is `synthetic-manager` (label **Example Capital**). It reports:

| Row | Source-scoped instrument | USD value | Shares | Sole / shared / no voting authority | Other-manager references |
| --- | --- | ---: | ---: | --- | --- |
| 1 | `synthetic-fund-shares`, label Example Capital, FUND SHARES | 1,000 | 100 | 40 / 35 / 25 | 7, 7, 12, 0 |
| 2 | Same fund-share instrument | 300 | 30 | 0 / 30 / 0 | 7, 7, 12, 0 |
| 3 | `synthetic-direct-shares`, Example Issuer COM | 600 | 60 | 60 / 0 / 0 | none |

Reporting/position date: June 30, 2026. Filing date: August 14, 2026. Currency: USD. The fund-share instrument totals 1,300 reported USD / 130 reported shares across two source rows. Three individual filing rows and their evidence remain inspectable. The manager's disclosed-row sum is 1,900 USD, not whole AUM, unique economic exposure or a valuation of the manager.

There is no ownership denominator. Ownership percentage stays null / “Not calculated.” Multiple or repeated manager references do not increase the quantity or value. Reference 0 remains unresolved. Voting partitions are attributes of those same shares, not additional positions. The same-name manager root and fund-share asset retain distinct identities.

Crucially, a holding of fund shares is **not** an imported portfolio of that fund. The manager's direct issuer holding is not attributed to the fund: there is no fund-to-issuer look-through edge. We do not know whether it overlaps economically with the fund's investments. These tests do not claim to deduplicate such economic exposure.

## Executable guarantees

1. `repeated, multiple and unresolved manager references...`: decodes the compact fixture; compares populated versus empty references; asserts exact 1,300 / 130 aggregation, row IDs, retained evidence and unresolved-reference wording.
2. `voting partitions...`: asserts exact partition totals and invariance of holding edges when the voting breakdown changes; requires managed-holding relation and null ownership percentage.
3. `same-name manager and fund-share instrument...`: asserts distinct node IDs/types, no fabricated fund look-through and the manager-only boundary. Checks “not whole AUM” and proprietary-ownership caveats.
4. `overlap evidence retains...`: preserves reporting date, distinct filing date, currency, source link, row ordinal and unknown ownership denominator.
5. `real shared instruments preserve...`: builds the actual admitted release network; checks every aggregate against its source rows, uniqueness of contributing position IDs, exact per-filer row retention, and a shared Apple COM example with one investor card per reporting boundary. The UI must keep the explicit warning that filer values must not be added as a company ownership total.

The real-data checks use all currently admitted manifest portfolios, rather than hard-coding a nine-filer ceiling. Exact source/class matching and admission validation remain covered by the existing network, portfolio and equivalence suites.

## Regression sensitivity and limitations

Local mutation probes confirmed this suite fails if portfolio aggregation multiplies a row by its number of other-manager references, if voting quantities are added to shares during decoding, or if the model invents a 100% ownership percentage. Those probes are not committed production changes.

This suite is not a source audit or a new review approval. The real-data tests rely on the release's existing reviewed admissions. The synthetic case tests a manager holding fund shares, not a sourced manager/fund parallel disclosure pair. Separate bounded fund manifests, official fund-level overlap examples, typed fund portfolio support, and a reviewed economic de-duplication policy remain open under #9. No client or ultimate beneficial investor is inferred, and full Vanguard coverage is not asserted.
