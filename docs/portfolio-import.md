# Full reported portfolio contract

The admitted release covers nine Q2 2026 SEC Form 13F filing families observed on 18 October 2026: BlackRock, Berkshire Hathaway, State Street, Geode Capital Management, JPMorgan Chase, Morgan Stanley, Goldman Sachs, Norges Bank and Vanguard Global Advisers, LLC. Their effective tables contain **162,082 reported rows**; **158,145 rows** qualify for the share view and **3,937 rows** are excluded. A complete public information table is not a complete economic portfolio or current holdings.

The shared network contains **5,657 verified cross-filer instrument groups**, plus **14,835 unmatched source-scoped instruments**, giving **20,492 instrument nodes**. These counts are not legal-issuer or company counts. Strict class-label matching deliberately leaves differently described instruments separate.

## Inputs and independent admission

`data-foundation/portfolios/input/*.normalized.json.gz` contains losslessly compressed normalized factual records, not raw filing XML. Decompression reproduces the exact independently reviewed input bytes. A sibling `*.review.json` binds an independent approval to that SHA-256 and records source identity, amendment discovery, row counts, dollar totals, share partition, spot checks and publication scope. The exporter rejects missing, stale or incomplete admission. The importer never creates review approvals; an independent reviewer must perform the checks and issue a byte-bound review.

Independent review mechanically compared every retained normalized row/field with official XML, rechecked primary-source bytes, spot-checked official filings, and checked SEC submissions history for amendments. This is not a claim of per-row human review. The five new filers contribute 104,126 reported rows and 101,050 eligible share rows. The original three filers' admitted rows, totals and amendment handling remain unchanged.

Material source qualifications remain visible:

- BlackRock is a parent filer reporting on behalf of operating subsidiaries in a combination report. Its source reference `0` remains unresolved without an invented manager identity.
- Morgan Stanley is a combination report. Morgan Stanley Institutional Investment Advisors LLC reports separately and its separate holdings are outside this table. Its 110 rows with unresolved manager references remain intact; zero-padding-equivalent references resolve to the same listed manager without altering the reported reference strings.
- Norges Bank states that collateral received through secured lending and borrowing transactions, which it may sell or pledge, is excluded unless reinvested. Its cover qualification is preserved in public coverage.
- State Street uses its restatement only. Its original remains in the amendment ledger, never appended to the effective table. An explicit note class source-tagged SH remains in normalized data but is excluded from the share view.
- The original audit corrected an equity-weight ETF class falsely treated as a warrant. Fund shares are not excluded merely because their names contain an incidental `WT` substring.

### FMR is withheld

FMR LLC's 30 June 2026 filing has 13,978 information-table rows, agreeing with its cover count, but the [cover](https://www.sec.gov/Archives/edgar/data/315066/000031506626002260/primary_doc.xml) reports **$2,303,878,429,728** while the [table](https://www.sec.gov/Archives/edgar/data/315066/000031506626002260/20260814_FMRLLC.xml) sums to **$2,303,878,429,723**. The **$5 discrepancy** fails exact reconciliation. No FMR normalized/admitted input, public portfolio or graph memberships are included. The importer does not round away the discrepancy, invent an adjusting position, apply a tolerance or silently publish a partial table.

## Strict offline import

Python 3.9 or newer is required only for normalization; the website remains a static app. Acquire official SEC submissions JSON, the filing directory JSON, cover XML and information-table XML **outside the repository**. Keep the acquisition manifest and transient identity map outside the repository too. The importer performs no network requests and creates no publication or review approval.

Run into a staging output directory, not the admitted input directory:

```sh
python3 scripts/import-sec13f.py \
  --manifest /private/acquisition/filer-manifest.json \
  --output-dir /private/staged-normalized \
  --private-dir /private/transient-identities
```

The manifest contract is documented in the script's `--help` output. It includes filer slug/name/CIK, reporting date, checked-through timestamp, SEC submissions URL/local path and the complete requested-period `filings` array. Each filing supplies accession, form, filing/report/acceptance dates, official index/cover URLs, local cover/directory paths and a table document with official URL, local path, expected SHA-256 and byte length. Acquisition counts, if supplied, are independently recomputed.

The importer currently accepts the verified **X0202 whole-dollar schema** and **one information-table document per filing**. It explicitly withholds older/unknown schemas and multi-document filings rather than assuming units or omitting documents. Supported source values are whole USD, not thousands, following the [current Form 13F instructions](https://www.sec.gov/files/form13f.pdf). Adding another schema or document layout requires an explicit implementation, tests and source review.

The importer fails closed on:

- Missing or inconsistent filer identity, reporting dates, accession URLs, XML roots, required fields, table hashes or byte lengths.
- A manifest missing an observed requested-period original/amendment, or recent-submissions history that does not cover the period. Historical-submissions overlap requires expanded acquisition/support rather than an unsupported completeness claim.
- Unknown amendment types, missing originals, missing/out-of-order amendment numbers or ambiguous filing order. Restatements replace the prior active family; `NEW HOLDINGS` amendments append source rows.
- Any difference in declared and recomputed row counts or exact integer-dollar totals, including a one-dollar difference.
- Invalid quantities, ambiguous manager-reference syntax, conflicting issuer labels inside one exact source-scoped instrument group, or unsupported value units.

Source-scoped IDs are opaque first-row ordinals. Grouping uses the exact privately reported identifier, exact trimmed class label, quantity type and put/call within one source. No issuer-name guess, internal-whitespace collapse, capitalization rewrite or cross-filer join is performed by this importer. Malformed identifier content can remain a source-scoped reported identity, but cannot establish a cross-filer match.

The normalized output is deterministic gzip containing every effective row, source/cover reconciliation, manager lists/references, amendment lineage, qualifications and warnings. The separate private identity file has `portfolioId`, `reportingDate`, `inputSha256` and `instruments` with exact source identifiers and row ordinals. It is mode 0600, restricted to a location outside this repository, and must never enter a commit or site artifact. The normalized file never includes those identifiers or their hashes. `--overwrite` is required to replace outputs; changed bytes invalidate any prior review.

Only after independent complete-batch review should the normalized gzip and its approved sibling review be admitted to `data-foundation/portfolios/input/`. Any shared-identity release needs its own independently rebuilt, byte-bound review. Raw XML, acquisition manifests and private identity maps stay outside the repository throughout.

## Deterministic projection

Run `npm run data:export-portfolios`; `npm run check` verifies byte-for-byte reproduction. Validation independently recomputes counts and integer-dollar totals, validates source URLs/row IDs and share eligibility, and checks source-scoped instrument consistency. Invalid rows are recorded under the excluded quarantine directory and withhold the batch.

The share view includes SH rows without put/call, excludes explicit warrant/right classes, and excludes explicit NOTE/NOTES/DEB/DEBENTURE classes even if source-tagged SH. Fund shares, preferred shares, depositary receipts and reported units can remain; this is not a common-stock-only dataset. Equal-looking source lines and differing manager allocations are retained, not economically deduplicated. Unresolved references are reported, not guessed, and do not multiply a row's value.

## Public delivery and lineage

`data/portfolios.json` is a small summary/index. Each of the nine listed filers has an explicitly allowlisted compact JSON file. A groups dictionary preserves source-scoped instrument ID, source index, reported issuer label and class. Each row preserves ordinal, group index, value, quantity, discretion, manager references and voting authorities. Decoding reconstructs the exact source row ID. All retained fields can be compared back to the admitted normalized record.

The shared network loads the nine portfolios and independently reviewed opaque instrument-equivalence mapping. Matching requires the same date, exact valid source identifier, exact trimmed class, quantity type and option. Differently labeled classes, malformed/placeholder identifiers and ambiguous same-filer candidates stay separate. Public memberships use only opaque source-scoped IDs; no raw or hashed proprietary identifiers, addresses, signatures, XML, API credentials or security-master/ticker joins are public.

The initial overview uses top 20 instruments per filer, with top 40/60 controls and a **200-node ceiling**. Selecting a manager or instrument expands its actual available incoming/outgoing neighborhood in 20-connection pages, retaining context where space permits. Company-to-reporting-manager role links are explicit SEC-evidenced navigation, not holdings or issuer-class consolidation. List pages contain at most 50 source rows. Values do not size bubbles. Cross-filer values are never aggregated into unique exposure or ownership.

Normalized inputs, admission files, documentation and quarantine are excluded by both the exact Pages artifact allowlist and legacy Jekyll `_config.yml` exclusions. Keep GitHub Actions as the supported Pages source.

The export check also binds the instrument-equivalence map to each exact admitted input hash and active source, checks eligible membership/class/type/option and distinct filers, and recomputes coverage. Positional IDs cannot survive a changed re-import without rebuilding and independent review.

Vanguard Global Advisers, LLC (CIK 1811242) is one legal filer, not the whole Vanguard group or parent CIK 102909. Its 3,638 reported rows reconcile exactly and 3,635 qualify for the share view. The January 12, 2026 reporting realignment caveat is retained. Apple row 2864 is the same position as the existing historical managed-discretion and voting claims: the two datasets are non-additive evidence views, never extra economic exposure. The researched dataset remains unchanged at four claims.
