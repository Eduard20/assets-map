import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {validatePortfolio,projectPortfolio} from '../scripts/export-portfolios.mjs';
import {decodePortfolio} from '../src/portfolio-view.js';
const priorInputs={
  "data-foundation/portfolios/input/berkshire.normalized.json.gz": "ec17a90309e65e617c0916f3766cf0a1a5637e70",
  "data-foundation/portfolios/input/berkshire.review.json": "467f27c85b80a0ef774c18622b71f6d71e03d9ef",
  "data-foundation/portfolios/input/blackrock.normalized.json.gz": "79da392db7a777f5164e48f88f686409b2ecf539",
  "data-foundation/portfolios/input/blackrock.review.json": "577a4495c4afc26b329d6834e856986ba029d865",
  "data-foundation/portfolios/input/geode.normalized.json.gz": "e51093849bd113346c4b737ac8225a5d8cfac61e",
  "data-foundation/portfolios/input/geode.review.json": "7ff8ec0dbc4c6cfa500c1da903ba9320d7996488",
  "data-foundation/portfolios/input/goldmansachs.normalized.json.gz": "8a1e78467b4e7577e51b79414cce2eca552d89be",
  "data-foundation/portfolios/input/goldmansachs.review.json": "1806e507075a66316cfedb2ac07c7d6be38668b4",
  "data-foundation/portfolios/input/jpmorgan.normalized.json.gz": "b0d9fafa15ea02b4277ece0dd7193e0877cf9cc5",
  "data-foundation/portfolios/input/jpmorgan.review.json": "33dba0cabd1fefd93aea382c63b93ff53cc5a3ea",
  "data-foundation/portfolios/input/morganstanley.normalized.json.gz": "a796366ddbcdb8aa99424e91d3b349f1e659e1f2",
  "data-foundation/portfolios/input/morganstanley.review.json": "d819141538d7476ae234d3f595d284fbdff7bff0",
  "data-foundation/portfolios/input/norgesbank.normalized.json.gz": "e44cfb1dc8c6a4b3d20576c206f6bfcba11f2d90",
  "data-foundation/portfolios/input/norgesbank.review.json": "4da74ae1be9f749e7c76629641466541cadc11c2",
  "data-foundation/portfolios/input/pif.normalized.json.gz": "838de8375e8a1c46cd50b37709112a02624a34ba",
  "data-foundation/portfolios/input/pif.review.json": "9c2aea94d660463c7e633066dafc76bc775a17e4",
  "data-foundation/portfolios/input/statestreet.normalized.json.gz": "72e1c3944ccb8aa2e06bd3a1b3002cb29d1557a7",
  "data-foundation/portfolios/input/statestreet.review.json": "73a8238d5f88604f9ce635d291bf0316dde7bd1a",
  "data-foundation/portfolios/input/vanguardglobaladvisers.normalized.json.gz": "438824963f64c1b1e47e1f228ccb76afa48be57c",
  "data-foundation/portfolios/input/vanguardglobaladvisers.review.json": "9498ead6eedf6587fde9cc5350a4d74aecac9c48"
};
const manifest=JSON.parse(await readFile(new URL('../data/portfolios.json',import.meta.url)));
const equivalence=JSON.parse(await readFile(new URL('../data/instrument-equivalence.json',import.meta.url)));
const expected={cpp:{confidential:null,cik:'1283718',rows:1694,value:'180776675190',accession:'0001104659-26-097308',hash:'e289b088497f3dc97e4c25f7ce97f0b89138fc49fe509963a81a037ecb38038a'},snb:{confidential:'false',cik:'1582202',rows:2301,value:'191389544938',accession:'0001582202-26-000007',hash:'44108b92aca75b121f5d788a1bd869ac09a68b73755500121c56107b7ca84bb8'}};
test('CPP/SNB expansion leaves the original ten normalized inputs and reviews byte-identical',async()=>{
 for(const [file,sha] of Object.entries(priorInputs)){
  const b=await readFile(new URL('../'+file,import.meta.url));
  assert.equal(createHash('sha1').update(Buffer.from(`blob ${b.length}\0`)).update(b).digest('hex'),sha,file);
 }
 assert.equal(manifest.portfolios.length,12);
 assert.ok(!manifest.portfolios.some(p=>/^(calpers|temasek)-/.test(p.portfolioId)),'unpublished parallel candidates must not leak into this integration');
});
for(const [slug,want] of Object.entries(expected))test(`${slug} retains exact source scope, reported confidentiality and every connection`,async()=>{
 const raw=gunzipSync(await readFile(new URL(`../data-foundation/portfolios/input/${slug}.normalized.json.gz`,import.meta.url))).toString();
 const input=JSON.parse(raw),review=JSON.parse(await readFile(new URL(`../data-foundation/portfolios/input/${slug}.review.json`,import.meta.url)));
 assert.equal(createHash('sha256').update(raw).digest('hex'),want.hash);assert.equal(review.inputSha256,want.hash);
 assert.deepEqual(validatePortfolio(input),{errors:[],quarantine:[]});
 assert.equal(input.filer.cik,want.cik);assert.equal(input.reportingDate,'2026-06-30');assert.match(input.checkedThrough,/^2026-10-24T/);
 assert.equal(input.sources.length,1);const source=input.sources[0];assert.equal(source.accessionNumber,want.accession);
 assert.equal(source.cover.reportType,'13F HOLDINGS REPORT');assert.equal(source.cover.isConfidentialOmitted,want.confidential);
 assert.equal(input.coverage.isConfidentialOmittedAsReported,want.confidential);assert.deepEqual(source.cover.includedManagers,[]);assert.deepEqual(source.cover.otherReportingManagers,[]);
 assert.equal(input.amendmentLedger.length,1);assert.equal(input.amendmentLedger[0].action,'original_report');
 assert.equal(input.reconciliation.reportedRowCount,want.rows);assert.equal(input.reconciliation.shareRowCount,want.rows);assert.equal(input.reconciliation.excludedRowCount,0);
 assert.equal(input.reconciliation.recomputedValueTotalUsd,want.value);assert.equal(input.reconciliation.shareValueUsd,want.value);
 assert.ok(input.positions.every(p=>p.shareViewEligible&&!p.putCall&&p.quantityType==='SH'&&p.otherManagerRefs.length===0));
 assert.doesNotMatch(raw,/"(?:cusip|figi|securityIdentifier|hashedCUSIP|rawCUSIP|coverPath|submissionsPath)"/i);
 const summary=manifest.portfolios.find(p=>p.portfolioId===input.portfolioId);assert.deepEqual(projectPortfolio(input,review,raw).summary,summary);
 assert.match(summary.coverage,/not proof of legal ownership or a complete investment portfolio/);
 const decoded=decodePortfolio(summary,JSON.parse(await readFile(new URL('../data/'+summary.dataFile,import.meta.url))));
 assert.equal(decoded.positions.length,want.rows);const ids=new Set(decoded.positions.map(p=>p.reportedSecurityId));
 const members=equivalence.groups.flat();assert.equal(members.filter(id=>ids.has(id)).length,want.rows);assert.equal(equivalence.groups.filter(g=>g.some(id=>ids.has(id))).length,want.rows);
 assert.throws(()=>projectPortfolio(input,{...review,inputSha256:'stale'},raw),/review/);
});
