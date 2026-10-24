# Country exploration and an Armenia discovery slice

Status: **Proposal accepted for implementation 2026-10-24 (maintainer instruction); bounded pilot implemented.** See [section 11](#11-implemented-pilot).
Prepared: 2026-10-24.
Ticket: [#13](https://github.com/Eduard20/assets-map/issues/13), phase P4, under [tracker #1](https://github.com/Eduard20/assets-map/issues/1). Depends on [#3](https://github.com/Eduard20/assets-map/issues/3) (sources), [#4](https://github.com/Eduard20/assets-map/issues/4) (claims and semantics), [#5](https://github.com/Eduard20/assets-map/issues/5) (identity), #7 and [#12](https://github.com/Eduard20/assets-map/issues/12) (integration).

The issue text asked for planning only. On 2026-10-24 the maintainer asked for a full, working, bounded implementation, and that instruction supersedes "do not implement". The issue's own data limits still apply: at most five Armenian entities, no country aggregate total, and no census. Everything outside section 11 is specification. It does not change the foundation schemas, the live dataset or any source admission.

**Recommended** marks a proposal awaiting maintainer review. **Approved** is used only for decisions already recorded in #1–#5.

## 1. Summary

- Treat "country" as **five independent dimensions**, never one field: investor domicile, issuer/legal-entity domicile, exchange/listing location, underlying asset/operating location, and reporting/valuation currency. Each value carries its own source, locator, excerpt and basis. No dimension is ever derived from another.
- Currency is never geography. A name, script or legal-form suffix ("CJSC", "S.a.r.l.") never sets a country. An unknown value stays unknown with a reason. "Non-resident" is kept as a residence status with no country.
- Cross-border ownership chains keep every intermediate entity. Stakes along a chain are not multiplied.
- No country aggregate, "Armenian wealth" figure or exposure total exists in the data model, the queries or the UI. Coverage labels describe the disclosed universe of each source only.
- The pilot is a closed-by-default modal layer, "Country exploration: Armenia · Pilot". It lets the user filter by each dimension separately and see the different answers (section 4).

## 2. Context and boundaries carried forward

- #1 and #2: asset location, issuer domicile, investor domicile and currency are distinct dimensions. Armenia is a bounded discovery slice, not inferred from a name or listing currency (#2, extension boundaries).
- #3 §7: the AMX listed-equity pages, the AMX listing requirements and the CBA licensed-bank list are the starting universe. They are not beneficial-ownership registers.
- #4: claims keep source wording, `as_of`, a denominator and a locator. Unknown is not zero. `instrument_currency` and `value_currency` are distinct from domicile.
- #5: name-only matching never merges entities. Candidate matches are reviewable and are not silent merges.
- The layer never enters graph-model, portfolio totals, security equivalence, issuer identity resolution or the `batch-v1` foundation.

## 3. Country-dimension dictionary

| Dimension (`id`) | Attaches to | Definition | Can say | Cannot say | Allowed bases |
|---|---|---|---|---|---|
| Investor domicile (`investorDomicile`) | the ownership claim (holder in its investor role) | Where the holding party is domiciled or resident, from a registry jurisdiction or the residence status in the disclosure | "Armenian investors": holders a source places in Armenia | Where the held asset is, where the issuer is incorporated, or where an ultimate owner sits. "Non-resident" excludes Armenia but names no country | `registry_jurisdiction`, `residence_status`, `incorporation_statement` |
| Issuer / legal-entity domicile (`issuerDomicile`) | entity | Jurisdiction of incorporation or registration | "Armenian companies" | Operations or owners. A foreign parent can run Armenian operations | `registry_jurisdiction`, `incorporation_statement`, `subsidiary_list` |
| Exchange / listing location (`listingLocation`) | entity (equity) | Country of an exchange on which the equity is listed | "Listed in Armenia" | Domicile, operations or investors. Unlisted is never assumed from missing evidence | `exchange_listing_record`, `listing_statement` |
| Underlying asset / operating location (`operatingLocation`) | entity | Where the source places operations, licensed activity or concession assets | "Assets in Armenia" and "exposure to Armenia" at the level of named operations | How much is Armenian. Segment names are a reporting construct, not an asset census | `operations_statement`, `regulator_licence`, `concession_statement`, `segment_disclosure` |
| Reporting / valuation currency (`reportingCurrency`) | entity | Presentation currency of the source's figures | Which currency the amounts are in | Any geography | `presentation_currency_statement` |

Value states (validator-enforced):

- `known`: one or more ISO 3166-1 alpha-2 codes (or ISO 4217 codes for currency) with basis, source, locator and excerpt. A currency code in a geographic dimension is rejected ("Currency is not geography"), and the reverse is rejected too.
- `non_resident` (investor domicile only): the source states non-residence. The country list stays empty.
- `unknown`: no codes, basis or source. It needs a reason: `not_stated_in_source`, `not_reviewed_in_pilot`, `no_inference_from_name` or `no_listing_found`.
- Bases such as `name_inference`, `legal_form_suffix` or `reporting_currency`, and any basis borrowed from another dimension, are rejected.

What the three phrases mean in this model:

- **"Assets in Armenia"** means entities whose `operatingLocation` includes AM. It is a list of entities with sourced Armenian operations, never an amount.
- **"Armenian investors"** means ownership claims whose `investorDomicile` is AM. Non-resident and unknown holders are listed separately, never folded in.
- **"Exposure to Armenia"** means a path from a holder to an entity with Armenian `operatingLocation`, with every intermediate shown. The pilot does not compute a look-through share or any exposure value.

## 4. Query and view examples

Filtering the pilot data by "Armenia" under each dimension gives different answers. These are record counts, not values.

| Query | Result | Why it differs |
|---|---|---|
| Operating location = Armenia | Ameriabank, Converse Bank, ACBA BANK, Armenia International Airports, **Corporación América Airports** (5) | CAAP is incorporated in Luxembourg and listed in New York, but it reports an Armenia segment |
| Issuer domicile = Armenia | Ameriabank, Converse Bank, ACBA BANK, Armenia International Airports (4) | CAAP drops out. Operating in Armenia does not make it Armenian |
| Listing location = Armenia | ACBA BANK (1) | Only ACBA's equity is in an AMX listing record. CJSCs are `unknown` (`no_listing_found`), not "unlisted" |
| Investor domicile = Armenia | The Armenian Apostolic Church (Mother See) → Converse Bank (1 claim) | All Ameriabank holders are foreign. Converse's two largest holders are non-resident |
| Investor domicile = non-resident | Advanced Global Investments LLC and HayPost Trust Management S.a.r.l. → Converse (2 claims) | Armenia is excluded, but no country is known |
| Investor domicile = unknown | ACBA FEDERATION CJSC → ACBA; the two indirect S.a.r.l. links (3 claims) | Armenian-looking names and suffixes are not evidence |
| Reporting currency = AMD | Ameriabank (1) | Not a geography query. CAAP reports in USD and still has Armenian operations |

The modal opens on "Operating location = Armenia". Preset buttons switch to investor and issuer domicile, so the difference shows in one click. The dimension and value selectors cover every dimension, including "Unknown" and "Non-resident".

## 5. Cross-border examples (real, sourced)

1. **Armenian bank, foreign holders, foreign listed parent.** Ameriabank CJSC was established under Armenian law, and its operations are "primarily located in Armenia". Its 31 December 2025 holders are Lion Finance Group PLC 60.00% (England and Wales, listed on the LSE main market), Bank of Georgia JSC 30.00% (LEI jurisdiction GE) and the EBRD 10.00% (an international financial institution; the LEI jurisdiction field is GB). The asset location is Armenia. The investor domiciles are GB, GE and GB-recorded IFI. The listing of the parent is GB. The reporting currency is AMD.
2. **Armenian bank, non-resident holders, kept chains.** Converse Bank CJSC: "Advanced Global Investments" LLC 72.89% and HayPost Trust Management S.a.r.l. 22.11% are both "non-resident" with no country stated. Each has a 100% "indirect significant participant" ("Advanced Global Investments" S.a.r.I.; PostFinance international S.a.r.I.), and both intermediates are kept. A natural person at the top of one chain is excluded without a name. The Mother See of Holy Etchmiadzin, 5%, is "resident".
3. **Foreign issuer, Armenian operations.** Corporación América Airports S.A. was incorporated in Luxembourg and is listed on the New York Stock Exchange. It presents its statements in U.S. dollars and has an Armenia reportable segment. Its subsidiary Armenia International Airports CJSC (listed against Armenia in Exhibit 8.1) holds the Zvartnots concession. The ownership percentage is unknown (not stated in the passages reviewed).
4. **Listed in Armenia, mixed holder evidence.** ACBA BANK OJSC is AMX-listed (equity, status "Listed"). AMX itemises ACBA FEDERATION CJSC 75% (domicile unknown: no country field, no LEI found) and Proparco 10% (LEI jurisdiction FR).

## 6. Armenia source-discovery checklist

Status key: **Used**: facts in the pilot. **Reviewed**: opened, no facts taken. **Unavailable**: not accessible or not permitted in this pass.

| Source family | Entry (evidence link) | Language | Identifiers | Disclosure scope / threshold | Access and reuse | Cadence | Gaps | Status |
|---|---|---|---|---|---|---|---|---|
| CBA licensed-bank register | [cba.am/en/licensed-banks](https://www.cba.am/en/licensed-banks/) | en, hy | CBA licence number, bank code, SWIFT, TPIN (tax ID, not stored) | All licensed banks; no shareholders | © CBA; [terms](https://www.cba.am/en/terms-of-use/): content protected, informational use | Undated, updated as licences change | No ownership; heads of bank are natural persons (not stored) | Used (licence facts only) |
| Banks' own significant-shareholder disclosures | e.g. [Converse Bank shareholders](https://conversebank.am/en/shareholders/), [Ameriabank significant shareholders](https://ameriabank.am/en/about-ameriabank/significant-shareholders) | en/ru/hy; Armenian prevails | Names only; residence status | "Significant participants" plus indirect significant participants | © each bank, no open licence; short factual excerpts with attribution | Page "last update" stamps (Converse: 2025-02-14) | Ameriabank's list was not present in the fetched HTML, so the annual report was used instead. Many banks list individuals | Used (Converse); Reviewed (Ameriabank page) |
| Bank annual reports (IFRS notes) | [Ameriabank Annual Report 2025](https://ameriabank.am/Portals/0/files/ir/annual-reports/annual_report_2025_eng.pdf) | en | None in the table | Full shareholding table at year end | © Ameriabank, all rights reserved | Annual | Lag of several months | Used |
| Armenia Securities Exchange (AMX) issuer database | [Listed shares](https://amx.am/en/instruments/shares), [listing rules](https://amx.am/en/listing_markets); API records [issuer/2](https://amx.am/api/issuer/2), [major-shareholders/2](https://amx.am/api/major-shareholders/2) | hy/en/ru | Ticker, ISIN (not stored), internal id | Major shareholders where the issuer flag `has_major_shareholders` is set; no total row | © AMX, all rights reserved; robots `Content-Signal: use=reference` | Record update stamps (2026-05-07) | No country/residence field for holders. Two other flagged issuers list individuals | Used (ACBA) |
| State Register of Legal Entities | [e-register.moj.am](https://e-register.moj.am/en/) (old site old.e-register.am, current to 25.12.2025) | hy, en, ru | State registration number, TPIN | Company search; beneficial-ownership declarations are submitted here | Not reviewed. Holds personal data (founders, BO declarants), and access limits are unverified | Continuous | BO data are personal data and out of scope | Unavailable (not accessed) |
| Armenian National Interests Fund / state property management | No official entry verified in this pass | — | — | State holdings | — | — | A reported 2024 reorganisation could not be confirmed from a primary source, so no state holding is in the pilot | Unavailable |
| Pension and investment fund managers | [CBA licensed managers](https://www.cba.am/en/licensed-investment-and-pension-fund-managers/) (lists "AMUNDI-ACBA ASSET MANAGEMENT" CJSC and others) | en, hy | Licence; fund LEIs exist in GLEIF | Fund portfolio disclosures on managers' sites (not reviewed) | © CBA / managers | Monthly or quarterly (unverified) | "Armenian investor" outward holdings are not collected | Reviewed |
| Development-institution project disclosures | [EBRD projects](https://www.ebrd.com/home/what-we-do/projects.html), [IFC disclosures](https://disclosures.ifc.org/), ADB projects (HTTP 403 to scripted access) | en | Project numbers | Investment intent and size at approval, not current holdings | Each institution's terms (not reviewed) | Per project | Not holdings evidence | Reviewed (EBRD, IFC); Unavailable (ADB) |
| Foreign regulators' filings | [SEC EDGAR 20-F](https://www.sec.gov/Archives/edgar/data/1717393/000110465926029442/caap-20251231x20f.htm), [Exhibit 8.1](https://www.sec.gov/Archives/edgar/data/1717393/000110465926029442/caap-20251231xex8d1.htm); [FCA NSM RNS](https://data.fca.org.uk/artefacts/NSM/RNS/a746d49f-ea50-4c6d-a5b0-9dd0f6bfca90.html) | en | CIK, accession, LEI | Issuer's own statements on incorporation, listing, segments, subsidiaries | SEC: free reuse; [NSM terms](https://data.fca.org.uk/artefacts/NSM_Terms_of_Use.pdf): "any lawful purpose" | Annual or periodic | Subsidiary percentages are often absent | Used |
| GLEIF LEI records | [api.gleif.org lei-records](https://api.gleif.org/api/v1/lei-records/5493007B2FR3CCMU7O30) | en plus local-script legal names | LEI; Level 2 consolidation parents | Entities that obtained an LEI | [CC0](https://www.gleif.org/en/meta/lei-data-terms-of-use) | Daily golden copy | Many Armenian holders have no LEI (AGI LLC, HayPost Trust Management, ACBA FEDERATION) | Used |
| Private-market holdings | — | — | — | Private companies, non-bank holdings and individuals' assets have no disclosure source | — | — | Explicit gap | Unavailable |

Identifier mapping rules: LEI is the only cross-border identifier stored. A bank-disclosure holder name is linked to an LEI only when the record's legal or other name matches exactly or a structural link corroborates it. Bank of Georgia JSC is corroborated: its LEI's direct consolidation parent is Lion Finance Group PLC's LEI. Every such link is a reviewable candidate under #5, not a merge. The PostFinance case is the counter-example: GLEIF has a "PostFinance International Development B.V." (NL), and it is **not** linked to "PostFinance international S.a.r.I.".

## 7. Pilot manifest (bounded)

| Subject | Kind | Facts | Source family |
|---|---|---|---|
| Ameriabank CJSC | Armenian bank | 3 holder claims; domicile, operations, currency | Annual report 2025; GLEIF (holders) |
| Converse Bank CJSC | Armenian bank | 3 holder claims plus 2 indirect links; domicile, operations | Bank page; GLEIF; CBA |
| ACBA BANK OJSC | AMX-listed Armenian bank | 2 holder claims; domicile, listing, operations | AMX; GLEIF; CBA |
| Armenia International Airports CJSC | Armenian operating subsidiary | 1 parent claim (percentage unknown); domicile, operations | SEC 20-F and Exhibit 8.1 |
| Corporación América Airports S.A. | Foreign issuer (not Armenian) | domicile, listing, operations, currency | SEC 20-F |
| Lion Finance Group PLC | Foreign holder | domicile, listing | FCA NSM RNS |

Caps (validator-enforced): at most five Armenian entities. An Armenian entity is one with a sourced Armenian issuer domicile or a sourced Armenian investor domicile. Operating in Armenia alone does not count. The pilot has 5: the four Armenian subjects and the Mother See. There are at most 30 sourced facts (ownership claims plus known entity-dimension values). The pilot has 27.

## 8. Coverage limitations

- Each coverage label states only the source's disclosed universe. Ameriabank: a three-holder table with the source's own 100.00% row. Converse: significant participants on a page last updated 2025-02-14. ACBA: two itemised AMX holders with no total row. AIA: the parent relation only.
- Four Armenian banks and one airport operator are not the Armenian economy. There is no census, ranking, country total or "Armenian wealth" figure, and the data model has no field to hold one.
- Converse's page and AMX records carry update stamps, not statement dates. They are labelled as such.
- Non-bank Armenian companies, state holdings, pension-fund portfolios and the Armenian outward investments of residents are not covered.

## 9. Acceptance-criteria checklist (mapped)

- [x] Country-dimension dictionary with independent fields and can/cannot-say rules: §3; enforced in `src/country-data.js`.
- [x] Currency never substitutes for geography: §3; validator rejects currency codes in geographic dimensions and currency bases; test "currency is never geography".
- [x] Unknown stays unknown; no inference from a name alone: §3, §6 (mapping rules); ACBA FEDERATION, AGI and HayPost cases.
- [x] Cross-border paths keep intermediates: §5 example 2; `paths` must chain claim-to-claim; `ownershipPath` returns `derivedPercentage: null`.
- [x] At least three cross-border examples separating asset location from investor and issuer domicile: §5 (four).
- [x] Armenia source-discovery checklist with language, identifiers, thresholds, access/reuse, cadence, gaps and evidence links; unavailable categories marked: §6.
- [x] Query/view examples that filter each dimension independently and show differing results: §4; UI selectors and presets; unit and browser tests.
- [x] Bounded pilot: ≤5 Armenian entities, ≤30 claims, legal entities only, natural persons excluded without names, no country total: §7, §11.
- [x] Assumptions and decisions listed: §10.

## 10. Assumptions and decisions needed

Assumptions:

- A CBA banking licence is sufficient evidence of Armenian operating activity for a bank. It does not locate every asset.
- "Resident" in an Armenian bank's disclosure is recorded as investor domicile AM, and "non-resident" as excluding AM with no country.
- An LEI registry jurisdiction is an acceptable basis for investor domicile. For an international organisation (EBRD), it is shown with a caveat.
- An issuer's subsidiary list pairing an entity with a country is an acceptable basis for that subsidiary's domicile.

Decisions needed from the maintainer:

1. Confirm the "Armenian entity" definition used for the cap: sourced domicile or residence, not operating location.
2. Confirm that "all rights reserved" bank and exchange pages may be cited for short factual excerpts with attribution, as done here, or name sources to drop.
3. Decide whether a state-holding source (State Property Management Committee or a successor) should be researched next, and in which language.
4. Decide whether e-register.moj.am company data (legal entities only) may be used, given its personal-data content.
5. Decide whether segment-level amounts may ever be shown for cross-border issuers. The recommendation is no, until a look-through methodology exists.

## 11. Implemented pilot

Implemented 2026-10-24 as an isolated, closed-by-default modal layer, "Country exploration: Armenia · Pilot". It follows the institutional, bond, gold and property pilot pattern.

### Files

- `src/country-data.js`: data, the dimension dictionary, the strict validator (runs at import), `queryCountry`, `dimensionValues`, `ownershipPath`, `armenianEntityIds` and `factCount`.
- `src/country-view.js` and `src/country.css`: the native `<dialog>`, launcher `#country-launcher`, dimension and value selectors (`#country-dimension`, `#country-value`), presets, cards and `<details>` evidence.
- `tests/country.test.mjs`: jsdom unit and rejection tests. `tests/browser-country.mjs`: Playwright at 320/390/1280 px, wired from `tests/browser-smoke.mjs`.
- Minimal integration in `index.html`, `src/app.js` (import, mount and mobile list) and the `scripts/prepare-site.mjs` allowlist.

### What was collected (11 ownership claims, 16 known entity-dimension values; 27 of 30)

All sources were retrieved 2026-10-24.

- **Ameriabank Annual Report 2025** ([PDF](https://ameriabank.am/Portals/0/files/ir/annual-reports/annual_report_2025_eng.pdf), PDF p. 52, printed pp. 101–102, as of 2025-12-31): Lion Finance Group PLC 60.00%, Bank of Georgia JSC 30.00%, EBRD 10.00%. The source also gives "established … under the laws of the Republic of Armenia", "operations are primarily located in Armenia" and "The AMD is also the presentation currency".
- **Converse Bank shareholders page** ([page](https://conversebank.am/en/shareholders/), last update 2025-02-14): "Advanced Global Investments" LLC 72.89% (non-resident), HayPost Trust Management S. a. r. l. 22.11% (non-resident), and The Armenian Apostolic Church, presented by Mother See of Holy Etchmiadzin, 5% (resident). Two indirect 100% links: "Advanced Global Investments" S.a.r.I. → AGI LLC and PostFinance international S.a.r.I. → HayPost Trust Management.
- **AMX** ([major-shareholders/2](https://amx.am/api/major-shareholders/2), updated 2026-05-07; [issuer/2](https://amx.am/api/issuer/2), updated 2026-02-09): ACBA FEDERATION CJSC 75.0000% and Proparco 10.0000% of ACBA BANK OJSC; equity ticker ACBA, status "Listed".
- **CBA licensed-bank register** ([page](https://www.cba.am/en/licensed-banks/), undated): Converse Bank licence no. 57 (issued 12/20/1993) and ACBA BANK licence no. 70 (3/29/1996).
- **CAAP Form 20-F 2025 and Exhibit 8.1** ([20-F](https://www.sec.gov/Archives/edgar/data/1717393/000110465926029442/caap-20251231x20f.htm), [Ex. 8.1](https://www.sec.gov/Archives/edgar/data/1717393/000110465926029442/caap-20251231xex8d1.htm), filed 2026-03-17): incorporated in Luxembourg; NYSE (CAAP); presented in U.S. dollars; six segments including Armenia; AIA "our subsidiary" holding the Zvartnots concession; AIA listed against Armenia.
- **Lion Finance Group FY25 RNS** ([NSM](https://data.fca.org.uk/artefacts/NSM/RNS/a746d49f-ea50-4c6d-a5b0-9dd0f6bfca90.html), 2026-02-25): "Registered under number 10917019 in England and Wales" and "listed on the London Stock Exchange's main market".
- **GLEIF LEI records** (CC0): jurisdictions for Lion Finance Group (GB), JSC Bank of Georgia (GE), EBRD (GB), Proparco (FR), Converse Bank (AM) and ACBA BANK (AM). LEIs are stored for these entities and for Ameriabank and CAAP.

### Invariants enforced by the validator

- Exactly five dimensions in a fixed order. Each value is `known`, `non_resident` or `unknown`, with strict keys. Bases are allowlisted per dimension. Country codes and currency codes cannot cross.
- A known value needs its own source, locator and excerpt. An unknown value carries no codes or source and needs a reason.
- Stakes are decimal strings exactly as in the source, with a denominator. An unknown stake is null with `percentage_not_stated`, never 0% or 100%. Claim `as_of` equals the source `as_of`.
- Paths must chain claim-to-claim and keep every intermediate. There is no multiplication.
- Entity kinds are `legal_entity`, `international_organisation` and `religious_organisation`; natural persons are rejected. Exclusions have no name field. Subject entities need a coverage label.
- Sources: host allowlist (`ameriabank.am`, `conversebank.am`, `www.cba.am`, `amx.am`, `api.gleif.org`, `www.sec.gov`, `data.fca.org.uk`), https only, valid dates, `as_of ≤ retrieved`, an `as_of` basis label, and a mandatory reuse statement.
- Caps: ≤5 Armenian entities and ≤30 facts. Strict keys block any total, aggregate, ISIN or wealth field.

### Excluded, and why

- The named individual who owns 100% of "Advanced Global Investments" S.a.r.I. is recorded only as "natural person, excluded for privacy".
- AMX-flagged ARARATBANK OJSC and ARMECONOMBANK OJSC were not used. Their AMX major-shareholder records include individuals (ARARATBANK: one of two itemised holders; ARMECONOMBANK: all three). One AMX-listed subject fits the five-entity cap.
- Bank heads, addresses, phone numbers and TPINs on the CBA page were not stored. ISINs from AMX were not stored.
- No state holding: the Armenian National Interests Fund's current status could not be verified from a primary source in this pass.
- The State Register (e-register.moj.am) and its beneficial-ownership declarations were not accessed: personal data, and access terms not reviewed.
- Converse's "Total Shareholders՚ Equity: 19,947,633,300 AMD" was not used as a reporting-currency fact. It is a stated amount, not a presentation-currency statement.
- AIA's ownership percentage: the reviewed 20-F passages and Exhibit 8.1 do not state it, so it is kept `unknown`.
- Lion Finance Group's own holding in JSC Bank of Georgia was not collected, so no look-through from Lion through Bank of Georgia to Ameriabank is shown.

### Remaining limits

- The pilot is explanatory, not comprehensive. It is not refreshed and has no ingestion pipeline.
- Bank pages are English renderings, and the Armenian versions prevail. The Armenian texts were not compared line by line.
- Extending scope needs a new source review and maintainer approval.
