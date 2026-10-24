# UAE dated disclosures: bounded portal admission

Tracking: [issue #53](https://github.com/Eduard20/assets-map/issues/53).

This increment adds a UAE data view to the existing portal, not a workbook or a replacement of the institutional pilot. The original four-claim historical export and the ten SEC reported-share portfolios remain separate and unchanged. Other datasets are outside this change.

## What a connection means

- `direct_equity_ownership` identifies the named direct holder in its source, using an own-account perimeter. It is not inferred from a consolidated table.
- `reported_group_interest` identifies an investment or portfolio company reported within a consolidated group. It does **not** establish the immediate legal shareholder, a controlling interest, voting authority, or an independently owned additional asset.
- `group_interest_percentage` is a separately typed source-stated group-interest percentage, never the compatibility `stakePercent`, a voting percentage or an additive aggregate. Its denominator records the reported interest basis without inventing a share count.
- `reported_portfolio_affiliation` describes a source-named real asset or brand, with no equity metric. Acquisition, ownership, operating and management qualifiers remain distinct; a brand is not fabricated as a legal company.
- Unknown interests remain unknown, not zero. There are no synthetic percentage calculations, company valuations, inferred investment values or fabricated ownership links between independent roots.

The new predicate and perimeter are additive capabilities of the existing single foundation validator, not a parallel database or admission bypass. The 30-claim per-release cap, independent review, rights/use, identity, evidence and publication gates remain in force. Separately approved releases form a deterministic combined inventory, with per-claim release provenance. Identical records are deduplicated, conflicting reused identities or source records are rejected, and different dates are not silently collapsed into a current position. Cross-role metrics and incompatible perimeters must fail validation. Legacy inputs retain their original field shapes and output hashes.

## Dates

The map is a set of dated evidence snapshots, not a guarantee of current holdings. A source publication date is not a transaction date. A reporting date is not a publication date. Retrieval does not make an older snapshot current.

When publication is genuinely unknown, `published_at` is null and the explicitly recorded `observed_by` date is only an upper bound on availability. The independent document decision must accept this basis; both cutoff and retrieval checks still apply. The UI says publication date unknown and displays observation separately. Signature dates and year-end dates are never substituted for publication.

Public-news snapshots may explicitly declare non-exhaustive correction coverage after independent review. That means the cited dated observation was checked, not that every later correction or ownership change was discovered. It is not a latest/current holding assertion. Regulatory filings, annual reports and sources without this specific reviewed snapshot basis keep the strict amendment-chain gate.

## Admission and publication

Only the exact independently reviewed candidate IDs, sources and input hashes in the UAE bundle may be exported. Review is specific to minimal factual fields and the publication channels used. No reports, illustrations, logos, signatures or copied narrative are republished. Explicit source restrictions remain binding; public availability alone is not treated as an open licence. Alternative sources require their own review rather than inheriting approval from another host.

Current source-use decisions cover a non-monetized research/educational visualization of selected normalized facts. They are not affirmative open licences or permission for commercial resale, raw-source copying or future changes in use. The main WAM public-site privacy provisions, including their research/educational purpose and commercial-use limits, were specifically reviewed.

The public-file allowlist includes only the generated UAE projection and application assets, never research archives. The public repository itself is a distribution channel: committed input evidence must also be cleared for the minimal factual publication.

The integration is partial. Group coverage, missing private investments, secondary levels of subsidiaries, undisclosed stakes and unreviewed entities stay visible as gaps. It does not claim all UAE holdings or all holdings of any included group. Direct and consolidated group rows and different dates must not be added together.

## Verification

Required checks are `npm test`, `npm run check`, `npm run build:site` and the CI browser workflow. UAE browser coverage includes switching datasets, choosing groups and snapshots, searching all admitted rows rather than only visible graph nodes, evidence drilldowns, focus/back and load-failure recovery. Final merge review must inspect the exact input bundle and exact commit's results.
