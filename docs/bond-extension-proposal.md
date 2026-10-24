# Assets map: bond and debt-security extension roadmap

Status: **Proposal accepted 2026-10-24; bounded pilot implemented.**
Prepared: 2026-10-24.
Ticket: [#14](https://github.com/Eduard20/assets-map/issues/14), under [tracker #1](https://github.com/Eduard20/assets-map/issues/1). Depends on #2 (architecture), #4 (claims and metric semantics), #5 (identity) and #12 (integration/acceptance).

This began as a planning document. On 2026-10-24 the maintainer accepted it and asked for the bounded pilot in §8. That pilot is implemented as an isolated, closed-by-default layer; see [§11](#11-implemented-pilot). It does not change the v1 equity contract, the 13F share view or any existing dataset. Wider collection, ingestion or a v2 contract still need their own approvals. Every "recommended" item below is a recommendation awaiting the maintainer's decision; the only **approved** decisions referenced are the existing 18 October 2026 bounded-foundation decision and the shares-only scope that follows from it.

## 1. Summary of recommendations

1. **Debt is a separate asset class, not a new share class.** Add `asset_class: debt` alongside the current `equity` constant. Debt instruments are separate registry securities under the same issuer entity as its shares. No debt metric may populate an equity, beneficial or voting field.
2. **Instrument terms, outstanding amounts, holdings and valuations are four separate record families.** Each has its own evidence, source type and dates. A prospectus term is not an outstanding amount, an outstanding amount is not a holding, and a price is not a term.
3. **Face amount, market value, share of an issue and portfolio weight are distinct metric types** with distinct units and named denominators. Face is never divided by market value, or the other way round.
4. **Holder coverage is always partial unless a complete register is evidenced.** Public sources describe some holders: funds, insurers, central banks and aggregates. Undisclosed principal is an explicit gap. It is never shown as an "other holders" entity or inferred as a residual owner.
5. **The first slice excludes lending, loans, repo, securities lending, derivatives, ABS/MBS pools and municipal bonds.** It is limited to plain sovereign and corporate bonds and notes with fixed, floating or zero coupons and optional inflation indexing.
6. **No proprietary instrument identifier becomes a canonical key** without a separate rights decision. CUSIP values and US-prefixed ISINs are flagged as licensing-uncertain.
7. **A bounded future pilot:** one sovereign issuer and one corporate issuer, at most two instruments each, at most 30 candidate claims. Implementation and ingestion each need their own later approval.

## 2. Scope boundaries

| In the initial debt slice (if approved) | Out of the initial slice |
|---|---|
| Sovereign and corporate bonds/notes/bills issued as transferable securities | Bilateral and syndicated loans, private credit, trade credit |
| Fixed, floating, zero-coupon; inflation-indexed principal as a flagged term | Derivatives (CDS, futures, swaps, options), structured notes with derivative payoffs |
| Optionality recorded as terms (call/put/sink schedule), not valued | Repo, reverse repo, securities lending and collateral positions |
| Convertible/exchangeable bonds recorded as debt with an `equity_linked` flag | ABS/MBS/CLO pools, pool factors, amortization tracking |
| Fund, insurer and central-bank holding disclosures under explicit perimeters | Municipal securities (EMMA reuse restrictions, §6) |
| Issuer-level outstanding totals as aggregate observations | Ratings (third-party licensed), yield curves, real-time prices |

Convertibles stay debt claims until a source evidences conversion into shares. The existing 13F share view excludes 858 option, principal, warrant/right and explicit debt-class rows (tracker #1). Those rows stay excluded. Any later display of them as `managed_holding` debt positions with a face-amount unit is a separate decision (§10, D8).

## 3. Schema-extension ADR (proposed)

**Context.** The v1 contract (`data-foundation/schemas/*-v1.schema.json`) fixes `asset_class: equity`. It allows `instrument_kind` ∈ {`common_equity`, `preferred_equity`, `fund_unit`}, metric units {`shares`, `fund_units`, `USD`, `EUR`, `GBP`, `NOK`, `percent`}, and denominator kinds built around equity and portfolios. Currency codes are currently used as units. This works for reported USD values but cannot tell a face amount in EUR apart from a market value in EUR.

**Decision (recommended).** Add a v2 contract family alongside v1. Do not edit v1 in place. v1 batches remain valid and unchanged.

### 3.1 Roles and identities

| Concept | Registry representation | Notes |
|---|---|---|
| **Issuer** | Existing `entity` (`legal_entity` or `government`) | One entity can issue both shares and debt. Equity claims target share-class securities; debt claims target debt securities. Issuer identity is shared, while the claims stay separate. |
| **Obligor / guarantor** | Entity, plus a debt-specific `guaranteed_by` claim | The obligor can differ from the issuer, e.g. a finance subsidiary issuing under a parent guarantee. A guarantee is not ownership and not control. |
| **Debt-management office / fiscal agent** | Entity with role `issuing_agent_for` | The UK DMO or the Finanzagentur issues on behalf of the sovereign. It is a publisher and agent, never the obligor. |
| **Programme** (shelf/MTN/EMTN) | Optional `debt_programme_id` on the instrument | A programme is a container. It has no outstanding amount of its own unless a source states one. |
| **Debt instrument** | `security` with `instrument_kind: debt_security` and a `debt_subtype` (`bill`, `note`, `bond`, `frn`, `inflation_linked`, `zero_coupon`, `convertible`) | This is the economic line that a holding refers to. |
| **Tranche / series** | `tranche_id` under the instrument, with `fungible_with` and `consolidation_date` | Reopenings, taps and further issues add tranches. A tranche may carry a temporary identifier until consolidation. Non-fungible 144A and Reg S lines are separate securities linked by `same_issue_group_id` (§5.5). |
| **Holder** | Fund, insurer, central bank, person, government entity | Same roles as in #4. The holder role is evidenced per source perimeter. |
| **Intermediary** | Custodian, nominee, depository (e.g. a common depositary), trustee, paying agent, underwriter | Record title with a depository is not beneficial holding. An underwriter allocation is not a holding. |
| **Manager** | Existing manager entity, `manages_fund`, `managed_holding` | Unchanged semantics. A manager's discretion over debt is not a creditor position of the manager. |

### 3.2 Predicates

Recommended approach: **reuse the holder-role predicates and add only debt-specific ones.**

- Reuse unchanged: `fund_holding`, `managed_holding`, `manages_fund`, `record_ownership`, `custody`, `subsidiary_of`.
- Add `direct_debt_holding`, the own-account creditor position. It is the debt counterpart of `direct_equity_ownership`, but it is never interchangeable with it and is never aggregated with it.
- Add `debt_issued_by` (instrument → issuer, registry-level), `guaranteed_by` (instrument → guarantor) and `issuing_agent_for` (agent → sovereign).
- **Validator rule (recommended):** `direct_equity_ownership`, `beneficial_ownership`, `voting_authority` and `control_assertion` are rejected when the target is a debt security. The exception is a source-stated, separately reviewed creditor-rights assertion, which is deferred to a later scope. For example, bondholder consent rights do not equal shareholder votes. A bond position never produces an equity percentage, a voting percentage or a control inference.

### 3.3 Instrument terms record

`instrument_terms` is a claim family with its own evidence, separate from holdings. Each field uses the #4 value envelope `{value, availability, reason, precision, qualifier, evidence_ids}`.

| Field | Meaning |
|---|---|
| `terms_source_kind` | `final_prospectus`, `pricing_supplement`, `final_terms`, `term_sheet_fwp`, `auction_announcement`, `auction_result`, `dmo_register`, `regulatory_reference_data`, `issuer_report` |
| `terms_effective_from` / `terms_effective_to` | Validity of the stated terms. Amendments, consent solicitations and exchanges create new revisions. |
| `currency_of_denomination` | ISO 4217 code of the principal. It is distinct from the payment currency (`payment_currency`, for dual-currency bonds) and from any reported value currency. |
| `denomination_minimum` / `denomination_increment` | Face units, e.g. 1,000 or 100,000 of the currency. |
| `issue_date`, `dated_date`, `first_coupon_date`, `maturity_date` | Dates as stated in the source. A perpetual bond has `maturity_date: not_applicable` with reason `perpetual`. |
| `coupon_type` | `fixed`, `floating`, `zero`, `step`, `inflation_linked_fixed_real`, `other`. |
| `coupon_rate` / `reference_rate` / `spread_bps` / `coupon_frequency` / `day_count` | Kept as stated in the source. A floating coupon is not resolved to a numeric rate in the terms record. |
| `principal_indexation` | `none` or `{index_id, base_index_value, lag}`. It is required for inflation-linked bonds so that unindexed and indexed principal are never confused. |
| `seniority` / `security_status` | `senior_unsecured`, `senior_secured`, `subordinated`, `junior_subordinated`, `unknown`, kept exactly as the source states. It says nothing about recovery. |
| `optionality` | Call, put and sink schedules (dates, prices, make-whole flag) and conversion terms (ratio, underlying security ID). Only the terms are recorded; no option value is computed. |
| `issued_amount_at_tranche` | Face amount of this tranche at issuance. It is a term of the tranche, **not** the current outstanding amount. |
| `governing_law` / `listing_venues` | Context only. |

### 3.4 Outstanding-amount observation

`outstanding_principal` is an **observation of the issue at a date**. It is not part of the terms. It changes with reopenings, buybacks, calls, conversions and exchanges.

Required fields:

- `outstanding_scope`: one of `tranche`, `security_line` or `same_issue_group`.
- `as_of_date` and the source (DMO register, MSPD Table III, issuer report).
- `face_currency`.
- `indexed`: true or false, to say whether inflation uplift is included.
- `held_by_issuer_excluded`: true, false or unknown, for treasury holdings and buybacks not cancelled.

Later outstanding observations never retroactively change the denominator used for an earlier holding date.

### 3.5 Holding and valuation fields

| Field | Meaning |
|---|---|
| `face_amount` | Principal held, in `face_currency`, with `unit: face_amount`. For an inflation-linked bond, `face_basis` is `unindexed` or `indexed`. |
| `reported_value` | Value as reported by the source, with `value_currency`, `valuation_basis` (`market`, `fair`, `amortized_cost`, `book`, `nominal`, `unknown`), `valuation_date` and `price_convention`. The existing `cost` enum stays; add `amortized_cost` for insurer and statutory sources. |
| `price_convention` | `clean`, `dirty` or `unknown`. It records whether `reported_value` includes accrued interest. **Unknown is the default**, because many filings do not state it. |
| `accrued_interest` | A separate amount, only when the source states it. It is never derived silently from terms. |
| `clean_price` / `dirty_price` | Unit `price_per_100_face`, with a price source and a price date. |
| `fx_rate` | Only as a reviewed transform with source, pair, direction and date (#4 §6.3, rule 4). |

The `reported_value` currency moves from `unit` to `value_currency`. In v2, `unit` describes the kind of quantity: `face_amount`, `currency_value`, `price_per_100_face`, `percent`, `shares` or `fund_units`.

**Consequences.** Shares and bonds can share issuers, holders, evidence, perimeters and review machinery without sharing metric meaning. The cost is a v2 contract, validator branches and new UI lanes. v1 releases stay reproducible.

**Alternatives rejected.**
- (a) Treating bonds as a new `instrument_kind` under `asset_class: equity`. This invites equity percentages.
- (b) Folding terms into each holding row. This duplicates terms, mixes their dates with holding dates and loses amendment history.
- (c) A single "amount" field with a currency unit. This cannot tell face apart from value.

## 4. Relationship and metric dictionary

### 4.1 Metric types

| `metric_type` | Unit | Numerator | Denominator (`denominator.kind`) | Forbidden uses |
|---|---|---|---|---|
| `face_amount` | `face_amount` + `face_currency` | Principal held | none | Adding it across currencies; adding it to `reported_value`; adding it to share counts |
| `reported_value` | `currency_value` + `value_currency` | Source value, with its basis and convention | none | Treating it as market value when the basis is amortized cost or unknown |
| `outstanding_principal` | `face_amount` + `face_currency` | Issue-level face | none | Using it as a holding; using it at a date other than its own |
| `share_of_issue_outstanding` | `percent` | Holder `face_amount` | `outstanding_principal` (new kind), same scope, same face currency, same indexation basis, as of the holding date or a reviewed reconciled date | Market value ÷ face; holder face ÷ issuer-wide debt; summing holders into a "100% register" |
| `share_of_issuer_debt_disclosed` | `percent` | Face across several of the issuer's instruments | `issuer_outstanding_debt` (new kind), only when the source defines a total and its scope | Mixing currencies without a reviewed FX transform; mixing tranches with different as-of dates |
| `portfolio_weight` | `percent` | `reported_value` | `net_assets` (labelled "% of fund net assets") or `selected_disclosed_value` (labelled "% of disclosed [scope] value") | Face ÷ net assets; a denominator in a different currency, date or valuation basis |
| `accrued_interest` | `currency_value` | Source-stated amount | none | Implicit derivation from coupon terms in the first slice |
| `clean_price` / `dirty_price` | `price_per_100_face` | Source-stated price | none | Mixing price sources or dates in one comparison |

`equity_percentage`, `beneficial_percentage` and `voting_percentage` are **not applicable** to debt targets. They carry `availability: not_applicable` with reason `not_defined_for_debt`.

### 4.2 Denominator kinds to add

| Kind | Definition |
|---|---|
| `outstanding_principal` | Face outstanding of a stated scope (tranche, security line or same-issue group) at an `as_of_date`, with indexation and issuer-held treatment stated |
| `issuer_outstanding_debt` | A source-defined total of an issuer's debt in a stated perimeter. Example: marketable debt held by the public in MSPD. It is never constructed by summing the instruments the project happens to know about. |
| `disclosed_holder_face` | The sum of disclosed holders' face for one security line at one date. It is used only for **coverage**, never as a share-of-issue denominator. |

### 4.3 Coverage measures (debt-specific)

- `disclosed_holder_coverage = Σ disclosed non-overlapping holder face_amount / outstanding_principal`. Same line, date, currency and indexation basis. The result is always labelled "share of outstanding principal attributed to disclosed holders". The complement is shown as **undisclosed**, and it is never shown as a holder.
- `terms_completeness` means the number of required term fields with `availability: known` out of the number required. It is a count ratio, not a value ratio.
- Coverage is always paired with `coverage_status`. `complete_for_declared_scope` is allowed only for a source that evidences a complete register for the declared scope. No public source identified in §6 does so for a widely held bond.

## 5. Dates, aggregation and double-count rules

### 5.1 Date dimensions per record family

| Family | Dates carried |
|---|---|
| Instrument terms | `published_at` of the prospectus or announcement, `terms_effective_from/to`, `issue_date`, `maturity_date`, schedule dates |
| Outstanding observation | `as_of_date`, `published_at` |
| Holding | `report_date` or `report_period`, `published_at`, `retrieved_at`; `effective_date_basis` (usually `reporting_snapshot`) |
| Valuation | `valuation_date`, price source, `price_convention`; it may differ from `report_date` |

All of these keep #4's separation of reporting, effective, publication, retrieval and model-revision time.

### 5.2 Mandatory compatibility checks (in addition to #4 §6.3)

1. **Currency:** no sum or ratio across `face_currency` or `value_currency` values without a reviewed FX transform. The pilot default rejects it.
2. **Tranche and line:** no sum across non-fungible lines unless the target is an explicit `same_issue_group` view. A pre-consolidation temporary line is not added to the main line before `consolidation_date`.
3. **Reporting period:** share of issue requires the holding date and the outstanding as-of date to match, or a reviewed reconciliation showing no reopening, buyback or call in between. A mixed-date sum is rejected by default.
4. **Indexation:** unindexed and indexed principal are never mixed.
5. **Valuation basis and convention:** `market` with `amortized_cost`, or `clean` with `dirty` or `unknown`, cannot be added or compared as like quantities.
6. **Asset class:** a debt metric and an equity metric for the same issuer are never added into a single "exposure to issuer" number in the first slice. Issuer views show separate **equity** and **debt** lanes.

### 5.3 Fund look-through and double counting

- Use either the manager layer or the fund layer, never both (#4 rule 7, `docs/manager-overlap-acceptance.md`).
- A fund's holding of another fund's units is a `fund_holding` of `fund_unit`. It is not that fund's bond portfolio. Look-through multiplication (`fund_unit` share × underlying bond face) is **deferred**. If it is approved later, it requires both funds' reports at the same date, an evidenced unit share, and lineage pinning both `claim_revision_ids`.
- Central-bank, insurer and fund holdings of the same line may overlap through intermediaries, e.g. a fund held by an insurer. Unknown overlap blocks an additive "disclosed holders" total. The holders are shown side by side instead.
- Custodial aggregates (TIC, the ECB SHSS) are statistical aggregates by country or sector. They are never added to named-holder positions, and their custodial basis is labelled.
- Stripped securities (principal and coupon strips) and pre-consolidation tranches are mapped to their parent line before any coverage calculation. If the mapping is unknown, a gap is recorded.

### 5.4 Missing holders

Missing holders are recorded as explicit `gaps` with category `coverage`, and reason `holder_register_not_public`, `below_disclosure_threshold`, `held_via_depository` or `source_not_admitted`. A holder absent from a later report is not a disposal and not a zero (#4 §5.2). The model has no "complete bond register" state unless a complete register is evidenced.

### 5.5 Identifier families for one economic issue

A single offering can carry 144A, Reg S and temporary identifiers. These are separate securities linked by `same_issue_group_id`, with evidence from the prospectus. A share of issue is computed against the line or the group as declared. The two are never mixed.

## 6. Source-discovery map

Status key: **V** means verified on 2026-10-24 by fetching the page or by consistent official search results. **P** means partly verified, for example the landing page was confirmed but not the field list. **U** means not verified at check time. All rights and reuse assessments are preliminary and need #3-style source admission.

| ID | Source | Role | Coverage | Reuse / gaps | Status |
|---|---|---|---|---|---|
| B1 | US Treasury Fiscal Data, [Monthly Statement of the Public Debt](https://fiscaldata.treasury.gov/datasets/monthly-statement-public-debt/) | Sovereign outstanding (summary; Table III CUSIP-level detail in the [published PDF](https://fiscaldata.treasury.gov/static-data/published-reports/mspd-entire/MonthlyStatementPublicDebt_Entire_202212.pdf)) | Monthly, as of month-end, published on the 4th business day; millions of USD in the API summary | The [API documentation](https://fiscaldata.treasury.gov/api-documentation/) states the data is "offered free, without restriction". The machine-readable endpoint name for the marketable detail was not confirmed. CUSIP values are embedded (§6.1). | V (dataset, licence); P (Table III endpoint) |
| B2 | TreasuryDirect [Auction Query](https://www.treasurydirect.gov/auctions/auction-query/) and [auctions](https://www.treasurydirect.gov/auctions) | Sovereign terms per auction and reopening | CSV/JSON/TSV/XML downloads | Field list not confirmed on the page. Fiscal Data also hosts an auctions dataset whose endpoint path was found only in secondary references. | P |
| B3 | NY Fed [SOMA holdings](https://www.newyorkfed.org/markets/soma-holdings) | Named central-bank holder of Treasuries by security | Historical download available | Terms of use not checked. It is one holder only, not a register. | P |
| B4 | Treasury [Major Foreign Holders](https://ticdata.treasury.gov/resource-center/data-chart-center/tic/Documents/mfhhis01.html) | Country aggregate | Monthly; custodial basis, per Treasury's caveat | Not attributable to named holders. Statistical aggregate only. | V |
| B5 | SEC [Form N-PORT data sets](https://www.sec.gov/data-research/sec-markets-data/form-n-port-data-sets) and [Form N-PORT](https://www.sec.gov/about/forms/formn-port.pdf) | Fund holder positions: principal amount, currency, USD value, % of net assets, debt terms | Quarterly data sets of public filings; money-market funds excluded. Public cadence is quarter-third-month holdings at a lag, with changes proposed and delayed ([IC-35538](https://www.sec.gov/files/rules/final/2025/ic-35538.pdf); [2026 proposal summary](https://www.alston.com/en/insights/publications/2026/02/sec-proposal-relaxes-form-n-port-disclosure), secondary) | SEC disclaims accuracy; fields are omitted versus the filings. Item-level debt field locators were not re-read in this pass (the PDF text was not extractable). Identifiers include CUSIP/ISIN (§6.1). | V (data sets); P (item fields, cadence) |
| B6 | SEC EDGAR 424B2/424B5 prospectus supplements and FWP term sheets; [EDGAR full-text search](https://www.sec.gov/edgar/search/); rules [17 CFR 230.424](https://www.ecfr.gov/current/title-17/section-230.424) and [230.433](https://www.ecfr.gov/current/title-17/section-230.433) | Corporate terms; final term sheet | SEC-registered offerings only; 144A and Reg S deals are absent | Public filings. FWPs can be superseded by the final prospectus, so the final 424(b) wins only through an explicit amendment chain, not by recency. | P (example FWPs found; eCFR fetch blocked by redirect) |
| B7 | SEC [Official List of Section 13(f) Securities](https://www.sec.gov/rules-regulations/staff-guidance/official-list-section-13f-securities) | Determines which convertible debt appears in 13F | Quarterly list | 13F is a managed-discretion subset that covers only listed convertibles. It is not a bond-holder source. | V (list page) |
| B8 | MSRB [EMMA](https://emma.msrb.org) and its [User Agreement](https://emma.msrb.org/AboutEmma/UserAgreement) | Municipal terms and continuing disclosure | Broad US municipal coverage | **Restrictive.** The agreement prohibits scraping, systematic download, building a database of content, OCR of images and direct linking to PDFs. It is internal use only, and it carries CUSIP and ratings licences. **Recommend excluding EMMA.** | V |
| B9 | ESMA FIRDS ([register](https://registers.esma.europa.eu/publication/searchRegister?core=esma_registers_firds)) and the instructions for full/delta files | EU instrument reference data by ISIN: maturity, nominal, rate for bonds | Instruments in MiFID scope traded on EU venues | The register returned HTTP 502 at check time. Reuse terms not confirmed. Reference data says nothing about holders or outstanding amounts. The UK has the separate [FCA FIRDS](https://www.fca.org.uk/publication/systems-information/fca-firds-tech-spec.pdf). | U (live page); P (secondary) |
| B10 | ECB [Securities Holdings Statistics](https://www.ecb.europa.eu/stats/financial_markets_and_interest_rates/securities_holdings/html/index.en.html); CSDB-based [securities issues statistics](https://data.ecb.europa.eu/methodology/securities-issues) | Aggregate holdings by holder country/sector; issuance aggregates | Quarterly, about t+60 days; market and face value; currency and maturity breakdowns | Published series are aggregates only. Security-by-security CSDB/SHS micro data is not publicly available as a register (inference: only aggregates are described). | V (SHSS page); P (CSDB) |
| B11 | UK DMO [data](https://www.dmo.gov.uk/data): D1A Gilts in Issue, D1D index-linked, D4L Government Holdings of Gilts, D2.1A auctions, D10A syndications | Sovereign terms and outstanding; a government-holder aggregate | Report-level XML for several datasets | Crown copyright; Open Government Licence applicability not confirmed on the data page. | V (reports); U (licence) |
| B12 | Bundesfinanzagentur [Federal securities](https://www.deutsche-finanzagentur.de/en/institutional-investors/federal-securities/) | Sovereign terms and outstanding volume by ISIN; monthly itemised list (PDF/XLSX) | Federal securities | Access notice (jurisdiction/US-person confirmation); reuse terms not found. Bundesbank publishes [prices and yields](https://bundesbank.de/en/statistics/money-and-capital-markets/interest-rates-and-yields/prices-and-yields-of-listed-federal-securities). | V (content); U (reuse) |
| B13 | NAIC annual statement Schedule D Part 1 (bonds); access via [NAIC financial data products](https://content.naic.org/index.php/prod_serv_financial_home.htm) | Insurer holder positions at par, book/adjusted value, fair value | Statutory statements, mainly sold as PDF or bulk under quote | **Paid access; redistribution likely restricted.** Some states provide statements on request ([example](https://www.doi.sc.gov/1047/Accessing-Insurance-Company-Financial-St)). Valuation is mostly amortized cost. | P (access); U (reuse) |
| B14 | GLEIF [LEI mapping](https://www.gleif.org/en/lei-data/lei-mapping) (ISIN-to-LEI relationship files) | Links issuers to ISINs | Partial; depends on participating numbering agencies | Open for the mapping. It is not a complete instrument list. | P |
| B15 | FINRA [fixed-income data](https://www.finra.org/finra-data/fixed-income/about-cna-trade/) (TRACE) | Corporate trade prices | US corporate/agency | Non-commercial use under the user agreement; redistribution needs agreements. **Not recommended** for valuations in the first slice. | P |

### 6.1 Identifier licensing (flag)

- **CUSIP:** The CGS/ABA licence language seen in public contract exhibits ([example](https://go.factset.com/hubfs/Website_Downloads/Third-party%20Terms/cusip_agreement.pdf)) requires a licence for use outside clearing and settlement. It restricts publishing or distributing the database, and it bars building substitute master files. Antitrust litigation over the fees has been [reported](https://www.asppa-net.org/news/2022/3/class-action-suit-challenges-big-cusip-licensing-fees/); its outcome is not verified here. The current registry deliberately has no proprietary instrument namespace. **Recommendation:** treat CUSIPs as source-row locator text kept only in restricted staging. Never use them as a canonical public key without a rights decision.
- **ISIN:** ANNA states that national numbering agencies publish ISIN data freely and that a free ISIN lookup exists ([Federal Reserve-hosted comment letter](https://www.federalreserve.gov/SECRS/2024/November/20241112/R-1837/R-1837_102324_161733_421326575288_1.pdf)). US and Canadian ISINs embed a CUSIP, and their licensing has been disputed. **Recommendation:** non-US/CA ISINs are a candidate `isin` namespace, pending decision D2. US-prefixed ISINs share the CUSIP restriction until decided.
- **LEI:** Open (GLEIF). It is the recommended issuer and holder identifier where available, as in #5.

## 7. Synthetic examples

**All examples are fictional.** Entities, identifiers (`SYN-…`), amounts and `synthetic://` URIs are invented, and production validation must reject them (#4 V19). No real holdings numbers appear.

**D01: shares and bonds of one issuer coexist.** Issuer `SYN-CORP-A` has share class `SYN-A-COM` and bond `SYN-A-5Y-EUR`. Fund F reports, at 2025-06-30, 1,000 shares (of 100,000 outstanding) and EUR 2,000,000 face of the bond.
- Accept: `equity_percentage` = 1% via `outstanding_equity`. Separately, the bond position has `face_amount` EUR 2,000,000 and `equity_percentage: not_applicable`. The issuer view shows an equity lane and a debt lane.
- Reject: "F owns 1% + EUR 2m of A" as one exposure figure. Reject any voting or control inference from the bond.

**D02: face, value, weight and share of issue.** Evidence `synthetic://bonds/D02/v1`. Fund F holds EUR 2,000,000 face of `SYN-A-5Y-EUR` at valuation date 2025-06-30. Clean price is 98.50 and accrued interest is 1.20 (both per 100 face), so the dirty price is 99.70. The source reports value EUR 1,994,000 with `price_convention: dirty`. Fund net assets are EUR 40,000,000 at the same date. Outstanding principal is EUR 500,000,000 as of 2025-06-30, line scope, per a separate issuer report.
- Accept: `portfolio_weight` = 1,994,000 / 40,000,000 = 4.985% of fund net assets. `share_of_issue_outstanding` = 2,000,000 / 500,000,000 = 0.4% (face over face). The clean value of EUR 1,970,000 and accrued interest of EUR 24,000 are separate stated metrics.
- Reject: 1,994,000 / 500,000,000 (value over face). Reject 2,000,000 / 40,000,000 (face over net assets). Reject labelling 4.985% as "share of the bond".

**D03: terms versus outstanding after a reopening.** Sovereign `SYN-SOV` issues `SYN-SOV-10Y` on 2025-02-15 with a tranche of 30,000,000,000 face. It reopens the line on 2025-05-15 with +20,000,000,000. A DMO register shows outstanding 50,000,000,000 as of 2025-05-31. Holder H reports 300,000,000 face as of 2025-03-31.
- Accept: the terms record holds the tranche amounts. The outstanding observations are 30bn (as of 2025-03-31, if evidenced) and 50bn (as of 2025-05-31). H's share of issue at 2025-03-31 is 1% **only if** the 30bn observation at that date is evidenced. Otherwise it is unknown.
- Reject: 300m / 50bn = 0.6% at 2025-03-31. Reject using `issued_amount_at_tranche` as current outstanding.

**D04: currencies and tranches are not summed.** `SYN-CORP-B` has `SYN-B-EUR-2030` (EUR 750m outstanding) and `SYN-B-USD-2030` (USD 1,000m outstanding), both as of 2025-06-30.
- Accept: two lines, each with its own currency.
- Reject: "1,750m of 2030 bonds". Reject an issuer-debt total without a reviewed FX transform and without a source-defined `issuer_outstanding_debt`.

**D05: 144A and Reg S lines.** One offering of USD 600m is split by the prospectus into `SYN-C-144A` (USD 350m) and `SYN-C-REGS` (USD 250m), linked by `same_issue_group_id`. Fund F holds USD 35m of the 144A line.
- Accept: 10% of the 144A line, or about 5.83% of the same-issue group, each labelled with its scope.
- Reject: an unlabelled "5.83% of the bond", or 35/250.

**D06: incomplete holders.** The `SYN-A-5Y-EUR` line has EUR 500m outstanding. Disclosed holders at 2025-06-30 are fund F (EUR 2m), insurer I (EUR 10m) and central bank C (EUR 25m), with no evidenced overlap.
- Accept: `disclosed_holder_coverage` = 37m / 500m = 7.4%, with `coverage_status: partial`. The remaining EUR 463m is an explicit `coverage` gap with reason `holder_register_not_public`.
- Reject: an "Other holders: 92.6%" node. Reject rescaling the three holders to 100%. Reject treating the common depositary's record title as a holder of EUR 500m beneficial principal.

**D07: fund look-through double count.** Fund-of-funds G holds units of fund F. F holds EUR 2m of the bond. Manager M's report also includes F's EUR 2m.
- Accept: a manager-layer view (M) or a fund-layer view (F), and G's `fund_unit` holding as a separate claim.
- Reject: M + F = EUR 4m. Reject attributing a look-through share of F's bond to G without the deferred, approved look-through rule.

**D08: inflation-linked principal.** Bond `SYN-SOV-IL` has unindexed face 1,000,000 and an evidenced index ratio of 1.12345 at the valuation date, so indexed principal is 1,123,450.
- Accept: both values, each labelled with its `face_basis`. Share of issue uses an outstanding amount on the same basis.
- Reject: an indexed holding divided by unindexed outstanding.

**D09: amortized cost versus market.** Insurer I reports EUR 10,000,000 par and EUR 9,900,000 `amortized_cost`. Fund F reports a `market` value.
- Accept: both values, kept separate by basis.
- Reject: summing I's and F's values into one market-value total.

**D10: out-of-scope instruments.** A source row describes a term loan, a CDS or a repo collateral position.
- Accept: preserve the row in staging with gap reason `out_of_scope_asset_class`.
- Reject: admitting it as a debt-security holding.

**D11: call exercised, stale outstanding.** Terms show a call notice effective 2025-09-01 for half of a line. The last outstanding observation is dated 2025-06-30.
- Accept: the 2025-06-30 outstanding stays valid for 2025-06-30 holdings. Holdings after 2025-09-01 have share of issue = unknown until a new outstanding observation exists.
- Reject: computing the post-call outstanding from terms without evidence of the amount actually redeemed.

## 8. Bounded pilot specification (approved 2026-10-24; implemented in §11)

**Objective.** Demonstrate the v2 contract end-to-end on the smallest real slice: terms, outstanding amounts, a few disclosed holdings and coverage gaps, kept fully apart from the equity release.

**Bounds.**
- One sovereign issuer with at most two instruments, and one corporate issuer with at most two instruments.
- At most 30 candidate claims in total, as in the current pilot cap.
- One reporting snapshot date per holder source.

**Candidate selection criteria (recommended, not chosen):**
- **Sovereign:** a debt office with an official itemised outstanding list and verifiable reuse terms. Option S-1 is Germany (B12): ISIN-identified, but reuse is unverified. Option S-2 is the United States (B1/B2/B3): reuse is clear, but CUSIP namespace restrictions apply (§6.1). The UK (B11) is a fallback once Open Government Licence coverage is confirmed.
- **Corporate:** an SEC-registered issuer that already has a share class in the admitted 13F release, so that D01 coexistence is tested on real data. It needs 424B2/424B5 final terms (B6) for two fixed-rate senior notes in one currency, and an issuer report evidencing outstanding amounts.
- **Holders:** N-PORT (B5) positions for at most three named funds at one public quarter-end date. For the US sovereign option, SOMA (B3) may be used as one named holder. NAIC, EMMA, TRACE and FIRDS are excluded from the pilot.

**Preconditions (each a separate approval):**
1. Acceptance of this roadmap with decisions D1–D10 recorded.
2. A v2 schema and validator implementation PR, using synthetic fixtures D01–D11 only.
3. Source admission per source, document and use (B-IDs above), including the identifier-namespace decision.
4. An ingestion approval for the named instruments and holder filings.
5. A publication/cutover approval for a separately selectable "Debt disclosures (pilot)" view. It is never merged into the share view's default.

**Success metrics.**
- Every admitted claim has evidence plus a locator, the correct record family and its own dates.
- Zero cross-currency, cross-tranche, cross-basis or mixed-date aggregates pass the validator.
- Coverage gaps are shown for 100% of lines.
- Equity release hashes are unchanged.

**Go/no-go.**
- *No-go* if an outstanding amount cannot be evidenced at the holding date for at least one line per issuer.
- *No-go* if identifier rights are unresolved for the chosen namespace.
- *No-go* if any equity-lane metric changes.

**Stop conditions.**
- Any source requires scraping or licensed data.
- A holder total would exceed outstanding beyond the documented rounding tolerance.
- Overlap between holder layers is unknown, in which case holders are shown side by side only.

## 9. Acceptance-criteria checklist

| Criterion (#14) | Where addressed | State |
|---|---|---|
| Shares and bonds can coexist without confusing issuer equity with debt claims. | §3.1, §3.2 validator rule, §4.1 (equity metrics `not_applicable`), §5.2 rule 6; D01 | Specified; review pending |
| Face amount, market value and portfolio weight have distinct units and denominators. | §3.5, §4.1, §4.2; D02, D08, D09 | Specified |
| Instrument terms, holdings and valuations carry their own dates and evidence. | §3.3–§3.5, §5.1; D03, D11 | Specified |
| Different currencies, tranches and reporting periods cannot be silently aggregated. | §5.2 rules 1–5, §5.5; D03, D04, D05 | Specified |
| Missing holders are explicit disclosure gaps, not an inferred complete bond register. | §4.3, §5.4; D06 | Specified |
| Implementation and ingestion remain separate future approvals. | Status line, §1 item 7, §8 preconditions 2–5 | Specified |

## 10. Assumptions, gaps and decisions needed

### Assumptions
- #4's claim, evidence and envelope model and #5's identity rules apply unchanged to debt. Only the additions here are new.
- Public holder disclosures for bonds are fragmentary: funds, some insurers, central banks and statistical aggregates. No complete public register exists for widely held bearer or global-note bonds.
- The first slice values nothing itself. It only preserves source-stated prices and values.

### Gaps
- N-PORT item-level debt fields and the current public cadence were not re-read at the field-locator level in this pass.
- The ESMA FIRDS live page was unavailable. The reuse terms of the Finanzagentur, the UK DMO (OGL), the NY Fed, NAIC and FIRDS are unconfirmed.
- The outcome of the CUSIP/ISIN licensing litigation is unknown.
- No real issuer or instrument has been selected, and no source has been admitted or downloaded.
- Creditor rights (consents, acceleration), restructurings, defaults and exchanges are not modelled beyond terms revisions.

### Decisions needed from the maintainer
- **D1.** Approve debt as `asset_class: debt` in a v2 contract family alongside v1.
- **D2.** Identifier namespaces: allow `isin` (non-US/CA)? Keep CUSIP and US ISINs restricted to staging?
- **D3.** Predicate approach: reuse the holder-role predicates and add `direct_debt_holding`, `debt_issued_by`, `guaranteed_by` and `issuing_agent_for`.
- **D4.** Unit vocabulary change (`face_amount`, `currency_value` and `price_per_100_face`, with separate currency fields).
- **D5.** Default `price_convention: unknown`, with no derived accrued interest in the first slice.
- **D6.** Whether a `same_issue_group` share of issue may be displayed, or only line-level shares.
- **D7.** Convertible bonds stay debt with an `equity_linked` flag. No as-converted equity metric.
- **D8.** Whether the 858 excluded 13F principal/debt rows ever surface in a debt lane.
- **D9.** Sovereign pilot choice (S-1 Germany, S-2 United States or UK fallback) and the corporate selection criteria.
- **D10.** Exclude EMMA, TRACE and NAIC from the first slice, pending explicit rights review.

Completion condition: the maintainer records acceptance or requested revisions on #14. The issue stays open until then.

## 11. Implemented pilot

Implemented 2026-10-24 as the separate modal layer **"Bonds and debt securities · Pilot"** (launcher `#bond-launcher`). Files: `src/bond-data.js` (data, validator, compatibility guards), `src/bond-view.js`, `src/bond.css`, `tests/bond.test.mjs`, `tests/browser-bond.mjs`. The layer never enters graph-model, portfolio totals, security equivalence or issuer identity resolution. The equity release is unchanged.

### What was collected

Two issuers, four lines, **17 claims**: 4 `debt_issued_by` relationships, 4 terms records, 4 outstanding observations, 2 holdings and 3 prices. There are also 9 explicit gaps. Every figure was copied from the primary source listed. All sources were retrieved on 2026-10-24.

| Line (project id) | Terms | Outstanding principal | Disclosed holder | Price |
|---|---|---|---|---|
| US Treasury 4.250% Note due 2035-08-15 (`bond-ust-note-2035`) | Fiscal Data auctions record for the original 2025-08-15 issue: coupon, dates, semi-annual, not callable, total accepted USD 56,253,817,500 | MSPD Table III, 2026-09-30: USD 134,934.7665 million, security line (original issue plus two reopenings), not indexed | SOMA, 2026-09-30: par USD 14,977,674,200. Share of issue 11.10% (face ÷ face, same line and date). This matches SOMA's own stated `percentOutstanding` 0.1109993709441814 | Auction price 99.95962 per 100 (2025-08-06), convention unknown |
| US Treasury 1.875% TIPS due 2035-07-15 (`bond-ust-tips-2035`) | Auctions record for the original 2025-07-31 issue, with CPI basis 1982-1984=100 and reference CPI 321.097580 | MSPD, 2026-09-30: USD 63,567.91831011 million, **indexed** (includes the inflation adjustment) | SOMA par USD 2,479,164,800 (unindexed). Inflation compensation of USD 98,993,050.46 is shown separately and never added. Share of issue is **not computed**, because unindexed par does not match indexed outstanding (§5.2 rule 4) | Not admitted (gap) |
| Oracle 4.450% Notes due 2030-09-26 (`bond-orcl-2030`) | 424(b)(2) prospectus supplement dated 2025-09-24: USD 3,000,000,000, 30/360, senior unsecured, make-whole +15 bps, par call 2030-08-26, New York law, not listed | Form 10-K, 2026-05-31: USD 3,000 million | None admitted (gap) | Offering price 99.938 (clean) |
| Oracle 5.200% Notes due 2035-09-26 (`bond-orcl-2035`) | Same prospectus: USD 4,000,000,000, make-whole +20 bps, par call 2035-06-26 | Form 10-K, 2026-05-31: USD 4,000 million | None admitted (gap) | Offering price 99.985 (clean) |

Oracle's LEI 1Z4GXXU7ZHVWFCD8TV52 comes from GLEIF (CC0). Oracle common stock already appears in the 13F share view. The debt lane sits beside it and is never added to it (D01).

### Sources and reuse (checked 2026-10-24)

- U.S. Treasury Fiscal Data API: `auctions_query` and `mspd_table_3_market` on `api.fiscaldata.treasury.gov`. The data is "offered free, without restriction".
- New York Fed SOMA holdings API on `markets.newyorkfed.org`. The Terms of Use (updated 6/9/2023) grant a licence to use, copy and distribute with attribution, and SOMA data is not listed under Use Restrictions. The required notice is displayed. Share-of-issue figures are labelled as this pilot's calculation, not New York Fed content.
- SEC EDGAR on `www.sec.gov`: the Oracle 424B2 and the 10-K borrowings table (R33). sec.gov states that its information "is considered public information and may be copied or further distributed".
- GLEIF LEI record on `api.gleif.org`, under CC0.

The validator allowlists only these four hostnames.

### Enforced by the validator and guards

- Exact field allowlists for each family. The record families are separate, and each record has its own source and dates. A source's as-of date must be on or before its retrieval date. An outstanding or holding date must equal its source snapshot date, with one snapshot date per holder source.
- Equity, beneficial, voting and control predicates are rejected, and so is any equity, voting, beneficial, control or ownership field.
- CUSIP-shaped values, US/CA ISINs and identifier fields are rejected. Instruments use opaque project ids.
- Units are explicit: `face_amount`, `currency_value` and `price_per_100_face`. Share of issue is computed only face ÷ face, at the same line, date, currency and indexation basis. Otherwise it is unknown, with a reason.
- `sumFace` and `sumValues` refuse to add across currency, line, date, indexation basis, valuation basis or price convention, and they refuse unknown conventions. `portfolioWeight` needs a value numerator and a named denominator (`net_assets` or `selected_disclosed_value`) with the same currency and date.
- Every line must carry a holder-coverage gap. Entities named like "other holders" are rejected. The undisclosed share is shown as a gap, never as a node.
- Pilot bounds: one sovereign issuer and one corporate issuer, at most two lines each, at most 30 claims. Every line needs terms and an outstanding observation. Disclosed holders may not exceed outstanding.

### Excluded and why

- **CUSIPs** are withheld (§6.1), although the Treasury APIs return them. Citation URLs filter by date and term, not by CUSIP.
- **Corporate holders (N-PORT):** not admitted. Automated EDGAR access requires a declared contact user agent, which was not configured for this pass. Full N-PORT holdings files could not be read reliably through the fetch tool. Oracle holder coverage is therefore an explicit `source_not_admitted` gap.
- **TIPS price:** the auction record carries adjusted and unadjusted prices, and its basis needs review.
- **Unindexed TIPS outstanding:** not stated by MSPD and not derived.
- **SOMA's TIPS `percentOutstanding` (0.0404186746142682):** its basis is undocumented, so it is not used.
- **Later outstanding for Oracle:** the 10-K date (2026-05-31) is not carried forward.
- **Treasury reopening tranches:** these appear only through the MSPD line observation. They are not separate terms records.
- **Out of scope as in §2:** ratings, TRACE, NAIC, EMMA, FIRDS, issuer-level debt totals, FX transforms and look-through.

