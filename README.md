# Assets Map

An evidence-first map with four independently reviewed historical equity disclosures and a separate illustrative sample.

## Explore the map

The default **Researched disclosures** view shows four source-qualified historical claims about Apple common stock. Select a connection to see exact reported numbers, dates, source locators and coverage. Switch to **Illustrative sample** for the original broader interface demonstration.

- Tim Cook and the 12-person management group: beneficial attribution on **2 January 2026**, each source-bound below 1%; the group includes Cook.
- Vanguard Global Advisers, LLC: reported discretion and voting authority on the **same 30 June 2026 position**. These are separate roles, not two holdings.
- No current-position inference, cap-table total, full-AUM claim or cross-date summation. Three unapproved candidates remain excluded.

## Try the illustrative sample

- Search for **BlackRock**, **Berkshire**, **Amazon**, **Nestlé** or **SpaceX**.
- Select an entity or connection to inspect its source and date.
- Make any entity the focus, then explore its owners or investments.
- Start with **3D bubbles**: drag to orbit, pinch/scroll to zoom, and tap a bubble or its name to explore. A **2D map** and accessible **List** view are also available.
- The larger bubble is the current focus. Bubble sizes and spatial distances do not represent asset values, valuations or ownership percentages.
- Devices without WebGL 2 automatically show the 2D map with a clear explanation.
- The initial map expands only one neighborhood at a time. Data and rendering are separate.

## Scope and interpretation

The starter dataset has **17 entities, 12 illustrative connections and 10 public official sources**. It is not complete, current in every detail, or a live portfolio. Broad data collection is intentionally deferred until the interface is reviewed.

- BlackRock's three sample connections are **corporate acquisitions of managers/data businesses**, not its clients' investments.
- **AUM is client assets under management**, not company-owned assets or valuation.
- A **managed holding** is not corporate ownership or proof of control. No client-holdings dataset is loaded yet.
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

The workflow validates the dataset and runs model/DOM tests before uploading a static site artifact. It publishes the exact file allowlist in `scripts/prepare-site.mjs`, including only `data/graph.json` and generated `data/researched.json` from `data/`. Canonical data, staging, raw evidence, pilot candidates and review artifacts are excluded. Symlinked public inputs are rejected.

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

The original seven-candidate quarantine fixture is retained unchanged. A separate, independently reviewed four-claim subset now generates the default historical disclosure view. The remaining three candidates are still excluded. `scripts/export-researched.mjs` requires publication approval and all original admission gates; `npm run check` verifies exact reproduction of the public projection. Reviewed inputs and admission evidence are in `data-foundation/researched/input/` and excluded from Pages. No raw filing archives or proprietary security identifiers are committed. Synthetic fixtures test the accepted path, exact revision lineage, replay, conflicts, source rights, amendments and rollback.

- [Implementation and agent contract](docs/data-foundation.md)
- [Pilot evidence, rights scope and remaining gates](data-foundation/pilot/README.md)
- [Per-candidate validation report](data-foundation/pilot/validation-report.json)

Run `npm run data:demo` for an explicitly fictional local shadow release, or `npm run check:foundation` for focused tests. A separate PR workflow runs model/DOM/data/build and browser smoke checks; only the existing main-branch Pages workflow deploys.

## Third-party notices

Three.js and OrbitControls: MIT, Copyright 2010–2026 Three.js Authors. See `vendor/THREE-LICENSE.txt`.
