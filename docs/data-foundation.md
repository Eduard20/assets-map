# Versioned equity foundation v1

This implementation follows the reviewed architecture, source and semantics proposals in [#2](https://github.com/Eduard20/assets-map/issues/2#issuecomment-6248239669), [#3](https://github.com/Eduard20/assets-map/issues/3#issuecomment-6248256057) and [#4](https://github.com/Eduard20/assets-map/issues/4#issuecomment-6248240332), following the maintainer's 18 October 2026 instruction to proceed with versioned files, independent submissions, one validator and a small shares test.

It is a reviewable foundation, not a live-data cutover. The existing 17-node, 12-edge illustrative graph and default 3D experience are unchanged. The real pilot has **seven candidate claims, zero admitted claims**. Mandatory amendment discovery is incomplete. Synthetic acceptance tests exercise the successful path; synthetic evidence cannot pass production validation.

## Decisions and boundaries

- **Storage:** normalized immutable JSONL collections within content-addressed release directories. No hosted database or credentials.
- **Write authority:** research agents create isolated JSON batches. Only the integrator's validator builds canonical releases. Review records are separate inputs; mechanical validation does not confer review or publication authority.
- **Identity:** a reviewed, versioned registry identifies legal entities, funds, persons, reported disclosure groups, presentation-only brands, equity securities/classes, listings and reporting perimeters. A brand cannot be the legal reporter of a holdings claim.
- **Source admission:** document-specific, channel-specific and use-specific. Collection, retention, extraction, identifier use, derived publication, redistribution, attribution and commercial use are separate rights axes. Unknown/unsatisfied rights fail closed for the uses required by a claim.
- **Publication:** every generated file is a **shadow** artifact. The CLI has no command to overwrite `data/graph.json`, merge a PR or deploy. A maintainer's explicit approval is required before any public application cutover. `publication.status` is a recorded decision, not an action that deploys anything.
- **Pilot bound:** each batch is bounded to 30 candidate claims; the combined active release is capped at 30. No global collection, automatic refresh or whole-portfolio ingestion.

## File layout

| Path | Purpose | Pages publication |
| --- | --- | --- |
| `data/graph.json` | Unchanged illustrative UI dataset | Explicitly allowed |
| `data-foundation/schemas/` | Strict versioned input contracts | Excluded |
| `data-foundation/fixtures/synthetic.mjs` | Fictional acceptance fixtures only | Excluded |
| `data-foundation/pilot/input/` | Minimized real candidates and proposed contexts, all held | Excluded |
| `data-foundation/pilot/validation-report.json` | Reproducible per-candidate decisions and gaps | Excluded |
| `data-foundation/.local/` | Ignored staging, immutable canonical releases and shadow pointer | Excluded |
| `data-foundation/raw/` | Ignored; no raw documents are included by this implementation | Excluded |
| `data-foundation/legacy-inventory.json` | Byte hash and non-promoted legacy IDs | Excluded |
| `scripts/prepare-site.mjs` | Exact public-file allowlist; no directory-wide copying | Build tool only |

A public GitHub repository is itself a distribution channel. Being excluded from Pages is not sufficient permission to commit restricted material. The pilot input files contain only the independently reviewed, minimized SEC factual candidate payload, links, locators and caveats. They contain no raw filing archive, proprietary security identifier values, addresses, signatures, logos or personal contact details. Future batches belong in ignored staging until separately reviewed for repository publication.

## Agent input contract

`batch-v1.schema.json` is the wire contract. All object keys are explicit; unknown fields and malformed dates/decimal strings are rejected. The local evaluator implements exactly the checked-in schema vocabulary and rejects unsupported keywords. It is not a general-purpose implementation of every JSON Schema feature.

Every manifest fixes:

- Schema, identity-registry and source-registry versions
- Task, agent and immutable batch ID
- Exact base release ID (`null` for a first isolated integration)
- Knowledge cutoff, creation time, permitted entity/security/source IDs and reporting dates
- Maximum records, equity-only asset class and explicit stop conditions

The batch contains documents, locator-level evidence, independent observations, denominators, coverage, claims and gaps. Agent submissions cannot create canonical identities or admit their own sources. Proposed registry/source contexts remain `proposed`/`needs_review` until independently reviewed.

Each claim names a subject, exact relationship, security or entity target, reporting date and temporal basis, versioned reporting perimeter, position scope, evidence and metrics. `primary_evidence_ids` identifies the assertion rows; `evidence_ids` also includes contextual footnotes. Shared contextual evidence does not incorrectly imply that two different disclosed holders are one source row.

The integrator derives:

- `claim_id`: stable assertion family, including source family, assertion key, parties, role, reporting snapshot, perimeter version and position scope
- `claim_revision_id`: content hash of the exact immutable assertion, metrics and evidence references
- `release_id`: content hash of canonical data, registry/source snapshots, review, validation and generator version

A new retrieval is a new observation, not automatically a new claim revision. Equal display names and tickers never merge identities. Repeated batches with identical content are no-ops; reuse of a batch ID with changed content is rejected. Input batch order does not choose a winner.

## Identity review and reconciliation

The registry separates issuer and security/class IDs. Multiple listings can point to one security. Scoped official identifiers have validity dates and evidence URLs; conflicting overlapping identifiers fail validation. Only currently permitted namespaces are accepted; proprietary instrument namespaces are deliberately absent.

Decision tree:

1. Exact official identifier, correct namespace/scope/date, compatible entity/security kind, and accepted reviewer decision: use the existing canonical ID.
2. Different IDs or incompatible identity: retain distinct records. A name match supplies no automatic equivalence.
3. New identity with official evidence: propose a new stable ID and wait for review.
4. Unresolved identity or class: quarantine the claim, preserving the gap.

Merge/split/reversal decisions are append-preserved audit records. They do not rewrite historical claims or silently redirect legal parties. A later approved migration must make mapping changes explicit and rebuild dependents. This bounded version freezes registry/source snapshots during a release chain: changed hashes, versions or intended publication use require an explicit reviewed rebase/migration rather than an implicit update. General registry migration automation is outside this first increment.

## Admission and semantics

The validator gates **all transitive support**, including denominator and source-count evidence. Every supporting item must have a source-admitted document, allowed use, precise locator, in-cutoff publication and retrieval, and complete amendment discovery through the cutoff. A recent `amendment_checked_through` date does not override `amendment_status: incomplete`.

It also requires independently accepted claim, identity and perimeter decisions; permitted roles; temporal/perimeter compatibility; distinct metrics with unambiguous units; and evidenced coverage. Proposed review flags cannot be treated as accepted.

Important rules:

- Managed discretion, fund holdings, direct equity, record title, beneficial attribution, custody, voting and control assertions remain distinct.
- `reported_discretion` preserves what a 13F establishes without inventing whether all positions are client assets or proprietary assets. It is not corporate ownership or full AUM.
- Numbers are decimal strings. Unknown, unavailable and inapplicable values are null with a reason. Source zero remains a real zero. A source `<1%` stays a null exact point plus its explicit bound; it is never replaced by 0% or 1%.
- Source-stated percentages with unresolved or different-date denominators receive non-comparable warnings. They cannot become the compatibility `stakePercent` value. Beneficial, voting and portfolio percentages never populate an equity stake field.
- A snapshot does not imply continuing ownership. A reporting-perimeter change is not a sale. Retrieval does not refresh the underlying reporting date.
- One supported metric per metric type is allowed in this narrow pilot. Ambiguous multiple quantities/values must be split into explicitly scoped claims rather than selected by array order.
- Independent conflicting values and source-row identity conflicts quarantine every affected mapping, including an earlier active claim; they never use first-batch-wins or latest-retrieval-wins.
- Partial corrections append revisions and explicitly supersede exact earlier revisions. Additive amendments add only new rows. Full restatements/withdrawals need an independent document review and explicit predecessor-document scope; omitted rows become absent, never zero. Old revisions remain available.

Quarantined claim evidence never enters canonical fact collections or the shadow graph. The input stays in isolated staging and the validation report preserves reasons and gaps. Registry/source proposal metadata in the review package is not an admission of its claims.

## Queries and derivations

`queryIssuerDisclosures` separates ownership attribution, managed exposure, fund holdings and voting lanes; it never returns a summed cap-table percentage. `queryReportedPortfolio` requires an entity, reporting-perimeter version and reporting date, and excludes voting/custody from additive holdings.

`aggregateDisclosedSubset` takes exact active `claim_revision_ids`. It requires one subject, role, position scope, reporting date, perimeter version, value currency and valuation basis. Known/unknown overlaps block an unqualified additive total. Beneficial-attribution rows are not an additive exposure universe.

Its denominator is explicitly the selected disclosed long-equity values. Whole-portfolio coverage remains null. Exact decimal arithmetic is used; display percentages use half-up rounding to six places. Classification needs a named taxonomy/version and evidence; missing classification stays in an `Unclassified` bucket. No real industry taxonomy is imported or licensed by this pilot.

## Run and inspect

    npm test
    npm run check
    npm run data:demo

The demo creates an explicitly fictional, held release in `data-foundation/.local/synthetic-demo`. Run it twice to see idempotent output.

Validate the real candidates without writing any canonical files:

    npm run data:validate -- \
      --registry data-foundation/pilot/input/registry.json \
      --sources data-foundation/pilot/input/sources.json \
      --review data-foundation/pilot/input/review.json \
      --batch data-foundation/pilot/input/batch.json

Expected result: 0 active, 7 quarantined; exit code **2** means a valid review completed with quarantined claims. Exit **1** means a structural/operational failure. Exit **0** means no claims were quarantined, not that publication was authorized. Add `--report FILE` for a report or `--store data-foundation/.local/NAME` for an isolated shadow store.

## Atomic storage, recovery and rollback

A single filesystem lock guards writes. The validator serializes complete releases into a unique temporary directory, writes hashes for the exact expected artifact set, verifies the result and atomically renames the directory. Only then is `shadow-current.json` atomically replaced. A stale base pointer is rejected. A failure before pointer replacement leaves the previous release readable. Unreferenced incomplete temporary directories cannot be mistaken for releases or block a new unique staging attempt.

Each release includes normalized JSONL, the exact reviewed snapshots, validation, a build manifest, shadow graph and integrity manifest. Reads verify the artifact set, hashes and equivalence to the complete release; a partial/edited artifact set fails closed. Hashes detect drift, not malicious replacement by an administrator controlling the entire filesystem. Store paths resolving into public application directories are rejected.

If a process is terminated while it holds the lock, inspect whether a validator is still running before removing a stale lock. Do not automatically steal another writer's lock. Temporary files are disposable only after confirming they are unreferenced; immutable completed releases and staged candidate batches are retained.

Rollback is a reviewed local shadow-pointer operation; it does not erase history:

    node scripts/foundation.mjs rollback-shadow \
      --store data-foundation/.local/NAME \
      --release PREVIOUS_RELEASE_ID \
      --expected CURRENT_RELEASE_ID

## Migration and release checklist

1. Keep the legacy graph byte-identical. Inventory all 17 nodes and 12 edges; no sample relation is promoted into verified canonical data.
2. Reproduce synthetic acceptance/rejection, source amendment, double-count, replay, conflict, failure and rollback tests.
3. Complete the actual source, identity, amendment and rights checks for a bounded real batch. Re-run the single validator with independent review.
4. Review the exact candidate-to-canonical mapping, omissions, coverage and source rights. Do not work around a denied source or fill private gaps by inference.
5. Design and approve UI support for material role/date/coverage/denominator distinctions. The shadow projection is deliberately **not current-UI-compatible**, so it cannot be mistaken for a drop-in graph replacement.
6. Obtain explicit maintainer approval of the live-data cutover and deployment. Choose and record a prior reviewed release for rollback. This draft PR does not grant those approvals.

The existing browser smoke workflow is retained. A separate pull-request verification workflow runs the same browser checks without deployment. Local model/DOM/data tests can pass when browser startup is restricted; that does not count as a browser pass. GitHub-hosted Chromium is the integration check for the unchanged 3D interface.
