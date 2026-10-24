# Issuer-to-shareholders equity pilot: specification and bounded implementation

Status: **Proposal accepted for implementation 2026-10-24 (maintainer instruction); bounded pilot implemented**
Prepared: 2026-10-24. Ticket: [#8](https://github.com/Eduard20/assets-map/issues/8), under [tracker #1](https://github.com/Eduard20/assets-map/issues/1). Depends on #2 (architecture), #3 (sources), #4 (claims and metric semantics) and #5 (identity).
Scope: the issue text asked for planning only. The maintainer later asked for a full implementation, which supersedes that limit. Sections 1–10 are the specification. Section 11 records what was built. Every figure in this document and in `src/issuer-data.js` was read from the primary filing or regulator page on 2026-10-24.

## 1. Question and approach

The existing map answers "what does this manager hold?" from Form 13F. This pilot asks the reverse: **who has disclosed a stake in this issuer?** The answer comes from issuer and regulator disclosures, not from 13F.

Recommendations:
1. Keep the issuer view in its own layer, closed by default ("Who owns this issuer? · Pilot", `#issuer-launcher`, `#issuer-dialog`). It never enters graph-model, portfolio totals, security equivalence or issuer identity resolution.
2. Take one reporting snapshot per issuer (section 2), and keep each claim's own filing date, record date, share class and denominator.
3. Reuse #4's roles. `beneficial_ownership` (SEC Rule 13d-3), `voting_authority` (sole/shared), direct versus indirect holdings, and `record_ownership`/custody all stay separate. A stated percentage is shown only with its class-scoped denominator.
4. **Never build a cap table.** Do not add up rows. Overlapping attributions (a parent and its subsidiary), different frameworks, different dates and different classes are all reasons not to. The coverage label always reads "Disclosed holders above reporting thresholds only", never "complete".
5. Record only legal entities, governments and the filing's aggregate "directors and executive officers as a group" row. Individually named people are excluded and counted (section 6).

## 2. Frozen manifest

| Issuer | Regime | Snapshot (frozen) | Securities in scope | Primary sources |
|---|---|---|---|---|
| Alphabet Inc. | US SEC | DEF 14A ownership table as of **2026-04-06**, plus Schedule 13G/13G/A on Class A and Class C filed 2026-03-01 to 2026-04-30 | Class A (1 vote), Class B (10 votes), Class C (no votes at the 2026 meeting) | [DEF 14A filed 2026-04-24](https://www.sec.gov/Archives/edgar/data/1652044/000130817926000342/goog-20260424.htm); [13G VCM, Class A](https://www.sec.gov/Archives/edgar/data/1652044/000210011926000161/xslSCHEDULE_13G_X02/primary_doc.xml); [13G VCM, Class C](https://www.sec.gov/Archives/edgar/data/1652044/000210011926000137/xslSCHEDULE_13G_X02/primary_doc.xml); [13G/A No. 9, The Vanguard Group, Class A](https://www.sec.gov/Archives/edgar/data/1652044/000010290926000584/xslSCHEDULE_13G_X02/primary_doc.xml) |
| Meta Platforms, Inc. | US SEC | DEF 14A ownership table as of **2026-04-01** | Class A (1 vote), Class B (10 votes) | [DEF 14A filed 2026-04-16](https://www.sec.gov/Archives/edgar/data/1326801/000162828026025532/meta-20260416.htm) |
| ITV plc | UK FCA (DTR 5) | TR-1 notifications published on the NSM **2026-01-01 to 2026-03-31**, latest per notifier, plus the total-voting-rights (TVR) announcement for 2025-12-31 | Ordinary shares of 10p; ADR line kept separate | NSM: RNS 4634N (TVR), 7536X, 3373X, 9301R (section 3) |
| Volkswagen AG | DE BaFin (WpHG) | BaFin major-holdings database, issuer page **as retrieved 2026-10-24**. Each row keeps its own publication date. | Voting rights (WpHG §§ 33–39 scope) | [BaFin database, issuer 10108495](https://portal.mvp.bafin.de/database/AnteileInfo/aktiengesellschaft.do?cmd=zeigeAktiengesellschaft&id=10108495) |
| Stripe, Inc. (private gap) | US SEC | EDGAR filing index as retrieved 2026-10-24 | none (no public class data) | [data.sec.gov submissions, CIK 1691342](https://data.sec.gov/submissions/CIK0001691342.json) |

**Cap:** at most 5 listed issuers plus 1 private gap case, and **at most 30 claims**. Implemented: 4 listed issuers and 1 gap case, 25 claims. The validator rejects 31 or more claims, fewer than 2 regimes, no multiple-class voting case, or a private issuer with anything other than a disclosure gap.

**Change from the issue's example:** the issue suggested SpaceX as the private case. SpaceX listed on Nasdaq in June 2026: EDGAR shows a 424B4 prospectus filed 2026-06-12, ticker `SPCX`, and 10-Q filings since then ([submissions index](https://data.sec.gov/submissions/CIK0001181412.json)). It is no longer a private company, so Stripe, Inc. replaces it. Stripe's EDGAR record shows only Form D and D/A notices (13 D, 1 D/A), with no tickers and no exchanges.

## 3. Source list with locators and reuse

| Source id | Document | Locator used | Reuse checked 2026-10-24 |
|---|---|---|---|
| `issuer-src-alph-proxy` | Alphabet 2026 DEF 14A | "Common Stock Ownership of Certain Beneficial Owners and Management": table rows BlackRock, Inc. and group (14 persons); footnotes (7) and (8); shares-outstanding sentence; annual-meeting voting summary | sec.gov: "Information presented on sec.gov is considered public information and may be copied or further distributed" |
| `issuer-src-alph-vcm-a` / `-vcm-c` | Schedule 13G by Vanguard Capital Management, event date 03/31/2026, filed 04/29/2026 | Cover rows 5–11, Item 4. Class resolved from the cover CUSIP (Class A for 000210011926000161, Class C for 000210011926000137). The CUSIP itself is not republished. | as above |
| `issuer-src-alph-vg-a` | Schedule 13G/A Amendment No. 9 by The Vanguard Group, event date 03/13/2026, filed 03/26/2026 | Cover rows 5–11 and comment on the 12 January 2026 realignment | as above |
| `issuer-src-meta-proxy` | Meta 2026 DEF 14A | "Security Ownership of Certain Beneficial Owners and Management": rows group (20 persons), BlackRock, FMR; footnotes (20)–(23) | as above |
| `issuer-src-itv-tvr` | ITV Total Voting Rights and Capital, RNS 4634N, 2026-01-02 (NSM path `NSM/RNS/797ea5d6-1c72-46a3-b6f2-afe6bfe17d15.html`) | "the total number of voting rights in ITV was 3,793,189,219" | FCA NSM Terms of Use (updated 19 March 2020): material may be used "for any lawful purpose not otherwise excluded". The terms forbid linking "to any part of this site other than the home page", so the data links only to the NSM home page and cites the RNS number and NSM path as text. |
| `issuer-src-itv-tr1-blk` | TR-1 by BlackRock, Inc., RNS 7536X, published 2026-03-24 (path `NSM/RNS/3eaca0fb-c783-4671-b2a9-5032066dc538.html`) | Sections 5–9 | as above |
| `issuer-src-itv-tr1-lg` | TR-1 by Liberty Global Ltd., RNS 3373X, published 2026-03-19 (path `NSM/RNS/2b12cd9a-e31b-4f78-b02a-7a7ed13ac2e7.html`) | Sections 4, 5–9 | as above |
| `issuer-src-itv-tr1-amp` | TR-1 by Ameriprise Financial, Inc., RNS 9301R, published 2026-02-05 (path `NSM/RNS/9c9fa7a4-5c07-4bef-a668-be8b0278c148.html`) | Sections 5–8 | as above |
| `issuer-src-vw-db`, `-vw-land`, `-vw-land-chain`, `-vw-qatar`, `-vw-qhg` | BaFin "Major holdings of voting rights according to Sec. 33, 38 and 39 WpHG": issuer page, notification details (ids 115571, 40463, 40470) and chain of controlled undertakings (115571) | Detail fields "Sec. 33 WpHG direct holdings", "Sec. 34 WpHG indirect holdings", "Sec. 33, 34 WpHG total", "Sec. 38", "Sec. 39", and "Publication according to Sec. 40 (1) WpHG" | BaFin terms of use: content "may generally be stored, shared and reproduced", citing "© Federal Financial Supervisory Authority / www.bafin.de" |
| `issuer-src-stripe` | EDGAR submissions JSON for Stripe, Inc. | `name`, `tickers`, `exchanges`, `filings.recent.form` | sec.gov policy as above |

Allowed hosts: `www.sec.gov`, `data.sec.gov`, `data.fca.org.uk` (NSM home page URL only), and `portal.mvp.bafin.de`. Secondary aggregators (ticker.app, MarketScreener, press coverage) were used at most to find documents and are never evidence. The validator rejects any other host.

SEC access: requests used the declared User-Agent `assets-map research (non-commercial)`. `www.sec.gov` still answered scripted requests with its "Undeclared Automated Tool" page, so the filing text was read through WebFetch. `data.sec.gov` accepted the declared agent. No personal email address was used.

## 4. Record types

| Record | Purpose | Key fields |
|---|---|---|
| `issuer` | Issuer, regime, listed/private, frozen snapshot, share classes | `snapshot.anchorSourceId`, `classes[].votesPerShareRaw` (string or null), `votingNote`, optional LEI |
| `holder` | Disclosing party | `kind` ∈ `legal_entity`, `government`, `aggregate_group`. No `natural_person` kind exists. |
| `denominator` | Class-scoped base for a percentage | `kind` ∈ `class_shares_outstanding`, `combined_votes`, `issuer_total_voting_rights`; `availability` `known`/`unknown`, with a `reason` when unknown; `origin` `source_stated` or `calculated` (`ISSUER-VOTES-v1` with `inputIds`) |
| `beneficial_ownership` claim | One SEC row for one class | `quantityRaw`, `percentRaw` or the `below_one_percent_marker` qualifier (the filing's `*`), `denominatorId`, `reportDate`, `votingAuthority {sole, shared}`, `dispositivePower {sole, shared}`, `reliesOn` (the 13G an issuer table restates), `qualifier` |
| `voting_power_stated` claim | The proxy's "% of total voting power" column | `percentRaw`, a `combined_votes` denominator over the voting classes |
| `major_holding_notification` claim | One TR-1 or WpHG notification | `holderId` (notifier) and `directHolderId`; `eventDate` (threshold crossed; null for BaFin rows, which show only publication); `lines[]` per class with direct/indirect counts and percentages (blank is `null`, an explicit zero is `"0"`); `instruments[]` (8B1/8B2); `sharesPercentRaw`, `instrumentsPercentRaw`, `totalPercentRaw`, `previousTotalPercentRaw` |
| `attribution_chain_entry` claim | A controlled undertaking inside a notified chain | `parentClaimId`, `percentRaw`. It must sit in an overlap group with its parent. |
| `reporting_scope_transition` claim | A filer's zero after a reporting-perimeter change | `transitionDate`, `eventDate`, a note that must say it is **not a sale** |
| `disclosure_gap` claim | A private company without public ownership disclosure | `holders: {availability: 'unknown', reason}`, plus a note. No holders, percentages or classes are recorded. |
| `overlapGroup` | Claims that must not be added | `claimIds` (same issuer) and the reason |
| `exclusion` | Rows deliberately not recorded | `category` ∈ `natural_person`, `out_of_scope_row`; `rowCount`; reason |

Field allowlists are exact. Any extra field (for example `capTable`, `ownershipTotal`, `economicPercentRaw`, `portfolioWeight`, `cusip`, `isin` or an issuer-identity join) is rejected.

## 5. Normalization rules

1. **Exact strings.** Quantities and percentages are stored as the filing prints them, without separators (`'356934964'`, `'6.1'`, `'5.900000'`). Nothing is rounded or re-scaled.
2. **Class scope.** Every beneficial row names one class. A class percentage must use a `class_shares_outstanding` denominator for that class with the same record date. Rows are never merged across classes.
3. **Voting power.** It uses a `combined_votes` denominator. When a proxy states voting percentages without a vote total, the pilot calculates the base as `ISSUER-VOTES-v1` = Σ (class shares outstanding × votes per share), with inputs from the same source and date. Alphabet: 5,823,665,113 × 1 + 835,779,041 × 10 = 14,181,455,523. Meta: 2,196,045,588 × 1 + 342,377,716 × 10 = 5,619,822,748. The validator checks that every stated class and voting percentage agrees with its denominator to within half a unit of its last digit. This is a check, never a new displayed figure.
4. **Economic versus voting.** Class percentages are not combined into an economic percentage. For Alphabet, an economic share across classes is **unknown**, because the proxy does not state Class C shares outstanding.
5. **Beneficial versus record or direct.** SEC 13d-3 rows are beneficial ownership (voting or dispositive power), not record title. TR-1 and WpHG rows keep direct (DTR 5.1 / § 33) and indirect (DTR 5.2.1 / § 34) separately. The notifier and the direct holder stay separate entities (Liberty Global Ltd. notifies; Liberty Global Ventures Limited holds directly).
6. **Nominee, depositary and custodian lines** stay separate from the owner's ordinary-share line. In the Ameriprise notification, the 49,050 voting rights held through American depositary receipts form their own line (`issuer-itv-adr`). Instrument positions (securities lending, CFDs, equity swaps, ADR rights) stay in `instruments[]` and are never added to shares.
7. **Unknown denominators** stay `null` with a reason. Schedule 13G percentages (7.48% and 6.41%) do not state their denominator, and BaFin database rows do not show total voting rights. Those percentages are displayed as source-stated and never recomputed.
8. **TR-1 denominator.** The notifications do not name their denominator. The issuer's last TVR figure before them (3,793,189,219 voting rights at 2025-12-31) is stored as context. The notified percentages agree with it only to about 0.01 percentage point (BlackRock: 223,926,063 / 3,793,189,219 = 5.9034% against a stated 5.900000%), so the pilot does not recompute them.
9. **Issuer tables restating old 13Gs.** Proxy rows restate 13G/A numerators from 2024 or 2025 against 2026 record-date denominators. `reliesOn` records the underlying filing date so the age is visible. Alphabet footnote (7) also gives Vanguard "approximately 8.5%" from a 2024 numerator after the parent's filing reported zero. That figure is not recorded.
10. **Dates.** Each source keeps `asOf`, `publishedAt` and `retrievedAt`; as-of ≤ published ≤ retrieved. A BaFin row's publication date (for example 18/12/2009 for Qatar) is kept, and the view shows it. Stale rows are not hidden or refreshed.
11. **No identifiers.** CUSIPs and ISINs are not republished; the validator scans for ISIN-shaped strings. LEIs are permitted (ITV's LEI appears in its own announcement).

## 6. Gap and privacy policy

- **Coverage label:** "Disclosed holders above reporting thresholds only. Not a shareholder register or cap table." The validator rejects a label containing "complete", "full register" or "100%".
- **Threshold gaps:** a holder below the 5% SEC threshold, the 3% UK and German thresholds, or the period's notification trigger is absent. Absence is not zero.
- **Private company:** Stripe, Inc. is recorded as one `disclosure_gap` claim. Holders are unknown, with reason `no_public_ownership_disclosure`. Form D notices report exempt offerings, not shareholders. No cap table, valuation-implied stake or press-reported investor is recorded.
- **Natural persons excluded.** Individually named people are never recorded, even when a regulator publishes their stake. Reason: the map is about institutional capital, and holdings of private individuals are personal data whose aggregation in a new public tool needs a separate legal basis and review. Counted exclusions: Alphabet 14 rows; Meta 18 rows; Volkswagen 16 notifier rows. Seven more Volkswagen rows (2009/2013 family holding vehicles whose chains lead to named people) and four intermediate Qatar chain entities are excluded as out of scope.
- **Consequence for voting-control cases:** dual-class control appears only through the group row and class-level totals. Alphabet's directors and executive officers as a group hold 92.2% of Class B and 54.3% of total voting power. Meta's group holds 99.8% of Class B and 60.9% of total voting power. Volkswagen's largest holder, Porsche Automobil Holding SE (53.35%, published 07/04/2025), appears in the BaFin database only inside notifications filed by named natural persons, so it is excluded and listed as an exclusion.
- **Contact names** in TR-1 section 11 and in TVR announcements are not recorded.

## 7. Test-case matrix

| # | Case | Data | Expected behaviour | Test |
|---|---|---|---|---|
| T1 | Multiple classes, economic vs voting | Alphabet A/B/C, Meta A/B | Separate class claims; voting power via `ISSUER-VOTES-v1`; Alphabet economic share across classes is unknown | `issuer.test.mjs` "summaries…", "ISSUER-VOTES-v1…" |
| T2 | Group row instead of individuals | Alphabet (14 persons), Meta (20 persons) | `aggregate_group` holder; `*` kept as a marker, never 0 | rejection: `percentRaw='0'` on the marker row |
| T3 | Acquisition rights in a numerator | Meta group Class A includes 92,993 RSU shares | Qualifier recorded; no recalculated percentage | data test |
| T4 | Sole/shared authority | 13G cover rows, proxy footnotes | `votingAuthority` and `dispositivePower` kept; "not stated" when absent | DOM test |
| T5 | Reporting-perimeter change | Vanguard parent zero (Alphabet 13G/A; Meta footnote 21) with Vanguard Capital Management's 13G | `reporting_scope_transition` plus overlap group; never shown as a sale | rejection: note "Vanguard sold its stake" |
| T6 | Unknown denominator | 13G percentages; BaFin rows | `availability: unknown` with reason; no recomputation | rejection: reason `null` |
| T7 | Direct vs indirect, notifier vs holder | Liberty Global (direct, via subsidiary), BlackRock (indirect) | Separate fields | data test |
| T8 | Depositary line and instruments | Ameriprise ADR line, equity swap; BlackRock CFDs and lending | Separate lines; not added to shares | data test |
| T9 | Overlapping attribution | Land Niedersachsen 20.00159% ⊇ 9.76% + 10.25%; State of Qatar / Qatar Holding Germany GmbH 17% each | Overlap groups required; no sum | rejection: removing the group; chain entry above its parent |
| T10 | Stale rows | Qatar rows published 2009-12-18 | Date shown; not refreshed | DOM text |
| T11 | Private gap | Stripe | Single `disclosure_gap`; any holding claim rejected | rejection tests |
| T12 | Licensing-driven links | NSM | Only the home-page URL is accepted | rejection: deep artefact URL |
| T13 | Privacy | All | No `natural_person` kind; names such as "Larry Page" never appear in the view | rejection plus DOM test |
| T14 | Layer isolation | Browser at 320/390/1280 px | Closed by default; app state and totals unchanged after open/close; focus restored; Escape closes; no horizontal overflow | `browser-issuer.mjs` |

## 8. Acceptance-criteria checklist

| Criterion (issue #8) | Where met |
|---|---|
| 3–5 public issuers from at least two disclosure regimes | §2 (4 issuers, 3 regimes); validator caps |
| One multiple-share-class case distinguishing economic ownership from voting power | §5.3–5.4; T1; Alphabet and Meta |
| One private-company disclosure gap recorded as unknown, with no guessed cap table | §6; T11; Stripe |
| One reporting snapshot per issuer | §2 (frozen snapshot column); `issuer.snapshot` |
| Direct legal vs disclosed beneficial ownership; sole/shared voting authority | §4, §5.5; T4, T7 |
| Share class, share count, stated percentage with denominator and class scope | §4, §5.1–5.2, §5.7–5.8 |
| Nominee/custodian records distinct from ultimate owners | §5.6; T8 |
| Never sum incomparable disclosures, overlapping interests or different dates | §1.4, §5, overlap groups; T5, T9; no total field exists |
| Coverage label says disclosed holders above threshold, never "complete" | §6; validator |
| Natural persons excluded, with the exclusion and its reason recorded | §6; `exclusions[]`; T13 |
| At most 30 claims; issuers, securities, dates, sources and cap frozen | §2, §3 |
| Every figure verified from the primary filing text | §3, §11 |

## 9. Stop conditions

Stop and ask the maintainer, rather than collect, if:
- a source's terms forbid reproduction, or allow only linking that the layer cannot honour;
- a percentage's class or denominator cannot be identified from the document;
- the only evidence for a legal entity's stake is a natural person's notification (as with Porsche SE above);
- a figure would need a secondary aggregator;
- the claim count would exceed 30, or a new issuer, regime or record type would be needed;
- an issuer's classes have different economic rights that the filing does not state.

## 10. Assumptions and decisions needed

Assumptions:
- An SEC proxy's "percent of class" uses the stated record-date shares outstanding, adjusted for each holder's acquisition rights under Rule 13d-3. Rows without such rights reconcile exactly (checked by the validator).
- Votes per share are as stated for the 2026 annual meeting. Class C's "no voting power" is scoped to that meeting's items of business.
- BaFin's database shows the latest publication per notifier. A row from 2009 is the last notification, not a current holding.
- The 13G filings by Vanguard Capital Management state "Common Stock" as the title of class. The class was resolved from the cover CUSIP, which is used for the mapping only and is not stored.

Decisions needed from the maintainer:

| ID | Decision | Recommendation |
|---|---|---|
| D1 | Keep natural persons out of every equity layer, including regulator-published stakes | Keep excluded |
| D2 | Whether Porsche Automobil Holding SE may be recorded from the chain section of a natural person's notification, without naming the person | Defer. It needs a privacy review. |
| D3 | Accept `ISSUER-VOTES-v1` as a calculated denominator when a proxy states voting percentages without a vote total | Accept |
| D4 | Accept the NSM linking restriction (home page only, RNS number as locator) or seek FCA permission for deep links | Accept as implemented |
| D5 | Add issuer-published Class C counts (10-Q cover) so that an economic share across classes can be shown | Defer; it would be a second document on a different date |
| D6 | Separate approval for any expansion beyond this pilot | Required |

## 11. Implemented pilot

Implemented 2026-10-24 as an isolated, closed-by-default modal layer, "Who owns this issuer? · Pilot" (launcher `#issuer-launcher`, dialog `#issuer-dialog`). Files: `src/issuer-data.js` (records, `ISSUER-VOTES-v1`, rounding reconciliation and the validator, which runs at import), `src/issuer-view.js`, `src/issuer.css`, `tests/issuer.test.mjs` and `tests/browser-issuer.mjs` (run from `tests/browser-smoke.mjs`). The layer is wired after the gold launcher in `index.html`, mounted in `src/app.js` (including the mobile controls list), and allowlisted in `scripts/prepare-site.mjs`.

### What was collected (25 claims, retrieved 2026-10-24)

| Issuer | Claims | Figures (exact as filed) |
|---|---|---|
| Alphabet | 8 | BlackRock, Inc. Class A 356,934,964 (6.1%; sole voting 321,125,552; sole dispositive 356,934,964; per its 13G/A of 2024-02-12) and 2.5% of total voting power. Group (14 persons): Class A 2,596,986 (`*`), Class B 770,340,078 (92.2%), 54.3% of total voting power. Denominators: Class A 5,823,665,113 and Class B 835,779,041 at 2026-04-06; Class C unknown. Vanguard Capital Management 13G (event 2026-03-31): Class A 436,027,408 (7.48%; sole voting 57,765,829) and Class C 348,894,310 (6.41%; sole voting 46,632,134); denominators not stated. The Vanguard Group 13G/A No. 9: 0 shares as of 2026-03-13 after the 2026-01-12 realignment. |
| Meta | 8 | Entities affiliated with BlackRock Class A 157,849,942 (7.2%; sole voting 142,976,542) and 2.8% of voting power. Entities affiliated with FMR LLC Class A 134,555,687 (6.1%; sole voting 128,222,257) and 2.4%. Group (20 persons): Class A 1,555,951 (`*`, including 92,993 RSU shares), Class B 341,823,978 (99.8%), 60.9% of voting power. Denominators: Class A 2,196,045,588 and Class B 342,377,716 at 2026-04-01. Vanguard parent zero as of 2026-03-13 (footnote 21). |
| ITV | 3 | BlackRock, Inc. (crossed 2026-03-20): indirect 223,926,063 (5.900000%), instruments 0.790000%, total 6.690000% (254,012,545 voting rights), previous 5.010000%. Liberty Global Ltd. via Liberty Global Ventures Limited (crossed 2026-03-17): direct 93,909,460 (2.475700%), previous 4.999999%. Ameriprise Financial, Inc. (crossed 2026-02-03): indirect 188,040,710 (4.957000%) plus ADR line 49,050 (0.001000%), equity swap 0.030000%, total 4.988000%, previous 5.122. TVR context: 3,793,189,219 at 2025-12-31. |
| Volkswagen | 5 | Land Niedersachsen (published 2025-03-28): direct 0%, indirect 20%, total 20.00159%. Its chain: Hannoversche Beteiligungsgesellschaft Niedersachsen mbH 9.76% and Wissenschafts- und Forschungsförderung Niedersachsen gGmbH 10.25%. State of Qatar (indirect) and Qatar Holding Germany GmbH (direct), 17% each, published 2009-12-18. |
| Stripe | 1 | Disclosure gap: no tickers or exchanges; only Form D (13) and D/A (1) on EDGAR. |

### Excluded and why

- **Named natural persons:** 14 Alphabet rows, 18 Meta rows and 16 Volkswagen notifier rows (§6).
- **Porsche Automobil Holding SE (Volkswagen, 53.35%):** appears only inside natural persons' notification chains (decision D2).
- **Seven Volkswagen family holding-vehicle rows (2009/2013)** whose chains lead to named people, and **four intermediate Qatar chain entities** (Qatar Investment Authority, Qatar Holding LLC, Qatar Holding Luxembourg II S.à r.l., Qatar Holding Netherlands B.V.). The overlap is shown with the top and direct entities, which also keeps the pilot under the cap.
- **Superseded ITV notification:** BlackRock's 2026-03-06 TR-1 (5.010000%) is superseded by its 2026-03-24 notification, which states it as the previous position.
- **Meta's Schedule 13G of 2026-04-30 and FMR's 13G/A of 2026-08-06:** they fall outside the frozen Meta snapshot (the proxy as of 2026-04-01).
- **SpaceX:** listed in June 2026 (§2), so it no longer qualifies as the private case.
- **Volkswagen preference shares and Alphabet Class C counts:** WpHG notifications cover voting rights only, and the Alphabet proxy does not state Class C shares outstanding.

### Verification

`npm test` (327 tests, including 6 in `tests/issuer.test.mjs` with 43 validator rejection cases), `npm run check`, `npm run test:browser` (including `checkIssuerPilot` at 320, 390 and 1280 px) and `node scripts/prepare-site.mjs <empty dir>` (50 allowlisted files) all pass.

### Unverified points

- `www.sec.gov` refused scripted downloads despite the declared User-Agent, so the filing text was read through WebFetch, whose verbatim quotes are capped at about 125 characters. The figures were cross-checked arithmetically. Every stated class and voting percentage reconciles with the stated denominators, and the validator enforces this at import. Proxy row excerpts are cell sequences, not single quoted sentences.
- The ITV notified percentages agree with the 2025-12-31 TVR figure only to about 0.01 percentage point. The notifier's actual denominator is not stated.
- BaFin's Land Niedersachsen detail shows "20%" indirect and "20.00159%" total. The pilot keeps both as printed.
