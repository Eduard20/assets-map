import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, writeFile, rm, stat, access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {validatePortfolio} from '../scripts/export-portfolios.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const importer = path.join(root, 'scripts/import-sec13f.py');
const hash = data => createHash('sha256').update(data).digest('hex');
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;');
const row = ({issuer='Fixture Issuer', cls='COM', id='123456789', value='25', quantity='3', type='SH', option=null, refs=null, sole='3', shared='0', none='0', discretion='SOLE'}={}) => `<infoTable><nameOfIssuer>${escape(issuer)}</nameOfIssuer><titleOfClass>${escape(cls)}</titleOfClass><cusip>${id}</cusip><value>${value}</value><shrsOrPrnAmt><sshPrnamt>${quantity}</sshPrnamt><sshPrnamtType>${type}</sshPrnamtType></shrsOrPrnAmt>${option ? `<putCall>${option}</putCall>` : ''}<investmentDiscretion>${discretion}</investmentDiscretion>${refs !== null ? `<otherManager>${refs}</otherManager>` : ''}<votingAuthority><Sole>${sole}</Sole><Shared>${shared}</Shared><None>${none}</None></votingAuthority></infoTable>`;
const table = rows => `<informationTable xmlns="http://www.sec.gov/edgar/document/thirteenf/informationtable">${rows.join('')}</informationTable>`;
const manager = '<otherManagers2Info><otherManager2><sequenceNumber>1</sequenceNumber><otherManager><cik>0000000321</cik><form13FFileNumber>028-00100</form13FFileNumber><name>Fixture Included Manager</name></otherManager></otherManager2></otherManagers2Info>';
const cover = ({form='13F-HR', schema='X0202', amendment=null, number=1, count, total, managers=false, combination=false, qualification=null, confidential='false'}={}) => `<edgarSubmission xmlns="http://www.sec.gov/edgar/thirteenffiler"><schemaVersion>${schema}</schemaVersion><headerData><submissionType>${form}</submissionType><filerInfo><liveTestFlag>LIVE</liveTestFlag><filer><credentials><cik>0000000123</cik></credentials></filer><periodOfReport>06-30-2026</periodOfReport></filerInfo></headerData><formData><coverPage><reportCalendarOrQuarter>06-30-2026</reportCalendarOrQuarter>${amendment ? `<isAmendment>true</isAmendment><amendmentNo>${number}</amendmentNo><amendmentInfo><amendmentType>${amendment}</amendmentType></amendmentInfo>` : ''}<filingManager><name>Fixture Manager</name></filingManager><reportType>${combination ? '13F COMBINATION REPORT' : '13F HOLDINGS REPORT'}</reportType>${combination ? '<otherManagersInfo><otherManager><name>Separately Reporting Manager</name><cik>0000000456</cik></otherManager></otherManagersInfo>' : ''}${qualification ? `<additionalInformation>${escape(qualification)}</additionalInformation>` : ''}</coverPage><summaryPage><tableEntryTotal>${count}</tableEntryTotal><tableValueTotal>${total}</tableValueTotal><otherIncludedManagersCount>${managers ? 1 : 0}</otherIncludedManagersCount><isConfidentialOmitted>${confidential}</isConfidentialOmitted>${managers ? manager : ''}</summaryPage></formData></edgarSubmission>`;

async function fixture(t, specs=[{}]) {
  const dir = await mkdtemp(path.join(tmpdir(), 'assets-map-sec13f-'));
  t.after(() => rm(dir, {recursive: true, force: true}));
  const output = path.join(dir, 'normalized'), privateDir = path.join(dir, 'private');
  const manifest = {slug:'fixture', name:'Fixture Manager', cik:123, reportingDate:'2026-06-30', checkedThrough:'2026-10-18T10:00:00Z', submissionsUrl:'https://data.sec.gov/submissions/CIK0000000123.json', submissionsPath:path.join(dir, 'submissions.json'), filings:[]};
  for (let i=0; i<specs.length; i++) {
    const s=specs[i], rows=s.rows ?? [row()], accession=`0000000123-26-${String(i+1).padStart(6,'0')}`;
    const base=`https://www.sec.gov/Archives/edgar/data/123/${accession.replaceAll('-','')}/`;
    const raw=table(rows), coverPath=path.join(dir, `${i}-cover.xml`), tablePath=path.join(dir, `${i}-table.xml`), directoryPath=path.join(dir,`${i}-directory.json`);
    const total=s.total ?? rows.reduce((sum,r) => sum+BigInt(r.match(/<value>(\d+)<\/value>/)?.[1] ?? '0'),0n).toString();
    const form=s.amendment ? '13F-HR/A' : '13F-HR';
    await writeFile(coverPath,cover({...s, form, total, count:s.count ?? rows.length}));
    await writeFile(tablePath,raw);
    await writeFile(directoryPath,JSON.stringify({directory:{item:[{name:'primary_doc.xml'},{name:'table.xml'}]}}));
    manifest.filings.push({accessionNumber:accession, form, filingDate:`2026-08-${String(10+i).padStart(2,'0')}`, reportDate:'2026-06-30', acceptanceDateTime:`2026-08-${String(10+i).padStart(2,'0')}T12:00:00Z`, filingIndexUrl:base+accession+'-index.html', coverUrl:base+'primary_doc.xml', coverPath, directoryPath, tables:[{name:'table.xml',url:base+'table.xml',path:tablePath,sha256:hash(raw),byteLength:Buffer.byteLength(raw)}]});
  }
  const keys=['accessionNumber','form','filingDate','reportDate','acceptanceDateTime'];
  const recent=Object.fromEntries(keys.map(k=>[k,manifest.filings.map(f=>f[k])]));
  recent.accessionNumber.push('0000000123-26-000000');recent.form.push('13F-HR');recent.filingDate.push('2026-05-01');recent.reportDate.push('2026-03-31');recent.acceptanceDateTime.push('2026-05-01T12:00:00Z');
  const submissions={cik:123,name:'Fixture Manager',filings:{recent,files:[]}};
  const manifestPath=path.join(dir,'manifest.json');
  async function run({args=[], updateSubmissions=true}={}) {
    await writeFile(manifestPath,JSON.stringify(manifest));
    if(updateSubmissions) await writeFile(manifest.submissionsPath,JSON.stringify(submissions));
    const result=spawnSync('python3',[importer,'--manifest',manifestPath,'--output-dir',output,'--private-dir',privateDir,...args],{cwd:root,encoding:'utf8'});
    return result;
  }
  async function parsed() {
    const compressed=await readFile(path.join(output,'fixture.normalized.json.gz'));
    const text=gunzipSync(compressed).toString('utf8');
    const identity=JSON.parse(await readFile(path.join(privateDir,'fixture.identities.private.json'),'utf8'));
    return {data:JSON.parse(text),text,identity,compressed};
  }
  return {dir,output,privateDir,manifest,submissions,run,parsed};
}

function succeeded(result) { assert.equal(result.status,0,result.stderr || result.error?.message); }
function failed(result, pattern) { assert.equal(result.status,1,result.stdout);assert.match(result.stderr,pattern); }

// All fixtures are synthetic. No actual raw filing or security-identifier dataset
// is checked in, and no test creates a review approval.
test('normalizes whole dollars, exact counts, all rows, opaque groups, and private identity separately',async t=>{
  const f=await fixture(t,[{managers:true,rows:[row({refs:'1',value:'25'}),row({refs:'1, 0',value:'0',quantity:'0',sole:'0'}),row({cls:'COM  A',value:'100'}),row({cls:'COM A',value:'50'})]}]);
  succeeded(await f.run());
  const {data,text,identity}=await f.parsed();
  assert.deepEqual(validatePortfolio(data),{errors:[],quarantine:[]});
  assert.equal(data.reconciliation.reportedRowCount,4);
  assert.equal(data.reconciliation.recomputedValueTotalUsd,'175');
  assert.equal(data.positions[0].valueUsd,'25'); // Never multiply modern values by 1,000.
  assert.equal(data.positions[0].reportedSecurityId,data.positions[1].reportedSecurityId);
  assert.notEqual(data.positions[2].reportedSecurityId,data.positions[3].reportedSecurityId); // Internal spacing preserved.
  assert.deepEqual(data.positions[1].otherManagerRefs,['1','0']);
  assert.equal(data.dataQuality.warnings[0].type,'unresolved_manager_reference');
  assert.equal(data.sources[0].cover.includedManagers[0].name,'Fixture Included Manager');
  assert.equal(data.readiness.independentAdmission,'pending');
  assert.equal(identity.inputSha256,hash(text));
  assert.equal(identity.instruments[0].securityIdentifier,'123456789');
  assert.deepEqual(identity.instruments[0].rowOrdinals,[1,2]);
  assert.doesNotMatch(text,/123456789|rawCUSIP|hashedCUSIP|securityIdentifier|"cusip"|submissionsPath|coverPath/);
  assert.equal((await stat(path.join(f.privateDir,'fixture.identities.private.json'))).mode&0o777,0o600);
  assert.equal(data.sources[0].informationTableSha256,f.manifest.filings[0].tables[0].sha256);
});

test('uses exact existing share partition including fund shares, PRN, options, warrants, rights, and SH debt',async t=>{
  const specs=[{cls:'COM'},{cls:'ETF'},{cls:'PFD'},{cls:'SPONSORED ADR'},{cls:'UNITS'},{cls:'WARRANTS'},{cls:'*W EXP 2028'},{cls:'RTS'},{cls:'RIGHT'},{cls:'NOTE 2.5%'},{cls:'DEBENTURE'},{cls:'COM',type:'PRN'},{cls:'COM',option:'Put'},{cls:'COM',option:'CALL'}];
  const f=await fixture(t,[{rows:specs.map(s=>row(s))}]);succeeded(await f.run());
  const {data}=await f.parsed();
  assert.deepEqual(validatePortfolio(data),{errors:[],quarantine:[]});
  assert.equal(data.reconciliation.shareRowCount,5);assert.equal(data.reconciliation.excludedRowCount,9);
  assert.deepEqual(data.positions.map(p=>p.shareViewEligible),specs.map((_,i)=>i<5));
  assert.equal(data.sources[0].dataQuality.shareTypeClassConflicts.length,2);
  assert.equal(data.reconciliation.distinctReportedSecurityCount,14);
});

test('restatements replace all prior sources; additional holdings append without merging source identities',async t=>{
  const f=await fixture(t,[{rows:[row({value:'10'})]},{amendment:'NEW HOLDINGS',number:1,rows:[row({value:'20'})]},{amendment:'RESTATEMENT',number:2,rows:[row({value:'30'})]},{amendment:'NEW HOLDINGS',number:3,rows:[row({value:'40'})]}]);
  f.manifest.filings.reverse();succeeded(await f.run());
  const {data,identity}=await f.parsed();
  assert.deepEqual(validatePortfolio(data),{errors:[],quarantine:[]});
  assert.equal(data.sources.length,4);assert.equal(data.positions.length,2);
  assert.equal(data.reconciliation.recomputedValueTotalUsd,'70');
  assert.deepEqual(data.amendmentLedger.map(x=>x.effectiveRowCountAfter),[1,2,1,2]);
  assert.equal(data.amendmentLedger[2].replacedSourceIds.length,2);
  assert.notEqual(data.positions[0].reportedSecurityId,data.positions[1].reportedSecurityId);
  assert.equal(identity.instruments.length,2);assert.equal(identity.supersededSourceInstruments.length,2);
});

test('preserves combination reporting managers and exact cover qualification in public coverage',async t=>{
  const qualification='Collateral is excluded unless reinvested.';
  const f=await fixture(t,[{combination:true,qualification}]);succeeded(await f.run());
  const {data}=await f.parsed();
  assert.match(data.coverage.filerQualification,/Separately Reporting Manager/);
  assert.match(data.coverage.filerQualification,/outside this information table/);
  assert.ok(data.coverage.filerQualification.includes(qualification));
  assert.equal(data.sources[0].cover.additionalInformation,qualification);
});

for(const [label,spec,pattern] of [
  ['one-dollar value mismatch',{total:'26'},/value total mismatch/],
  ['row-count mismatch',{count:2},/row count mismatch/],
  ['unknown schema',{schema:'X9999'},/Unsupported value-unit schema/],
  ['legacy schema instead of guessing units',{schema:'X0101'},/Unsupported value-unit schema/],
  ['missing original',{amendment:'RESTATEMENT'},/no observed original/],
  ['decimal quantities',{rows:[row({quantity:'1.5'})]},/Invalid integer/],
  ['missing votes',{rows:[row().replace('<None>0</None>','')]},/Missing XML field/],
  ['duplicate scalar field',{rows:[row().replace('<value>25</value>','<value>25</value><value>25</value>')]},/Ambiguous XML field/],
  ['conflicting issuer names within exact group',{rows:[row(),row({issuer:'Different Name'})]},/Conflicting issuer names/],
  ['invalid manager-reference syntax',{rows:[row({refs:'1;2'})]},/Ambiguous manager references/]
]) test(`fails closed on ${label} without emitting outputs`,async t=>{
  const f=await fixture(t,[spec]);failed(await f.run(),pattern);
  await assert.rejects(access(path.join(f.output,'fixture.normalized.json.gz')));
  await assert.rejects(access(path.join(f.privateDir,'fixture.identities.private.json')));
});

test('missing amendment discovery and incomplete recent history are rejected',async t=>{
  const f=await fixture(t,[{}, {amendment:'NEW HOLDINGS'}]);
  f.manifest.filings.pop();failed(await f.run(),/manifest filing family differs/);
  for(const key of Object.keys(f.submissions.filings.recent)) f.submissions.filings.recent[key]=f.submissions.filings.recent[key].slice(0,1);
  failed(await f.run(),/recent history does not predate/);
});

test('rejects historical discovery overlap, missing amendment numbers, and wrong source metadata',async t=>{
  const f=await fixture(t,[{}, {amendment:'NEW HOLDINGS',number:2}]);
  failed(await f.run(),/Missing or out-of-order amendment number/);
  f.submissions.filings.files=[{name:'history.json',filingTo:'2026-07-01'}];
  failed(await f.run(),/historical submissions overlap/);
  f.submissions.filings.files=[];f.manifest.filings[0].form='13F-HR/A';
  failed(await f.run(),/metadata differs from submissions/);
});

test('verifies table hash and directory completeness rather than acquisition claims',async t=>{
  const f=await fixture(t);const table=f.manifest.filings[0].tables[0];
  const original=table.sha256;table.sha256='0'.repeat(64);failed(await f.run(),/SHA-256 mismatch/);
  table.sha256=original;
  await writeFile(f.manifest.filings[0].directoryPath,JSON.stringify({directory:{item:[{name:'primary_doc.xml'},{name:'table.xml'},{name:'missed.xml'}]}}));
  failed(await f.run(),/missing\/ambiguous XML table/);
});

test('rejects source CIK mismatch and unsafe XML declarations',async t=>{
  const f=await fixture(t);const p=f.manifest.filings[0].coverPath;
  const raw=await readFile(p,'utf8');
  await writeFile(p,raw.replace('<cik>0000000123</cik>','<cik>0000000321</cik>'));
  failed(await f.run(),/Cover CIK mismatch/);
  await writeFile(p,'<!DOCTYPE edgarSubmission []>'+raw);
  failed(await f.run(),/DTD\/entity declarations/);
});

test('keeps private outputs outside repository and requires explicit overwrite; gzip is deterministic',async t=>{
  const f=await fixture(t);
  failed(await f.run({args:['--private-dir',path.join(root,'data')]}),/outside the public repository/);
  succeeded(await f.run());const first=await f.parsed();
  failed(await f.run(),/already exists/);
  succeeded(await f.run({args:['--overwrite']}));
  const second=await f.parsed();assert.deepEqual(second.compressed,first.compressed);
});

test('coverage describes every active table, not only the latest amendment',async t=>{
  const f=await fixture(t,[{combination:true,confidential:'true'},{amendment:'NEW HOLDINGS',number:1,rows:[row({value:'20'})]}]);succeeded(await f.run());
  const {data}=await f.parsed();
  assert.equal(data.reconciliation.activeSourceIds.length,2);
  assert.equal(data.coverage.reportType,'13F COMBINATION REPORT + 13F HOLDINGS REPORT');
  assert.equal(data.coverage.isConfidentialOmittedAsReported,'true');
  assert.match(data.coverage.filerQualification,/combination report separately identifies/);
});
