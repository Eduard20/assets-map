# Bounded SEC equity pilot: held candidates

Cutoff: 18 October 2026. Scope: **seven Apple-common-stock-related candidate claims**. No global holdings collection or additional asset class.

**Outcome: zero admitted claims; seven quarantined.** The selected source statements have precise evidence, but complete original/amendment discovery through the cutoff was not established. Marking observations historical does not waive that admission requirement. All source and identity decisions remain proposed; the generated live app continues to use its original illustrative sample.

## Candidate slices

- Apple 2026 proxy: Vanguard and BlackRock beneficial-disclosure rows, with the older underlying dates retained; Tim Cook and the 12-person management group, retaining the source's strict `<1%` bounds as null exact points.
- Historical Vanguard Schedule 13G: one shared-voting-authority observation.
- Vanguard Global Advisers' Q2 2026 13F: one Apple reported-discretion position and a separately typed voting-authority observation.

Cook is included in the management group; these are overlapping attribution rows. Managed and voting descriptions of VGA's same position cannot both increase exposure. The historical Vanguard parent and current VGA affiliate are different reporting entities/perimeters; no disposal, brand-wide zero or complete Vanguard portfolio is inferred.

The historical BlackRock filing identifies CIK **1364742**. It is not automatically merged into current CIK **2012383**. The original filing's 6.7% and the proxy's 7.10% use different contexts; the candidate retains the proxy's stated figure with its different-date denominator limitation, not a comparable calculated current stake.

## Evidence entry points

- [Apple 2026 proxy](https://www.sec.gov/Archives/edgar/data/320193/000130817926000008/aapl014016-def14a.htm): printed pages 81–82, ownership rows and footnotes; filing publication 8 January 2026.
- [Vanguard's 2025 Q2 Apple 13G amendment](https://www.sec.gov/Archives/edgar/data/102909/000093247125000778/xslSCHEDULE_13G_X01/primary_doc.xml): cover powers and Items 4/6. Full predecessor chain remains uncollected.
- [VGA Q2 2026 accession index](https://www.sec.gov/Archives/edgar/data/1811242/000181124226000015/0001811242-26-000015-index.html): cover, summary and information table, Apple ordinary common row.
- [Vanguard reporting realignment disclosure](https://www.sec.gov/Archives/edgar/data/1384905/000210012126000017/xslSCHEDULE_13G_X01/primary_doc.xml): filer is Vanguard Portfolio Management, CIK 2100121; the URL path's 1384905 identifies RingCentral, not Vanguard. It provides context, not a reconciled Apple holding or economic sale.
- [Historical BlackRock filing](https://www.sec.gov/Archives/edgar/data/320193/000108636424006980/0001086364-24-006980.txt): Amendment 14, cover rows 9/11 and Item 4. This link is evidence; no raw copy is stored.

Exact locators and distinct report/publication/retrieval timestamps are in `input/batch.json`. Source facts are stated by the filers/issuer; SEC hosting does not mean the SEC verified or endorsed them.

## Rights review for this review package

The [SEC webmaster FAQ](https://www.sec.gov/about/webmaster-frequently-asked-questions) and [SEC website dissemination policy](https://www.sec.gov/about/privacy-information) support reuse/further distribution of EDGAR public filing content. Independent review found a narrow basis to include these minimized factual candidates, CIK/accession references and citations in a public draft code review.

That decision is **separate from source admission or permission to publish an admitted ownership dataset**. It does not clear every third-party database, identifier, artwork or commercial use. Raw filings, proprietary security identifier values, personal addresses/signatures/contact details and artwork are omitted. A targeted payload scan was performed; it is not a universal data-loss-prevention guarantee.

The source candidates still record unsatisfied collection/identifier/publication/admission conditions. No automated SEC collector was built; the research used bounded public-web retrieval. Do not claim a tested SEC JSON or raw-XML ingestion service. The [SEC fair-access rules](https://www.sec.gov/filergroup/announcements-old/new-rate-control-limits) remain a separate gate for any future collector.

## Reproduction and next gate

Run the command in `docs/data-foundation.md`; the expected exit code is 2. Tests assert the exact 0/7 outcome and confirm that toggling positive review/rights flags cannot bypass incomplete amendment discovery. The validation report lists every blocker and the omitted fund, sovereign, direct-government, private-holder and cross-country slices. Those slices were not collected; this does not mean their official data is unavailable.

Before any real claim can be admitted: complete the necessary source/version chain, reconcile identities/perimeters, approve the exact required rights and review each candidate. Then regenerate and review the shadow projection. Live integration remains a separate approval and UI task.
