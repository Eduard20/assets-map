# Property and infrastructure ownership extension

Status: **Proposal — not approved.**
Prepared: 2026-10-24.
Ticket: [#15](https://github.com/Eduard20/assets-map/issues/15), phase P4, under [tracker #1](https://github.com/Eduard20/assets-map/issues/1). Depends on [#2](https://github.com/Eduard20/assets-map/issues/2) (architecture), [#4](https://github.com/Eduard20/assets-map/issues/4) (claims, evidence and metrics), [#5](https://github.com/Eduard20/assets-map/issues/5) (identity) and [#12](https://github.com/Eduard20/assets-map/issues/12) (integration and release acceptance).

This is a planning document. It does not change schemas, code, the live dataset or source admissions. It does not collect, ingest or publish any property, title, concession or plant record. The [18 October bounded-execution decision](https://github.com/Eduard20/assets-map/issues/1#issuecomment-6248531585) covers the shares test only. Nothing here extends it to later asset classes.

Throughout this document, **Recommended** marks a proposal awaiting maintainer review. **Approved** is used only for decisions already recorded in #1/#2/#4/#5. No decision in this document is approved yet.

## 1. Summary of recommendations

1. **Recommended:** Add a physical asset record (`asset_id`) as a new canonical kind next to entities and securities. Do not model buildings, parcels or plants as entities or as securities.
2. **Recommended:** Add asset-specific predicates for title, asset interest, management, operation, lease, concession, lending and public-authority roles. Each role is a separate claim type with its own evidence rules. None of them reuses `direct_equity_ownership`.
3. **Recommended:** Keep two exposure lanes that never mix in one aggregate. The *security lane* covers shares of a listed property company or infrastructure issuer (existing 13F/equity claims). The *physical-asset lane* covers title and interests in buildings and projects.
4. **Recommended:** Treat indirect interest through holding companies, SPVs and funds as a derived path. Every link keeps its own evidence. If any link's stake is undisclosed, the derived share is `unknown`. It is never set to 0% or 100%.
5. **Recommended:** Use separate metric types for project cost, enterprise value, asset (property) value, encumbrance/debt and an investor's disclosed stake value. Each carries `valuation_scope`, `valuation_basis`, `valuation_date` and `value_currency`. Never attribute the whole-asset value to each investor in a chain.
6. **Recommended:** Store asset location independently of investor domicile, issuer domicile and valuation currency. Publish it at country/subdivision/locality granularity by default, with no street addresses, title numbers or parcel geometry.
7. **Recommended:** No registry ingestion. Any later pilot is bounded to one property case and one infrastructure case (section 12). Each needs its own source admission and maintainer approval.

## 2. Context and boundaries carried forward

Approved foundation constraints this extension must respect (from #2, #4 and `docs/data-foundation.md`):

- Typed, immutable, evidenced claims (`claim_id` / `claim_revision_id`). Evidence documents, locator-level evidence and observations stay separate. Mechanical validation, review, conflict and publication eligibility are independent statuses.
- A value envelope keeps `known`, `unknown`, `unavailable` and `not_applicable` distinct, each with a reason. Source zero is a real zero.
- A snapshot does not imply continuing ownership. Retrieval does not refresh the reporting date. Reporting-perimeter changes are not disposals.
- Additive results need one non-overlapping layer, one date, currency and valuation basis, and a named denominator. Derived paths are views, not new direct records. The #4 proposal defers automatic multiplication through chains until approved look-through rules exist (#4 §3, "Derived paths").
- Source admission is document-, channel- and use-specific. Unknown rights fail closed. A public Git repository is itself a distribution channel.
- The current `batch-v1` schema is deliberately equity-only. Its `asset_class` is fixed, `predicate` allows only the ten equity predicates, and the metric units are shares, fund units and currency. This proposal requires a new schema version. It does not loosen v1.

The extension boundary in #2 §6 already states: "Operator is not necessarily owner; equity in an owning company differs from title to the asset." This document specifies that boundary.

## 3. Extension ADR

**ADR-P4-01: Physical assets as a separate canonical kind with role-separated claims**

- **Context.** Property and infrastructure ownership involves layered legal structures: title-holding SPVs, holding companies, funds, joint ventures, leases and concessions. It also involves non-owner roles: operators, managers, lenders and granting authorities. Sources report different things, such as title, accounting carrying value, project cost, investment commitments and fund look-through shares. These are measured at different scopes and dates. The equity model cannot represent them without inventing percentages or double-counting.
- **Decision (recommended).**
  1. Introduce canonical record kinds `asset` (physical property/plant/network/site) and `project` (a dated development or concession programme that may produce one or more assets). Both are allocated by the identity registry (#5). Like securities, they are never identified by display name.
  2. Introduce predicates listed in section 5, each with subject/object kinds, required temporal fields and evidence rules.
  3. Add metric types listed in section 7. Every value metric requires `valuation_scope`, plus a `share_basis` stating whether the figure is for 100% of the asset or the holder's share.
  4. Aggregations declare one `exposure_lane` (`security` or `physical_asset`) and one role. The validator rejects a universe that mixes lanes or contains two links of the same economic chain.
  5. Location is an attribute of the asset, with its own evidence and precision. It is never derived from any party's domicile or reporting currency.
- **Alternatives considered.**
  - *A. Reuse entity records for assets (a building is a "company").* Rejected. It conflates title holder and asset, invites equity percentages over buildings, and breaks the issuer/security distinction.
  - *B. Treat a REIT share or infrastructure fund unit as the asset exposure.* Rejected. It already exists as the security lane, and conflating it with direct ownership double-counts.
  - *C. Generic `owns` edge with free-text qualifier.* Rejected. It is the same failure mode #4 removed from the equity model (`stakePercent`).
  - *D. Separate asset kind plus typed roles (chosen).* Higher modelling cost. It preserves evidence, unknowns and role separation, and maps cleanly to future SQL tables (#2 option B).
- **Consequences.** New schema version (`batch-v2` or an asset-specific batch type), new registry kinds, new validator rules, and a projection/UI design for the asset lane (#7). The current equity views are unaffected. Until a UI can show the material distinctions (#2 §5), asset claims stay out of public projections.

## 4. Concept dictionary

| Concept | Record kind | Definition | Must not be confused with |
|---|---|---|---|
| Physical asset | `asset` (`asset_kind`: `building`, `land_parcel_group`, `estate`, `power_plant`, `generator_unit`, `transmission_line`, `pipeline`, `road`, `port`, `airport`, `water_works`, `telecom_network`, `other`) | A tangible, located thing with its own lifecycle. May contain component assets via `part_of`. | Its owner, its SPV, a security, a fund. |
| Project | `project` | A defined undertaking (development, PPP, concession) with dates, sponsor(s) and possibly several assets or phases. | The asset it produces; the concession contract; the SPV. |
| Asset location | attribute block on `asset` | Where the asset physically is: country, subdivision, locality, precision, evidence. | Investor domicile, issuer domicile, listing venue, value currency. |
| Legal title holder | `entity` in role | Entity registered or evidenced as proprietor of a title (freehold, leasehold, other tenure). | Beneficial or economic owner; operator; manager. |
| Holding company / SPV | `entity` (`entity_kind` existing, with `purpose_qualifier: spv` where sourced) | Intermediate legal entity holding title, concession or equity in another. | The asset; the sponsor; the fund. |
| Fund | `entity` (existing fund/series kinds) | Pooled vehicle with investors; may hold SPVs or assets. | Its manager; its investors; its assets. |
| Manager | `entity` in role | Investment or asset manager acting for a fund/owner. Has no stake by role. | Owner; operator. |
| Operator | `entity` in role | Runs day-to-day operation (plant operator, facility manager, toll operator). | Owner; concessionaire (may coincide, separately evidenced). |
| Concessionaire | `entity` in role | Holder of rights granted by a public authority to build/operate/collect revenue for a term. | Title holder; the public authority (which often keeps title). |
| Lender | `entity` in role | Provider of debt to an owner/SPV/project, possibly secured on the asset. | Owner. Security over an asset is not title. |
| Public authority | `entity` (`actor_category: government_body`) in role | Grantor of concession, procuring authority, regulator, or title holder of public land. | A state-owned company or sovereign fund (distinct entities per #4). |
| Lessee / lessor | `entity` in role | Parties to a lease of an asset or part of it, with term. | Owner (lessor may itself be a leaseholder). |

## 5. Role and relationship matrix

All predicates are **recommended** additions. Subjects and objects are canonical IDs. Each claim carries the #4 temporal envelope (`report_date`, `effective_from`/`effective_to`, `temporal_kind`, `effective_date_basis`, `end_semantics`) and locator-level evidence.

| Predicate | Subject → object | Stake metric allowed? | Required temporal fields | Sufficient evidence | Insufficient by itself |
|---|---|---|---|---|---|
| `asset_title` | Title holder → `asset` | `asset_interest_percentage` only if the register/source states a share (e.g. joint proprietors with stated shares); otherwise not applicable | Register snapshot date or registration date; `tenure` (`freehold`, `leasehold`, `strata`, `other`, `unknown`) | Official land/title register extract or published register dataset row; owner's audited schedule explicitly stating title held by named entity | Fund marketing material, press release, operator signage, a REIT holding the SPV's parent shares, a mortgage/charge |
| `asset_interest` | Holder → `asset` or `project` | Yes: source-stated share with `stake_basis` (`economic`, `equity_in_owner`, `joint_venture_share`, `undivided_interest`, `source_label`) | Snapshot/as-of date; interval if stated | Owner/fund report table stating share at a date; regulator ownership schedule (e.g. EIA-860 owner file for jointly owned generators) | Sponsor lists, investment-commitment totals, "portfolio includes" lists without share |
| `direct_equity_ownership` (existing) | Owner → SPV/holding entity | Yes, per #4 (`equity_percentage` with denominator) | Per #4 | Per #4: shareholder register, ownership schedule | Per #4 |
| `subsidiary_of` (existing) | SPV → parent | No numeric default | Per #4 | Per #4 | "Wholly owned" label as exact 100% |
| `fund_holding` (existing, extended object) | Fund → SPV / `asset` | Yes if the fund states the share | Report date | Fund annual report or official look-through table | Manager-level AUM, brand |
| `manages_asset` | Manager → `asset`, SPV or fund mandate | **No.** Stake is `not_applicable` | Appointment interval if stated | Fund prospectus/annual report naming manager; owner's statement of the appointment | Being the fund's manager (that is `manages_fund`); co-branding |
| `operates_asset` | Operator → `asset` | **No.** `not_applicable` | Operating interval or snapshot | Regulator plant record naming operator; concession/O&M disclosure | Ownership data; employer of site staff |
| `lease_of` | Lessor → lessee, scoped to `asset` (or part) | No stake. Allowed metrics: `lease_term`, `rent_reported` (if published) | `lease_start`, `lease_end` or `term_years` with basis; break/option dates if stated | Published lease register row, owner/issuer disclosure, registered leasehold title | Occupancy or tenant signage. Residential tenancies are out of scope. |
| `concession_grant` | Public authority → concessionaire, scoped to `project`/`asset` | No equity stake. Allowed metrics: concession term, contract value as `contract_value` | `award_date`, `effective_from`, `concession_end` (with `end_semantics`), extension/termination events | Official procurement/concession notice, PPP register entry, signed-contract publication | Bidder lists, preferred-bidder announcements, sponsor press release |
| `procures_project` | Public authority → `project` | No | Contract/financial-close date | Official PPP/PFI register | Ministerial statements without contract evidence |
| `lends_to` | Lender → borrower entity, optional `secured_on_asset_id` | No equity stake. Allowed metrics: `debt_amount` with tranche/facility scope | Facility date, maturity if stated | Borrower's filed accounts/notes, official project database debt-provider fields, registered charge (as evidence of a security interest only) | Being a "financial partner"; development-bank "support" label; charge registration as proof of outstanding amount |
| `project_sponsor` | Sponsor → `project` | Only if the source states a share; else `unknown` | Snapshot date of the source | Official database sponsor field with share | Sponsor field without share is **not** an ownership percentage |
| `part_of` | `asset` → `asset`/`project` | No | Effective interval if known | Source description | Name similarity |
| `control_assertion` (existing) | Controller → SPV/asset owner | No automatic percentage rule | Per #4 | Per #4 | Majority stake alone; operator role |

**Role separation rules (recommended):**

- One entity may hold several roles over the same asset, for example owner and operator. Each role is a separate claim with its own evidence. Roles are never inferred from one another.
- `manages_asset`, `operates_asset`, `concession_grant`, `procures_project` and `lends_to` cannot carry an ownership percentage. A validator rejects `asset_interest_percentage` or `equity_percentage` on these predicates.
- A concessionaire's interest is a time-limited right, not title, unless title is separately evidenced. A public authority that grants a concession may also hold `asset_title` if a register says so.
- A lender's security over an asset is recorded as an attribute of `lends_to` (`security_interest_evidenced: true`). It is never `asset_title`.

## 6. Identity, location and geographic granularity

### 6.1 Asset and project IDs (recommended)

- `asset_id` and `project_id` are opaque registry IDs (#5), for example `ast_…` and `prj_…`. They are never derived from address, name or coordinates.
- Scoped external identifiers are kept as namespaced, dated aliases with evidence: EIA plant ID / generator ID, World Bank PPI project ID, UK PFI project ID, TED notice/procedure ID, REIT-internal property names, and, under restricted handling only, a title number or parcel ID. Each alias has `namespace`, `scope` (plant vs unit, phase vs whole), validity dates and `reuse_status`.
- An alias's namespace scope matters. An EIA generator is a component of a plant, and a PPI project may span several assets. Mapping a component alias to a whole asset is a split/merge decision under #5, never automatic.
- Name-only matching never merges assets. Two buildings with the same name or address string stay distinct until evidence resolves them.
- Redevelopment, demolition, subdivision, and plant uprate or repowering are lifecycle events (`asset_event`) with dates. They are not silent ID changes.

### 6.2 Location (recommended)

| Field | Meaning |
|---|---|
| `location_country` | ISO 3166-1 alpha-2 of the physical location. Required, `unknown` allowed with reason. |
| `location_subdivision` | ISO 3166-2 code where evidenced. |
| `location_locality` | City/municipality name as sourced, with source text retained. |
| `location_precision` | `country`, `subdivision`, `locality`, `site_point`, `parcel`. Publication default ceiling: `locality`. |
| `location_evidence_ids` | Separate evidence. The location claim is its own field-level support. |
| `cross_border` | For linear assets (pipelines, interconnectors): list of countries, never a single "home" country. |

Investor domicile (from the entity registry), issuer domicile, listing venue, `instrument_currency` and `value_currency` are independent dimensions. They are never used to fill `location_country`. A GBP-denominated fund holding a German warehouse has location DE, value currency GBP, and fund domicile as separately evidenced.

Site coordinates, street addresses, title numbers and parcel geometry may be retained only in restricted staging where the source licence permits it and review needs them for identity resolution. They are not part of the proposed public projection (section 10).

## 7. Interests, stake basis and valuation semantics

### 7.1 Stake basis

`asset_interest_percentage` follows the #4 percentage rules. It needs a denominator, here an explicit `denominator_kind` such as `whole_asset_economic_interest`, `title_shares` or `generator_capacity_share`. It also needs a scope and date, and the source-reported value is kept separately from any recomputation. `stake_basis` states what is measured: an economic share of the asset, equity in the owning entity, a JV share or an undivided interest. Different bases are not additive.

### 7.2 Indirect interests through chains

- Each link (fund → holdco, holdco → SPV, SPV → title) is a separate claim with its own evidence, date and stake.
- A derived `look_through_interest` is a calculated metric (`assertion_origin: calculated`). It records every link's `claim_revision_id`, its percentages, and a formula ID. The links' dates must match, or the dates must be explicitly reconciled. Mixed dates are rejected by default.
- If any link's stake is `unknown` or `unavailable`, the derived interest is `unknown` with reason `intermediate_stake_not_disclosed`. The partial chain stays inspectable.
- A source-stated look-through share stays `source_stated`. Example: NBIM's fund-level table states both "Fund's ownership" in a property and "Fund's ownership in BAL". The model keeps it as stated even if multiplying the links gives a slightly different number. Differences are flagged, not overwritten.
- No deeper inference: a parent's consolidation of an SPV does not establish the parent's percentage of the asset.

### 7.3 Value metric types (recommended)

| `metric_type` | Measures | Typical source | Never treated as |
|---|---|---|---|
| `project_cost` | Total capital cost/budget of a project (estimate or outturn; `cost_stage`: `estimated`, `at_financial_close`, `outturn`) | PPP register "capital value", plant construction cost, project database investment | Value of anyone's ownership; asset value today |
| `investment_commitment` | Source-defined committed investment (debt + equity, sometimes including payments to government) | World Bank PPI | Equity owned; current value |
| `contract_value` | Value stated in a procurement/concession award | TED/eForms award notice | Asset value or owner's stake |
| `enterprise_value` | Equity plus net debt of the owning entity/project at a date, as sourced | Transaction disclosure, valuation report | Property value; equity value |
| `asset_value` | Value of 100% (or a stated share) of a physical asset; basis `fair`, `appraised`, `book`, `cost`, `assessed_for_tax` | Fund annual report, REIT fair-value note, Schedule III carrying amount (cost basis) | Market price of the owner's shares |
| `encumbrance` / `debt_amount` | Debt secured on or owed by the asset/SPV | Schedule III Column B; borrower accounts | Negative ownership; lender equity |
| `disclosed_stake_value` | The value an investor itself reports for its interest | Investor annual report, fund look-through | Asset value × percentage computed by the model |
| `reported_value` (existing) | Security-lane position value (e.g. 13F) | 13F | Physical-asset exposure |

Mandatory fields for every value metric: `valuation_scope` (`whole_asset`, `holder_share`, `equity_tranche`, `debt_tranche`, `project_total`, `portfolio_total`), `share_basis` (`at_100_percent`, `at_share`, `unknown`), `valuation_basis`, `valuation_date`, `value_currency`, `gross_or_net_of_debt` (`gross`, `net`, `not_applicable`, `unknown`), and evidence. Value currency is the currency of the reported figure. It is independent of the asset's country.

**Rules (recommended):**

1. `project_cost`, `investment_commitment` and `contract_value` cannot fill `asset_value` or `disclosed_stake_value`, and cannot appear in an owned-value aggregate.
2. An investor's value is shown only as its own `disclosed_stake_value`. A model-computed `asset_value × look_through_interest` is a separate derived metric, `derived_attributed_value`. It requires an approved formula, matching date/basis/currency and both inputs known, and it is labelled "calculated, not reported". The recommended pilot default is that it is disabled.
3. The whole `asset_value` is attached to the asset node only. It is never copied onto each investor, fund, holdco or SPV in the chain. For one asset, the sum of attributed values cannot exceed 100% of `asset_value` beyond rounding tolerance. Exceeding it is a review failure.
4. Gross asset value and equity (net-of-debt) value are not compared or added.
5. Schedule III Column E is a cost-based carrying amount under 17 CFR 210.12-28 and is labelled `valuation_basis: cost`. It is never presented as market or fair value.

## 8. Double-count prevention

**Recommended invariant:** an aggregate declares exactly one `exposure_lane` and one role. The lanes are:

- **Security lane:** positions in shares/units of a listed property company, REIT, infrastructure company or listed fund. These are existing equity claims (`managed_holding`, `fund_holding`, `direct_equity_ownership` of a security).
- **Physical-asset lane:** `asset_title`, `asset_interest`, look-through interests and their value metrics.

The validator rejects:

- A universe mixing a REIT share position with any of that REIT's properties.
- A universe containing both a fund's stake in an SPV and the SPV's title to the asset for the same holder path.
- A universe containing two chain levels of the same economic interest, for example a fund's look-through share and the holdco's share.
- Any use of project cost, commitment or contract value in an owned-value aggregate.

An issuer's balance-sheet properties appear on the issuer's node, never in a shareholder's exposure total. A UI may show "investor X holds shares of REIT R; R reports owning building B" as two separate, labelled facts. It never shows "X owns part of B". A reviewed security-to-asset look-through rule would be a separate, later decision.

## 9. Source and coverage map

Links checked on 2026-10-24 unless marked otherwise. Coverage and rights notes describe what the source says about itself. They are not admissions, which need a #3-style source profile per use.

| Source family | Example (public URL) | Supports | Coverage / limits | Rights / access |
|---|---|---|---|---|
| Official title register (GB) | [HM Land Registry — UK companies that own property in England and Wales (formerly CCOD)](https://www.gov.uk/guidance/hm-land-registry-commercial-and-corporate-ownership-data); [Use land and property data](https://use-land-property-data.service.gov.uk/) | `asset_title` for corporate proprietors, tenure | England and Wales only. Excludes private individuals, overseas companies (separate OCOD) and charities. Current proprietors only, no history. Legal title, not beneficial interest. | Page states OGL v3.0 "except where otherwise stated". Account required. Dataset-specific licence terms need review before any use. |
| Overseas-entity controllers (GB) | [Register of Overseas Entities overview](https://changestoukcompanylaw.campaign.gov.uk/register-of-overseas-entities) | Registrable controllers of foreign entities holding UK land | Lists controllers, not percentage of the land. Contains natural persons, so out of public scope here. | Companies House terms. Natural-person data excluded by this proposal. |
| Price-paid transactions (GB) | Referenced via [Open Knowledge discussion](https://discuss.okfn.org/t/hm-land-registry-price-paid-data-is-it-open/7995) (secondary) | Transaction price at a date | Mostly residential. Includes addresses. | OGL with address-data caveats (secondary source). **Excluded** from scope as residential/address data. |
| Cadastral geometry (EU) | [INSPIRE Cadastral Parcels Technical Guidelines](https://knowledge-base.inspire.ec.europa.eu/publications/inspire-data-specification-cadastral-parcels-technical-guidelines_en) | Parcel geometry and identifiers only | Per the guidelines, rights and owners are out of INSPIRE scope. Parcels do not establish title extent. | Member-state services vary. Not an ownership source. |
| National land registers with access tests | [Berlin: Grundbuch – Einsichtnahme](https://service.berlin.de/dienstleistung/326740/) | Title (if accessible) | German land-register inspection requires a demonstrated legitimate interest (§ 12 GBO). Curiosity and market research do not qualify. | **Inaccessible for this project.** Record as a coverage gap. |
| Beneficial-ownership registers (EU) | [eucrim summary of CJEU C-37/20 and C-601/20](https://eucrim.eu/news/cjeu-no-unrestricted-access-to-data-of-beneficial-owners/pdf/) | Ultimate owners of holdcos/SPVs | The 22 November 2022 judgment invalidated general public access. Many registers now require legitimate interest. | **Restricted.** Natural-person data out of scope regardless. |
| REIT/property company filings (US) | [17 CFR 210.12-28 (Schedule III)](https://www.law.cornell.edu/cfr/text/17/210.12-28) | Property-level description, location, encumbrances, cost basis, acquisition/construction dates for issuer-owned real estate | Cost-based carrying amounts, not fair value. Description "should include type of property" and "geographical location", often city/state only. Small items may be grouped. Some issuers list properties only in aggregate. | SEC public filings. Existing SEC adapter knowledge (#3) applies. |
| Fund / sovereign fund real-estate disclosure | [NBIM — investing in unlisted real estate through a fund](https://www.nbim.no/en/investments/investment-areas/investing-in-unlisted-real-estate-through-a-fund/) | Property-level indirect shares with fund and vehicle shares, as at 31 Dec 2025 | One vehicle. Leverage (LTV) disclosed at a different date. Shows source-stated look-through. | Publisher terms need review. |
| PPP/PFI register (GB) | [PFI and PF2 projects: 2025 summary data](https://www.gov.uk/government/publications/pfi-and-pfi2-projects-2025-summary-data) | `procures_project`, project cost ("capital value"), term, possibly SPV/equity holders (unverified) | As at 31 March 2025. Standard-terms PFI/PF2 only. Excludes LIFT, NPD and MIM. Departmental returns, not audited by HMT (secondary). | Page states OGL v3.0. |
| Public procurement / concessions (EU) | [Tenders Electronic Daily](https://single-market-economy.ec.europa.eu/single-market/public-procurement/digital-procurement/tenders-electronic-daily_en) | `concession_grant`, `contract_value`, award dates | Above-threshold notices. Several award notices per procedure. Changes require reconciliation. eForms format. | Open data via data.europa.eu. Reuse licence to confirm per notice set. |
| Developing-country PPI projects | [World Bank PPI database — about](https://ppi.worldbank.org/en/about-us/about-ppi) | `project_sponsor`, `investment_commitment`, lenders/DFI support, location | Low- and middle-income countries. Projects at financial close. Built from public sources. Self-described as "not fully comprehensive". Small/local operators often omitted. | Free access. No explicit reuse licence located. **Treat as unknown until confirmed.** |
| US power plant ownership/operation | [EIA-860 detailed data](https://www.eia.gov/electricity/data/eia860/) | `operates_asset`, `asset_interest` (owner file: shared/third-party ownership), plant/generator location and capacity, construction cost from 2013 | Generators ≥1 MW. Plants without owner-file rows are wholly owned by the operator. Annual, with an early release and a final release (final 2025 data released 10 Sep 2026). | EIA copyright/reuse policy linked but **not verified** here. |
| US utility financial reports | FERC Form 1 (electric utility annual report) | Utility plant accounts, financial statements | Utilities under FERC jurisdiction only | FERC page returned 403. **Not verified.** |
| Energy asset trackers (NGO) | [GEM Global Integrated Power Tracker](https://globalenergymonitor.org/projects/global-integrated-power-tracker/download-data/) | Owner/operator, location, capacity, status | Compiled research data, not official records. Release-versioned (Sept 2026 citation on page). | Per GEM download pages, generally CC BY 4.0 "unless otherwise noted", with a separate **commercial exemption** process and some NonCommercial sub-datasets. The licence was not shown on the fetched page itself. Download via form. Use as discovery or cross-check only until rights are reviewed. |
| Commercial databases (e.g. property/infrastructure transaction vendors) | n/a | Deal values, ownership chains | Proprietary | **Excluded.** Licensing prohibits redistribution. Not proposed. |

### 9.1 Recorded inaccessible, restricted and opaque areas

- **Inaccessible registries:** land registers with legitimate-interest tests (e.g. Germany), paid per-title extracts (England and Wales individual registers are per-title purchases, a separate channel from the bulk dataset), and jurisdictions with no public cadastre or only in-person access. These are recorded as `gap.category: source` with reason `registry_access_restricted`.
- **Licensing restrictions:** GEM commercial-use exemption, World Bank PPI reuse terms not located, HMLR dataset-specific licence beyond the OGL page statement, and address data embedded in registry outputs. All fail closed under the approved admission rule.
- **Opaque structures:** offshore holdcos, nominee and trust structures, LP interests in unlisted funds, undisclosed JV shares, and EU BO registers closed to the public. The links that can be evidenced are recorded. The undisclosed link is `unknown` (`intermediate_stake_not_disclosed` or `beneficial_owner_not_public`). No inference from control, consolidation or sponsor labels is made.

## 10. Privacy and publication scope

**Recommended limits:**

1. No natural-person holders, lessees, controllers or beneficial owners in the public scope. Claims whose only evidenced holder is a natural person are not collected.
2. No residential property in scope, including residential units within mixed-use assets, below the asset level. Residential tenancies and price-paid data are excluded.
3. Publication location ceiling: `locality`. No street address, postcode, title number, parcel ID, cadastral geometry or site coordinates in the public projection. This holds even for corporate assets, because a single-tenant site can identify individuals.
4. The project does not build, collect or publish an asset registry. Asset records exist only as needed to anchor reviewed claims within an approved bounded case. There is no bulk registry download, mirror or refresh.
5. Restricted identifiers needed for review stay in ignored staging, under a source profile that permits retention. A `.gitignore` rule is not an access control (#2). Anything that may not be committed to a public repository is not committed.
6. Licence attributions (OGL, CC BY) appear in the public source detail where any derived fact is published.

## 11. Synthetic paths

**All entities, assets, values, dates, documents and `synthetic://` URIs below are fictional.** They are acceptance fixtures, not research. Production validation must reject synthetic URIs (#4 V19).

### S-P1 — Property: listed company shares versus building title, with an undisclosed link

- **Evidence.**
  - `SYN-P1-D1`, `synthetic://property/P1/register/v1`: Example Land Office register snapshot as at 2025-03-31. Title holder for asset `ast_SYN_TOWER` (office building, location XA / XA-01 / "Example City", precision `locality`) is SPV `Tower PropCo Ltd`, tenure freehold.
  - `SYN-P1-D2`, `synthetic://property/P1/reit-10k/v1`: Example REIT annual report, FY2024, as at 2024-12-31. Subsidiary schedule: "Tower PropCo is a subsidiary of Holdco H". Property schedule row: "Example Tower, Example City; encumbrances 40; gross carrying amount 120 (cost basis), USD".
  - `SYN-P1-D3`, `synthetic://property/P1/13f/v1`: Manager M reports 1,000 shares of Example REIT, reported value USD 50, as at 2025-06-30.
- **Claims.** `asset_title(Tower PropCo → ast_SYN_TOWER)` dated 2025-03-31. `subsidiary_of(Tower PropCo → Holdco H)`, stake unknown, reason `not_disclosed`. Holdco H → REIT link: `subsidiary_of`, stake unknown. `asset_value` = 120, `valuation_basis: cost`, `share_basis: at_100_percent`, `valuation_scope: whole_asset`, date 2024-12-31. `encumbrance` = 40. `managed_holding(M → REIT shares)` = USD 50 in the security lane.
- **Accept.** REIT's derived interest in the tower is `unknown` (intermediate stake not disclosed). Title, cost carrying amount and encumbrance stay on the asset with their own dates. M's position stays a security-lane fact.
- **Reject.** M "owns" part of the tower. USD 50 + USD 120 in one total. REIT interest = 100% from "subsidiary". Carrying amount 120 shown as market value. Asset location inferred from M's or the REIT's domicile. Mixing the 2025-03-31 register date and the 2024-12-31 schedule into one "current" view without labels.

### S-I1 — Infrastructure: concession, SPV, operator, lender and investors in a chain

- **Evidence.**
  - `SYN-I1-D1`, `synthetic://infra/I1/award/v1`: Example Roads Authority award notice, awarded 2020-05-01. Concession for toll road project `prj_SYN_ROAD` to `RoadCo SPV`, effective 2020-07-01 to 2050-06-30 (end inclusive). Contract value EUR 900.
  - `SYN-I1-D2`, `synthetic://infra/I1/ppp-register/v1`: PPP register as at 2024-03-31. Capital value (project cost at financial close) EUR 800. Title to the road remains with the Authority. Equity holders: Fund F 60%, Builder B 40%.
  - `SYN-I1-D3`, `synthetic://infra/I1/spv-accounts/v1`: RoadCo accounts FY2023. Senior loan from Bank L, EUR 550, secured on concession rights. O&M operator `OpCo O`.
  - `SYN-I1-D4`, `synthetic://infra/I1/fund-report/v1`: Fund F annual report, as at 2023-12-31. Investors' disclosed stake value for RoadCo is EUR 120 (fair value, at share, net of debt). Fund F's LP investor list is not published.
- **Claims.** `asset_title(Authority → ast_SYN_ROAD)`. `concession_grant(Authority → RoadCo, scope prj_SYN_ROAD)` with term. `direct_equity_ownership(F → RoadCo)` 60% and `(B → RoadCo)` 40%, as at 2024-03-31. `lends_to(L → RoadCo)` EUR 550, `security_interest_evidenced: true`. `operates_asset(OpCo O → ast_SYN_ROAD)`, stake `not_applicable`. `project_cost` EUR 800, `contract_value` EUR 900, `disclosed_stake_value(F)` EUR 120. LP interests in F are `unknown`, reason `beneficial_owner_not_public`.
- **Accept.** Five distinct roles. F's owned value shown only as its disclosed EUR 120 at 2023-12-31. The Authority holds title while RoadCo holds a dated concession. The road's location is independent of F's domicile and the EUR currency.
- **Reject.** F "owns 60% of an EUR 800 road" (= EUR 480). EUR 800 or EUR 900 attributed to F, B and RoadCo each. Lender L as a 0% or any-% owner. Operator O as owner. RoadCo as title holder. Concession treated as open-ended after 2050-06-30. LP investors assigned a share of F's interest. Equity percentages (2024-03-31) combined with the fund value (2023-12-31) as one date.

### 11.1 Proposed validator acceptance tests (specifications only)

| ID | Condition | Required result | Fixture |
|---|---|---|---|
| A01 | Stake metric on `operates_asset`, `manages_asset`, `lends_to`, `concession_grant` or `procures_project` | Reject type/metric mismatch | S-I1 |
| A02 | Chain link stake unknown; derived look-through requested | `unknown`, reason retained; no 0/100 default | S-P1 |
| A03 | Aggregate mixes security-lane and physical-asset-lane claims | Reject | S-P1 |
| A04 | `project_cost` / `contract_value` / `investment_commitment` used as owned value | Reject | S-I1 |
| A05 | Whole-asset value attached to multiple chain parties, or attributed sum > 100% of the asset | Reject / review failure | S-I1 |
| A06 | `location_country` missing evidence or copied from an entity's domicile or a currency | Reject the location claim | S-P1 |
| A07 | Concession or lease without term fields, or open `effective_to` read as current | Quarantine / no "current" label | S-I1 |
| A08 | Cost-basis value labelled market or fair | Reject basis mismatch | S-P1 |
| A09 | Natural-person holder, street address or parcel ID in public projection | Block publication | — |
| A10 | Source-stated look-through differs from link product | Preserve both; flag; no overwrite | NBIM-style |

## 12. One bounded future case per asset type (not authorized)

Each case needs its own source profile, rights review, identity review and maintainer approval before any collection. Both are capped well below the existing 30-claim batch limit.

**Property case (recommended candidate): one US-listed equity REIT's Schedule III for one fiscal year.**
Scope: at most 25 properties from one 10-K Schedule III, with the REIT as reporting issuer. Fields: description, property type, location at locality/state precision, encumbrances, cost-basis carrying amount, acquisition/construction dates. The REIT's existing 13F-reported holders stay in the security lane. The case demonstrates that the REIT's buildings appear on the issuer and never in shareholders' totals. Subsidiary/SPV title links are recorded only where the filing states them, otherwise `unknown`. Exit criteria: A03, A06 and A08 pass; no fair value is inferred; no address published. Open question: whether a selected REIT lists properties individually rather than in aggregate.

**Infrastructure case (recommended candidate): one UK PFI project from the HM Treasury/IPA 2025 summary data.**
Scope: one project, as at 31 March 2025, under OGL v3.0. Roles: procuring authority, SPV, `project_cost` (capital value), contract term, and equity holders only if the dataset states them. Optional cross-check with the SPV's filed accounts for `lends_to` evidence. Exit criteria: A01, A04, A05 and A07 pass, and the authority/SPV/lender/operator roles stay distinct. Alternative if the PFI fields prove insufficient: one jointly owned US plant from EIA-860 (owner file plus operator), pending EIA reuse-policy verification.

## 13. Acceptance-criteria checklist

| Criterion (#15) | Where addressed | State |
|---|---|---|
| [x] Owner, operator, manager, lender and concession holder have different relationship types. | §5 matrix and role separation rules; S-I1; A01 | Specified (proposal) |
| [x] Intermediate holding structures retain evidence; undisclosed stakes are unknown. | §7.2; §9.1 opaque structures; S-P1, S-I1; A02, A10 | Specified (proposal) |
| [x] Asset location is independent of investor domicile and valuation currency. | §6.2; §7.3 currency rule; S-P1; A06 | Specified (proposal) |
| [x] Physical assets and securities representing exposure cannot be double-counted in one aggregate. | §8 lanes; S-P1; A03, A05 | Specified (proposal) |
| [x] Valuation fields cannot confuse total project cost with owned asset value. | §7.3 metric types and rules 1–5; S-I1; A04, A08 | Specified (proposal) |
| [x] The proposal defines privacy/source limits and does not collect or publish an asset registry. | §9, §9.1, §10; A09; nothing collected | Specified (proposal) |
| [x] Deliverables: ADR, role matrix, source/coverage map, synthetic paths, bounded cases | §3, §5, §9, §11, §12 | Draft complete; review pending |

Checked boxes mean the proposal addresses the criterion. They do not mean it is approved or implemented.

## 14. Assumptions, gaps and decisions needed

### Assumptions

- The equity foundation contract (#4 envelope, statuses, lineage) applies unchanged to the new predicates and metrics.
- Public official sources are preferred, and NGO trackers are discovery or cross-check aids. Jurisdiction-specific legal meanings (tenure, concession, title) attach to each source profile and are not universal legal opinions.
- First use is explanatory, not comprehensive: the cases demonstrate semantics, not coverage of any market.

### Gaps

- Not verified: FERC Form 1 page (403), EIA copyright/reuse policy, World Bank PPI reuse licence, GEM licence text on its own licensing page, HMLR dataset-specific licence terms, PFI spreadsheet field list (equity holders, SPV names), PPI investment-amount definitions, and the statement that individual HMLR title registers are a separate per-title paid channel (from general knowledge, not checked).
- No schema, registry kind, validator rule, UI or projection design exists. Asset-lane UI belongs to #7 and needs its own design.
- Identity-resolution rules for asset aliases (plant vs unit, project vs phase) need a #5 extension.
- Leases are modelled only at commercial/asset level. Sub-leases, ground rents and option structures are not specified.
- FX, inflation indexation and revaluation transforms are not proposed. The #4 default (no cross-currency aggregation) stands.

### Decisions needed from the maintainer

1. Approve or revise ADR-P4-01: separate `asset`/`project` kinds rather than reusing entities.
2. Approve the predicate vocabulary in §5, especially whether `project_sponsor` should exist or be folded into `asset_interest` with `stake_basis: source_label`.
3. Approve the two-lane non-mixing invariant and confirm that security-to-asset look-through stays out of scope.
4. Decide whether `derived_attributed_value` (asset value × look-through share) is ever allowed. The recommended default is disabled.
5. Set the public location ceiling. The recommendation is `locality`, with no addresses, title numbers or geometry.
6. Confirm the privacy exclusions: natural persons, residential property, price-paid data and BO registers.
7. Choose whether a property/infrastructure pilot is wanted at all, and if so which bounded case comes first and its claim cap.
8. Assign rights review for the sources marked unknown before any is used.

Completion condition: the maintainer records acceptance or requested revisions. #15 stays open until then. No implementation, collection or publication follows from this document.
