import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {exportPortfolios,validatePortfolio,projectPortfolio} from '../scripts/export-portfolios.mjs';
import {decodePortfolio,portfolioModel,holdingsPage,portfolioInstrumentDetails} from '../src/portfolio-view.js';
import {buildVisibleGraph,initialState} from '../src/graph-model.js';
const manifest=JSON.parse(await readFile(new URL('../data/portfolios.json',import.meta.url)));
const load=async p=>decodePortfolio(p,JSON.parse(await readFile(new URL('../data/'+p.dataFile,import.meta.url))));
test('all three admitted complete filings reproduce exact public compact data',async()=>{
 const result=await exportPortfolios({check:true});assert.equal(result.portfolios,3);assert.equal(result.positions,53460);assert.ok(result.bytes<4500000);
 assert.equal(manifest.portfolios.reduce((n,p)=>n+p.reconciliation.reportedRowCount,0),54318);
 const expected={'berkshire-2026-06-30':[89,'299253556246',29],'blackrock-2026-06-30':[49286,'6706454577631',5442],'statestreet-2026-06-30':[4085,'3378870771423',4085]};
 for(const p of manifest.portfolios){const rows=(await load(p)).positions;assert.equal(rows.length,expected[p.portfolioId][0]);assert.equal(rows.reduce((n,r)=>n+BigInt(r.valueUsd),0n).toString(),expected[p.portfolioId][1]);assert.equal(new Set(rows.map(r=>r.reportedSecurityId)).size,expected[p.portfolioId][2]);assert.ok(!JSON.stringify(p).match(/cusip|figi|acceptedAt|api_key|raw_content/i));}
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
