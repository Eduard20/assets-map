# Central-bank gold reserves: model, evidence coverage and future pilot

Status: **Proposal accepted 2026-10-24; bounded pilot implemented**
Prepared: 2026-10-24. Ticket: [#16](https://github.com/Eduard20/assets-map/issues/16), under [tracker #1](https://github.com/Eduard20/assets-map/issues/1) (P4; depends on #2, #3, #4, #12).
Scope: sections 1–12 are the original planning text; every number in sections 6 and 8 is synthetic. Section 13 records the bounded pilot implemented after acceptance. Sources were read on 2026-10-24 only to check what they define, how often they publish and what reuse terms they state.

Throughout, **Recommendation** means a proposal waiting for the maintainer. **Accepted** refers only to what the [18 October decision](https://github.com/Eduard20/assets-map/issues/1#issuecomment-6248531585) already approved: the files-first, evidence-first and temporal-claim approach for the bounded shares test. Nothing here extends that approval to gold.

## 1. Summary of recommendations

1. **Use a separate asset-specific model, not an equity percentage.** Model gold as an asset-specific `reserve_observation` family that reuses #4's evidence, observation, claim-revision, value-envelope and status vocabulary. Do not express it as `equity_percentage`, `portfolio_weight` or a holding edge into an issuer. This follows the extension boundary in #2 §6: "Tonnes and valuation are not equity percentages."
2. **Keep four facts apart:** (a) the reporting authority and its reporting perimeter; (b) the reported quantity of monetary gold; (c) the reported valuation; (d) any custody or storage disclosure. Each is a separate claim with its own evidence, dates and availability. Reporting an owned reserve says nothing about where the metal is stored.
3. **Keep the source's units and convert by one fixed rule.** Store the quantity in the unit the source used (fine troy ounces, millions of fine troy ounces, tonnes, kilograms). Any converted figure is a derived value: 1 troy ounce = 31.1034768 g exactly, and 1 tonne = 10^6 g. Record the formula version and the source's rounding interval.
4. **Treat a change in quantity and a change in valuation as different metrics.** Many central banks revalue gold at period ends, so a change in reported value can come entirely from the price. A split of a value change into quantity and price effects is an optional derived analysis with a named formula, not a source fact.
5. **Record encumbrances only when a source covers them.** Represent swaps, deposits or loans, pledges, and allocated versus unallocated status only when a source explicitly covers that dimension for that perimeter and date. If no source covers it, the status is `unknown`, never "unencumbered" and never "none".
6. **Keep revisions and conflicts visible.** Handle them with #4 §7. A national release and an IMF dataset can differ because they use different definitions or valuation bases, not because one is wrong. Store them as scoped, separate observations.
7. **Future pilot:** three reporting authorities and one common reference date, 31 December 2025 (recommended). The pilot starts only after approval of source admission, rights and implementation (section 9).

## 2. Context and dependencies

| Dependency | What this proposal reuses | Status |
|---|---|---|
| #2 architecture | Files-first, immutable claim revisions, canonical-to-projection boundary, asset-specific extension records | Approach accepted for the bounded shares test; gold extension not approved |
| #3 sources | Admission checklist items 1–11, rights axes (`automated_collection` … `commercial_use`), status lifecycle `discovered → … → scope_admitted`; §7 gold pointers (IRFCL, national statements; COFER is not a gold source) | Proposal; no gold source admitted |
| #4 semantics | Value envelope `{value, availability, reason, precision, qualifier, evidence_ids}`, document/evidence/observation fields, `report_date`/`temporal_kind`, `valuation_basis`/`valuation_date`, `derivation`, status dimensions, amendment kinds, conflict sets | Approach accepted for the shares test; gold metric types below are new and unapproved |
| #12 integration | Fixture/test matrix shape, accept/reject/quarantine outcomes, atomic versioned release | Partially delivered for shares only |

The current live map is shares-only: three Form 13F snapshots dated 30 June 2026 plus separate historical and illustrative views. Gold adds no node, edge or count to these views.

## 3. Proposed gold model

### 3.1 Entities and roles

| Role | Meaning | Not to be confused with |
|---|---|---|
| `reporting_authority` | The central bank, ministry or treasury that publishes or submits the reserve figure for a stated perimeter | The publisher of a secondary dataset (IMF, WGC); the country as a territory |
| `reserve_holder` | The entity the source names as the owner of the reserve (for example a treasury, while the central bank administers it) | The custodian; the reporting authority, when the source distinguishes them |
| `custodian` | An entity the source names as physically safekeeping some of the gold | The owner. Bank of England states that customers keep title to specific bars and that customer gold is not on its balance sheet ([BoE gold](https://www.bankofengland.co.uk/gold)) |
| `storage_location` | A facility, city or country stated by a source | The holder's domicile or the reporting country |
| `counterparty` | A swap, deposit or lending counterparty, only if a source names one | An unnamed or assumed bullion bank |

A `reserve_perimeter_id` (an extension of #4's `reporting_perimeter_id`) records which balance sheet the figure covers: central bank only, central bank plus treasury or stabilisation fund, Eurosystem consolidated, and so on. Perimeters are versioned. A change in perimeter is a `scope_transition`, not a purchase or sale.

### 3.2 Proposed claim and metric types (new, unapproved)

| Type | Subject → object | Required fields beyond the #4 envelope | Cannot be supported by |
|---|---|---|---|
| `reserve_quantity` (metric) | Holder or perimeter → `asset:monetary_gold` | `quantity_raw`, `unit_raw` (`fine_troy_ounce`, `million_fine_troy_ounces`, `tonne`, `kilogram`), `fineness_basis` (`fine_gold` / `gross_weight` / `unknown`), `report_date`, `definition_framework` (for example `IRFCL_2013`, `national_accounts`, `BPM6`), `inclusion_note` (for example "including gold deposits and, if appropriate, gold swapped") | A value divided by a price the source did not state; a WGC table standing in for primary evidence without admission |
| `reserve_valuation` (metric) | Same perimeter | `value_raw`, `value_currency`, `valuation_basis` (`market`, `statutory_book`, `official_fixed_price`, `historical_cost`, `unknown`), `valuation_date`, `price_reference` (price, unit, currency, source) when stated | Quantity × a price the model chose, unless labeled `calculated`, with its own lineage and an admitted price source |
| `custody_disclosure` | Holder → `custodian` / `storage_location` | `share_raw` or `quantity_raw`, `disclosure_date`, `location_granularity` (facility / city / country), `allocation_basis_raw` | A reserve total; the reporting country; a custodian's own vault totals across all its customers |
| `encumbrance_disclosure` | Holder → arrangement | `arrangement_kind` (`swap`, `deposit_or_loan`, `pledge`, `lent`, `other`), quantity or value, counterparty if stated, `source_scope_statement` | Absence of a statement; a template line that does not separate the item |
| `allocation_status_disclosure` | Holder → account form | `allocated` / `unallocated` / `mixed` / `unknown`, with scope | General custodian marketing text that does not concern the holder |
| `reserve_change_event` | Holder → event | `event_kind` (`purchase`, `sale`, `coin_minting_use`, `relocation`, `sale_and_repurchase`, `perimeter_change`), source-stated quantity, effective date or interval | A difference between two snapshots. That is a derived `quantity_delta`, not a source-stated event |

Derived metrics (`assertion_origin=calculated`, each with a #4 `derivation` record):
- `quantity_converted`: a unit conversion. Section 4 gives the rule.
- `quantity_delta`: the quantity change between two compatible snapshots (same perimeter, framework and fineness basis).
- `valuation_delta`: the value change between two compatible snapshots (same currency and basis).
- `valuation_effect_split`: optional. Section 5.2.
- `gold_share_of_reserves`: allowed only with an explicit total-reserves denominator from the same source, date, perimeter and valuation basis (the #4 §4.4 `denominator` object). It is **not** an ownership percentage and is never computed across sources by default.

### 3.3 Dates

Each observation keeps these dates separately, with explicit availability: `report_date` (the month-end or other reference date), `report_period` where the figure covers a flow, `valuation_date`, `disclosure_date` for custody statements, `published_at`, `retrieved_at`, `revised_at` / `document_version`, and the model's `recorded_at`. A custody breakdown published in 2026 can describe a different date from the reserve total in the same document. Section 6 G03 shows this.

## 4. Units and conversion provenance

**Rule `GOLD-MASS-v1` (recommended).**
- 1 troy ounce = 480 grains. 1 grain = 64.79891 mg exactly (the 1959 international yard and pound definition). So 1 troy ounce = **31.1034768 g exactly**. NIST OWM's [precious-metal conversion table](https://www.nist.gov/document/precious-metals-conversion-information-march2015pdf) lists 1 troy ounce = 480 gr = 31.103 476 8 g.
- 1 tonne = 1,000 kg = 10^6 g exactly.
- tonnes = fine troy ounces × 31.1034768 / 10^6. Fine troy ounces = tonnes × 10^6 / 31.1034768, which gives about 32,150.7466 per tonne. That factor is non-terminating, so store the full-precision result and round only for display.
- price per fine troy ounce = price per kg × 0.0311034768. Example: SNB quotes gold in CHF per kilogram ([SNB, 31 July 2026](https://www.snb.ch/en/publications/communication/press-releases/2026/pre_20260731)), while the ECB quotes EUR per fine oz ([ECB weekly statement, 8 July 2026](https://www.ecb.europa.eu/press/annual-reports-financial-statements/wfs/2026/html/ecb.fs260708.en.html)).

**Invariants.**
1. The original `quantity_raw`/`unit_raw` is never overwritten. A converted value is a derived metric that names `formula_id=GOLD-MASS-v1` and its input `claim_revision_id`.
2. Use decimal-string arithmetic, never binary floats (as #4 §4.4 already requires).
3. Treat a source figure rounded to a stated precision (for example "1,040 tonnes", or tonnes to one decimal) as an interval (`qualifier=range`, or a precision field). Convert both bounds of the interval, not a point.
4. Convert **mass only**. Fineness stays a separate field. If a source states gross bar weight rather than fine weight, `fineness_basis=gross_weight` blocks comparison with fine-gold figures. The IMF template asks for "volume in millions of fine troy ounces" ([IRFCL reporting template](https://data.imf.org/Datasets/IRFCL/Reporting-Template)).
5. Do not convert "ounces" without "troy" or "fine" into troy ounces automatically. Quarantine for review.

## 5. Quantity versus valuation

### 5.1 Valuation bases seen in sources (examples, not admissions)

| Basis | Example source behavior | Consequence |
|---|---|---|
| Market, revalued each quarter-end | Eurosystem weekly statement: gold revalued at quarter-end and shown in a separate "quarter-end adjustments" column, with the EUR per fine oz price used ([ECB 8 July 2026](https://www.ecb.europa.eu/press/annual-reports-financial-statements/wfs/2026/html/ecb.fs260708.en.html)) | Within-quarter weekly values are not daily market values. A quarter-end step is mostly a price effect |
| Market, reported with "unchanged in volume terms" | SNB interim and annual results report a valuation gain or loss and say the gold volume is unchanged ([SNB 31 July 2026](https://www.snb.ch/en/publications/communication/press-releases/2026/pre_20260731)) | The source itself separates the price effect. Keep that statement as evidence for `quantity_delta = 0` |
| Statutory book value | U.S. Treasury-Owned Gold: fine troy ounces by facility. Book value at the statutory $42.2222/oz is explicitly not market value ([Fiscal Data dataset](https://fiscaldata.treasury.gov/datasets/status-report-government-gold-reserve/)) | Never mix with market values in a sum or a time series |
| Official fixed price used by a secondary compiler | IMF help note: IFS converts the reported fine-troy-ounce volume at SDR 35/oz, then applies the US$/SDR rate. The reserve template recommends market valuation. "This accounts for most of the difference between the RT and IFS" ([IMF data help 484362](https://datahelp.imf.org/knowledgebase/articles/484362-why-are-official-reserve-assets-data-in-the-data-t)) | An IFS gold value and an IRFCL gold value for the same month are scoped observations on different bases, not a conflict |
| Value disclosed, basis stated elsewhere or not at all | Banque de France's gold page gives ounces and tonnes but no valuation basis ([BdF gold reserves](https://banque-france.fr/en/monetary-strategy/markets/management-gold-reserves)) | `valuation_basis = unknown` until evidenced. Not presumed to be market |

### 5.2 Change attribution

- `quantity_delta` and `valuation_delta` are always computed and shown separately, and only between compatible snapshots.
- `valuation_effect_split` is optional (decision D5). Recommended formula `GOLD-VALSPLIT-v1`: quantity effect = Δq × p_start; price effect = q_end × Δp. Both are in the same currency and basis, and both prices are source-stated. The order of terms changes the split, so the formula ID is mandatory. Without stated prices at both dates, the split is `unavailable` with reason `price_not_disclosed`. It is not estimated from a market benchmark.
- Translating currency is a third effect. The pilot default is no cross-currency translation (#4 §6.3 item 4).
- A source-stated event, such as SNB's "unchanged in volume terms" (or a coin-minting attribution such as press coverage reports for the Bundesbank; primary wording unverified), is evidence about the event. A difference between snapshots alone does not identify a purchase or sale.

## 6. Custody, storage and encumbrances

**Default: storage location is unknown.** A reserve total, a reporting country or a template line never creates a `custody_disclosure`. A storage claim needs a source passage that concerns that holder, scope and date.

Source patterns that show why this matters:
- **Bundesbank** has published per-location tonnages for Frankfurt, New York and London. Its 2017 transfer-completion release gives a three-site table with no explicit as-of date ([Bundesbank 23 Aug 2017](https://bundesbank.de/en/press/press-releases/bundesbank-completes-gold-transfers-ahead-of-schedule-667434)). Its older topic page still shows a four-site year-end table that includes Paris ([Bundesbank topic page](https://bundesbank.de/en/tasks/topics/the-development-of-the-bundesbank-s-gold-reserves-647196)). Official pages can therefore present custody snapshots from different dates side by side. Each custody claim must carry its own `disclosure_date`, and an undated table is `effective_date_basis=unknown`.
- **De Nederlandsche Bank** gives storage percentages for Zeist, London, New York and Ottawa. It notes that the proportions changed in 2026, while the value it quotes is for end-2025 ([DNB gold](https://www.dnb.nl/en/about-us/gold/)). The custody shares and the reserve value describe different dates.
- **Banque de France** says its gold is stored mainly in its Paris vault ([BdF gold reserves](https://banque-france.fr/en/monetary-strategy/markets/management-gold-reserves)). Its 2025 results describe selling New York-held bars that did not meet its standard, buying back gold in Europe, and an exceptional capital gain, with the stated total unchanged ([BdF 2025 results](https://www.banque-france.fr/en/news/banque-de-france-2025-results)). One relocation event can change location, realised gains and valuation while quantity stays constant. It is also not a physical transfer of the same bars.
- **Swiss National Bank** publicly gave approximate country shares in 2013. Secondary coverage reports the figures ([swissinfo](https://swissinfo.ch/eng/swiss-politics/central-bank-discloses-gold-location/35646052)), but primary SNB wording for the current split was not verified (section 11).
- **Bank of England** is a custodian for many central banks. Its vault totals cannot be attributed to any one holder ([BoE gold](https://www.bankofengland.co.uk/gold)).

**Encumbrances.**
- The IRFCL template's gold line reads "Gold (including gold deposits and, if appropriate, gold swapped)". Footnote 5 asks that the valuation basis be disclosed, "ideally … by showing the volume and price" ([template](https://data.imf.org/Datasets/IRFCL/Reporting-Template)). An IRFCL gold figure may therefore *include* deposited or swapped gold without separating it. Store it as `inclusion_note`, and set `encumbrance_disclosure` to `unknown` (reason `not_separated_in_source`), not to zero.
- Section IV of the template has general pledged-asset and lent/repo memo lines, but no gold-specific line. A zero in a general memo line is a source zero only for that line's definition and asset scope. Admit it as evidence about gold only if the source states that it covers gold.
- IMF guidance treats some gold swaps and collateral cases as affecting reserve classification ([IMF clarification note on reverse transactions](https://www.imf.org/-/media/files/data/statistics/bpm6/approved-guidance-notes/clarification-note-treatment-of-securities-under-reverse-transactions-in-reserve-assets.pdf.md)). The model records the source's classification as given and does not reclassify.
- The BIS offers central banks gold sight accounts, deposits, swaps and location exchange ([BIS products and services](https://www.bis.org/banking/finserv.htm)). That shows these arrangements exist. It is not evidence that any particular holder uses them.
- Allocated or unallocated status is recorded only from a holder-specific statement. A custodian's general statement that it stores gold on an allocated basis supports a `custody_disclosure` qualifier only for holders that source names.

## 7. Source evaluation

Tiers follow #3: A = primary official and accession-like; B = primary but selective or irregular; C = secondary or derived. Every row's rights are `unknown` until checked against #3 checklist item 7. "Reuse note" summarises stated terms only and is not a legal conclusion.

| Source | Tier | What it can support | Definitional notes | Timing and revisions | Reuse note |
|---|---|---|---|---|---|
| [IMF IRFCL dataset](https://data.imf.org/en/Datasets/IRFCL) and [reporting template](https://data.imf.org/Datasets/IRFCL/Reporting-Template); [2013 Guidelines](https://www.imf.org/en/Publications/Manuals-Guides/Issues/2016/12/31/International-Reserves-and-Foreign-Currency-Liquidity-Guidelines-for-a-Data-Template-40117) | A (country-submitted) | `reserve_quantity` (millions of fine troy ounces), `reserve_valuation` (market recommended) | Gold line may include deposits and swapped gold. Gold outside reserves is a separate line. Perimeter is "monetary authorities", as each country defines it | Monthly for SDDS reporters. Lag and revisions vary by country; vintages must be captured | IMF [copyright and terms](https://www.imf.org/en/About/copyright-and-terms) have special terms for statistical data that require attribution. Recheck the live wording and any third-party content |
| IMF IFS / data portal gold series | C (IMF-derived value) | Quantity, as reported by authorities | Value derived at SDR 35/oz, then converted; not market value (help note above) | Monthly; revisions follow country submissions | Same IMF terms |
| ECB / Eurosystem [weekly financial statement](https://www.ecb.europa.eu/press/annual-reports-financial-statements/wfs/2026/html/ecb.fs260708.en.html) | A for the Eurosystem aggregate | `reserve_valuation` of "gold and gold receivables" for the consolidated Eurosystem | "Gold receivables" is not a quantity of physical gold. The Eurosystem aggregate is not a national central bank figure | Weekly; quarter-end revaluation column; gold price per fine oz stated | ECB reuse terms not yet checked |
| National central-bank annual reports and pages (Bundesbank, Banque de France, SNB, DNB) | A/B | Quantity, valuation, and sometimes custody shares | Accounting perimeter and valuation policy differ by bank. Custody tables may have no date | Annual for audited figures; some monthly (BdF says it publishes reserve size monthly). Corrections show up as new report versions | Per-publisher terms not checked |
| [U.S. Treasury-Owned Gold (Fiscal Data)](https://fiscaldata.treasury.gov/datasets/status-report-government-gold-reserve/); historic [Fiscal Service reports](https://www.fiscal.treasury.gov/reports-statements/gold-report/15-04.html) | A | Quantity in fine troy ounces by facility, form and location (a rare holder-specific storage disclosure); statutory book value | Treasury-owned gold. Deep storage versus working stock. Book value ≠ market | Monthly; page showed last update 2026-10-15, next expected 2026-11-11; series from 2012-01-31 | U.S. federal open data; check dataset-specific notes |
| [Bank of England gold](https://www.bankofengland.co.uk/gold) | B (custodian context) | Context only: allocated basis; customer gold off balance sheet | Vault totals are not any holder's reserve | Irregular | Not a quantity source |
| [BIS](https://www.bis.org/banking/finserv.htm) | Context | Existence of gold deposit, swap and location-exchange services | Publishes no country reserve quantities (none found) | — | Not a quantity source |
| [World Gold Council gold reserves data](https://www.gold.org/data/gold-reserves) | C | Discovery and cross-check only | Compiled from IMF IFS, with WGC adjustments where it knows of unreported movements | Monthly, with a lag; WGC may adjust for unreported movements | Its pages prohibit reproduction or redistribution without written consent, apart from limited extracts with citation ([WGC Dec 2025 statistics](https://www.gold.org/goldhub/gold-focus/2026/02/central-bank-gold-statistics-december-2025)). LBMA Gold Price data shown there is licensed from ICE Benchmark Administration. **Not recommended as evidence** |
| Central Bank of Armenia | B (gap fixture) | Possibly an IRFCL-style monthly template. A public-domain mirror on [data.opendata.am](https://data.opendata.am/en/dataset/cba-international-reserves-and-foreign-currency-liquidity-statistics-by-month/resource/2a157553-818d-4a51-8e49-364b65390cc2) last updated 2023 | Secondary aggregators suggest the gold line is zero. Only an explicit source zero may be recorded as zero | Official cba.am page not located | Useful later as a test of a "reported zero versus missing" fixture, not for the quantity pilot |

**Discovery plan (later, after approval).**
1. For each candidate authority, find the primary page and document (annual report, monthly release, IRFCL submission) and record document IDs, locators and versions under #4 §4.2.
2. Run #3's admission checklist per channel: authenticity, scope, semantics, dates and lag, revision discovery, a small permitted access check, rights axes, quality, minimisation, refresh.
3. Capture the IRFCL value for the same month as a separate observation, never a merged one.
4. Do not use WGC or aggregators (CEIC and similar) as evidence. Use them at most as discovery pointers, logged as such.

**Reconciliation plan.** For each authority and reference date, compare national and IRFCL figures across six dimensions:
1. Perimeter: central bank only, or including the treasury.
2. Definition: monetary gold, with or without deposits and swaps.
3. Unit and fineness.
4. Rounding interval.
5. Valuation basis and date.
6. Vintage.

Classify each pair as one of:
- `compatible_within_rounding`
- `compatible_different_basis` (for example IFS SDR 35 versus market)
- `scope_difference_explained`
- `unexplained_difference`, which creates a #4 conflict set.

Never average, never pick the larger figure, and never apply latest-wins.

## 8. Synthetic examples

All entities, figures and `synthetic://` URIs are fictional. Currency code **XTS** is the ISO 4217 code reserved for testing. Production validation must reject all of these (#4 V19).

**G01 — Price-driven valuation change (quantity unchanged).**
- Authority SA ("Synthetic Central Bank A") publishes two quarterly statements: `synthetic://gold/G01/q1`, as of 2025-03-31, and `synthetic://gold/G01/q2`, as of 2025-06-30.
- Quantity in both: 10,000,000 fine troy ounces. Market prices: XTS 2,000 and XTS 1,800 per ozt. Values: XTS 20,000,000,000 and XTS 18,000,000,000.
- **Accept:** `quantity_delta = 0`, `valuation_delta = −2,000,000,000`, attributed wholly to price.
- **Reject:** reporting a "sale" or a −10% reserve decline in gold quantity.

**G02 — Quantity and price both change; optional split.**
- Q3 statement as of 2025-09-30: 10,050,000 ozt at XTS 1,900, value XTS 19,095,000,000. Δvalue = +1,095,000,000.
- `GOLD-VALSPLIT-v1`: quantity effect 50,000 × 1,800 = 90,000,000; price effect 10,050,000 × 100 = 1,005,000,000; the two sum to the total.
- **Reject:** presenting the split without its formula ID, or estimating it from an external price when the source states none.

**G03 — Custody date differs from reserve date; rounded shares.**
- Authority SB's 2026 annual report (`synthetic://gold/G03/ar`) states two things: reserves as of 2025-12-31 are "311.0 tonnes", and the storage split "following 2026 changes" is 31% home vault / 32% Custodian X / 18.5% Custodian Y / 18.5% Custodian Z.
- **Accept:** the quantity claim, dated 2025-12-31 with interval [310.95, 311.05) t. Separately, four `custody_disclosure` claims with `disclosure_date` unknown within 2026 and `effective_date_basis=unknown`. The shares sum to 100% but stay source-stated percentages.
- **Reject:** applying the 2026 percentages to the 2025-12-31 tonnage to produce per-custodian tonnes for 2025-12-31.

**G04 — Reported total, no custody statement.**
- Authority SC reports 5,000,000 ozt as of 2025-12-31 (`synthetic://gold/G04/m12`). The source says nothing about location.
- **Accept:** `custody_disclosure` absent, location `unknown` (reason `not_disclosed`).
- **Reject:** displaying the gold "in" SC's country on a map, or drawing an edge to any vault.

**G05 — Template inclusion note, encumbrance not separated.**
- An IRFCL-style row for SD reads "Gold (including gold deposits and, if appropriate, gold swapped): 2.000 million fine troy ounces" (`synthetic://gold/G05/rt`).
- **Accept:** a quantity of 2.000 m ozt with `inclusion_note`. `encumbrance_disclosure = unknown`, reason `not_separated_in_source`.
- **Reject:** "SD's gold is unencumbered", or deposits and swaps set to 0.

**G06 — Explicit swap disclosure.**
- SE's annual report note (`synthetic://gold/G06/ar`, locator "Note 7") says: "Of the gold reserves as of 2025-12-31, 0.300 m ozt was provided under gold swaps with resident banks, maturing in 2026."
- **Accept:** an `encumbrance_disclosure` (kind `swap`, quantity 0.300 m ozt, counterparty class "resident banks", date) linked to the quantity claim. Whether the swapped gold is inside the reported reserve total follows the source's own statement. If the source does not say, record `unknown`.
- **Reject:** subtracting it from reserves without source support, or inferring the absence of swaps at other dates.

**G07 — Revision of a monthly figure.**
- SF's monthly release for 2025-11-30 says 10,000,000 ozt in v1 (published 2025-12-07). v2 (published 2026-01-07, labeled "revised") says 10,045,000 ozt.
- **Accept:** a #4 `partial_correction`. The best-supported 30 November figure is 10,045,000. A knowledge-time query for 2025-12-20 returns 10,000,000. Both revisions are retained.
- **Reject:** treating the revision as a December purchase of 45,000 ozt.

**G08 — National versus IFS-style value (not a conflict).**
- For 2025-12-31, SG's national statement gives a market value of XTS 20,000,000,000 for 10,000,000 ozt. A secondary dataset (`synthetic://gold/G08/ifs`) gives the same quantity valued at "35 units of account per ozt", converted at a stated rate.
- **Accept:** two `reserve_valuation` claims with different `valuation_basis`, classified `compatible_different_basis`. Quantities agree.
- **Reject:** a conflict flag, an average, or a "corrected" market value derived from the fixed-price series.

**G09 — Rounding-compatible quantity reports.**
- Source A: "312.6 tonnes" (one decimal), giving [312.55, 312.65) t.
- Source B: "10.05 million fine troy ounces" (two decimals), giving [10.045, 10.055) m ozt = [312.434424456, 312.745459224) t by `GOLD-MASS-v1`.
- **Accept:** the intervals overlap, so the pair is `compatible_within_rounding`; both are retained.
- **Reject:** converting B's point value (312.58994184 t) and calling the 0.01 t difference from 312.6 a conflict.

**G10 — Relocation by sale and repurchase.**
- SH reports the same total quantity at two year-ends. Its report states that bars held at Custodian X were sold and equivalent gold was bought and stored at its home vault, producing a realised gain of XTS 500,000,000.
- **Accept:** `quantity_delta = 0`. A `reserve_change_event` of kind `sale_and_repurchase` with the realised gain as a source-stated accounting item. Custody disclosures before and after, each dated.
- **Reject:** describing the event as a physical transport of the same bars, or counting a sale and a purchase as net reserve flows without source quantities.

**G11 — Reported zero versus missing.**
- SI's template row for gold reads "0.000" for 2025-12-31. SJ has no row for that month in the captured extract.
- **Accept:** SI has a known zero (evidence: that row). SJ is `unavailable`, reason `not_in_public_extract`.
- **Reject:** SJ = 0, or "SJ holds no gold".

## 9. Future pilot manifest sketch

**Recommendation:** three authorities that publish in different units and on different valuation bases. Each has some primary statement about storage or volume, which tests the separation rules.

| Authority | Why | Primary channel to check | IRFCL cross-check |
|---|---|---|---|
| U.S. Treasury (Bureau of the Fiscal Service) | Fine troy ounces by facility and location; statutory book value; monthly | Fiscal Data "U.S. Treasury-Owned Gold", record for 2025-12-31 | U.S. IRFCL submission, December 2025 (perimeter may include other U.S. authorities, to be reconciled) |
| Deutsche Bundesbank | Tonnes; per-location disclosures; market valuation in an annual report | Annual report 2025 and the gold-holdings document the Bundesbank site lists as dated 31.12.2025 | German IRFCL, December 2025 |
| Swiss National Bank | Tonnes and CHF/kg price; states "unchanged in volume terms"; quarterly results | Annual report 2025 / results releases | Swiss IRFCL, December 2025 |

Alternates: De Nederlandsche Bank (custody shares dated differently from the value: a G03 pattern) or Banque de France (relocation event: a G10 pattern). The common reference date is **2025-12-31**, the latest year-end that audited annual reports are likely to cover. If a source lacks that date, record a gap rather than substituting a nearby month.

```json
{
  "manifest_kind": "gold_reserve_pilot_proposal",
  "status": "proposal_not_approved",
  "ticket": "#16",
  "schema_versions": {"batch": "TBD (gold extension of batch-v1)", "registry": "TBD", "sources": "TBD"},
  "asset_class": "monetary_gold",
  "reference_date": "2025-12-31",
  "knowledge_cutoff": "TBD at approval",
  "authorities": [
    {"authority_id": "TBD:us-treasury-fiscal-service", "reserve_perimeter": "treasury_owned_gold",
     "sources": ["fiscaldata:us-treasury-owned-gold", "imf:irfcl:US"]},
    {"authority_id": "TBD:deutsche-bundesbank", "reserve_perimeter": "central_bank_balance_sheet",
     "sources": ["bundesbank:annual-report-2025", "bundesbank:gold-holdings-2025-12-31", "imf:irfcl:DE"]},
    {"authority_id": "TBD:swiss-national-bank", "reserve_perimeter": "central_bank_balance_sheet",
     "sources": ["snb:annual-report-2025", "imf:irfcl:CH"]}
  ],
  "permitted_claim_types": ["reserve_quantity", "reserve_valuation", "custody_disclosure",
                            "encumbrance_disclosure", "allocation_status_disclosure", "reserve_change_event"],
  "permitted_derivations": ["GOLD-MASS-v1", "quantity_delta", "valuation_delta"],
  "deferred_derivations": ["GOLD-VALSPLIT-v1", "gold_share_of_reserves", "fx_translation"],
  "limits": {"max_candidate_claims": 30, "max_authorities": 3, "reference_dates": 1,
             "prior_vintages": "only those needed to show revisions of the reference month"},
  "excluded_sources_as_evidence": ["world_gold_council", "commercial_aggregators"],
  "rights_axes": {"automated_collection": "unknown", "raw_retention": "unknown", "internal_extraction": "unknown",
                  "derived_publication": "unknown", "raw_redistribution": "unknown",
                  "attribution": "required_where_stated", "commercial_use": "unknown"},
  "stop_conditions": [
    "source not scope_admitted for the intended use",
    "reference date not published by the authority (record gap, do not substitute)",
    "unit or fineness basis ambiguous",
    "custody table undated and no reviewer decision",
    "any rights axis required for publication is unknown or blocked"
  ],
  "publication": {"status": "not_authorized", "projection": "separate gold view; never merged with share views"}
}
```

Pilot exit tests:
- Every quantity keeps its raw unit, and every conversion cites `GOLD-MASS-v1`.
- Each authority has distinct quantity and valuation claims.
- Custody appears only where a dated source supports it.
- Missing encumbrance data shows as unknown.
- Every IRFCL-versus-national pair is classified under section 7.
- No gold figure enters a share or ownership-percentage view.

## 10. Acceptance-criteria checklist

| #16 criterion | Where addressed | State |
|---|---|---|
| Reserve quantity and valuation are distinct metrics with explicit units, dates and evidence | §3.2 (`reserve_quantity`, `reserve_valuation`), §3.3, §5; G01, G02, G08 | Specified in proposal |
| Fine-gold mass conversions have a reproducible rule and retained original units | §4 `GOLD-MASS-v1`, invariants 1–5; G09 | Specified in proposal |
| Custody/storage location remains unknown unless separately disclosed | §3.1, §6; G03, G04, G10 | Specified in proposal |
| Missing data is not zero reserves or proof of unencumbered holdings | §6 encumbrances; G05, G06, G11; #4 §5 | Specified in proposal |
| Conflicting revisions or reporting periods are visible, not silently combined | §3.3, §7 reconciliation; G03, G07, G08, G09 | Specified in proposal |
| Gold not forced into an equity-percentage model; implementation and collection need later approval | §1.1, §3.2 (`gold_share_of_reserves` is not ownership), §9 `publication.status`, §12 | Specified; approval pending |

## 11. Assumptions, gaps and source claims not fully verified

**Assumptions.**
- The #4 envelope and status dimensions apply without change. Gold needs only new metric and claim types plus a reserve perimeter.
- Annual reports for 2025 are the most likely common reference documents. Not every authority will publish custody data.
- The pilot remains a separate view from the shares map.

**Gaps and unverified items.**
- The 2013 IRFCL Guidelines PDF could not be text-extracted in this environment. Paragraph-level wording on monetary gold, unallocated accounts and the 995/1,000 purity rule was seen only through IMF secondary pages and summaries, and must be checked at admission. The IMF data-help article was cited from search results; its page could not be fetched directly.
- The exact IMF data-portal dataset URL format varies (some variants returned 404). Confirm the stable URL and API route.
- A current, primary SNB statement of storage shares was not located. Secondary reports of the 2013 disclosure exist.
- The Bundesbank's year-end-2025 per-location table was seen only through press coverage. The official 31.12.2025 holdings document was not opened.
- The official cba.am reserve-template page was not located. Armenia's zero gold line is from secondary aggregators only.
- ECB, Bundesbank, SNB, DNB, Banque de France and Fiscal Data reuse terms are not reviewed. IMF data terms were read only in summary form.
- The exactness of 31.1034768 g rests on the 1959 grain definition. NIST's table lists the value but does not itself use the word "exact".
- No access probe, download, parser or IRFCL vintage history was tested.

## 12. Decisions needed from the maintainer

| ID | Decision | Recommendation |
|---|---|---|
| D1 | Approve gold as a separate asset-specific record family reusing #4's envelope, with no equity metrics | Approve |
| D2 | Approve conversion rule `GOLD-MASS-v1` and interval handling for rounded figures | Approve |
| D3 | Approve the default "custody unknown unless disclosed" and "encumbrance unknown unless source-scoped" | Approve |
| D4 | Choose pilot authorities and reference date | U.S. Treasury, Bundesbank, SNB; 2025-12-31 |
| D5 | Whether `valuation_effect_split` appears in a first pilot | Defer; show Δq and Δvalue only |
| D6 | WGC and aggregators: discovery-only or excluded entirely | Discovery-only, never evidence |
| D7 | Whether IRFCL is captured alongside national sources or replaces them | Alongside, as separate observations |
| D8 | Separate authorisations for implementation, collection and publication | Required; none implied here |

Completion condition: the maintainer records acceptance or requested revisions on #16. This proposal starts no implementation, collection or deployment, and the issue stays open.

## 13. Implemented pilot

Implemented 2026-10-24 as an isolated, closed-by-default modal layer, "Central-bank gold reserves · Pilot" (launcher `#gold-launcher`, dialog `#gold-dialog`). Files: `src/gold-data.js` (records, `GOLD-MASS-v1` decimal-string arithmetic and the validator, which runs at import), `src/gold-view.js`, `src/gold.css`, `tests/gold.test.mjs` and `tests/browser-gold.mjs`. The layer never enters graph-model, portfolio totals, security equivalence or issuer identity resolution.

### What was collected (25 claims, reference date 2025-12-31, retrieved 2026-10-24)

| Authority | Claims | Primary source |
|---|---|---|
| U.S. Treasury (Bureau of the Fiscal Service) | 8 `custody_disclosure` lines (fine troy ounces by facility, form and location) and 8 `reserve_valuation` lines (USD book value, `statutory_book`, $42.222/oz as stated on the dataset page) | [Fiscal Data API, record_date 2025-12-31](https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/gold_reserve?filter=record_date:eq:2025-12-31); [dataset page](https://fiscaldata.treasury.gov/datasets/status-report-government-gold-reserve/) |
| Deutsche Bundesbank | 2 `reserve_quantity` (holdings document: 3,350,286.5312 kg fine, also stated 107,714,173.571 ozf; annual accounts: 3,350,285 kg), 1 `reserve_valuation` (EUR 395,215 million, `market`, €3,669.106/ozf), 3 `custody_disclosure` (Frankfurt, London, New York, fine kg, dated 31 Dec 2025), 1 `reserve_change_event` (−1,260 kg, coin minting) | [Gold holdings as per 31 December 2025](https://www.bundesbank.de/resource/blob/618402/0f75835691887a4bd9247a22aa7d46c3/472B63F073F071307366337C94F8C870/goldbarrenliste-data.pdf); [Annual accounts 2025](https://publikationen.bundesbank.de/content/988046) |
| Swiss National Bank | 1 `reserve_quantity` (1,040.0 t, bars plus coins, fineness basis not stated), 1 `reserve_valuation` (CHF 115,351.2 million, `market`, CHF 110,918.97/kg) | [Annual Report 2025](https://www.snb.ch/public/asset/en/www-snb-ch/publications/communication/annual-report/annrep_2025_komplett/publications0_en/annrep_2025_komplett.en.pdf), Item 01 and balance sheet |

Reuse terms checked on 2026-10-24 are recorded for each source. Fiscal Data is a U.S. federal government work. The Bundesbank's conditions of use (§ 4.1) allow unaltered reproduction with "Source: Deutsche Bundesbank". The SNB copyright notice allows non-commercial use.

### Model and rules as implemented

- Quantities keep the source unit and decimal string. Conversions use `GOLD-MASS-v1` (1 troy oz = 31.1034768 g; 1 t = 10^6 g) in BigInt decimal arithmetic. Each stated figure also shows its rounding interval, converted at both bounds.
- The U.S. source publishes no total. The view shows a **calculated** line sum (`GOLD-LINESUM-v1`: lines from the same source, date, unit and valuation basis only), which gives 261,498,926.241 fine troy oz (8,133.526 t). This derivation was added for the pilot. It never sums across authorities.
- Quantities appear side by side in fine troy ounces and tonnes, each labelled source-stated or converted. There is no world total, and values in USD book, EUR market and CHF market are never added together.
- Encumbrance and allocation status are `unknown` (`not_covered_by_source`) for all three authorities. The validator rejects `none`, zero and unencumbered values.
- The Bundesbank holdings document and its annual accounts differ by 1.5312 kg. Both are kept, under a visible `unexplained_difference` reconciliation.
- Validator acceptance criteria: exact field allowlists per claim type (so equity, ownership, portfolio-weight, issuer, CUSIP and world-total fields are rejected), a host allowlist (Fiscal Data, Bundesbank, SNB only; WGC and `synthetic://` URIs are rejected), valid dates with as-of on or before retrieval, a single reference date, caps of 3 authorities and 30 claims, currency matching for price references, distinct quantity and valuation claims for each authority, and custody claims only with a disclosure date and only for an authority whose custody status is `disclosed`.

### Excluded and why

- **SNB storage shares.** Annual Report 2025 (PDF p. 95) says "approximately 70% is stored in Switzerland, some 20% at the Bank of England, and roughly 10% at the Bank of Canada", but gives no disclosure date. Under the §9 stop condition (undated custody, no reviewer decision), SNB custody stays `unknown` and the reason is shown in the view.
- **Per-location € values and tonnes in the Bundesbank annual accounts (Table 1).** These duplicate the dated per-custodian fine weights; omitted to stay within the claim cap.
- **IRFCL cross-checks, DNB and Banque de France alternates.** Not needed, because all three primary authorities had a verifiable 2025-12-31 source. IRFCL capture is deferred.
- **Secondary sources** (World Gold Council, press coverage, aggregators). Used at most for discovery and never as evidence.
- **`GOLD-VALSPLIT-v1`, `gold_share_of_reserves`, FX translation.** Deferred as §9 specifies.

### Unverified points

- The Fiscal Data dictionary describes `record_date` as "The date that data was published." The pilot treats the 2025-12-31 record as the month-end reference, as the dataset's monthly series implies.
- The Fiscal Data page states $42.222 per ounce. Line values divided by quantities give about 42.2222 (the statutory $42 2/9). Only the stated figure is stored.
- Converting the Bundesbank kilogram total gives 107,714,213.197 ozf, against the 107,714,173.571 ozf the source states. The source says different methods and rounding rules are used. Both figures are displayed.
