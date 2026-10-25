# National Pension Service: bounded reported-share admission

Tracking: [NPS #60](https://github.com/Eduard20/assets-map/issues/60). Adds **National Pension Service, SEC CIK 1608046**, at **30 June 2026**. This is reported Section 13(f) investment discretion, not a complete pension portfolio, current holding register, legal/beneficial ownership, control or Korean government ownership. The preceding twelve filers and unrelated UAE, card, bond, gold and property work remain unchanged. CalPERS and Temasek candidates are not included.

## Exact source scope and dates

Accession `0001193125-26-347818`, filed **13 August 2026**. The X0202 cover and complete table reconcile exactly: **552 rows / USD 155,079,663,358**. No tolerance, rounding adjustment or invented entry. The share view contains **551 rows / 551 source-scoped instruments / USD 155,075,664,624**.

The sole exclusion is row **552**, OCCIDENTAL PETE CORP, class `W EXP 08/03/202`, USD **3,998,734**. The abbreviated class is preserved without inventing an expiry date. This reported warrant remains in normalized evidence but not the share view; `SH` quantity alone does not make it an eligible share.

The cover is a **13F HOLDINGS REPORT**, with zero other included managers, no separately reporting manager list and explicit confidentiality-omitted `false`. This flag is preserved as reported, not a promise that all economic assets are disclosed.

Original amendment discovery was checked at **2026-10-24T10:07:09.568865+00:00**. The recent-submissions history extends to 7 November 2014 with no historical shards; one requested-period original and no amendments were observed. A separate independent fresh recheck later on 24 October reproduced every pinned source byte. The original normalized check timestamp remains unchanged rather than relabeling the historical snapshot. Prior filers retain their own original check dates.

## Primary evidence and independent admission

- [SEC submissions](https://data.sec.gov/submissions/CIK0001608046.json)
- [Filing index](https://www.sec.gov/Archives/edgar/data/1608046/000119312526347818/0001193125-26-347818-index.htm)
- [Cover and totals](https://www.sec.gov/Archives/edgar/data/1608046/000119312526347818/primary_doc.xml)
- [Information table](https://www.sec.gov/Archives/edgar/data/1608046/000119312526347818/56942.xml)

A separate reviewer freshly downloaded official sources, rebuilt every normalized position and grouping, compared all retained fields, and verified identity, manager scope, amendment history, share partition, totals and a byte-identical repeat import. Decompressed normalized SHA-256: `98b32c025f97751eed134514bf240a299abd16e0a24a514abc544c550c816edd`. Mechanical complete-row comparison is not individual human review of every holding.

An independent implementation also rebuilt instrument equivalence from all thirteen pinned information tables without calling the producer matcher. **545** NPS instruments match; **six** remain source-scoped. Removing NPS members recovers every previous group; four previously unmatched instruments gain new cross-filer groups. Total coverage: **162,696 eligible rows**, **43,978 source-scoped instruments**, **5,661 matched groups**, **14,837 unmatched instruments**, and **20,498 instrument nodes**, not legal issuers or companies. Effective source universe: **166,634 rows**, **3,938 exclusions**.

The equivalence admission binds exact pending-proposal SHA-256 `275168a990e047571190011bf6709578ebc6c128550117e1e0971b031b4df55c`. All preceding twelve normalized input hashes and official source hashes remain unchanged. The canonical proposal uses JavaScript numeric-key serialization; independent review confirms this only changes key order from the initial Python serialization, not content or identity rules.

## Interpretation, reuse and release boundaries

Each share-view weight uses only that filer's dated eligible-share USD total, not whole AUM or ownership percentage. No cross-filer value is summed as unique economic exposure. Non-13F assets, permitted omissions, private investments, shorts, undisclosed positions if any, other report dates and unknown ownership percentages remain gaps. A missing record does not prove a sale or no investment. Exact class/type/option/date matching remains conservative; unmatched descriptions stay distinct. Fund shares and depositary receipts remain where reported; this is not a common-stock-only dataset.

Independent review checked the [SEC Webmaster FAQ](https://www.sec.gov/about/webmaster-frequently-asked-questions), [EDGAR access guidance](https://www.sec.gov/search-filings/edgar-search-assistance/accessing-edgar-data) and [Form 13F instructions](https://www.sec.gov/files/form13f.pdf) on 24 October 2026. Acquisition was bounded, declared and paced, with no access bypass, paid source or expanded permissions.

Reviewed use is minimal factual research/navigation fields and official links. Raw XML, acquisition manifests, proprietary identifiers, identifier-derived hashes, reusable security-master lookups, addresses, signatures, contacts, logos and copied narratives stay out of the public repository and site. This is not blanket commercial or future-use licensing clearance.

The compact NPS file is individually allowlisted; normalized/review inputs remain excluded from the site. Source admission does not itself authorize publication. Fresh-base integration, independent exact-change review, full regression/data/build checks, hosted desktop/mobile browser QA and coordinated publication/deployment/live verification remain required.
