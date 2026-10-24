# CPP and Swiss National Bank: bounded reported-share admission

Tracking: [CPP #54](https://github.com/Eduard20/assets-map/issues/54) and [SNB #55](https://github.com/Eduard20/assets-map/issues/55).

This data-only candidate adds two exact legal filers at **30 June 2026**. It preserves the released UAE/card UI and dataset and does not include the separate CalPERS or Temasek candidates. Local admission is not publication or live deployment.

| Filer | SEC CIK | Accession | Filed | Source/share rows | Exact whole-dollar source/share value |
|---|---|---|---|---:|---:|
| Canada Pension Plan Investment Board | 1283718 | 0001104659-26-097308 | 14 August 2026 | 1,694 | $180,776,675,190 |
| Swiss National Bank | 1582202 | 0001582202-26-000007 | 11 August 2026 | 2,301 | $191,389,544,938 |

Both covers are **13F HOLDINGS REPORT**, with zero other included managers and no separate-reporting manager list. CPP’s confidential-omission flag is absent and retained as null, not converted to false. SNB explicitly reports false, preserved as reported. Neither establishes complete investment-portfolio coverage. Every row passes the existing share filter; no options/debt/warrants were removed from these two tables. Quantities, classes, reported discretion and form-defined voting authority remain distinct.

## Evidence and independent review

Official sources, freshly retrieved independently on 24 October 2026:

- CPP [submissions](https://data.sec.gov/submissions/CIK0001283718.json), [filing index](https://www.sec.gov/Archives/edgar/data/1283718/000110465926097308/0001104659-26-097308-index.html), [cover](https://www.sec.gov/Archives/edgar/data/1283718/000110465926097308/primary_doc.xml), [table](https://www.sec.gov/Archives/edgar/data/1283718/000110465926097308/infoTable.xml).
- SNB [submissions](https://data.sec.gov/submissions/CIK0001582202.json), [filing index](https://www.sec.gov/Archives/edgar/data/1582202/000158220226000007/0001582202-26-000007-index.htm), [cover](https://www.sec.gov/Archives/edgar/data/1582202/000158220226000007/primary_doc.xml), [table](https://www.sec.gov/Archives/edgar/data/1582202/000158220226000007/InfoTable_Q22026.xml).

The complete recent-submissions histories predate this quarter and list no historical shards. Each has one requested-quarter original and no amendments observed at the check. This is a check-date-bounded finding, not an automatic future refresh. Existing ten inputs and their original correction-check dates are unchanged.

A separate reviewer compared every retained field of all **3,995 new rows** against fresh official XML and checked exact integer-dollar totals, identities, cover scope, filing dates, amendment discovery, eligibility and missing flags. No tolerance, adjustment row or fuzzy identity match was used. Admission binds the decompressed normalized hashes:

- CPP: `e289b088497f3dc97e4c25f7ce97f0b89138fc49fe509963a81a037ecb38038a`
- SNB: `44108b92aca75b121f5d788a1bd869ac09a68b73755500121c56107b7ca84bb8`

An independent implementation rebuilt equivalence from all **162,145 eligible source rows** across the exact twelve inputs and pinned official source bytes. Every new instrument matches an existing group. The candidate contains **5,657 matched groups**, **14,835 unmatched instruments**, and **20,492 instrument nodes**, unchanged; it adds 3,995 filer-to-instrument connections. Total source rows become **166,082**, with the existing **3,937 exclusions** unchanged. These are not unique company counts. The pending proposal SHA-256 is `d89c1d65b61284b0f6d35ea336d18aeb57f581228610a9567b1a51bd82605469`.

## Meaning and gaps

These are **historical Section 13(f) investment-discretion disclosures**, not legal/beneficial ownership, current positions, complete investment portfolios, whole pension assets, all central-bank reserves, gold holdings, or Canadian/Swiss government ownership. No parent/government edges or ownership percentages are inferred. A share-view weight uses only that exact filer's dated eligible-row USD total; cross-filer values are never summed into economic exposure.

Non-13F assets, permitted omissions, confidential positions if any, private investments, shorts, other reporting dates, and unknown ownership percentages remain gaps. Missing records are not proof of a sale or no holding. Exact class matching keeps differently labeled classes separate and does not consolidate legal issuers.

## Source-use and publication boundary

The [SEC Webmaster FAQ](https://www.sec.gov/about/webmaster-frequently-asked-questions) supports access/reuse of EDGAR public filing content; its separate proprietary 13(f) list limitation remains relevant. The [EDGAR access guidance](https://www.sec.gov/search-filings/edgar-search-assistance/accessing-edgar-data) and [Form 13F instructions](https://www.sec.gov/files/form13f.pdf) were also independently inspected. Acquisition was bounded and paced; no vendor, paid service, access bypass, credentials or expanded permissions were used.

The reviewed use is minimal normalized factual research/navigation plus official evidence links in the existing non-monetized portal and public repository. Raw XML, acquisition manifests, proprietary identifiers, identifier-derived hashes, reusable security-master lookups, addresses, signatures, contact details, logos and copied narrative are excluded. This is not blanket commercial or future-use licensing clearance.

New compact files are individually allowlisted. All normalized/review inputs remain excluded from the site artifact. Exact existing-input hashes, new hashes, all-row compact export equality, source-specific dates, shared connections and the 200-node graph bound are tested. Hosted browser QA, publication, deployment and live verification are required release gates; data admission alone does not satisfy them or bypass any native confirmation.
