import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {validatePortfolio,projectPortfolio} from '../scripts/export-portfolios.mjs';
import {decodePortfolio} from '../src/portfolio-view.js';
const sha=b=>createHash('sha256').update(b).digest('hex');
const priorFiles={
  "data/berkshire-2026-06-30.json": "97e288aad34bb1142db4b1b15d247f74bc3ee48eeee44cdd2128a4b7ac0ed1f4",
  "data/blackrock-2026-06-30.json": "5e430e68de207e9ffbb653903ed6334d26a4fd12a26152a1e607d2fd60e82c67",
  "data/cpp-2026-06-30.json": "ef57b8bb298b27e757b4c6a8cd7a7e1d4bd6da12718c2efd17e95d6feb554694",
  "data/geode-2026-06-30.json": "04407df1576bdbc01a7bdf4a2cd9b578965e6fbb661e8355bfe6f38c22942b7c",
  "data/goldmansachs-2026-06-30.json": "b1ded74277c18e3036c35786098d35b1b619a307a289bda686a4436fd0db82bc",
  "data/graph.json": "7e2fd0dbc6c44f8edc9974432aecaefa3be8947349d15ba3b9b7a579e667c601",
  "data/jpmorgan-2026-06-30.json": "483a550d2dc672cb308500b924c05eb1f7e7d9e841bc47961b299b20e7a7a9ce",
  "data/morganstanley-2026-06-30.json": "4575f53af604410e6b67ec74b5fa466bba15e2dd8f299e05efa401342b6993fa",
  "data/norgesbank-2026-06-30.json": "984b1cd391d3a46c27b6911bdc354ebace0b3082531fb932b7911711f70287d2",
  "data/pif-2026-06-30.json": "ea4f2107bf5e4f24481182d12d460f8dd1343e88d927babbbf3ecac39c8b5b4b",
  "data/researched.json": "1a249dfde5b011223389ab6fbee03e60f9c618c8f247c04dcd7de9f740576282",
  "data/snb-2026-06-30.json": "77746b2f821aa5bb74fbac47e05eeed9618625e97767a751ea604823183cb344",
  "data/statestreet-2026-06-30.json": "7ef9e6fdefa0b7e129f9760e884e697b6a25bf0779d45d77cfbade0006bc55fa",
  "data/uae.json": "242461e80ba31a82bf420f3ded75ea4bcf7c84012bf01d9304dc6309666830fe",
  "data/vanguardglobaladvisers-2026-06-30.json": "f52d6739563109ff0cf41949ba9fa45c2e68e0e6796fec82e114aec94330206a",
  "data-foundation/portfolios/input/berkshire.normalized.json.gz": "ac7dc976815427a3fe2d40d2b4088db8b4ab15ea33fef4c30f8d69c030536fa6",
  "data-foundation/portfolios/input/berkshire.review.json": "4105caf4b5c7b34dfccf0e28f4e17f8535a0683af359b7f476ab6a1060429c23",
  "data-foundation/portfolios/input/blackrock.normalized.json.gz": "947ddaccdce5e11b5a622feda9caddf4cec70e808206f3cfc64820c342b3c7e9",
  "data-foundation/portfolios/input/blackrock.review.json": "aaf3e72c805114f23e91ec669041927b285628abf080ae34de0045cbf3de16e2",
  "data-foundation/portfolios/input/cpp.normalized.json.gz": "4e433a71c1801772ce5e0a5cee008e47f0ff607e7e55d196e4c68640d5c51a5b",
  "data-foundation/portfolios/input/cpp.review.json": "4f7ca7f5353c43a659f7ee90088b935ffa0959131c29c810578580650be70267",
  "data-foundation/portfolios/input/geode.normalized.json.gz": "5d4e1b49f96b6109d3623c2e4ddf3d17f197b43cc98647b885b1ed2c24842b42",
  "data-foundation/portfolios/input/geode.review.json": "ed19b9232811a1c5570be4a3ccdb83322bc62ebe180a5153e3acb06ea502ed3a",
  "data-foundation/portfolios/input/goldmansachs.normalized.json.gz": "a8bb7a022d20d3d927c16d96e004c5b56c7551708da15d62dc5ff90a5ca9b1cb",
  "data-foundation/portfolios/input/goldmansachs.review.json": "e816193432c76e05cb724d24da7a072f74bd92e279cde828dacbe00b8578e528",
  "data-foundation/portfolios/input/jpmorgan.normalized.json.gz": "f695d74a25284cdeb189c8e68df2ddd59659d7d0453cceb9af1fef6d5fadf395",
  "data-foundation/portfolios/input/jpmorgan.review.json": "5724e2847a2b0eea392ee269137fb80972ae115e592f78265bb302711779616f",
  "data-foundation/portfolios/input/morganstanley.normalized.json.gz": "8b4ec76e06c4cbcc16d17ba998e4667e7782bb125e60106b3a3a286cec60a49e",
  "data-foundation/portfolios/input/morganstanley.review.json": "c20c4c332be399d041da7f2eec713cf8b4ddf60ec2af68c6f6142f13efdb2256",
  "data-foundation/portfolios/input/norgesbank.normalized.json.gz": "dd1c7c7363f3d7934d9d354dd40a55d3288d7a4ef3d5c99b430f5603e55b0bc9",
  "data-foundation/portfolios/input/norgesbank.review.json": "d70b924daf7f68dcb0a106cde56ca24b579ecc1b6d8262dc5e7e32257815aa7f",
  "data-foundation/portfolios/input/pif.normalized.json.gz": "8ac32368f5c10fa25eeae835e07b924b72f4745b9f7f2b0113916520874f80d5",
  "data-foundation/portfolios/input/pif.review.json": "67f8df2b1f57d5a30c930f7bb53d6c87f366bfabb898c5f8c060f31c8570f952",
  "data-foundation/portfolios/input/snb.normalized.json.gz": "7791dc712e093219333acec306904ba1a04ff1976fb608aca53ed4da982465d9",
  "data-foundation/portfolios/input/snb.review.json": "4572b1200a767c0b038d299fa8df80d423e9f1d695ee955f05bc8232b8d0427d",
  "data-foundation/portfolios/input/statestreet.normalized.json.gz": "7f094b609d167067568eaba89de0c91b012d3ba41bce3e6d1c589a0e0587a7e2",
  "data-foundation/portfolios/input/statestreet.review.json": "0ebe5fa7b06733e24950141b088d403612e9447df1df79dfdcb2a12a7b936275",
  "data-foundation/portfolios/input/vanguardglobaladvisers.normalized.json.gz": "fe817b00601582a4faeebf0f04d785f59f11ce4f5d6870d1359a21510bdd151d",
  "data-foundation/portfolios/input/vanguardglobaladvisers.review.json": "a9311545699f290d73629623e0cfdb508eec1bcefc1dc56422e5f8637c26785f"
};
const raw=gunzipSync(await readFile(new URL('../data-foundation/portfolios/input/nps.normalized.json.gz',import.meta.url))).toString();
const input=JSON.parse(raw),review=JSON.parse(await readFile(new URL('../data-foundation/portfolios/input/nps.review.json',import.meta.url)));
const manifest=JSON.parse(await readFile(new URL('../data/portfolios.json',import.meta.url)));
const identity=JSON.parse(await readFile(new URL('../data/instrument-equivalence.json',import.meta.url)));
test('NPS preserves all twelve earlier inputs, reviews, compact portfolios and other datasets',async()=>{
 for(const [path,hash] of Object.entries(priorFiles))assert.equal(sha(await readFile(new URL('../'+path,import.meta.url))),hash,path);
 assert.equal(manifest.portfolios.length,13);assert.ok(!manifest.portfolios.some(p=>/^(calpers|temasek)-/.test(p.portfolioId)));
});
test('NPS retains exact source scope and warrant exclusion without erasing evidence',async()=>{
 assert.equal(sha(raw),'98b32c025f97751eed134514bf240a299abd16e0a24a514abc544c550c816edd');assert.equal(review.inputSha256,sha(raw));
 assert.deepEqual(validatePortfolio(input),{errors:[],quarantine:[]});assert.equal(input.filer.cik,'1608046');assert.equal(input.reportingDate,'2026-06-30');
 assert.equal(input.sources.length,1);const source=input.sources[0];assert.equal(source.accessionNumber,'0001193125-26-347818');assert.equal(source.filingDate,'2026-08-13');
 assert.equal(source.cover.reportType,'13F HOLDINGS REPORT');assert.equal(source.cover.isConfidentialOmitted,'false');assert.deepEqual(source.cover.includedManagers,[]);assert.deepEqual(source.cover.otherReportingManagers,[]);
 assert.equal(input.amendmentLedger.length,1);assert.equal(input.amendmentLedger[0].action,'original_report');
 assert.equal(input.reconciliation.reportedRowCount,552);assert.equal(input.reconciliation.shareRowCount,551);assert.equal(input.reconciliation.recomputedValueTotalUsd,'155079663358');assert.equal(input.reconciliation.shareValueUsd,'155075664624');
 const excluded=input.positions.filter(p=>!p.shareViewEligible);assert.equal(excluded.length,1);assert.equal(excluded[0].rowOrdinal,552);assert.equal(excluded[0].securityClass,'W EXP 08/03/202');assert.equal(excluded[0].valueUsd,'3998734');assert.deepEqual(excluded[0].shareViewExclusionReasons,['warrant_or_right_class']);
 assert.doesNotMatch(raw,/"(?:cusip|figi|securityIdentifier|hashedCUSIP|rawCUSIP|coverPath|submissionsPath)"/i);
 const summary=manifest.portfolios.find(p=>p.portfolioId===input.portfolioId);assert.deepEqual(projectPortfolio(input,review,raw).summary,summary);assert.equal(summary.checkedThrough,'2026-10-24');
 assert.match(summary.coverage,/not proof of legal ownership or a complete investment portfolio/);
 const decoded=decodePortfolio(summary,JSON.parse(await readFile(new URL('../data/'+summary.dataFile,import.meta.url))));assert.equal(decoded.positions.length,551);assert.ok(!decoded.positions.some(p=>p.rowOrdinal===552));
 assert.throws(()=>projectPortfolio(input,{...review,inputSha256:'stale'},raw),/review/);
});
test('NPS exact equivalence preserves every old group and leaves six instruments separate',()=>{
 const ids=new Set(input.positions.filter(p=>p.shareViewEligible).map(p=>p.reportedSecurityId)),members=identity.groups.flat();
 assert.equal(members.filter(id=>ids.has(id)).length,545);assert.equal([...ids].filter(id=>!members.includes(id)).length,6);assert.ok(!members.includes(input.positions.find(p=>p.rowOrdinal===552).reportedSecurityId));
 const prior=identity.groups.map(g=>g.filter(id=>!ids.has(id)).sort()).filter(g=>g.length>1).sort();assert.equal(prior.length,5657);assert.equal(sha(JSON.stringify(prior)),'ee86881bb4f8c03ba4b63556890549c65dfb862bcf5ef0829ace2fc7c2b4b3b0');
 assert.equal(identity.admission.reviewedInputSha256,'275168a990e047571190011bf6709578ebc6c128550117e1e0971b031b4df55c');
});
