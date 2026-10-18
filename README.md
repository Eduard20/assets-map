# Assets Map

A small, evidence-first UI prototype for exploring the connections between asset managers, companies and investments.

## Try the prototype

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

The workflow validates the dataset and runs model/DOM tests before uploading a static site artifact. It publishes only `index.html`, `style.css`, `icon.svg`, `src`, `data`, and `vendor`.

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

## Third-party notices

Three.js and OrbitControls: MIT, Copyright 2010–2026 Three.js Authors. See `vendor/THREE-LICENSE.txt`.
