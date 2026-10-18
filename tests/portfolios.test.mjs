import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,writeFile,mkdtemp,rm,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {gzipSync,gunzipSync} from 'node:zlib';
import {exportPortfolios,validatePortfolio,projectPortfolio,validateEquivalence,publicationErrors,sha256} from '../scripts/export-portfolios.mjs';
import {decodePortfolio,portfolioModel,holdingsPage,portfolioInstrumentDetails} from '../src/portfolio-view.js';
import {buildVisibleGraph,initialState} from '../src/graph-model.js';
const manifest=JSON.parse(await readFile(new URL('../data/portfolios.json',import.meta.url)));
const load=async p=>decodePortfolio(p,JSON.parse(await readFile(new URL('../data/'+p.dataFile,import.meta.url))));
const expected={
 'berkshire-2026-06-30':{reported:89,total:'299253556246',shares:89,shareValue:'299253556246',instruments:29},
 'blackrock-2026-06-30':{reported:49968,total:'6729538649155',shares:49286,shareValue:'6706454577631',instruments:5442},
 'statestreet-2026-06-30':{reported:4261,total:'3383260349220',shares:4085,shareValue:'3378870771423',instruments:4085},
 'geode-2026-06-30':{reported:8470,total:'1875315674155',shares:8455,shareValue:'1875165705077',instruments:4438},
 'jpmorgan-2026-06-30':{reported:34064,total:'1807041234839',shares:32666,shareValue:'1710607027032',instruments:6541},
 'morganstanley-2026-06-30':{reported:45905,total:'1890805575974',shares:45409,shareValue:'1889856060810',instruments:8170},
 'goldmansachs-2026-06-30':{reported:14070,total:'1151631766592',shares:12904,shareValue:'953071672750',instruments:5471},
 'norgesbank-2026-06-30':{reported:1617,total:'1003234964718',shares:1616,shareValue:'1003234702801',instruments:1616}
};
test('all eight admitted complete filings reproduce exact public compact data',async()=>{
 const result=await exportPortfolios({check:true});assert.equal(result.portfolios,8);assert.equal(result.positions,154510);assert.ok(result.bytes<13000000);
 assert.deepEqual(manifest.portfolios.map(p=>p.portfolioId).sort(),Object.keys(expected).sort());
 assert.equal(manifest.portfolios.reduce((n,p)=>n+p.reconciliation.reportedRowCount,0),158444);
 assert.equal(manifest.portfolios.reduce((n,p)=>n+p.reconciliation.excludedRowCount,0),3934);
 for(const p of manifest.portfolios){
  const rows=(await load(p)).positions,want=expected[p.portfolioId],r=p.reconciliation;
  assert.equal(p.reportingDate,'2026-06-30');assert.equal(p.checkedThrough,'2026-10-18');
  assert.equal(r.reportedRowCount,want.reported);assert.equal(r.totalValueUsd,want.total);
  assert.equal(rows.length,want.shares);assert.equal(r.shareRowCount,want.shares);assert.equal(r.shareValueUsd,want.shareValue);
  assert.equal(rows.reduce((n,row)=>n+BigInt(row.valueUsd),0n).toString(),want.shareValue);
  assert.equal(new Set(rows.map(row=>row.reportedSecurityId)).size,want.instruments);assert.equal(r.shareReportedSecurityCount,want.instruments);
  assert.equal(r.excludedRowCount,want.reported-want.shares);
  assert.equal(r.excludedValueUsd,(BigInt(want.total)-BigInt(want.shareValue)).toString());
  assert.ok(!JSON.stringify(p).match(/cusip|figi|acceptedAt|api_key|raw_content/i));
 }
});
test('every exported row remains identical to its admitted source row across all eight filers',async()=>{
 for(const p of manifest.portfolios){
  const slug=p.portfolioId.replace('-2026-06-30',''),base=new URL('../data-foundation/portfolios/input/',import.meta.url);
  const raw=gunzipSync(await readFile(new URL(slug+'.normalized.json.gz',base))).toString('utf8');
  const input=JSON.parse(raw),review=JSON.parse(await readFile(new URL(slug+'.review.json',base)));
  assert.deepEqual(validatePortfolio(input),{errors:[],quarantine:[]});
  assert.equal(input.positions.length,expected[p.portfolioId].reported);
  assert.doesNotMatch(raw, /"(?:cusip|rawCUSIP|hashedCUSIP|securityIdentifier|figi|coverPath|submissionsPath)"/i);
  const exported=(await load(p)).positions,admitted=input.positions.filter(row=>row.shareViewEligible);
  assert.equal(exported.length,admitted.length);
  for(let i=0;i<exported.length;i++)for(const [field,value] of Object.entries(exported[i]))assert.deepEqual(value,admitted[i][field],`${p.portfolioId} row ${admitted[i].rowOrdinal} ${field}`);
  assert.deepEqual(projectPortfolio(input,review,raw).summary,p);
  if(input.importedBy)assert.notEqual(review.reviewer,input.importedBy);
 }
});
test('expanded identity release covers exactly eight filers and keeps unmatched instruments separate',async()=>{
 const identity=JSON.parse(await readFile(new URL('../data/instrument-equivalence.json',import.meta.url)));
 assert.equal(identity.groups.length,5651);assert.equal(identity.coverage.matchedGroups,5651);
 assert.equal(identity.coverage.eligibleSourceRows,154510);
 assert.equal(identity.coverage.eligibleSourceScopedInstruments,35792);
 assert.equal(identity.coverage.matchedSourceScopedInstruments,20953);
 assert.equal(identity.coverage.unmatchedSourceScopedInstruments,14839);
 assert.equal(identity.groups.length+identity.coverage.unmatchedSourceScopedInstruments,20490);
 assert.deepEqual([...identity.coverage.portfolioIds].sort(),Object.keys(expected).sort());
 const memberships=identity.groups.flatMap(group=>Array.isArray(group)?group:group.members);
 assert.equal(memberships.length,20953);assert.equal(new Set(memberships).size,memberships.length);
 assert.ok(memberships.every(id=>/^sec13f-\d{10}-\d{2}-\d{6}-security-\d{5,}$/.test(id)));
});
test('FMR remains withheld and material source qualifications survive public projection',async()=>{
 for(const directory of ['../data/','../data-foundation/portfolios/input/'])assert.ok(!(await readdir(new URL(directory,import.meta.url))).some(file=>/^fmr(?:-|\.)/.test(file)));
 assert.ok(!manifest.portfolios.some(p=>p.filer.cik==='315066'));
 const morgan=manifest.portfolios.find(p=>p.portfolioId==='morganstanley-2026-06-30');
 assert.match(morgan.coverage,/13F COMBINATION REPORT/);
 assert.match(morgan.coverage,/Morgan Stanley Institutional Investment Advisors LLC/);
 assert.match(morgan.coverage,/separately reported holdings are outside this information table/);
 assert.ok(morgan.dataQuality.warnings.some(w=>w.type==='unresolved_manager_reference'&&w.rowCount===110));
 const norges=manifest.portfolios.find(p=>p.portfolioId==='norgesbank-2026-06-30');
 assert.match(norges.coverage,/Collateral received through secured lending and borrowing/);
 assert.match(norges.coverage,/unless reinvested/);assert.match(norges.coverage,/not reflected in our 13F reporting/);
});
test('source-scoped instrument graph preserves every row, exact totals and bounded progressive view',async()=>{
 const p=await load(manifest.portfolios.find(p=>p.portfolioId.startsWith('blackrock'))),model=portfolioModel(p),state=initialState(model);
 assert.equal(model.holdingEdges.length,49286);assert.equal(model.edges.length,5442);assert.equal(buildVisibleGraph(model,state).nodes.length,9);
 state.limits.set(model.rootId,40);assert.equal(buildVisibleGraph(model,state).nodes.length,41);state.limits.set(model.rootId,50000);assert.ok(buildVisibleGraph(model,state).nodes.length<=45);
 assert.equal(model.edges.reduce((n,e)=>n+BigInt(e.portfolioPosition.valueUsd),0n).toString(),p.reconciliation.shareValueUsd);
 assert.equal(holdingsPage(model).rows.length,50);assert.equal(holdingsPage(model,'',1).rows.length,50);assert.equal(holdingsPage(model,'not-a-real-issuer').rows.length,0);assert.ok(holdingsPage(model,'APPLE').total>0);
 const group=model.edges.find(e=>e.portfolioPositions.length>1);assert.match(portfolioInstrumentDetails(group,p),/every underlying row/);assert.equal(group.portfolioPositions.reduce((n,r)=>n+BigInt(r.valueUsd),0n).toString(),group.portfolioPosition.valueUsd);
});
test('admission fails closed for stale or missing independent review and invalid rows quarantine',async()=>{
 const raw=gunzipSync(await readFile(new URL('../data-foundation/portfolios/input/berkshire.normalized.json.gz',import.meta.url))).toString(),input=JSON.parse(raw),review=JSON.parse(await readFile(new URL('../data-foundation/portfolios/input/berkshire.review.json',import.meta.url)));
 assert.throws(()=>projectPortfolio(input,null,raw),/review/);assert.throws(()=>projectPortfolio(input,{...review,inputSha256:'stale'},raw),/review/);assert.throws(()=>projectPortfolio(input,{...review,checks:{...review.checks,amendmentDiscovery:false}},raw),/review/);
 const bad=structuredClone(input);bad.positions[0].valueUsd='-1';assert.equal(validatePortfolio(bad).quarantine.length,1);assert.throws(()=>projectPortfolio(bad,review,raw),/quarantined/);
 const totals=structuredClone(input);totals.reconciliation.shareValueUsd='1';assert.match(validatePortfolio(totals).errors.join(' '),/Reconciliation/);
 const cover=structuredClone(input);cover.sources[0].cover.tableValueTotal='1';assert.match(validatePortfolio(cover).errors.join(' '),/Cover value total mismatch/);
 const dropped=structuredClone(input);dropped.positions.pop();for(const [k,v] of Object.entries({reportedRowCount:88,recomputedValueTotalUsd:dropped.positions.reduce((n,p)=>n+BigInt(p.valueUsd),0n).toString()}))dropped.reconciliation[k]=v;dropped.reconciliation.shareRowCount=88;dropped.reconciliation.shareValueUsd=dropped.reconciliation.recomputedValueTotalUsd;assert.match(validatePortfolio(dropped).errors.join(' '),/Cover row count mismatch/);
});
test('reviewer independence needs a recorded importer except for the three pinned legacy inputs',async()=>{
 const read=async n=>{const raw=gunzipSync(await readFile(new URL(`../data-foundation/portfolios/input/${n}.normalized.json.gz`,import.meta.url))).toString();return {raw,input:JSON.parse(raw),review:JSON.parse(await readFile(new URL(`../data-foundation/portfolios/input/${n}.review.json`,import.meta.url)))};};
 const legacy=await read('berkshire');assert.equal(legacy.input.importedBy,undefined);assert.doesNotThrow(()=>projectPortfolio(legacy.input,legacy.review,legacy.raw));
 const current=await read('geode');assert.doesNotThrow(()=>projectPortfolio(current.input,current.review,current.raw));
 const {importedBy,...anonymous}=current.input,raw=JSON.stringify(anonymous,null,2)+'\n';assert.ok(importedBy);
 assert.throws(()=>projectPortfolio(anonymous,{...current.review,inputSha256:sha256(raw)},raw),/Independent complete-batch review/);
 assert.throws(()=>projectPortfolio(current.input,{...current.review,reviewer:importedBy},current.raw),/Independent complete-batch review/);
});
test('superseded filing rows cannot be appended to the effective State Street table',async()=>{
 const input=JSON.parse(gunzipSync(await readFile(new URL('../data-foundation/portfolios/input/statestreet.normalized.json.gz',import.meta.url))).toString());
 assert.deepEqual(validatePortfolio(input).errors,[]);
 const original=input.sources.find(s=>!input.reconciliation.activeSourceIds.includes(s.sourceId)).sourceId,appended=structuredClone(input);appended.positions[0]={...appended.positions[0],sourceId:original,positionId:`${original}-row-00001`};
 assert.match(validatePortfolio(appended).errors.join(' '),/superseded or inactive sources/);
 const unknown=structuredClone(input);unknown.reconciliation.activeSourceIds=['sec13f-unknown'];assert.match(validatePortfolio(unknown).errors.join(' '),/Invalid active source set/);
});
test('corrected equity-weight ETF is retained, SH-tagged note excluded, original State Street not appended',async()=>{
 const blackrock=await load(manifest.portfolios.find(p=>p.portfolioId.startsWith('blackrock')));assert.ok(blackrock.positions.some(p=>/EQ WT/.test(p.securityClass)));
 const state=await load(manifest.portfolios.find(p=>p.portfolioId.startsWith('statestreet')));assert.ok(!state.positions.some(p=>/^(NOTE|NOTES|DEB|DEBENTURE)\b/.test(p.securityClass)));assert.equal(state.positions.length,4085);assert.equal(new Set(state.positions.map(p=>p.sourceId)).size,1);
 assert.ok(manifest.portfolios.find(p=>p.portfolioId.startsWith('blackrock')).dataQuality.warnings.some(w=>w.type==='unresolved_manager_reference'));
});

test('instrument identity map is bound to the exact admitted inputs and exact-match rule',async()=>{
 const inputs=await Promise.all(manifest.portfolios.map(p=>p.portfolioId.replace('-2026-06-30','')).map(async n=>{const raw=gunzipSync(await readFile(new URL(`../data-foundation/portfolios/input/${n}.normalized.json.gz`,import.meta.url))).toString();return {raw,input:JSON.parse(raw)};}));
 const identity=JSON.parse(await readFile(new URL('../data/instrument-equivalence.json',import.meta.url)));
 assert.deepEqual(validateEquivalence(identity,inputs),[]);
 const reimported=structuredClone(inputs);reimported[0].raw+=' ';assert.match(validateEquivalence(identity,reimported).join(' '),/stale for berkshire/);
 const instrument=new Map(inputs.flatMap(({input})=>input.positions.filter(p=>p.shareViewEligible).map(p=>[p.reportedSecurityId,{portfolioId:input.portfolioId,securityClass:p.securityClass}])));
 const swapped=structuredClone(identity),other=[...instrument].find(([id,i])=>i.portfolioId===instrument.get(swapped.groups[0][1]).portfolioId&&i.securityClass!==instrument.get(swapped.groups[0][0]).securityClass&&!identity.groups.flat().includes(id));
 swapped.groups[0][1]=other[0];assert.match(validateEquivalence(swapped,inputs).join(' '),/Class\/type\/option mismatch in group 1/);
 const sameFiler=structuredClone(identity);sameFiler.groups[0]=[sameFiler.groups[0][0],sameFiler.groups[1][0]];assert.match(validateEquivalence(sameFiler,inputs).join(' '),/Same-filer merge in group 1|repeated/);
 const counts=structuredClone(identity);counts.coverage.matchedGroups--;assert.match(validateEquivalence(counts,inputs).join(' '),/matchedGroups/);
});
test('check mode is read-only even when a batch is quarantined',async()=>{
 const input=JSON.parse(gunzipSync(await readFile(new URL('../data-foundation/portfolios/input/berkshire.normalized.json.gz',import.meta.url))).toString());input.positions[0].valueUsd='-1';
 const directory=await mkdtemp(tmpdir()+'/portfolio-check-'),file='check-mode-probe.normalized.json.gz',report=new URL('../data-foundation/portfolios/quarantine/'+file+'.json',import.meta.url);
 try{await writeFile(directory+'/'+file,gzipSync(JSON.stringify(input)));await writeFile(directory+'/check-mode-probe.review.json',await readFile(new URL('../data-foundation/portfolios/input/berkshire.review.json',import.meta.url)));await assert.rejects(exportPortfolios({directory,check:true}),/quarantined/);await assert.rejects(access(report));}
 finally{await rm(directory,{recursive:true,force:true});await rm(report,{force:true});}
});
test('every exported portfolio is published and nothing stale ships',async()=>{
 const {PUBLIC_FILES}=await import('../scripts/prepare-site.mjs'),files=manifest.portfolios.map(p=>p.dataFile);
 assert.deepEqual(publicationErrors(files,{presentFiles:await readdir(new URL('../data/',import.meta.url))}),[]);
 assert.match(publicationErrors([...files,'fmr-2026-06-30.json']).join(' '),/data\/fmr-2026-06-30.json is missing from PUBLIC_FILES/);
 assert.match(publicationErrors(files.slice(1)).join(' '),new RegExp(`PUBLIC_FILES publishes data/${files[0]}`));
 assert.match(publicationErrors(files,{presentFiles:[...files,'portfolios.json','retired-2026-03-31.json']}).join(' '),/retired-2026-03-31.json is an orphaned/);
 assert.ok(files.every(f=>PUBLIC_FILES.includes('data/'+f)));
});
