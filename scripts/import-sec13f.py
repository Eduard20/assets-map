#!/usr/bin/env python3
"""Fail-closed, offline SEC 13F normalization, with NO admission/review approval.

Usage: python3 scripts/import-sec13f.py --manifest /private/filer-manifest.json \
  --output-dir data-foundation/portfolios/input --private-dir /private/identities

The acquisition manifest has slug, name, cik, reportingDate, checkedThrough,
submissionsUrl, submissionsPath and filings[]. Each filing has accessionNumber,
form, filingDate, reportDate, acceptanceDateTime, filingIndexUrl, coverUrl,
coverPath, directoryPath and tables[{name,url,path,sha256,byteLength}].
Optional acquisition counts are rechecked, never trusted as normalization.

Currently supports the explicitly verified X0202 whole-dollar schema and one
information-table document per filing. Other schemas/multiple documents are
withheld, not guessed. SEC's current Form 13F instructions require whole dollars:
https://www.sec.gov/files/form13f.pdf (Information Table, instruction 8).
Raw XML, manifests and the transient identity map MUST stay outside this repo.
Normalized output contains opaque ordinal identities, not security identifiers.
"""
import argparse
import datetime as dt
import gzip
import hashlib
import json
import os
from pathlib import Path
import re
import sys
import tempfile
from urllib.parse import urlparse
import xml.etree.ElementTree as ET

REPO = Path(__file__).resolve().parent.parent
COVER_NS = 'http://www.sec.gov/edgar/thirteenffiler'
TABLE_NS = 'http://www.sec.gov/edgar/document/thirteenf/informationtable'
MAX_SAFE_INTEGER = 9007199254740991
WARRANT = re.compile(r'\b(WARRANTS?|RIGHTS?)\b|^\*?W(?:T|TS)?\s+EXP|^(WT|WTS|RTS)$', re.I)
DEBT = re.compile(r'^(NOTE|NOTES|DEB|DEBENTURE)\b', re.I)
FORMS = {'13F-HR', '13F-HR/A'}


class ImportFailure(ValueError):
    pass


def require(condition, message):
    if not condition:
        raise ImportFailure(message)


def string(value, label):
    require(isinstance(value, str) and value.strip(), f'Missing {label}')
    return value.strip()


def iso_date(value, label):
    value = string(value, label)
    require(re.fullmatch(r'\d{4}-\d{2}-\d{2}', value), f'Invalid {label}')
    try:
        dt.date.fromisoformat(value)
    except ValueError as exc:
        raise ImportFailure(f'Invalid {label}') from exc
    return value


def timestamp(value, label):
    value = string(value, label)
    try:
        parsed = dt.datetime.fromisoformat(value.replace('Z', '+00:00'))
        require(parsed.tzinfo is not None, f'{label} needs explicit timezone')
        return parsed
    except ValueError as exc:
        raise ImportFailure(f'Invalid {label}') from exc


def integer(value, label):
    require(isinstance(value, str) and re.fullmatch(r'\d+', value), f'Invalid integer {label}')
    return str(int(value))


def cik(value):
    result = integer(str(value), 'CIK')
    require(0 < int(result) < 10**10, 'Invalid CIK')
    return result


def digest(data):
    return hashlib.sha256(data).hexdigest()


def private_path(value, label):
    path = Path(string(value, label)).resolve()
    require(not path.is_relative_to(REPO), f'{label} must be outside the public repository')
    return path


def load_private(value, label):
    path = private_path(value, label)
    require(path.is_file(), f'Missing {label} file')
    return path.read_bytes()


def url(value, label):
    value = string(value, label)
    parsed = urlparse(value)
    require(parsed.scheme == 'https' and parsed.hostname in {'www.sec.gov', 'sec.gov', 'data.sec.gov'}
            and not parsed.username and not parsed.password and not parsed.query and not parsed.fragment,
            f'Invalid official SEC URL: {label}')
    return value


def archive_url(value, base_path, label):
    result = url(value, label)
    require(urlparse(result).path.startswith(base_path), f'{label} does not belong to filing accession')
    return result


def xml(data, root_name, namespace):
    require(b'<!DOCTYPE' not in data.upper() and b'<!ENTITY' not in data.upper(), 'DTD/entity declarations are not supported')
    try:
        root = ET.fromstring(data)
    except ET.ParseError as exc:
        raise ImportFailure('Invalid source XML') from exc
    require(root.tag == f'{{{namespace}}}{root_name}', f'Unexpected XML root/namespace, expected {root_name}')
    for node in root.iter():
        node.tag = node.tag.split('}')[-1]
    return root


def one(node, path, optional=False):
    matches = node.findall(path)
    require(len(matches) <= 1, f'Ambiguous XML field: {path}')
    if not matches:
        require(optional, f'Missing XML field: {path}')
        return None
    return matches[0]


def field(node, path, optional=False):
    element = one(node, path, optional)
    if element is None:
        return None
    require(not list(element), f'Non-scalar XML field: {path}')
    value = (element.text or '').strip()
    require(value or optional, f'Empty XML field: {path}')
    return value or None


def numeric(node, path):
    return integer(field(node, path), path)


def xml_date(value, label):
    require(re.fullmatch(r'\d{2}-\d{2}-\d{4}', value or ''), f'Invalid {label}')
    try:
        return dt.datetime.strptime(value, '%m-%d-%Y').date().isoformat()
    except ValueError as exc:
        raise ImportFailure(f'Invalid {label}') from exc


def json_object(data, label):
    try:
        result = json.loads(data)
    except (ValueError, UnicodeError) as exc:
        raise ImportFailure(f'Invalid {label} JSON') from exc
    require(isinstance(result, dict), f'Invalid {label} object')
    return result


def verify_discovery(manifest, reporting_date, filer_cik, checked):
    submissions_url = url(manifest.get('submissionsUrl'), 'submissionsUrl')
    require(urlparse(submissions_url).path == f'/submissions/CIK{int(filer_cik):010d}.json', 'Submissions URL CIK mismatch')
    raw = load_private(manifest.get('submissionsPath'), 'submissionsPath')
    sub = json_object(raw, 'submissions')
    require(cik(sub.get('cik')) == filer_cik, 'Submissions CIK mismatch')
    require(string(sub.get('name'), 'submissions name') == manifest['name'], 'Submissions filer name mismatch')
    recent = sub.get('filings', {}).get('recent', {})
    keys = ['accessionNumber', 'form', 'filingDate', 'reportDate', 'acceptanceDateTime']
    require(all(isinstance(recent.get(k), list) for k in keys), 'Missing recent-submissions columns')
    length = len(recent['form'])
    require(length and all(len(recent[k]) == length for k in keys), 'Misaligned recent-submissions columns')
    oldest = min(iso_date(x, 'recent filing date') for x in recent['filingDate'])
    require(oldest <= reporting_date, 'Incomplete amendment discovery: recent history does not predate reporting date')
    for archive in sub.get('filings', {}).get('files', []):
        require(iso_date(archive.get('filingTo'), 'historical filingTo') < reporting_date,
                'Incomplete amendment discovery: historical submissions overlap reporting period')
    rows = [{k: recent[k][i] for k in keys} for i in range(length)]
    family = [r for r in rows if r['form'] in FORMS and r['reportDate'] == reporting_date]
    require(family, 'No requested-period 13F filings in submissions')
    require(len({r['accessionNumber'] for r in family}) == len(family), 'Duplicate accession in submissions')
    supplied = manifest.get('filings')
    require(isinstance(supplied, list) and supplied, 'Missing filing family')
    require(len({r.get('accessionNumber') for r in supplied}) == len(supplied), 'Duplicate accession in manifest')
    require({r['accessionNumber'] for r in family} == {r.get('accessionNumber') for r in supplied},
            'Incomplete amendment discovery: manifest filing family differs from submissions')
    by_accession = {r['accessionNumber']: r for r in family}
    for filing in supplied:
        actual = by_accession[filing['accessionNumber']]
        require(all(filing.get(k) == actual[k] for k in keys), 'Filing metadata differs from submissions')
        require(timestamp(filing['acceptanceDateTime'], 'acceptanceDateTime') <= checked, 'Filing accepted after checkedThrough')
    all_13f = [r for r in rows if r['form'] in FORMS]
    latest = max(iso_date(r['reportDate'], '13F reportDate') for r in all_13f if r['reportDate'])
    return {
        'submissionsUrl': submissions_url, 'submissionsSha256': digest(raw),
        'requestedReportingDate': reporting_date, 'checkedThrough': manifest['checkedThrough'],
        'matchingFilingCount': len(family), 'latestObserved13fReportingDate': latest,
        'oldest13fFilingDateInRecent': min(r['filingDate'] for r in all_13f),
        'oldestFilingDateInRecent': oldest,
        'scope': 'All requested-period 13F-HR and amendments in current SEC recent-submissions history; that history predates this reporting date and listed historical files end before it. '
                 + ('No newer report observed.' if latest == reporting_date else 'A newer reporting period is present; this portfolio intentionally uses the requested date.')
    }


def managers(cover, summary):
    included = []
    for entry in summary.findall('otherManagers2Info/otherManager2'):
        number = numeric(entry, 'sequenceNumber')
        manager = one(entry, 'otherManager')
        record = {'sequenceNumber': number, 'name': field(manager, 'name')}
        for key in ['cik', 'form13FFileNumber', 'crdNumber', 'secFileNumber']:
            value = field(manager, key, True)
            if value is not None:
                record[key] = value
        included.append(record)
    require(len({m['sequenceNumber'] for m in included}) == len(included), 'Duplicate included-manager sequence')
    require(int(numeric(summary, 'otherIncludedManagersCount')) == len(included), 'Included-manager count mismatch')
    others = []
    for manager in cover.findall('otherManagersInfo/otherManager'):
        record = {'name': field(manager, 'name')}
        for key in ['cik', 'form13FFileNumber', 'crdNumber', 'secFileNumber']:
            value = field(manager, key, True)
            if value is not None:
                record[key] = value
        others.append(record)
    return included, others


def partition(quantity_type, option, security_class):
    reasons = []
    if quantity_type != 'SH':
        reasons.append('principal_amount')
    if option:
        reasons.append('option_contract')
    if WARRANT.search(security_class):
        reasons.append('warrant_or_right_class')
    if quantity_type == 'SH' and DEBT.search(security_class):
        reasons.append('debt_class_reported_as_SH')
    return reasons


def reconciliation(positions):
    shares = [p for p in positions if p['shareViewEligible']]
    return {
        'reportedRowCount': len(positions),
        'recomputedValueTotalUsd': str(sum(int(p['valueUsd']) for p in positions)),
        'shareRowCount': len(shares), 'shareValueUsd': str(sum(int(p['valueUsd']) for p in shares)),
        'excludedRowCount': len(positions) - len(shares),
        'distinctReportedSecurityCount': len({p['reportedSecurityId'] for p in positions}),
        'shareReportedSecurityCount': len({p['reportedSecurityId'] for p in shares})
    }


def normalize_source(filing, manifest):
    accession = string(filing.get('accessionNumber'), 'accessionNumber')
    require(re.fullmatch(r'\d{10}-\d{2}-\d{6}', accession), 'Invalid accessionNumber')
    source_id = f'sec13f-{accession}'
    filer_cik = cik(manifest['cik'])
    base = f'/Archives/edgar/data/{filer_cik}/{accession.replace("-", "")}/'
    cover_url = archive_url(filing.get('coverUrl'), base, 'coverUrl')
    index_url = archive_url(filing.get('filingIndexUrl'), base, 'filingIndexUrl')
    require(urlparse(index_url).path in {base + accession + '-index.html', base + accession + '-index.htm'}, 'Invalid filing index URL')
    raw_cover = load_private(filing.get('coverPath'), 'coverPath')
    root = xml(raw_cover, 'edgarSubmission', COVER_NS)
    schema = field(root, 'schemaVersion')
    require(schema == 'X0202', f'Unsupported value-unit schema {schema}; no dollars/thousands assumption allowed')
    require(filing['filingDate'] >= '2023-01-03', 'X0202 filing predates verified whole-dollar schema period')
    require(field(root, 'headerData/submissionType') == filing['form'], 'Cover form differs from submissions')
    require(field(root, 'headerData/filerInfo/liveTestFlag') == 'LIVE', 'Non-live filing')
    require(cik(field(root, 'headerData/filerInfo/filer/credentials/cik')) == filer_cik, 'Cover CIK mismatch')
    period = field(root, 'headerData/filerInfo/periodOfReport')
    require(xml_date(period, 'periodOfReport') == manifest['reportingDate'], 'Cover reporting date mismatch')
    cover = one(root, 'formData/coverPage')
    summary = one(root, 'formData/summaryPage')
    require(xml_date(field(cover, 'reportCalendarOrQuarter'), 'reportCalendarOrQuarter') == manifest['reportingDate'], 'Cover calendar date mismatch')
    filer_name = field(cover, 'filingManager/name')
    # A filing name can differ from the current submissions name following a rename.
    # Preserve the actual cover name and use CIK, not fuzzy name matching, for identity.
    report_type = field(cover, 'reportType')
    require(report_type in {'13F HOLDINGS REPORT', '13F COMBINATION REPORT'}, 'Unsupported 13F report type')
    amendment = field(cover, 'isAmendment', True)
    require(amendment in {None, 'true', 'false'}, 'Invalid amendment flag')
    amendment_no = field(cover, 'amendmentNo', True)
    amendment_type = field(cover, 'amendmentInfo/amendmentType', True)
    # SEC cover variants put amendmentType inside amendmentInfo; a direct scalar
    # is also encountered. Both present is ambiguous and therefore rejected.
    direct_type = field(cover, 'amendmentType', True)
    require(not (amendment_type and direct_type), 'Duplicate amendment type')
    amendment_type = amendment_type or direct_type
    if filing['form'] == '13F-HR/A':
        require(amendment == 'true' and amendment_no and int(integer(amendment_no, 'amendmentNo')) > 0,
                'Amendment is missing affirmative flag/number')
        require(amendment_type in {'RESTATEMENT', 'NEW HOLDINGS'}, 'Unknown amendment type')
    else:
        require(amendment in {None, 'false'} and not amendment_no and not amendment_type, 'Original filing has conflicting amendment metadata')
    included, others = managers(cover, summary)
    if report_type == '13F COMBINATION REPORT':
        require(others, 'Combination report lacks other reporting managers')
    confidential = field(summary, 'isConfidentialOmitted', True)
    require(confidential in {None, 'true', 'false'}, 'Invalid confidential-omission flag')
    cover_metadata = {
        'schemaVersion': schema, 'periodOfReport': period, 'isAmendment': amendment,
        'amendmentNo': amendment_no, 'amendmentType': amendment_type, 'reportType': report_type,
        'tableEntryTotal': numeric(summary, 'tableEntryTotal'), 'tableValueTotal': numeric(summary, 'tableValueTotal'),
        'isConfidentialOmitted': confidential, 'otherIncludedManagersCount': numeric(summary, 'otherIncludedManagersCount'),
        'includedManagers': included, 'otherReportingManagers': others
    }
    extra_info = field(cover, 'additionalInformation', True)
    if extra_info:
        cover_metadata['additionalInformation'] = extra_info
    tables = filing.get('tables')
    require(isinstance(tables, list) and len(tables) == 1, 'Exactly one information-table document is supported; no document may be silently omitted')
    table = tables[0]
    table_name = string(table.get('name'), 'table name')
    require('/' not in table_name and '\\' not in table_name, 'Invalid table document name')
    table_url = archive_url(table.get('url'), base, 'informationTableUrl')
    require(urlparse(table_url).path == base + table_name, 'Information-table URL/document mismatch')
    directory = json_object(load_private(filing.get('directoryPath'), 'directoryPath'), 'filing directory')
    xml_names = {x['name'] for x in directory.get('directory', {}).get('item', [])
                 if isinstance(x.get('name'), str) and x['name'].lower().endswith('.xml')
                 and x['name'] != urlparse(cover_url).path.rsplit('/', 1)[-1]}
    require(xml_names == {table_name}, 'Filing directory contains missing/ambiguous XML table documents')
    raw_table = load_private(table.get('path'), 'table path')
    require(table.get('sha256') == digest(raw_table), 'Information-table SHA-256 mismatch')
    require(table.get('byteLength') == len(raw_table), 'Information-table byte length mismatch')
    if filing.get('coverSha256'):
        require(filing['coverSha256'] == digest(raw_cover), 'Cover SHA-256 mismatch')
    info = xml(raw_table, 'informationTable', TABLE_NS)
    require(all(node.tag == 'infoTable' for node in info), 'Unexpected information-table child')
    positions, identity_groups, private_instruments = [], {}, []
    unresolved, conflicts = [], []
    manager_numbers = {m['sequenceNumber'] for m in included}
    partitions = {}
    for ordinal, row in enumerate(info, 1):
        issuer_name = field(row, 'nameOfIssuer')
        security_class = field(row, 'titleOfClass')
        identifier = field(row, 'cusip')  # PRIVATE: never copied to normalized rows.
        quantity_type = field(row, 'shrsOrPrnAmt/sshPrnamtType')
        require(quantity_type in {'SH', 'PRN'}, f'Unknown quantity type at row {ordinal}')
        option = field(row, 'putCall', True)
        require(option in {None, 'Put', 'Call', 'PUT', 'CALL'}, f'Unknown option type at row {ordinal}')
        discretion = field(row, 'investmentDiscretion')
        require(discretion in {'SOLE', 'DFND', 'OTR'}, f'Unknown investment discretion at row {ordinal}')
        reasons = partition(quantity_type, option, security_class)
        key = (identifier, security_class, quantity_type, option)
        if key not in identity_groups:
            identity_groups[key] = {
                'reportedSecurityId': f'{source_id}-security-{ordinal:05d}', 'sourceId': source_id,
                'securityIdentifier': identifier, 'issuerName': issuer_name, 'securityClass': security_class,
                'quantityType': quantity_type, 'putCall': option, 'rowOrdinals': [], 'shareViewEligible': not reasons
            }
            private_instruments.append(identity_groups[key])
        group = identity_groups[key]
        require(group['issuerName'] == issuer_name, f'Conflicting issuer names within exact instrument group at row {ordinal}')
        group['rowOrdinals'].append(ordinal)
        raw_refs = field(row, 'otherManager', True)
        require(raw_refs is None or re.fullmatch(r'\d+(?:[\s,]+\d+)*', raw_refs), f'Ambiguous manager references at row {ordinal}')
        refs = re.split(r'[\s,]+', raw_refs) if raw_refs else []
        p = {
            'positionId': f'{source_id}-row-{ordinal:05d}', 'reportedSecurityId': group['reportedSecurityId'],
            'sourceId': source_id, 'filerId': f'sec-filer-{filer_cik}', 'issuerName': issuer_name,
            'securityClass': security_class, 'valueUsd': numeric(row, 'value'),
            'quantity': numeric(row, 'shrsOrPrnAmt/sshPrnamt'), 'quantityType': quantity_type,
            'putCall': option, 'investmentDiscretion': discretion, 'otherManagerRefs': refs,
            'votingSole': numeric(row, 'votingAuthority/Sole'), 'votingShared': numeric(row, 'votingAuthority/Shared'),
            'votingNone': numeric(row, 'votingAuthority/None'), 'rowOrdinal': ordinal,
            'shareViewEligible': not reasons, 'shareViewExclusionReasons': reasons
        }
        require(int(p['valueUsd']) <= MAX_SAFE_INTEGER, f'Value exceeds public rendering precision at row {ordinal}')
        positions.append(p)
        unknown = [ref for ref in refs if str(int(ref)) not in manager_numbers]
        if unknown:
            unresolved.append({'positionId': p['positionId'], 'rowOrdinal': ordinal, 'unresolvedManagerRefs': unknown})
        if 'debt_class_reported_as_SH' in reasons:
            conflicts.append({'positionId': p['positionId'], 'rowOrdinal': ordinal, 'issuerName': issuer_name,
                              'securityClass': security_class, 'reportedQuantityType': quantity_type,
                              'action': 'retain_source_row_but_exclude_from_share_view'})
        category = reasons[0] if reasons else 'share_view'
        counts = partitions.setdefault(category, {'category': category, 'rowCount': 0, 'valueUsd': 0})
        counts['rowCount'] += 1
        counts['valueUsd'] += int(p['valueUsd'])
    rec = reconciliation(positions)
    require(int(cover_metadata['tableEntryTotal']) == len(positions),
            f'{accession}: row count mismatch: cover {cover_metadata["tableEntryTotal"]}, table {len(positions)}')
    require(cover_metadata['tableValueTotal'] == rec['recomputedValueTotalUsd'],
            f'{accession}: value total mismatch: cover {cover_metadata["tableValueTotal"]}, table {rec["recomputedValueTotalUsd"]}')
    require('rowCount' not in table or table['rowCount'] == len(positions), 'Acquisition row count mismatch')
    require('valueUsd' not in table or str(table['valueUsd']) == rec['recomputedValueTotalUsd'], 'Acquisition value total mismatch')
    rec.update({'declaredEntryTotal': len(positions), 'declaredValueTotalUsd': cover_metadata['tableValueTotal'],
                'rowCountMatches': True, 'valueTotalMatches': True,
                'partitions': [dict(p, valueUsd=str(p['valueUsd'])) for p in partitions.values()]})
    source = {
        'sourceId': source_id, 'publisher': 'U.S. Securities and Exchange Commission', 'filerName': filer_name,
        'filerCik': filer_cik, 'accessionNumber': accession, 'form': filing['form'],
        'reportingDate': manifest['reportingDate'], 'filingDate': filing['filingDate'],
        'acceptedAt': filing['acceptanceDateTime'], 'checkedThrough': manifest['checkedThrough'],
        'filingIndexUrl': index_url, 'coverUrl': cover_url, 'informationTableUrl': table_url,
        'informationTableDocument': table_name, 'informationTableSha256': digest(raw_table),
        'informationTableByteLength': len(raw_table), 'coverSha256': digest(raw_cover),
        'rowLocatorPattern': 'informationTable/infoTable[{rowOrdinal}] (one-based XML document order)',
        'valueUnit': 'USD; whole dollars, schema X0202; no legacy thousands multiplier',
        'cover': cover_metadata, 'reconciliation': rec,
        'retrievedDate': manifest['checkedThrough'][:10], 'retrievalTimestampPrecision': 'day',
        'dataQuality': {'unresolvedOtherManagerReferences': unresolved, 'shareTypeClassConflicts': conflicts}
    }
    return source, positions, private_instruments


def normalize(manifest):
    slug = string(manifest.get('slug'), 'slug')
    require(re.fullmatch(r'[a-z0-9][a-z0-9_-]+', slug), 'Invalid slug')
    manifest['name'] = string(manifest.get('name'), 'name')
    reporting_date = iso_date(manifest.get('reportingDate'), 'reportingDate')
    checked = timestamp(manifest.get('checkedThrough'), 'checkedThrough')
    require(checked.date().isoformat() >= reporting_date, 'checkedThrough predates reportingDate')
    filer_cik = cik(manifest.get('cik'))
    discovery = verify_discovery(manifest, reporting_date, filer_cik, checked)
    filings = sorted(manifest['filings'], key=lambda f: timestamp(f['acceptanceDateTime'], 'acceptanceDateTime'))
    require(len({f['acceptanceDateTime'] for f in filings}) == len(filings), 'Ambiguous filing order: equal acceptance timestamps')
    sources, batches, identities, active, ledger = [], {}, {}, [], []
    last_amendment = 0
    for filing in filings:
        source, positions, instruments = normalize_source(filing, manifest)
        sid = source['sourceId']
        sources.append(source)
        batches[sid], identities[sid] = positions, instruments
        amendment = source['cover']['amendmentType']
        replaced = []
        if filing['form'] == '13F-HR':
            require(not ledger, 'Multiple originals or original follows an amendment')
            action, active = 'original_report', [sid]
        else:
            require(active, 'Amendment has no observed original report')
            number = int(source['cover']['amendmentNo'])
            require(number == last_amendment + 1, 'Missing or out-of-order amendment number')
            last_amendment = number
            if amendment == 'RESTATEMENT':
                action, replaced, active = 'replace_prior_report', active, [sid]
            else:
                action = 'append_new_holdings'
                active.append(sid)
        ledger.append({'sourceId': sid, 'form': filing['form'], 'amendmentNumber': source['cover']['amendmentNo'],
                       'amendmentType': amendment, 'action': action, 'filingDate': filing['filingDate'],
                       'effectiveRowCountAfter': sum(len(batches[s]) for s in active), 'replacedSourceIds': replaced})
    positions = [p for sid in active for p in batches[sid]]
    rec = reconciliation(positions)
    rec.update({'activeSourceIds': active, 'allActiveSourceTotalsReconciled': True})
    if 'activeAccessions' in manifest:
        require(manifest['activeAccessions'] == [s.removeprefix('sec13f-') for s in active], 'Acquisition active-source ledger mismatch')
    active_sources = [s for sid in active for s in sources if s['sourceId'] == sid]
    omitted = {s['cover']['isConfidentialOmitted'] for s in active_sources}
    coverage = {
        'scope': 'Complete public information-table rows for this filer and reporting date, after observed amendments.',
        'meaning': 'Reported Section 13(f) investment discretion; not proof of legal ownership or a complete investment portfolio.',
        'excludedFromUniverse': ['Non-13F securities and assets', 'Confidentially withheld positions, if any',
                                'Permitted omissions and unreported positions', 'Short positions',
                                'Securities reported only by other managers in a combination report'],
        'shareViewRule': 'SH quantity type with no put/call, excluding explicit warrant/right classes and explicit NOTE/DEB/DEBENTURE classes. Retains fund shares, depositary receipts, preferred shares and units where reported. Not a common-stock-only view; fund shares can hold other asset classes.',
        'overlapPolicy': 'Source rows and reporting-manager references retained; shared discretion and parent/fund layers may overlap. Do not sum across portfolios to infer ownership.',
        'securityIdentity': 'Opaque source-scoped IDs group only exact private reported identifier, trimmed class, quantity type and put/call within one source. No cross-filer entity matching, ticker mapping, or legal-issuer consolidation in this import.',
        'weightDenominator': 'If calculated, share-view weight = row reported USD value / sum of eligible share-view row values for this filer/date. It is neither ownership percentage nor percent of total AUM.',
        'valueScale': 'Current Form 13F schema X0202 values are whole USD, not thousands.',
        # Describe every active table, not just the latest filing: a NEW HOLDINGS amendment can
        # differ in report type or omission flag from the original it is appended to.
        'reportType': ' + '.join(dict.fromkeys(s['cover']['reportType'] for s in active_sources)),
        'isConfidentialOmittedAsReported': next((flag for flag in ('true', 'false') if flag in omitted), None)
    }
    qualifications = []
    reporting_managers = [m['name'] for s in active_sources for m in s['cover']['otherReportingManagers']]
    if reporting_managers:
        qualifications.append('This combination report separately identifies ' + '; '.join(dict.fromkeys(reporting_managers))
                              + '. Their separately reported holdings are outside this information table; do not infer parent-level ownership or sum overlapping manager portfolios.')
    for source in sources:
        if source['sourceId'] in active and source['cover'].get('additionalInformation'):
            qualifications.append('Filing cover qualification (as reported): ' + source['cover']['additionalInformation'])
    if qualifications:
        coverage['filerQualification'] = ' '.join(dict.fromkeys(qualifications))
    warnings = []
    for source in sources:
        if source['sourceId'] not in active:
            continue
        for key, category, detail in [
            ('unresolvedOtherManagerReferences', 'unresolved_manager_reference', 'Reported manager references absent from the included-manager list are preserved; no manager identity is invented.'),
            ('shareTypeClassConflicts', 'debt_class_reported_as_SH', 'An explicit debt class was reported as SH. Preserve the source row but exclude it from share view.')
        ]:
            if source['dataQuality'][key]:
                warnings.append({'sourceId': source['sourceId'], 'type': category, 'rowCount': len(source['dataQuality'][key]), 'detail': detail})
    output = {
        'schemaVersion': 'assets-map.sec13f-portfolio.v1', 'portfolioId': f'{slug}-{reporting_date}',
        'filer': {'name': manifest['name'], 'cik': filer_cik, 'filerId': f'sec-filer-{filer_cik}'},
        'reportingDate': reporting_date, 'checkedThrough': manifest['checkedThrough'],
        'importedBy': 'assets-map-sec13f-importer-v1', 'coverage': coverage, 'sources': sources,
        'amendmentLedger': ledger, 'amendmentDiscovery': discovery, 'reconciliation': rec,
        'readiness': {'normalization': 'complete', 'independentAdmission': 'pending',
                      'publicRawDocumentsIncluded': False, 'publicProprietaryIdentifiersIncluded': False},
        'positions': positions, 'retrievedDate': manifest['checkedThrough'][:10], 'retrievalTimestampPrecision': 'day',
        'dataQuality': {'warnings': warnings, 'preservationPolicy': 'Original reported values, classes, quantity types and manager references are retained even when anomalous. Exclusion is a view decision, not a correction of the filing.'}
    }
    private = {'portfolioId': output['portfolioId'], 'reportingDate': reporting_date,
               'instruments': [i for sid in active for i in identities[sid]],
               'supersededSourceInstruments': [i for sid in identities if sid not in active for i in identities[sid]]}
    return output, private


def write_atomic(path, data, mode=0o644):
    path.parent.mkdir(parents=True, exist_ok=True)
    handle, temp = tempfile.mkstemp(prefix='.' + path.name + '.', dir=path.parent)
    try:
        with os.fdopen(handle, 'wb') as stream:
            stream.write(data)
        os.chmod(temp, mode)
        os.replace(temp, path)
    finally:
        if os.path.exists(temp):
            os.unlink(temp)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--manifest', required=True)
    parser.add_argument('--output-dir', required=True)
    parser.add_argument('--private-dir', required=True)
    parser.add_argument('--overwrite', action='store_true', help='Explicitly replace generated files; existing reviews become stale.')
    args = parser.parse_args()
    try:
        private_dir = private_path(args.private_dir, 'private-dir')
        manifest = json_object(load_private(args.manifest, 'manifest'), 'manifest')
        output, private = normalize(manifest)
        text = (json.dumps(output, ensure_ascii=False, indent=2) + '\n').encode('utf-8')
        private['inputSha256'] = digest(text)
        target = Path(args.output_dir).resolve() / f'{manifest["slug"]}.normalized.json.gz'
        private_target = private_dir / f'{manifest["slug"]}.identities.private.json'
        require(target != private_target, 'Public and private outputs overlap')
        require(args.overwrite or not target.exists(), 'Normalized output already exists; use --overwrite explicitly')
        require(args.overwrite or not private_target.exists(), 'Private output already exists; use --overwrite explicitly')
        private_bytes = (json.dumps(private, ensure_ascii=False, indent=2) + '\n').encode('utf-8')
        write_atomic(private_target, private_bytes, 0o600)
        write_atomic(target, gzip.compress(text, mtime=0))
        print(json.dumps({'portfolioId': output['portfolioId'], 'normalizedPath': str(target),
                          'privateIdentityPath': str(private_target), 'inputSha256': private['inputSha256'],
                          'reconciliation': output['reconciliation'], 'review': 'independent review required'}))
    except (ImportFailure, OSError, KeyError, TypeError, ValueError) as exc:
        print(f'Import withheld: {exc}', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
