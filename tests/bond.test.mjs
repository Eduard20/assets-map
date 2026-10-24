import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {bondPilot,validateBondPilot,claimCount,shareOfIssue,holderCoverage,sumFace,sumValues,portfolioWeight} from '../src/bond-data.js';
import {mountBondPilot} from '../src/bond-view.js';
const copy=()=>structuredClone(bondPilot);
test('pilot stays within §8 bounds with four separate record families',()=>{
  const d=validateBondPilot(copy());assert.equal(d.assetClass,'debt');assert.equal(d.instruments.length,4);assert.ok(claimCount(d)<=30);assert.equal(claimCount(d),17);
  assert.deepEqual([d.terms.length,d.outstanding.length,d.holdings.length,d.valuations.length],[4,4,2,3]);
  assert.ok(d.instruments.every(i=>d.gaps.some(g=>g.instrumentId===i.id&&g.category==='coverage')),'coverage gap shown for 100% of lines');
  assert.ok(d.sources.every(s=>s.retrievedAt==='2026-10-24'&&s.asOf<=s.retrievedAt&&s.reuse));
  assert.equal(d.outstanding.find(o=>o.instrumentId==='bond-orcl-2030').asOfDate,'2026-05-31');
});
test('no proprietary identifiers in public data; LEI kept',()=>{
  const json=JSON.stringify(bondPilot);assert.doesNotMatch(json,/cusip|isin/i);assert.match(json,/1Z4GXXU7ZHVWFCD8TV52/);
  for(const change of [d=>d.instruments[0].name='Note 91282CNT4',d=>d.terms[0].excerpt+=' "cusip":"x"',d=>d.instruments[0].cusip='x',d=>d.instruments[0].name='US91282CNT49']){const d=copy();change(d);assert.throws(()=>validateBondPilot(d),/identifier/i);}
});
test('equity, beneficial, voting and control predicates and fields are rejected for debt',()=>{
  for(const p of ['direct_equity_ownership','beneficial_ownership','voting_authority','control_assertion']){
    const d=copy();d.holdings[0].predicate=p;assert.throws(()=>validateBondPilot(d),/Equity predicate rejected/);
    const r=copy();r.relationships[0].predicate=p;assert.throws(()=>validateBondPilot(r),/Equity predicate rejected/);}
  for(const field of ['equityPercentage','votingPercentage','beneficialPercentage','controlFlag']){const d=copy();d.holdings[0][field]=1;assert.throws(()=>validateBondPilot(d));}
});
test('rejects invented holders, bad sources, dates, units and bounds',()=>{
  for(const change of [
    d=>d.entities.push({id:'bond-other',name:'Other holders',kind:'fund',lei:null,leiSourceId:null}),
    d=>d.sources[0].url='https://example.com/x',d=>d.sources[0].url='http://api.fiscaldata.treasury.gov/x',d=>d.sources[2].asOf='2026-10-25',d=>d.sources[0].retrievedAt='2026-02-30',
    d=>d.holdings[0].unit='currency_value',d=>d.outstanding[0].unit='currency_value',d=>d.holdings[0].reportDate='2026-09-23',d=>d.outstanding[0].faceCurrency='EUR',
    d=>d.holdings[0].faceAmount=2e11,d=>d.holdings[1].faceBasis='not_indexed',d=>d.terms[1].fields.principalIndexation={value:'none',availability:'known',reason:null},
    d=>d.terms[0].fields.dayCount={value:null,availability:'known',reason:null},d=>d.terms[0].fields.dayCount={value:0,availability:'unknown',reason:'x'},
    d=>d.valuations[1].priceConvention='dirty',d=>d.valuations[0].unit='currency_value',d=>d.gaps=d.gaps.filter(g=>g.instrumentId!=='bond-orcl-2030'||g.category!=='coverage'),
    d=>d.instruments.push({...d.instruments[2],id:'bond-orcl-third'}),d=>d.entities.push({id:'bond-apple',name:'Apple Inc.',kind:'corporate',lei:null,leiSourceId:null})&&d.instruments.splice(3,1,{...d.instruments[3],issuerId:'bond-apple'}),
    d=>d.outstanding.splice(2,1),d=>d.relationships[0].to='bond-oracle',d=>d.holdings[0].holderId='bond-oracle',d=>{for(let i=0;i<14;i++)d.relationships.push({...d.relationships[0],id:`bond-rel-x${i}`});}
  ]){const d=copy();change(d);assert.throws(()=>validateBondPilot(d));}
});
test('share of issue is face ÷ face at the same line, date and indexation basis',()=>{
  const d=copy(),s=shareOfIssue(d,'bond-hold-1');assert.equal(s.status,'known');
  assert.ok(Math.abs(s.value/100-0.1109993709441814)<1e-12,'matches SOMA stated percentOutstanding');
  const tips=shareOfIssue(d,'bond-hold-2');assert.equal(tips.status,'unknown');assert.equal(tips.reason,'indexation_basis_mismatch');
  const later=copy();later.outstanding[0].asOfDate='2026-08-31';later.sources[2].asOf='2026-08-31';assert.equal(shareOfIssue(later,'bond-hold-1').reason,'no_outstanding_at_holding_date');
  const c=holderCoverage(d,'bond-ust-note-2035');assert.equal(c.coverageStatus,'partial');assert.ok(Math.abs(c.disclosed+c.undisclosed-100)<1e-9);
  assert.equal(holderCoverage(d,'bond-orcl-2030').status,'no_disclosed_holders');assert.equal(holderCoverage(d,'bond-ust-tips-2035').status,'side_by_side');
});
test('§5.2 aggregation guards refuse cross-currency, line, date, basis and unit sums',()=>{
  const d=copy(),[a,b]=d.outstanding;
  assert.throws(()=>sumFace([a,b]),/tranches or lines/);
  assert.throws(()=>sumFace([a,{...a,faceCurrency:'EUR'}]),/currencies/);
  assert.throws(()=>sumFace([a,{...a,asOfDate:'2026-08-31'}]),/dates/);
  assert.throws(()=>sumFace([d.holdings[1],{...d.holdings[1],faceBasis:'indexed'}]),/indexation/);
  assert.throws(()=>sumFace([a,{...a,unit:'currency_value'}]),/currency values/);
  assert.equal(sumFace([a]),134934766500);
  const v={unit:'currency_value',valueCurrency:'USD',valuationDate:'2026-06-30',valuationBasis:'market',priceConvention:'clean',value:10};
  assert.equal(sumValues([v,v]),20);
  assert.throws(()=>sumValues([v,{...v,valuationBasis:'amortized_cost'}]),/valuation bases/);
  assert.throws(()=>sumValues([v,{...v,priceConvention:'dirty'}]),/conventions/);
  assert.throws(()=>sumValues([v,{...v,priceConvention:'unknown'}]),/unknown/);
  assert.throws(()=>sumValues([v,{...v,valueCurrency:'EUR'}]),/currencies/);
  assert.throws(()=>sumValues([v,d.valuations[1]]),/face amounts or prices/);
});
test('portfolio weight needs a value numerator and a named, compatible denominator',()=>{
  const v={unit:'currency_value',valueCurrency:'EUR',valuationDate:'2025-06-30',valuationBasis:'market',value:1994000};
  const w=portfolioWeight(v,{kind:'net_assets',valueCurrency:'EUR',valuationDate:'2025-06-30',value:40000000});
  assert.ok(Math.abs(w.value-4.985)<1e-9);assert.equal(w.label,'% of fund net assets');
  assert.throws(()=>portfolioWeight({...v,unit:'face_amount'},{kind:'net_assets',valueCurrency:'EUR',valuationDate:'2025-06-30',value:1}),/never face/);
  assert.throws(()=>portfolioWeight(v,{kind:'outstanding_principal',valueCurrency:'EUR',valuationDate:'2025-06-30',value:1}),/named denominator/);
  assert.throws(()=>portfolioWeight(v,{kind:'net_assets',valueCurrency:'USD',valuationDate:'2025-06-30',value:1}),/currency or date/);
});
test('layer stays isolated from graph, portfolio and equivalence modules',async()=>{
  for(const file of ['graph-model.js','portfolio-view.js','portfolio-network.js','research-view.js']){const src=await readFile(new URL(`../src/${file}`,import.meta.url),'utf8');assert.doesNotMatch(src,/bond-/);}
});
test('off by default; issuer filter, separate lanes, explicit gaps; close restores focus',()=>{
  const dom=new JSDOM('<button id="launch">Pilot</button>');const {document}=dom.window;const launcher=document.querySelector('button');let opens=0;
  const {dialog}=mountBondPilot({document,launcher,beforeOpen:()=>opens++});
  dialog.showModal=()=>dialog.setAttribute('open','');dialog.close=()=>{dialog.removeAttribute('open');dialog.dispatchEvent(new dom.window.Event('close'));};
  assert.equal(dialog.open,false);assert.equal(dialog.querySelectorAll('article').length,0);
  launcher.click();assert.equal(opens,1);assert.equal(dialog.querySelectorAll('article').length,4);
  assert.match(dialog.querySelector('h2').textContent,/Bonds and debt securities · Pilot/);
  assert.match(dialog.textContent,/Share of issue: 11\.10%/);assert.match(dialog.textContent,/Undisclosed 88\.90% — a disclosure gap, not a holder/);
  assert.match(dialog.textContent,/not computed — Holding is unindexed par; outstanding is indexed principal/);
  assert.ok([...dialog.querySelectorAll('.bond-holding')].every(h=>!/other|remaining|residual/i.test(h.textContent)),'no residual holder node');
  const select=dialog.querySelector('#bond-filter');select.value='bond-oracle';select.dispatchEvent(new dom.window.Event('change'));
  assert.equal(dialog.querySelectorAll('article').length,2);assert.match(dialog.textContent,/separate lanes/);assert.match(dialog.textContent,/Holder coverage: unknown/);
  assert.match(dialog.textContent,/as of 2026-05-31/);assert.match(dialog.textContent,/LEI 1Z4GXXU7ZHVWFCD8TV52/);
  assert.ok([...dialog.querySelectorAll('a')].every(a=>a.rel==='noopener noreferrer'&&a.href.startsWith('https://')));
  dialog.querySelector('button').click();assert.equal(document.activeElement,launcher);
});
