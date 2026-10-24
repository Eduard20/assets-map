import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {goldPilot,validateGoldPilot,decimalSum,toTonnes,toFineTroyOunces,roundingInterval} from '../src/gold-data.js';
import {mountGoldPilot,goldSummaries,roundDecimal,groupDecimal} from '../src/gold-view.js';
const copy=()=>structuredClone(goldPilot);
const claim=(d,id)=>d.claims.find(c=>c.id===id);
test('pilot is bounded to three authorities, one reference date and at most 30 claims',()=>{
  const d=validateGoldPilot(copy());assert.equal(d.authorities.length,3);assert.equal(d.claims.length,25);assert.equal(d.referenceDate,'2025-12-31');
  for(const a of d.authorities){const own=d.claims.filter(c=>c.authorityId===a.id);assert.ok(own.some(c=>c.type==='reserve_valuation'));assert.equal(a.encumbrance.status,'unknown');assert.equal(a.allocation.status,'unknown');}
  assert.equal(d.authorities.find(a=>a.id==='gold-snb').custody.status,'unknown');assert.equal(d.claims.filter(c=>c.authorityId==='gold-snb'&&c.type==='custody_disclosure').length,0);
  assert.ok(d.sources.every(s=>s.retrievedAt==='2026-10-24'&&s.reuse));
});
test('source figures are kept exactly as reported',()=>{
  const d=copy();assert.equal(claim(d,'gold-claim-us-q2').quantityRaw,'147341858.382');assert.equal(claim(d,'gold-claim-us-v2').valuationBasis,'statutory_book');
  assert.deepEqual(claim(d,'gold-claim-bbk-q1').alsoStated,{quantityRaw:'107714173.571',unitRaw:'fine_troy_ounce'});assert.equal(claim(d,'gold-claim-bbk-v1').currency,'EUR');
  assert.equal(claim(d,'gold-claim-snb-q1').quantityRaw,'1040.0');assert.equal(claim(d,'gold-claim-snb-v1').valueRaw,'115351.2');
});
test('GOLD-MASS-v1 decimal-string conversion and rounding intervals',()=>{
  assert.equal(toTonnes('1','fine_troy_ounce'),'0.0000311034768');assert.equal(toTonnes('10.05','million_fine_troy_ounces'),'312.58994184');
  assert.equal(toTonnes('3350286.5312','kilogram'),'3350.2865312');assert.equal(toFineTroyOunces('1','tonne'),'32150.747');
  assert.deepEqual(roundingInterval('1040.0'),['1039.95','1040.05']);assert.deepEqual(roundingInterval('10.05').map(v=>toTonnes(v,'million_fine_troy_ounces')),['312.434424456','312.745459224']);
  assert.equal(decimalSum(['0.1','0.2']),'0.3');assert.throws(()=>toTonnes('1','ounce'));assert.throws(()=>toTonnes('1e3','tonne'));
  assert.equal(roundDecimal('8133.5257855618547088',3),'8133.526');assert.equal(groupDecimal('-1260'),'−1,260');
});
test('summaries stay per authority: US line sum is calculated; no cross-authority total',()=>{
  const s=goldSummaries();assert.equal(s.length,3);
  const us=s.find(x=>x.authority.id==='gold-us-treasury');assert.equal(us.origin,'calculated_line_sum');assert.equal(us.ozt.value,'261,498,926.241');assert.equal(us.tonnes.value,'8,133.526');assert.equal(us.bookSum,'11041059957.9');
  const bbk=s.find(x=>x.authority.id==='gold-bundesbank');assert.equal(bbk.ozt.origin,'source-stated');assert.equal(bbk.tonnes.full,'3350.2865312');
  const snb=s.find(x=>x.authority.id==='gold-snb');assert.equal(snb.tonnes.origin,'source-stated');assert.equal(snb.tonnes.value,'1,040.0');assert.equal(snb.interval[0].ozt,'33,435,168.894');
  assert.ok(s.every(x=>!('worldTotal' in x)));
});
test('rejects equity framing, identifiers, invented zeros, undated custody and foreign sources',()=>{
  for(const [field,value] of Object.entries({equityPercentage:0.5,ownershipPercentage:1,portfolioWeight:0.1,issuerId:'x',cusip:'037833100',worldTotal:'1'})){const d=copy();d.claims[0][field]=value;assert.throws(()=>validateGoldPilot(d),field);}
  const changes=[
    d=>d.authorities[0].encumbrance={status:'none',reason:'not_covered_by_source'},
    d=>d.authorities[0].encumbrance={status:'unknown',reason:''},
    d=>claim(d,'gold-claim-snb-q1').quantityRaw='0',
    d=>claim(d,'gold-claim-snb-q1').quantityRaw=1040,
    d=>claim(d,'gold-claim-snb-q1').unitRaw='ounce',
    d=>claim(d,'gold-claim-snb-q1').reportDate='2025-11-30',
    d=>claim(d,'gold-claim-bbk-v1').currency='XTS',
    d=>claim(d,'gold-claim-bbk-v1').priceReference.currency='USD',
    d=>claim(d,'gold-claim-bbk-c1').disclosureDate=null,
    d=>claim(d,'gold-claim-bbk-c1').authorityId='gold-snb',
    d=>d.claims.push({...claim(d,'gold-claim-bbk-c1'),id:'gold-claim-snb-c1',authorityId:'gold-snb',sourceId:'gold-src-snb-ar'}),
    d=>d.claims.push(d.claims[0]),
    d=>d.sources[0].url='https://www.gold.org/data/gold-reserves',
    d=>d.sources[0].url='synthetic://gold/G01/q1',
    d=>d.sources[0].asOf='2027-01-01',
    d=>d.sources[0].retrievedAt='2026-02-30',
    d=>d.conversionRule.gramsPerTroyOunce='31.1035',
    d=>d.claims=d.claims.filter(c=>c.authorityId!=='gold-snb'||c.type!=='reserve_valuation'),
    d=>{while(d.claims.length<=30)d.claims.push({...claim(d,'gold-claim-us-q1'),id:`gold-claim-x${d.claims.length}`});},
    d=>d.authorities.push({...d.authorities[0],id:'gold-dnb'}),
    d=>d.reconciliations[0].claimIds=['gold-claim-bbk-q1','gold-claim-snb-q1'],
    d=>d.reconciliations[0].classification='latest_wins'
  ];
  for(const [i,change] of changes.entries()){const d=copy();change(d);assert.throws(()=>validateGoldPilot(d),`change ${i}`);}
});
test('off by default; filter scopes cards; evidence links; close restores focus',()=>{
  const dom=new JSDOM('<button id="launch">Gold</button>');const {document}=dom.window;const launcher=document.querySelector('button');let opens=0;
  const {dialog}=mountGoldPilot({document,launcher,beforeOpen:()=>opens++});
  dialog.showModal=()=>dialog.setAttribute('open','');dialog.close=()=>{dialog.removeAttribute('open');dialog.dispatchEvent(new dom.window.Event('close'));};
  assert.equal(dialog.open,false);assert.equal(dialog.querySelectorAll('article').length,0);assert.equal(launcher.getAttribute('aria-controls'),'gold-dialog');
  launcher.click();assert.equal(opens,1);assert.equal(dialog.open,true);assert.equal(dialog.querySelectorAll('article').length,25);assert.equal(dialog.querySelectorAll('.gold-authority').length,3);
  assert.match(dialog.textContent,/Central-bank gold reserves · Pilot/);assert.match(dialog.textContent,/never added up across authorities/);assert.match(dialog.textContent,/statutory book value \(not market value\)/);
  assert.match(dialog.textContent,/GOLD-LINESUM-v1/);assert.match(dialog.textContent,/unexplained difference/);assert.match(dialog.textContent,/Encumbrance: unknown/);
  const select=dialog.querySelector('select');select.value='gold-snb';select.dispatchEvent(new dom.window.Event('change'));
  assert.equal(dialog.querySelectorAll('article').length,2);assert.equal(dialog.querySelectorAll('.gold-authority').length,1);assert.match(dialog.textContent,/Storage: unknown/);assert.match(dialog.textContent,/fineness basis not stated/i);
  select.value='gold-bundesbank';select.dispatchEvent(new dom.window.Event('change'));assert.equal(dialog.querySelectorAll('article').length,7);
  assert.ok([...dialog.querySelectorAll('a')].every(a=>a.rel==='noopener noreferrer'&&a.href.startsWith('https://')));
  dialog.querySelector('button').click();assert.equal(document.activeElement,launcher);
});
