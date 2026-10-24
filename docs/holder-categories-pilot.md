# Bank, pension, insurer and private-holder equity cases: specification and bounded pilot

Status: **Proposal accepted for implementation 2026-10-24 (maintainer instruction); bounded pilot implemented**
Prepared: 2026-10-24. Ticket: [#11](https://github.com/Eduard20/assets-map/issues/11), under [tracker #1](https://github.com/Eduard20/assets-map/issues/1). Builds on #2 (architecture), #3 (sources), #4 (relationship and metric semantics) and #5 (identity). Closest earlier layer: [issuer-to-shareholders pilot](issuer-shareholders-pilot.md).
Scope: the issue asked for planning only. The maintainer later asked for a full implementation, which supersedes that limit; the issue's data bounds still apply. Sections 1–10 are the specification. Section 11 records what was built. Every figure in this document and in `src/holders-data.js` was read from the primary filing or agency document on 2026-10-24.

## 1. Question and approach

The map so far shows asset managers (13F discretion) and, in the issuer pilot, who has disclosed a stake in an issuer. This pilot asks a different question: **what does a stake look like when the holder is a bank, a pension fund, an insurer, a non-financial company, a private-equity sponsor or a private individual?** Each category mixes roles that are easy to collapse: a bank owns shares, manages client shares and holds others in custody; a pension fund holds assets for beneficiaries, is governed by a board and uses outside managers; a PE sponsor controls a fund's general partner without owning the portfolio company.

Recommendations:
1. One officially documented case per category, 1–3 equity relationships each, one frozen snapshot per case. Not portfolios.
2. Every role is its own claim type (§4). Role-only claims (asset management, custody, fund management, sponsor control chain, governance, beneficiaries, subsidiary) **carry no ownership stake**; the validator rejects any stake or percentage on them.
3. Indirect paths list every intermediate claim in order, and their derived share is always `unknown` with a reason. No percentage is multiplied through a chain.
4. Claims about the same object are never summed: the validator requires every pair of equity claims on the same object in a case to sit in an overlap group.
5. Keep the layer isolated: closed by default ("Bank, pension, insurer and private holders · Pilot", `#holders-launcher`, `#holders-dialog`). It never enters graph-model, portfolio totals, security equivalence or issuer identity resolution.

## 2. Frozen case manifests

| Category | Case | Snapshot (frozen) | Equity relationships | Entity boundary | Primary sources |
|---|---|---|---|---|---|
| Bank | MUFG Group → Morgan Stanley common stock | MUFG Form 20-F as of **2026-03-31**, with the Morgan Stanley 2026 proxy (record date 2026-03-16) | 1 (MUFG → Morgan Stanley), seen as an own-account equity-method interest and as SEC beneficial ownership; plus an asset-management role claim | MUFG Group and its unnamed fiduciary affiliates; Morgan Stanley as issuer. MUFG's other investees and Morgan Stanley's own joint-venture stakes are out. | [MUFG 20-F note R23](https://www.sec.gov/Archives/edgar/data/67088/000162828026047095/R23.htm); [Morgan Stanley DEF 14A](https://www.sec.gov/Archives/edgar/data/895421/000114036126012975/ny20058185x1_def14a.htm) |
| Pension | Thrift Savings Fund (US federal Thrift Savings Plan) → C Fund equity index account | Audited Thrift Savings Fund statements as of **2025-12-31** | 1 (Fund → C Fund account) | The C Fund account only; G, F, S, I, L funds and the mutual fund window are out. | [TSF financial statements 2025](https://www.frtib.gov/pdf/reading-room/FinStmts/2025%20December%20Financial%20Statements.pdf); [TSP fund sheet TSPLF14](https://www.tsp.gov/publications/tsplf14.pdf); [5 U.S.C. 8472](https://www.govinfo.gov/content/pkg/USCODE-2023-title5/html/USCODE-2023-title5-partIII-subpartG-chap84-subchapVII-sec8472.htm) |
| Insurer | Nippon Life Insurance Company → Corebridge Financial common stock | Nippon Life Schedule 13D/A, event date **2026-10-02**, with the Corebridge 2026 proxy table as of 2026-07-28 | 2 (Nippon Life → Corebridge; its subsidiary Nissay Asset Management → Corebridge) | Nippon Life and its asset-management subsidiary. Corebridge's own investment portfolio and the pending Equitable merger are out. | [Nippon Life 13D/A](https://www.sec.gov/Archives/edgar/data/1889539/000119312526415635/primary_doc.xml); [Corebridge DEF 14A](https://www.sec.gov/Archives/edgar/data/1889539/000114036126031413/ny20061068x1_def14a.htm) |
| Corporate investor | Intel Corporation → Mobileye Global Class A and Class B | Mobileye 2026 proxy table as of **2026-04-22**, with Intel's 10-K as of 2025-12-27 | 2 (Intel → Mobileye; Intel Overseas Funding Corporation → Mobileye) | Intel and its named holding vehicle; Mobileye as issuer. | [Mobileye DEF 14A](https://www.sec.gov/Archives/edgar/data/1910139/000110465926048118/tm261530-1_def14a.htm); [Intel 10-K](https://www.sec.gov/Archives/edgar/data/50863/000005086326000011/intc-20251227.htm) |
| Private-equity sponsor | The Carlyle Group Inc. … → Carlyle Partners VII S1 Holdings II, L.P. → StandardAero, Inc. | StandardAero 2026 proxy table as of **2026-04-27** | 1 (record holder → StandardAero), reached from the sponsor through a nine-link control chain | The entities named in proxy footnote (1). Carlyle's other portfolio companies and its funds' investors are out. | [StandardAero DEF 14A](https://www.sec.gov/Archives/edgar/data/2025410/000119312526194138/d317955ddef14a.htm) |
| Publicly disclosed individual | Amazon.com, Inc. executive chair → Amazon common stock | Amazon 2026 proxy table as of **2026-02-24**, plus Form 4 filings for 2026-08-03 and 2026-08-26 (each dated) | 1 (individual → Amazon) | Holdings stated in the issuer proxy and the reporting person's Section 16 filings. No personal data. | [Amazon DEF 14A](https://www.sec.gov/Archives/edgar/data/1018724/000110465926041026/tm261382-1_def14a.htm); [Form 4 of 2026-08-27](https://www.sec.gov/Archives/edgar/data/1043298/000104329826000002/xslF345X06/wk-form4_1787862279.xml); [Form 4 of 2026-08-05](https://www.sec.gov/Archives/edgar/data/1018724/000101872426000028/xslF345X06/wk-form4_1785962062.xml) |

**Caps (frozen):** exactly six cases, one per category; 1–3 distinct holder→object equity relationships per documented case; **at most 30 claims in total**. Implemented: 30 claims. A category may instead be recorded as `source_unavailable` with an evidence-backed gap and no claims (the validator accepts this; no category needed it).

**Changes from the brief's suggestions:**
- **ABP/APG was dropped.** ABP's listed-holdings list (30 June 2026) and annual report would have supported the fund/manager/beneficiary split, but the abp.nl disclaimer (updated 25 April 2025) says: "Alle informatie op de website en in de app, inclusief afbeeldingen, is eigendom van ABP. Wilt u daar iets van openbaar maken, bewerken of verspreiden, dan hebt u toestemming van ons nodig." Publication needs ABP's permission, so the Thrift Savings Plan (a US federal agency's documents) replaces it.
- **Corebridge's AIG row** was the first insurer candidate. AIG's Schedule 13G/A reports 0 shares (event date 2026-05-05), so Nippon Life is used.
- Excluded entities from other parallel work (CalPERS, CPP Investments, Korea NPS, Temasek, SNB, PIF, Norges Bank, UAE) are not used.

## 3. Sources, locators and reuse

| Source id | Document | Locator | Reuse checked 2026-10-24 |
|---|---|---|---|
| `holders-src-mufg-20f` | MUFG Form 20-F FY to 31 March 2026, filed 2026-07-06 | Note "Other Assets and Liabilities" (XBRL R23): carrying amount and 23.87% sentence | sec.gov "Website Dissemination": "Information presented on sec.gov is considered public information and may be copied or further distributed by users of the web site without the SEC's permission" |
| `holders-src-ms-proxy` | Morgan Stanley 2026 DEF 14A, filed 2026-04-02 | "Principal Shareholders" table (as of 2026-02-27), notes (1) and (2); record-date share count | as above |
| `holders-src-tsf-fs` | Thrift Savings Fund financial statements, 31 December 2025 and 2024 (audit report dated 2026-05-15) | Note 1 (plan description, participants, managers), Note 2 (C Fund) | US Government work (17 U.S.C. 105). No explicit frtib.gov reuse page exists; index data from S&P/MSCI is not reproduced. |
| `holders-src-tsp-sheet` | TSP Fund Information sheet TSPLF14 (5/2026) | C Fund page: "Investment Managers", "C Fund Investments" | as above |
| `holders-src-usc-8472` | 5 U.S.C. 8472 (GovInfo, 2023 edition) | §8472(a), (b), (h) | US Code, US Government work |
| `holders-src-crbg-proxy` | Corebridge 2026 DEF 14A, filed 2026-08-05 | >5% table (as of 2026-07-28), row Nippon, footnote (1); Blackstone paragraph | SEC policy |
| `holders-src-nippon-13da` | Schedule 13D/A by Nippon Life, event 2026-10-02, filed 2026-10-06 | Cover rows 7–13; Items 3 and 5 | SEC policy |
| `holders-src-mbly-proxy` | Mobileye 2026 DEF 14A, filed 2026-04-24 | Ownership table row Intel Corporation(1), footnote (1); voting section | SEC policy |
| `holders-src-intc-10k` | Intel 10-K FY ended 2025-12-27, filed 2026-01-23 | "All Other" segment discussion | SEC policy |
| `holders-src-saro-proxy` | StandardAero 2026 DEF 14A, filed 2026-04-30 | Ownership table (as of 2026-04-27) row "Investment funds affiliated with The Carlyle Group(1)", footnote (1) | SEC policy |
| `holders-src-amzn-proxy` | Amazon 2026 DEF 14A, filed 2026-04-09 | Ownership table (as of 2026-02-24), executive chair's row, footnote (1) | SEC policy |
| `holders-src-amzn-f4-aug27`, `-aug05` | Form 4 filings of 2026-08-27 and 2026-08-05 | Table I rows; footnotes (1)–(3) | SEC policy |

Allowed hosts: `www.sec.gov`, `www.frtib.gov`, `www.tsp.gov`, `www.govinfo.gov`. The validator rejects any other host, and rejects any non-SEC source in the individual case. Nippon Life's own website was read for context (Corebridge is an equity-method affiliate in its FY2025 statements) but is **not** a source: its Japanese site policy prohibits unauthorized reproduction.

SEC access: `www.sec.gov` answers scripted requests with its "Undeclared Automated Tool" page even with the declared User-Agent `assets-map research (non-commercial)`, so filing text was read through WebFetch and, for long proxies, the companies' own PDF copies of the same filings. Each key figure was then matched to the exact EDGAR document with EDGAR full-text search (efts.sec.gov). No personal email address was used.

## 4. Role and relationship matrix

| Claim type | Subject → object (allowed kinds) | Carries a stake? | Category use |
|---|---|---|---|
| `direct_equity_ownership` | bank, insurer, company, pension fund, holding vehicle, individual → issuer | Yes, only as source-stated; capacity `own_account` or `general_account` | Bank equity-method interest; Intel 80%; Intel Overseas Funding Corporation's direct holding |
| `beneficial_ownership` | same subjects → issuer | Yes; capacity `beneficial_attribution` (SEC power-based) or `own_account`; voting/dispositive powers kept | MUFG 13D row; Nippon Life rows; Intel class rows; individual rows |
| `record_ownership` | holding vehicle, custodian, insurer, company, bank, asset manager → issuer | Yes; capacity `record_title` | Carlyle record holder; Nissay Asset Management |
| `fund_holding` | pension fund, PE fund → fund account or issuer | Yes; capacity `fund_portfolio` | TSF → C Fund account |
| `managed_holding` | asset manager, bank → issuer or fund account | **No.** May show shares under management, never a percentage | MUFG fiduciary affiliates |
| `custody` | custodian, bank, asset manager → issuer or fund account | **No** | Gapped in bank and pension cases |
| `manages_fund` | asset manager, PE manager → fund account, pension fund, PE fund | **No** | BlackRock Institutional Trust Company and State Street Global Advisors Trust Company |
| `gp_chain_link` | sponsor or general partner → general partner, fund or holding vehicle; `sourceRole` ∈ sole shareholder, sole member, general partner, managing member | **No** | Carlyle chain |
| `control_assertion` | company, bank, insurer, sponsor, GP → holding vehicle or GP | **No** | Intel's power over its vehicle |
| `governs` | governing body → pension fund | **No** | FRTIB → Thrift Savings Fund |
| `beneficiaries_of` | beneficiary class → pension fund | **No** | Participants → Thrift Savings Fund |
| `subsidiary_of` | subsidiary → parent | **No** | Nissay Asset Management → Nippon Life |

Rules enforced by the validator:
- Sponsors, general partners and beneficiary classes can never be the subject of an equity claim, so "a fund investment means the sponsor owns the business" cannot be expressed.
- A bank case must contain an own-account claim from the bank and must either record or gap both asset management and custody.
- A pension case must have distinct pension-fund, governing-body and beneficiary-class entities with `governs` and `beneficiaries_of` claims, and an asset-manager claim or gap.
- An insurer case must record or gap both third-party management and general versus separate account.
- A PE case must contain distinct sponsor, general-partner, holding-vehicle and issuer entities, record or gap the fund and the manager, and include a path from the sponsor to the issuer.
- Known stakes need a source-stated percentage; unknown stakes stay `null` with a reason. Stated percentages with a numerator and denominator must reconcile within half a unit of their last digit.

## 5. Normalization rules

1. **Exact strings.** Quantities, percentages and values are stored as printed, without separators (`'380010887'`, `'23.87'`, `'474.3'`). Nothing is rounded, converted or re-scaled. Currencies are never converted; JPY and USD values are never compared.
2. **Denominators stay with the claim.** A percentage shows its own denominator and date when the source states them. Issuer tables that restate an older 13D/13G numerator against a newer share count keep both dates (MUFG: numerator 2025-11-03, denominator 2026-03-16; Nippon Life: 2026-04-08 and 2026-07-28).
3. **Economic versus voting.** Intel's 80% ownership interest (10-K) and 96.9% of total voting power (proxy) are separate measures on separate dates. Class percentages are not combined. The 96.9% was checked against votes per share (50,000,000 × 1 + 597,768,015 × 10 of 244,418,126 × 1 + 597,768,015 × 10) in tests only.
4. **Own account versus fiduciary.** MUFG's 2,925,720 fiduciary shares are an asset-management role claim inside the 380,010,887-share row, with MUFG's disclaimer kept.
5. **Direct versus indirect.** `form` is `direct`, `indirect` or `not_stated` as the source says. The individual's 5,087,266 indirect shares (trusts and an LLC) stay separate from the 879,323,424 direct shares, with the disclaimer kept.
6. **Paths.** Ordered claim lists in which each link's object is the next link's subject. Derived share is always `unknown`.
7. **No totals.** No field named `total`, weight, ticker, CUSIP or ISIN may appear; the view never adds claims.

## 6. Disclosure gaps and privacy

Recorded gaps (all `not_disclosed`, each tied to a source):
- Bank: custodian or nominee for MUFG's shares not stated; the holding subsidiary is not named ("the MUFG Group held").
- Pension: company-level positions are not published (the fund sheet's S&P 500 top ten has no weights and is index data); the custodian legal entities and covered positions are not named, although the statements say BlackRock and State Street act as "investment managers, custodians, and securities lending agents".
- Insurer: general versus separate account is not stated (the 13D/A says the shares were bought with working capital); no third-party manager is named for the stake. Blackstone's mandate in the Corebridge proxy covers Corebridge's own portfolios, not Nippon Life's shares.
- PE: the funds behind the record holder are not named; no investment adviser or manager is named (an investment committee of TC Group VII S1, L.P. decides); Carlyle's economic interest is not stated.

Privacy policy:
- One individual, a widely known public figure, recorded only with name, the public capacity stated on his Form 4, and holdings from the proxy and Form 4. The validator rejects personal-profile keys (`address`, `birthDate`, `spouse`, `family`, `netWorth`, `nationality`, `residence`, `email`, `phone` and similar) anywhere in the data, rejects family or home wording and street addresses in any text of the individual case, rejects individuals outside the individual case and requires SEC sources there.
- The proxy preamble's reference to spouses' interests, trust names, gift recipients, sale prices and footnote addresses are not recorded. Carlyle investment-committee members are not recorded.

## 7. Test-case matrix

| # | Case | Expected behaviour | Test |
|---|---|---|---|
| T1 | Six categories, caps | Exactly six cases; 1–3 equity relationships each; ≤ 30 claims | `holders.test.mjs` "bounded…" and rejections (extra case, duplicate category, 31st claim) |
| T2 | Exact figures | Strings as filed; stated percentages reconcile | "figures are kept…" |
| T3 | Bank roles | Own-account, fiduciary and custody separated; fiduciary claim rejects a stake or percentage | rejections: stake on `managed_holding`, removing the custody gap |
| T4 | Pension roles | Beneficiaries cannot hold equity; governing body cannot have a capacity | rejections: beneficiaries as `beneficial_ownership`, removing `governs` |
| T5 | Insurer | Third-party management must be recorded or gapped | rejection: removing the gap |
| T6 | Corporate | Economic 80% vs voting 96.9% kept apart | data and DOM tests |
| T7 | PE | Sponsor/GP cannot own; chain kept whole; derived unknown | rejections: sponsor or GP as record holder, dropping a link, a known derived percentage, invalid `sourceRole` |
| T8 | Individual privacy | Personal fields and wording rejected; SEC-only sources | rejections: six personal keys, "wife", street address, non-SEC host, individual in bank case |
| T9 | Overlaps | Same-object claims must be in an overlap group | rejection: removing a group |
| T10 | Gapped category | `source_unavailable` gap with no claims is accepted; without a gap it is rejected | "gapped category…" |
| T11 | Sources and dates | Host allowlist; as-of ≤ published ≤ retrieved; claim dates not after publication | rejections |
| T12 | Layer isolation | Closed by default; state and totals unchanged; focus restored; Escape; no overflow at 320/390/1280 px | `browser-holders.mjs` |

## 8. Acceptance-criteria checklist

| Criterion (issue #11) | Where met |
|---|---|
| One documented case or evidence-backed gap for each of six categories | §2; validator (`source_unavailable` path tested) |
| 1–3 equity relationships per category, defined snapshot date per case | §2; `equityRelationships`; `case.snapshot` must match its anchor source |
| Bank own-balance-sheet vs asset management vs custody/nominee | §4, §6; bank rule |
| Pension beneficiaries, governing organization and asset managers separate | §4; pension rule |
| Insurer-held vs third-party managed when disclosed | §4, §6; insurer rule |
| PE sponsor, manager, fund, vehicle, portfolio company distinct; fund investment ≠ sponsor ownership | §4, §6; PE rule and endpoint table |
| Individuals: only investment-relevant official facts; validator rejects personal fields | §6; T8 |
| Custody/management/legal/beneficial/sponsor relationships cannot be collapsed | §4 (distinct types, role-only claims carry no stake) |
| Indirect paths keep intermediates and never imply undisclosed percentages | §5.6; T7 |
| Private stakes, beneficial-owner ambiguity and incomplete coverage explicit | §6 gaps; individual indirect line; coverage label |
| Exact sources, dates, entity boundaries, caps and stop conditions frozen | §2, §3, §9 |

## 9. Stop conditions

Stop and ask the maintainer, rather than collect, if:
- a source's terms forbid reproduction (as with abp.nl and nissay.co.jp) or allow only linking the layer cannot honour;
- a role cannot be classified from the source's own words (for example "investment" without saying own account, fiduciary or custody);
- a stake would need an inferred percentage, a look-through multiplication or a currency conversion;
- an individual's holding could be shown only with personal data, or the person is not a widely known public figure acting in a public capacity;
- a figure would need a secondary aggregator;
- the claim count would exceed 30, a seventh case or new claim type would be needed, or a case would exceed three equity relationships.

## 10. Assumptions and decisions needed

Assumptions:
- An SEC proxy's percent of class uses the stated share count; rows reconcile within rounding (checked).
- FRTIB and TSP documents are US Government works under 17 U.S.C. 105; no explicit reuse page exists.
- "Investment funds affiliated with The Carlyle Group" in the table refers to the record holder named in footnote (1); the funds behind it are not identified.
- The individual's proxy figure (950,434,581 at 2026-02-24) and Form 4 figures (later dates, excluding voting-only shares) are not reconciled; they are dated and kept apart.

Decisions needed from the maintainer:

| ID | Decision | Recommendation |
|---|---|---|
| D1 | Keep the single public-figure individual case, given the issuer pilot excludes natural persons | Keep, under the §6 privacy rules |
| D2 | Seek ABP permission to use its holdings list for a Dutch fund/manager case | Optional; the TSP case meets the criteria |
| D3 | Accept 17 U.S.C. 105 as the reuse basis for FRTIB/TSP documents | Accept |
| D4 | Review MUFG's 2026-04-13 and 2026-07-15 Schedule 13D/As in a later snapshot | Defer |
| D5 | Separate approval for any expansion beyond this pilot | Required |

## 11. Implemented pilot

Implemented 2026-10-24 as an isolated, closed-by-default modal layer, "Bank, pension, insurer and private holders · Pilot" (launcher `#holders-launcher`, dialog `#holders-dialog`). Files: `src/holders-data.js` (records and the validator, which runs at import), `src/holders-view.js`, `src/holders.css`, `tests/holders.test.mjs` and `tests/browser-holders.mjs` (run from `tests/browser-smoke.mjs`). The launcher sits after the Armenia country launcher in `index.html`, is mounted in `src/app.js` (including the mobile controls list), and the three public files are allowlisted in `scripts/prepare-site.mjs`.

### What was collected (30 claims, retrieved 2026-10-24)

| Case | Claims | Figures (exact as filed) |
|---|---|---|
| Bank | 3 | MUFG Group held approximately 23.87% of Morgan Stanley common stock at 2026-03-31, carried at ¥3,996,002 million (equity-method investee). Morgan Stanley proxy: MUFG 380,010,887 shares, 24.0% (sole voting and dispositive power; 13D/A as of 2025-11-03; 1,581,386,814 shares at the 2026-03-16 record date). Of these, 2,925,720 held in a fiduciary capacity by MUFG affiliates as of 2025-10-29, beneficial ownership disclaimed. |
| Pension | 5 | C Fund separate accounts held approximately $474.3 billion of securities at 2025-12-31; managed by BlackRock Institutional Trust Company, N.A. and State Street Global Advisors Trust Company; plan administered by FRTIB; approximately 7.3 million participants. |
| Insurer | 4 | Corebridge proxy: Nippon 121,992,454 shares, 27.37% (as of 2026-04-08; 445,772,522 shares at 2026-07-28). 13D/A (event 2026-10-02): 126,604,050 shares, 28.4%, of which 126,570,779 of record by Nippon Life and 33,271 by Nissay Asset Management Corporation, a direct wholly owned subsidiary; funds from working capital. |
| Corporate | 5 | Mobileye proxy (2026-04-22): Intel Class A 50,000,000 (20.5% of 244,418,126) and Class B 597,768,015 (100%), 96.9% of total voting power, held directly by Intel Overseas Funding Corporation. Intel 10-K: 80% ownership interest at 2025-12-27, consolidated. |
| PE | 10 | StandardAero proxy (2026-04-27): "Investment funds affiliated with The Carlyle Group" 84,587,035 shares, 25.4% of 332,421,972; record holder Carlyle Partners VII S1 Holdings II, L.P.; nine chain links from The Carlyle Group Inc. through TC Group VII S1, L.P. |
| Individual | 3 | Amazon proxy (2026-02-24): 950,434,581 shares, 8.8% of 10,751,236,247, including 68,232,131 with sole voting and no investment power. Form 4: 879,323,424 direct after 2026-08-26; 5,087,266 indirect (trusts and an LLC, disclaimed) as of 2026-08-03. |

### Excluded and why

- **ABP/APG** (reuse needs ABP's permission) and **Nippon Life website content** (reproduction prohibited): §2–3.
- **AIG's Corebridge stake:** 0 shares from 2026-05-05.
- **State Street's 7.2% Morgan Stanley row and Morgan Stanley's 40% MUMSS interest:** other banks' or the issuer's own holdings, outside the MUFG case.
- **MUFG 13D/As of 2026-04-13 and 2026-07-15, Nippon Life Form 4s after 2026-10-02, filings after the Mobileye table:** outside the frozen snapshots.
- **Custody claims in the bank and pension cases:** not position-level disclosed; recorded as gaps.
- **Carlyle committee members, addresses, trust names, gift recipients, sale prices, family references:** privacy.
- **TSP S, I, F, G and L funds, and the S&P 500 top-ten list:** outside the case boundary or index data without fund weights.

### Verification

`npm test` (343 tests, including 6 in `tests/holders.test.mjs` with 52 validator rejection cases), `npm run check`, `npm run test:browser` (including `checkHoldersPilot` at 320, 390 and 1280 px) and `node scripts/prepare-site.mjs <empty dir>` (58 allowlisted files) all pass. Port 8088 was held by an unrelated long-running local server, so the browser smoke was run once from an identical temporary copy of `tests/browser-smoke.mjs` on port 8089 (copy deleted afterwards).

### Unverified points

- WebFetch caps verbatim quotes at about 125 characters, so long sentences (Carlyle footnote, MUFG note (2), Corebridge and Nippon Life text) were assembled from consecutive exact fragments or from the companies' own PDF copies of the same filings. Key figures were matched to the EDGAR document by full-text search.
- The TSP Appendix tables are images; the pilot uses the Note 2 text figure ($474.3 billion, approximate) instead.
- The full text of footnote (2) of the 2026-08-27 Form 4 was not quoted; the indirect line is therefore taken from the 2026-08-05 Form 4, whose footnote (3) was read in full.
