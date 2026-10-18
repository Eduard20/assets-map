# Assets Map

An evidence-first map of **158,145 real reported share-position rows** from **nine filers**: BlackRock, Berkshire Hathaway, State Street, Geode Capital Management, JPMorgan Chase, Morgan Stanley, Goldman Sachs, Norges Bank and Vanguard Global Advisers, LLC, using their **30 June 2026** SEC Form 13F filings.

## Explore the map

The default **Shared portfolio network** connects all nine imported filers through verified matching instruments. It starts with 99 nodes and 331 reported holding links (top 20 instruments per filer). Increase to top 40 or 60 per filer, filter the same network, or search all 158,145 source rows. Click any company/security or manager in 2D, 3D or List to reveal its available incoming and outgoing network, beyond the overview top-N. Clicking again opens the next 20 connections. The current neighborhood takes priority at the 200-node ceiling, while earlier context remains where space permits. Explicit SEC-evidenced issuer-role links let Berkshire, BlackRock, State Street, JPMorgan Chase, Morgan Stanley and Goldman Sachs shares open their reporting-manager portfolios without merging share classes or counting those links as holdings. Entities without imported investment portfolios say so explicitly. Back restores the previous focus and search context.

- BlackRock: **49,286 share rows / 5,442 source-scoped instruments**, $6,706,454,577,631 reported share value.
- Berkshire Hathaway: **89 share rows / 29 instruments**, $299,253,556,246.
- State Street: **4,085 share rows / 4,085 instruments**, $3,378,870,771,423, using the restatement rather than appending it to the superseded original.
- Geode Capital Management: **8,455 share rows / 4,438 instruments**, $1,875,165,705,077.
- JPMorgan Chase: **32,666 share rows / 6,541 instruments**, $1,710,607,027,032.
- Morgan Stanley: **45,409 share rows / 8,170 instruments**, $1,889,856,060,810.
- Goldman Sachs: **12,904 share rows / 5,471 instruments**, $953,071,672,750.
- Norges Bank: **1,616 share rows / 1,616 instruments**, $1,003,234,702,801.
- These are 158,145 filing rows, **not 158,145 companies**. Instrument counts are source-scoped, not globally unique issuers.
- The share view partitions **162,082 effective information-table rows**, excluding 3,937 option, principal, warrant/right or explicit debt-class rows. It includes fund shares, depositary receipts, preferred shares and units where reported, not only common stock.
- BlackRock is a parent filer reporting on behalf of operating subsidiaries in a combination report. These are dated disclosed securities, **not whole AUM, proprietary ownership or current holdings**.
- Morgan Stanley is also a combination report. Its separately reporting Morgan Stanley Institutional Investment Advisors LLC is outside this table. Unresolved manager references remain visible, not guessed. Norges Bank excludes relevant secured-lending/borrowing collateral unless reinvested, as qualified in its cover.
- FMR LLC was checked but **withheld**: its cover and table disagree by $5. No tolerance, invented adjustment or partial FMR portfolio is published.
- The shared graph links only exact verified reported instrument identities with exactly matching trimmed security-class labels and the same reporting date. Its **5,657 cross-filer matched groups** plus **14,835 unmatched source-scoped instruments** produce **20,492 instrument nodes**, not 20,492 legal issuers. Every underlying filing row, value, quantity, discretion category and manager reference remains inspectable. No name-based issuer merging or cross-filer economic-value aggregation.

The **Historical disclosures (4)** option preserves the separately reviewed Apple disclosure set; **Illustrative sample** preserves the original interface demonstration. No datasets are silently added together.

## Try the illustrative sample

- Search for **BlackRock**, **Berkshire**, **Amazon**, **Nestlé** or **SpaceX**.
- Select an entity or connection to inspect its source and date.
- Make any entity the focus, then explore its owners or investments.
- Start with **3D bubbles**: drag to orbit, pinch/scroll to zoom, and tap a bubble or its name to explore. A **2D map** and accessible **List** view are also available.
- The larger bubble is the current focus. Bubble sizes and spatial distances do not represent asset values, valuations or ownership percentages.
- Devices without WebGL 2 automatically show the 2D map with a clear explanation.
- The initial map expands only one neighborhood at a time. Data and rendering are separate.

## Scope and interpretation

The optional illustrative dataset has **17 entities, 12 illustrative connections and 10 public official sources**. Its relationships remain separate from the real full-filing portfolio view.

- BlackRock's three sample connections are **corporate acquisitions of managers/data businesses**, not its clients' investments.
- **AUM is client assets under management**, not company-owned assets or valuation.
- A **managed holding** is not corporate ownership or proof of control. Form 13F positions indicate reported investment discretion, not the manager’s legal ownership.
- **Unknown percentages are null**, never inferred as zero or 100%.
- A subsidiary shown at group level can be held through intermediate entities.
- Each edge has an independent evidence date; historical acquisitions are not live cap-table guarantees.
- SpaceX has a sourced entity page but no loaded ownership edges. Missing links do not establish an absence of a relationship.
- Sources and caveats are available in the detail panel and methodology dialog.

## Run locally

Node.js 20 or newer:

    npm install
    npm start

Open http://localhost:8080. The production app itself needs only a static HTTP server. Three.js 0.186.1 and OrbitControls are vendored with their MIT license; there are no runtime CDN requests, API keys, trackers or external fonts.

## Tests

    npm test
    npm run check
    npm run test:browser

Install the test browser with `npx playwright install chromium`, or provide an existing executable path in `CHROMIUM_PATH`. Browser screenshots go to `artifacts/` (not versioned). Model and DOM tests run without a browser. `test:browser` checks desktop/mobile layouts, search, filtering, evidence, 3D availability and the fallback. A restricted host can prevent Chromium from starting; that is not a passing browser test.

## Deployment

The repository includes a GitHub Pages deployment workflow. In repository **Settings → Pages → Build and deployment**, select **GitHub Actions** once if Pages has not been enabled. Then run the **Deploy Assets Map** workflow or push a change to `main`.

The workflow validates the dataset and runs model/DOM tests before uploading a static site artifact. It publishes the exact file allowlist in `scripts/prepare-site.mjs`, including the sample, historical disclosure projection, small portfolio index and nine explicit compact portfolio files from `data/`. Canonical data, staging, raw evidence, pilot candidates and review artifacts are excluded. Symlinked public inputs are rejected.

Use **GitHub Actions** as the Pages source, not a branch-based Jekyll build. `_config.yml` additionally excludes the data foundation and source-only directories if a legacy branch build is enabled; it is defense in depth, not a replacement for the workflow's exact allowlist. After deployment, verify the app and confirm that `/data-foundation/pilot/input/batch.json` returns 404.

## Project structure

- `data/graph.json`: sources, entities and relationship claims
- `src/graph-model.js`: validation, filtering, neighborhood expansion and layout
- `src/graph-2d.js`: accessible SVG renderer
- `src/graph-3d.js`: default, lazily loaded Three.js bubble renderer
- `src/bubble-layout.js`: presentation-only spatial layout and focus sizing
- `src/app.js`: application state, search and detail UI
- `tests`: model, DOM and browser smoke tests

## Data contract

`graph.json` contains `meta`, `sources`, `nodes` and `edges` arrays.

Sources: `id`, `title`, `url`, `publisher`, `asOf`, optional `publishedAt`.

Entities: `id`, `label`, `kind` (`manager`, `company`, `fund`, `asset`, `sovereign`), `sourceIds`, optional `ticker`, `country`, `sector`, `summary`, `metrics`.

Metrics: `label`, `value`, `unit`, `asOf`, `sourceId`. Every metric must name its scope honestly. AUM and disclosed portfolio totals must remain distinct.

Edges: `id`, `source`, `target`, `kind` (`managed_holding`, `corporate_ownership`, `investment`, `subsidiary`), `asOf`, `sourceIds`, optional `label`, `notes`, `stakePercent` and `valueUsd` (both nullable).

Each edge is a sourced claim. Multiple edges can describe different dated relationships between the same entities. This prototype does not reconcile contradictions, calculate control or compute aggregate ownership. Add evidence and explicit dates rather than inferred percentages.

## Versioned data foundation and reviewed cutover

A separately tested foundation now supports isolated agent batches, a reviewed identity/source registry, immutable claim revisions, one validator and atomic versioned shadow releases. The original illustrative graph remains unchanged and separately selectable.

The original seven-candidate quarantine fixture is retained unchanged. A separate, independently reviewed four-claim subset now generates the optional historical disclosure view. The remaining three candidates are still excluded. `scripts/export-researched.mjs` requires publication approval and all original admission gates; `npm run check` verifies exact reproduction of the public projection. Reviewed inputs and admission evidence are in `data-foundation/researched/input/` and excluded from Pages. No raw filing archives or proprietary security identifiers are committed. Synthetic fixtures test the accepted path, exact revision lineage, replay, conflicts, source rights, amendments and rollback.

- [Implementation and agent contract](docs/data-foundation.md)
- [Pilot evidence, rights scope and remaining gates](data-foundation/pilot/README.md)
- [Per-candidate validation report](data-foundation/pilot/validation-report.json)

Run `npm run data:demo` for an explicitly fictional local shadow release, or `npm run check:foundation` for focused tests. A separate PR workflow runs model/DOM/data/build and browser smoke checks; only the existing main-branch Pages workflow deploys.

## Third-party notices

Three.js and OrbitControls: MIT, Copyright 2010–2026 Three.js Authors. See `vendor/THREE-LICENSE.txt`.

## Full portfolio import and admission

See [portfolio import contract](docs/portfolio-import.md). Compressed normalized factual inputs preserve exact reviewed bytes without committing raw XML or proprietary security identifiers. Export checks bind independent complete-batch approval to the SHA-256 of each decompressed input. Each source row and retained field was mechanically reconciled to official XML, with live official spot checks and independent amendment discovery. This is not a claim of per-row human review.

Normalize new source acquisitions with Python 3.9+ using `python3 scripts/import-sec13f.py --manifest /private/filer-manifest.json --output-dir /private/staged-normalized --private-dir /private/transient-identities`. Keep raw sources, manifests and private identity maps outside this repository. The importer supports verified X0202 whole-dollar, single-table filings; it rejects ambiguous units, incomplete amendment discovery and any count/value discrepancy. It creates no review approval. Admit only independently reviewed, SHA-bound outputs, then run `npm run data:export-portfolios` and `npm run check`. See the [strict import workflow and FMR hold](docs/portfolio-import.md) for the full contract.

The public projection uses a small index, compact per-filer group/row arrays and an independently reviewed opaque instrument-equivalence mapping. The network loads all nine portfolios together; their data files total about **12.68 MB** before HTTP compression, plus about **1.13 MB** for the exact-match map and 22 KB for the index. The shared graph has a 200-node safety ceiling and progressive top-20/40/60-per-filer controls; List pages have at most 50 source rows. Dense 3D labels declutter while every node remains keyboard-accessible, with labels revealed on focus or hover. Invalid input rows are quarantined and withhold the complete batch rather than silently claiming full coverage.

## Phone-first network navigation

On phones the network fills the main screen. Filters and selected-entity details open in dismissible, keyboard-accessible sheets rather than pushing the graph down the page. The persistent selected-entity bar opens evidence and outgoing/incoming connections. Controls have 44-pixel touch targets, safe-area padding and 16-pixel search/select inputs.

Both renderers use small luminous points, fine connections and selective labels on a dark canvas. Visible point size is not asset value; invisible touch targets remain larger. In 2D, drag anywhere to pan and pinch to zoom. In 3D, drag to rotate and use two fingers to zoom/pan, including gestures that start on labels. Dragging does not select a node. Fit, Back and Reset remain available. Browser chrome height changes do not reset the 3D camera. Reduced-motion preferences disable optional transitions.

CI tests touch-emulated Chromium in 320px/390px portrait and 844px landscape, sheet controls, touch dragging over labels and nodes, pinch zoom, real WebGL and the 2D fallback. This is not certification on a physical iPhone/Safari.

## Discover shared securities

Choose **Shared securities** in Explore list to browse every exact instrument reported by at least two imported filers, ranked by distinct filer count. Search matches issuer descriptions and security class across the full admitted network, not only visible graph nodes. The filer filter selects shared instruments that filer reports, while counts and names still show all imported filers reporting that instrument. Each page has at most 50 securities. Select a result to explore its investors and separate filing evidence. This is not a portfolio-overlap value, ownership percentage, industry classification or complete investor list; values are never combined across filers. **All filing rows** preserves access to every original source row, including unmatched instruments.

Vanguard Global Advisers, LLC (CIK 1811242) is one legal filer, not the entire Vanguard group or parent CIK 102909. Its 3,638 reported rows reconcile exactly; 3,635 qualify for the share view. The January 12, 2026 parent/affiliate reporting realignment prevents parent-plus-affiliate addition or an inferred comparable time series. Its Apple source row 2864 is the same position already represented by the historical managed-discretion and voting-authority claims. Those remain separate non-additive evidence views, not extra holdings; the historical dataset remains four claims. See [bounded VGA admission](docs/vanguard-admission-proposal.md) for source scope.
