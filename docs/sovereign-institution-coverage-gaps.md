# Sovereign and institutional coverage gaps

Status: plan, 25 October 2026. Inventory of what the map holds today for sovereign investors and large institutions, what is missing, and the order to fill it. Every lane still goes through the existing importer, exact reconciliation and independent source review before admission; nothing here is admitted data.

## 1. What is covered today

Shared portfolio network (SEC Form 13F, 30 June 2026, one snapshot only):

| Type | Filers |
|---|---|
| Asset managers | BlackRock, State Street, Geode, Vanguard Global Advisers (one Vanguard affiliate only) |
| Banks / broker-dealers | JPMorgan Chase, Goldman Sachs, Morgan Stanley |
| Corporate | Berkshire Hathaway |
| Sovereign / central bank | Norges Bank (NBIM), Public Investment Fund, Swiss National Bank |
| Pension | CPP Investments |

Other layers:

- UAE disclosures (`data/uae.json`): 172 reviewed rows across 38 UAE entities (EIA, ADQ, Mubadala group, ICD, Dubai Holding, IHC and others). Its own coverage lanes mark ADIA, northern emirates, family groups and fund interests as incomplete.
- Holder-categories pilot: one example each for bank, pension (TSP), insurer, corporate, private equity and individual. Illustrative, not coverage.
- Institutional pilot: four think-tank roster listings only.

## 2. Structural gaps (apply to every filer)

These matter more than any single missing name.

1. **US-listed only.** 13F covers 13(f) securities. Norges Bank, PIF, SNB and CPP hold most of their equity outside the US; none of that is in the map. Norges Bank's 13F is a small slice of its global portfolio.
2. **One date.** Only 30 June 2026. No history, no change between quarters. The 30 September 2026 13F filings are due by 14 November 2026.
3. **Shares only.** Options, bonds, private equity, real estate, infrastructure and fund interests are excluded by design.
4. **No stake percentages.** Positions are not divided by shares outstanding, so "owns X% of Apple" cannot be shown. Needs a dated, sourced shares-outstanding figure per instrument.
5. **No large-stake filings.** Schedule 13D/13G (5%+ holders) and non-US equivalents (UK TR-1, EU major-holding notices, Japan EDINET large-shareholding reports) are not imported. These are the best sources for sovereign stakes in specific companies.
6. **No fund level.** N-PORT (US mutual fund/ETF holdings) is not used, so a manager cannot be broken down into its funds.

## 3. Sovereign investors missing

Checked against EDGAR full-text search for 13F-HR filings between 1 July and 25 October 2026.

### 3a. File 13F, not imported yet (cheapest: existing importer)

| Institution | Country | SEC CIK | Note |
|---|---|---|---|
| Temasek Holdings | Singapore | 1021944 | Claimed in #52 |
| National Pension Service | South Korea | 1608046 | Claimed in #60 |
| Korea Investment Corporation | South Korea | 1441689 | |
| Mubadala Investment Co | UAE (Abu Dhabi) | 1704268 | Links to existing UAE layer |
| Abu Dhabi Investment Council | UAE (Abu Dhabi) | 1814011 | Mubadala group; check perimeter overlap with Mubadala |
| Saudi Central Bank (SAMA) | Saudi Arabia | 1918181 | Second Saudi state investor next to PIF |
| Alaska Permanent Fund Corp | US (state) | 1582681 | US state-level sovereign fund |

### 3b. Do not file 13F (need other official sources)

| Institution | Country | Best official source | Coverage possible |
|---|---|---|---|
| Norges Bank global portfolio | Norway | NBIM published full holdings list (all equities, annual and half-year) | Complete equity list with % ownership; highest-value single source |
| GPIF | Japan | Annual holdings list in GPIF annual report | Full listed-equity list, yearly |
| Future Fund | Australia | Published semi-annual holdings | Full list |
| NZ Superannuation Fund | New Zealand | Published annual holdings | Full list |
| ADIA | UAE (Abu Dhabi) | Annual review only, no holdings | Only 13D/13G and company disclosures where ADIA is named |
| GIC | Singapore | Annual report only, no holdings | Same: large-stake filings only |
| China Investment Corp / SAFE | China | Annual report only | Large-stake filings only |
| Kuwait Investment Authority | Kuwait | No public holdings | Large-stake filings only (e.g. UK TR-1) |
| Qatar Investment Authority | Qatar | No public holdings | Large-stake filings and company registers (e.g. QIA stakes in listed European companies) |
| HKMA Exchange Fund | Hong Kong | No 13F found | Large-stake filings only |

Direct government ownership (state holds shares itself, not via a fund) is also missing. Examples with clean official sources: Norway's Ministry of Trade stakes (Equinor, Telenor), France's APE portfolio, Germany's federal stakes. This is #10.

## 4. Institutions missing

### 4a. Asset managers

| Gap | Why it matters |
|---|---|
| **The Vanguard Group, Inc.** | Only Vanguard Global Advisers is in. The main Vanguard 13F is the largest single gap in the network |
| FMR LLC (Fidelity) | Top-3 US holder of most large caps |
| Capital Group (Capital Research Global Investors, Capital World Investors) | Separate 13F filers; keep them separate |
| T. Rowe Price, Invesco, Northern Trust, Dimensional, Wellington, Amundi, Allianz | Second tier; add after the top three |

### 4b. Banks

Bank of America, Citigroup, Wells Fargo, BNY and UBS all file 13F. Their 13F mixes client discretion and own-account holdings, the same caveat already applied to JPMorgan, Goldman Sachs and Morgan Stanley.

### 4c. Pensions (all confirmed 13F filers)

CalPERS (#48), CalSTRS (1081019), New York State Common (810265), Florida SBA (938076), Texas Teachers (796848), Wisconsin SWIB (854157), Ontario Teachers' (937567), CDPQ (898286), PSP Investments (1396318), BCI (1228242), OMERS (1053321), HOOPP (1535845), APG (1434819). Non-filers with published lists: ABP/APG global list, AustralianSuper.

## 5. Housekeeping found during this review

- #54 (CPP) and #55 (SNB) are still open and marked `pending`, but both snapshots are on main via #62. They can likely be closed by their owner.
- #9 is marked partly delivered; the remaining Vanguard scope is item 4a above.

## 6. Proposed order

Each step is one isolated batch through the existing pipeline. Claim with `pending` before starting.

| # | Batch | Source | Effort | Value |
|---|---|---|---|---|
| 1 | The Vanguard Group, Inc. 13F | SEC 13F | Low (existing importer) | Very high |
| 2 | FMR and Capital Group 13Fs | SEC 13F | Low | High |
| 3 | Sovereign 13F filers: KIC, Mubadala, ADIC, SAMA, Alaska PF (after #52, #60 land) | SEC 13F | Low | High |
| 4 | 30 September 2026 snapshot for all admitted filers | SEC 13F (due 14 Nov) | Medium: needs a date-aware model, no cross-date sums | High |
| 5 | Shares-outstanding per instrument, to show stake % | Issuer 10-Q/10-K cover pages | Medium | High |
| 6 | NBIM global holdings list | NBIM open data | Medium: new non-SEC importer and identity rules | Very high for sovereigns |
| 7 | Schedule 13D/13G for named sovereigns (ADIA, GIC, QIA, KIA, CIC) | SEC 13D/13G | Medium | High; the only route for non-disclosing funds |
| 8 | Large pension 13Fs (CalSTRS, NY Common, Ontario Teachers', CDPQ, PSP) | SEC 13F | Low per filer | Medium |
| 9 | GPIF, Future Fund, NZ Super published lists | Official publications | Medium | Medium |
| 10 | Direct government stakes (Norway, France, Germany) | Government ownership reports | Medium | Medium (#10) |
| 11 | Non-US large-stake notices (UK TR-1, EDINET) | Regulator feeds | High | Medium |

## 7. Rules that carry over

- Exact-instrument matching only; no name-based merges across filers.
- Never sum values across filers, dates or currencies.
- Unknown stakes stay unknown, never zero.
- A 13F shows investment discretion, not legal ownership; a fund is not its state, and a manager is not its clients.
- Check reuse terms for every non-SEC source and record them.
