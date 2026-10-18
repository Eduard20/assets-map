"""Build an UNAPPROVED opaque instrument-equivalence proposal from local SEC XML.
Raw identifiers never leave this process or appear in the output. Admission is
separate and requires independent reconstruction against source bytes.
"""
import argparse, collections, gzip, hashlib, json, pathlib, re, xml.etree.ElementTree as ET


def sha(b): return hashlib.sha256(b).hexdigest()
def tag(e): return e.tag.rsplit('}', 1)[-1]
def field(e, name):
    return next(((n.text or '').strip() for n in e.iter() if tag(n) == name), '')
def identifier_ok(value):
    # Validate syntax and the source check digit, never repair identifiers.
    if not re.fullmatch(r'[A-Z0-9*@#]{8}[0-9]',value) or len(set(value))<2:return False
    total=0
    for index,char in enumerate(value[:8]):
        number=int(char) if char.isdigit() else ord(char)-55 if char.isalpha() else {'*':36,'@':37,'#':38}[char]
        number*=2 if index%2 else 1
        total+=number//10+number%10
    return (10-total%10)%10==int(value[-1])


def build(inputs, source_paths):
    instruments, source_checks, input_files, dates = {}, [], [], set()
    eligible_rows = 0
    for filename in inputs:
        raw = gzip.decompress(pathlib.Path(filename).read_bytes()); data = json.loads(raw)
        pid, date = data['portfolioId'], data['reportingDate']; dates.add(date)
        input_files.append({'portfolioId':pid,'file':pathlib.Path(filename).name,'sha256':sha(raw),'reportingDate':date})
        active = set(data['reconciliation']['activeSourceIds']); rows = {}
        for source in data['sources']:
            sid = source['sourceId']
            if sid not in active: continue
            url = source['informationTableUrl']
            if url not in source_paths: raise ValueError('Missing raw source: '+url)
            raw_xml = pathlib.Path(source_paths[url]).read_bytes()
            if sha(raw_xml) != source['informationTableSha256']: raise ValueError('Source hash mismatch: '+sid)
            records = [e for e in ET.fromstring(raw_xml).iter() if tag(e)=='infoTable']
            rows[sid] = records
            source_checks.append({'sourceId':sid,'informationTableSha256':sha(raw_xml),'rowCount':len(records),'informationTableUrl':url})
        for p in data['positions']:
            if not p['shareViewEligible']: continue
            eligible_rows += 1
            record = rows[p['sourceId']][p['rowOrdinal']-1]
            if field(record,'nameOfIssuer') != p['issuerName'] or field(record,'titleOfClass') != p['securityClass']:
                raise ValueError('Row identity mismatch: '+p['positionId'])
            key = (date,field(record,'cusip'),field(record,'titleOfClass'),field(record,'sshPrnamtType'),field(record,'putCall'))
            if key[3] != 'SH' or key[4]: raise ValueError('Ineligible matching row: '+p['positionId'])
            rid = p['reportedSecurityId']
            current = {'portfolioId':pid,'key':key}
            if rid in instruments and instruments[rid] != current: raise ValueError('Inconsistent instrument: '+rid)
            instruments[rid] = current
    if len(dates) != 1: raise ValueError('Only one comparable reporting date per equivalence release')
    by_key = collections.defaultdict(list); unmatchable=0
    for rid,item in instruments.items():
        if identifier_ok(item['key'][1]): by_key[item['key']].append(rid)
        else: unmatchable += 1
    groups, ambiguous = [], 0
    for members in by_key.values():
        filers=[instruments[rid]['portfolioId'] for rid in members]
        if len(set(filers)) != len(filers): ambiguous += len(members); continue
        if len(members)>1: groups.append(sorted(members))
    groups.sort(); matched=sum(map(len,groups)); pairs=collections.Counter()
    for members in groups:
        filers=sorted(instruments[rid]['portfolioId'] for rid in members)
        for i,a in enumerate(filers):
            for b in filers[i+1:]: pairs[(a,b)]+=1
    return {'schemaVersion':1,'datasetId':'reported-instrument-equivalence-'+next(iter(dates))+'-v2',
      'method':'Exact equality of verified source-reported security identifier, exact trimmed security-class label, quantity type and put/call at the same reporting date. No issuer-name matching.',
      'groups':groups,'coverage':{'portfolioIds':sorted(x['portfolioId'] for x in input_files),'reportingDate':next(iter(dates)),
      'eligibleSourceRows':eligible_rows,'eligibleSourceScopedInstruments':len(instruments),'matchedGroups':len(groups),
      'matchedSourceScopedInstruments':matched,'unmatchedSourceScopedInstruments':len(instruments)-matched,
      'unmatchableMalformedOrPlaceholderIdentifierInstruments':unmatchable,'ambiguousSameFilerInstrumentCount':ambiguous,
      'groupsByMemberCount':dict(sorted(collections.Counter(str(len(g)) for g in groups).items())),
      'pairCounts':[{'portfolioIds':list(k),'matchedGroups':v} for k,v in sorted(pairs.items())],
      'inputFiles':sorted(input_files,key=lambda x:x['portfolioId']),
      'allSourceScopedInstrumentIdsSha256':sha('\n'.join(sorted(instruments)).encode()),
      'allSourceScopedInstrumentIdsHashMeaning':'SHA-256 of sorted opaque public source-scoped IDs separated by newlines, not proprietary identifier material.'},
      'sourceChecks':source_checks,'semantics':{'relation':'same_reported_instrument','notRelation':['same_legal_issuer','same_company_across_share_classes','same_beneficial_owner'],
      'unlistedInstruments':'Remain source-scoped singletons; absence of a match is not evidence of different instruments or no holding.',
      'classDifferences':'Different trimmed classes remain separate even when the private identifier matches.',
      'rowPolicy':'Retain every source row and manager reference. No economic deduplication or cross-filer ownership totals.',
      'ownershipLabel':'Disclosed investment-discretion positions among the '+str(len(input_files))+' imported filers, not all investors or an ownership register.',
      'identifierPolicy':'Only opaque source-scoped memberships are emitted. No raw identifier, identifier hash, ticker mapping or reusable identifier-value lookup.'},
      'admission':{'status':'pending'}}

if __name__ == '__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--inputs',nargs='+',required=True);parser.add_argument('--source-map',required=True);parser.add_argument('--output',required=True)
    args=parser.parse_args(); result=build(args.inputs,json.loads(pathlib.Path(args.source_map).read_text()))
    pathlib.Path(args.output).write_text(json.dumps(result,separators=(',',':'))+'\n');print(json.dumps(result['coverage'],indent=2))
