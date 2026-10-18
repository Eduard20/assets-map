# Vanguard Global Advisers: bounded admission proposal

Status: **Prepared for independent review; not admitted or published.** Evidence checked 18 October 2026 UTC. This proposal addresses the claimed Vanguard discovery slice of [issue #9](https://github.com/Eduard20/assets-map/issues/9#issuecomment-6252789914), following the [source-registry proposal](https://github.com/Eduard20/assets-map/issues/3#issuecomment-6248256057). It does not approve a brand-wide Vanguard dataset, merge, deployment or changes to the currently admitted eight filers.

## Recommendation

Consider one additional, separately labeled legal reporting manager: **Vanguard Global Advisers, LLC, CIK 1811242**, reporting date **2026-06-30**. The complete public information table passes existing strict offline normalization without importer changes. Its **3,635 eligible share-view rows** are a promising bounded expansion, subject to independent byte-bound admission, explicit existing-claim overlap treatment and a separately rebuilt/reviewed instrument-equivalence release.

These are reported Section 13(f) investment-discretion observations, not legal ownership, the manager's own balance-sheet assets, current positions, a complete economic portfolio or total Vanguard AUM. No parent/affiliate portfolio sum or unique cross-manager economic exposure is proposed.

## Official source inventory and freshness

- [SEC submissions history for CIK 1811242](https://data.sec.gov/submissions/CIK0001811242.json), acquired as raw JSON. Recent history extends to 2020-05-15, with no listed historical submission shards; it covers the requested quarter and amendment window.
- [Accession 0001811242-26-000015 filing index](https://www.sec.gov/Archives/edgar/data/1811242/000181124226000015/0001811242-26-000015-index.html): form 13F-HR, filed 2026-08-13, period 2026-06-30. Submissions acceptance timestamp is 2026-08-13T19:57:39.000Z; the index displays 15:57:39 without a timezone. Preserve the API timestamp rather than treating those displayed clocks as inconsistent.
- [Raw cover XML](https://www.sec.gov/Archives/edgar/data/1811242/000181124226000015/primary_doc.xml) and [rendered cover](https://www.sec.gov/Archives/edgar/data/1811242/000181124226000015/xslForm13F_X02/primary_doc.xml).
- [Raw information table](https://www.sec.gov/Archives/edgar/data/1811242/000181124226000015/13F_0001811242_20260630.xml), 1,670,926 bytes. The accession directory identifies one information-table document.

The requested-period family contains exactly one original and no observed 13F-HR/A as of the recorded cutoff, **2026-10-18T17:18:27Z**. The latest observed holdings report quarter is 2026-06-30; no Q3 holdings report was observed. This is a statement about disclosed evidence, not a claim that June holdings remain current. The Q1 2026 family includes an amendment (0001811242-26-000008); it is a different reporting period and must not be appended to Q2. Earlier VGA notice filings are not missing or zero-valued portfolios.

## Reporting perimeter and temporal boundary

The Q2 cover names Vanguard Global Advisers, LLC, Form 13F file number 028-20273, identifies a **13F HOLDINGS REPORT**, lists **zero other included managers**, and reports confidential omissions as false. Retain all these qualifications; the absence of included managers does not establish economic independence of all positions.

**Do not relabel this filer as The Vanguard Group, Inc.** The historical parent CIK **102909** is a distinct source scope. The [Vanguard Portfolio Management Schedule 13G](https://www.sec.gov/Archives/edgar/data/1384905/000210012126000017/xslSCHEDULE_13G_X01/primary_doc.xml) explains a January 12, 2026 internal realignment and disaggregated reporting. That document concerns Vanguard Portfolio Management and its stated affiliates; it is contextual boundary evidence, not proof that VGA covers every successor business or an exhaustive affiliate reconciliation.

Consequently:

1. Keep the exact VGA legal-filer label and date in portfolio selection, coverage, source links and graph details.
2. Do not transfer the historical parent's figures to this filer, infer a parent sale from a missing/zero report, or draw a continuous same-scope time series across the reorganization.
3. Do not add this report to parent, fund or affiliate reports to infer Vanguard family AUM, ownership or unique exposure.
4. Keep the unresolved broader Vanguard reporting perimeter visible. Admission of this self-contained table need not pretend that the entire brand perimeter is solved.

## Exact reconciliation and exclusions

The X0202 cover and raw table agree exactly in whole USD:

| Check | Result |
| --- | ---: |
| Cover entry total / parsed source rows | 3,638 / 3,638 |
| Cover value / integer sum of source rows | $214,603,824,175 / $214,603,824,175 |
| Eligible share-view rows | 3,635 |
| Eligible share-view value | $214,603,821,939 |
| Excluded rows / excluded value | 3 / $2,236 |
| Distinct source-scoped instruments / eligible instruments | 3,638 / 3,635 |
| Unresolved manager references / importer warnings | 0 / 0 |

All three excluded rows are explicit warrant classes, despite SH quantity tags. Preserve them in the complete normalized source table, exclude only from the share view:

- XML ordinal 689: ALTISOURCE PORTFOLIO SOLUTIO, class `*W EXP 04/02/202`, $920.
- XML ordinal 1235: DEFI DEVELOPMENT CORP, class `*W EXP 01/21/202`, $2.
- XML ordinal 2145: ALTISOURCE PORTFOLIO SOLUTIO, class `*W EXP 04/30/203`, $1,314.

The eligible view retains the existing contract: SH without put/call, excluding explicit warrant/right and debt classes. It is not necessarily common stock only. No rounding tolerance, adjusting position, dropped duplicate, corrected source label or legacy thousand-dollar multiplier was used.

## Existing Apple evidence: one position, multiple representations

The historical researched batch already contains `cand_vga_managed_apple2026q2` and `cand_vga_voting_apple2026q2`, both under entity `ent_vanguard_global_advisers`, perimeter `per_vga_13f2026q2`, position scope `per_vga_13f2026q2_apple_common`, and overlap group `ov_vga_same_position_roles`.

The corresponding complete-table observation is **ordinal 2864**, source row `sec13f-0001811242-26-000015-row-02864`, APPLE INC / COM: **31,661,076 shares**, **$9,161,448,952**, investment discretion **DFND**, blank other-manager reference, sole voting **31,661,076**, shared voting **0**, no voting **0**. These fields match the existing selected-row claims. APPLE HOSPITALITY REIT INC at ordinal 15 is a different source instrument and must not be matched by a name prefix.

The two researched claims and this portfolio row are not three holdings. Any combined graph must link them to the same evidenced position or present them as explicitly separate non-additive evidence views. Managed discretion and voting authority remain different predicates; do not delete the voting semantics, double-count the share quantity/value, or call voting authority legal title. The pre-real-ignment parent evidence remains separately dated and non-additive.

A later implementation should add a regression test proving that navigating between the existing Apple evidence and this portfolio row preserves one position scope without creating an extra economic holding. Do not expand the researched-claim count merely by importing every table row into that different dataset.

## Publication and admission gates

The [SEC reuse FAQ](https://www.sec.gov/about/webmaster-frequently-asked-questions) permits reuse of public EDGAR filing content. The proposed narrow output remains factual normalized fields and direct SEC links under the existing portfolio contract. That does not settle proprietary identifier licensing or every commercial reuse question. Keep raw XML, accession acquisition manifests, private security identifiers and their derived identifier hashes out of repository history, public comments, site artifacts and attachments. Do not add a ticker/security-master join.

The existing importer was run unchanged into non-public staging. A subsequent staged-only coverage qualification explicitly records the VGA legal-filer/parent boundary and the non-additive Apple representations; no source row or numeric field was changed, and the private identity binding was updated to the final input hash. Its readiness remains `independentAdmission: pending`; no approved review was manufactured. The following steps are still required before publication:

1. Independent reviewer verifies legal filer, date, discovery completeness, exact raw bytes, every retained normalized field, partitions and the permitted minimal factual publication scope, then binds approval to the exact normalized SHA-256.
2. Reviewer checks the three warrant exclusions and Apple overlap mapping, and verifies no inappropriate parent/brand semantics in the proposed UI label.
3. Any graph integration rebuilds the instrument-equivalence mapping from the exact admitted inputs, independently reviews it, preserves unmatched instruments and does not sum cross-filer values into ownership or unique exposure. No cross-filer match count is claimed in this proposal.
4. Only then may a separately authorized implementation add the input/review, allowlist entry, scope labels, tests and projections. Re-run all deterministic export, foundation, application and browser checks and inspect the final site artifact for raw/private content before review or release.

Current public totals remain **eight filers / 154,510 eligible rows**. If this exact batch alone were later admitted, the arithmetic eligible-row count would become 158,145; this is only a row-count projection, not a released result or exposure aggregate. Other concurrent batches must be accounted for at integration time.

## Reproducibility record

These hashes identify full documents/normalized bytes, not hashes of proprietary identifiers:

- Cover XML SHA-256: `b94343eb4adaf1ab25efc8c4d69d02e4daeea2101c703efb7109d19c0f344268`.
- Information-table XML SHA-256: `1fc17579cfda9c1570c8b88f180ac7619dd51e9659ccec92f937962668d6e8fe`.
- Submissions JSON SHA-256: `0e461409d04c290b7eacbb68d748a961596c44c46322df5b8a70af800678e26a`.
- Decompressed normalized factual input SHA-256: `f86d87b74433a86cf596300ee83a0bce5b5259e5f37932a363ef3dc3a6814aa8`.

Checks completed: official cover/index reading, raw submissions/directory/cover/table acquisition, exact cover/table reconciliation, unchanged fail-closed importer, same-source Apple field comparison and explicit warrant review. Independent admission, public export/integration, shared-network rebuild and browser QA were **not performed** by this proposal. No admitted input, public export, application file or shared code was edited.

## Admission implementation checkpoint

The initial proposal above records its discovery-stage limits. Subsequent independent review approved the exact normalized input SHA-256 `f86d87b74433a86cf596300ee83a0bce5b5259e5f37932a363ef3dc3a6814aa8`. A separate full nine-filer source reconstruction approved pending equivalence proposal SHA-256 `3828aa7980a6c533fcb454ff3cd2285b6fe2d31377c42855ef52e1d53a900179`: 158,145 eligible rows, 5,657 matched groups and 24,592 memberships. Earlier eight input hashes are unchanged. The implementation retains unmatched instruments, adds only the exact VGA legal-filer portfolio, preserves both historical Apple role claims in their non-additive evidence view, and keeps raw sources/private identities outside the repository. Publication still depends on complete application/data/browser checks and coordinated review.
