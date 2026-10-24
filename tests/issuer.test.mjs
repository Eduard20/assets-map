import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {issuerPilot,validateIssuerPilot,combinedVotes,reconcilesWithinRounding,COVERAGE_LABEL} from '../src/issuer-data.js';
import {mountIssuerPilot,issuerSummaries,groupDecimal} from '../src/issuer-view.js';
const copy=()=>structuredClone(issuerPilot);
const claim=(d,id)=>d.claims.find(c=>c.id===id);
test('pilot is bounded: 4 listed issuers from 3 regimes, 1 private gap, at most 30 claims',()=>{
  const d=validateIssuerPilot(copy());assert.equal(d.issuers.filter(i=>i.status==='listed').length,4);assert.equal(d.issuers.filter(i=>i.status==='private').length,1);
  assert.equal(new Set(d.issuers.map(i=>i.regime)).size,3);assert.equal(d.claims.length,25);
  assert.ok(d.sources.every(s=>s.retrievedAt==='2026-10-24'&&s.reuse));assert.ok(d.holders.every(h=>h.kind!=='natural_person'));
  assert.match(d.coverageLabel,/^Disclosed holders above reporting thresholds/);assert.doesNotMatch(d.coverageLabel,/complete/i);
  assert.deepEqual(d.exclusions.map(x=>x.rowCount),[14,18,16,11]);
});
test('source figures are kept exactly as filed, with class scope and denominators',()=>{
  const d=copy();assert.equal(claim(d,'issuer-claim-alph-blk-a').quantityRaw,'356934964');assert.equal(claim(d,'issuer-claim-alph-grp-b').percentRaw,'92.2');
  assert.equal(claim(d,'issuer-claim-alph-grp-a').percentRaw,null);assert.equal(claim(d,'issuer-claim-alph-vcm-c').classId,'issuer-alph-c');
  assert.equal(d.denominators.find(x=>x.id==='issuer-den-alph-c').availability,'unknown');assert.equal(d.denominators.find(x=>x.id==='issuer-den-alph-13g-a').reason,'denominator_not_stated_in_filing');
  assert.equal(claim(d,'issuer-claim-itv-blk').totalPercentRaw,'6.690000');assert.equal(claim(d,'issuer-claim-itv-lg').directHolderId,'issuer-h-liberty-ventures');
  assert.equal(claim(d,'issuer-claim-itv-amp').lines[1].classId,'issuer-itv-adr');assert.equal(claim(d,'issuer-claim-vw-land').totalPercentRaw,'20.00159');
  assert.deepEqual(claim(d,'issuer-claim-stripe-gap').holders,{availability:'unknown',reason:'no_public_ownership_disclosure'});
});
test('ISSUER-VOTES-v1 and rounding reconciliation',()=>{
  assert.equal(combinedVotes([{sharesRaw:'5823665113',votesPerShareRaw:'1'},{sharesRaw:'835779041',votesPerShareRaw:'10'}]),'14181455523');
  assert.equal(combinedVotes([{sharesRaw:'2196045588',votesPerShareRaw:'1'},{sharesRaw:'342377716',votesPerShareRaw:'10'}]),'5619822748');
  assert.throws(()=>combinedVotes([]));assert.throws(()=>combinedVotes([{sharesRaw:'1.5',votesPerShareRaw:'1'}]));
  assert.equal(reconcilesWithinRounding('356934964','5823665113','6.1'),true);assert.equal(reconcilesWithinRounding('356934964','5823665113','6.2'),false);
  assert.equal(reconcilesWithinRounding('7705997766','14181455523','54.3'),true);assert.equal(reconcilesWithinRounding('1','0','1'),false);
  // The ITV TR-1 percentage is stated to 6 decimals but only agrees with the TVR denominator to 2, so it is never recomputed.
  assert.equal(reconcilesWithinRounding('223926063','3793189219','5.900000'),false);assert.equal(groupDecimal('3793189219'),'3,793,189,219');
});
test('summaries stay per issuer: economic share across classes is unknown when a class denominator is missing; no totals',()=>{
  const s=issuerSummaries();assert.equal(s.length,5);
  assert.equal(s.find(x=>x.issuer.id==='issuer-alphabet').economic,'unknown');assert.equal(s.find(x=>x.issuer.id==='issuer-meta').economic,'not_combined');
  assert.equal(s.find(x=>x.issuer.id==='issuer-itv').economic,'single_class_scope');assert.equal(s.find(x=>x.issuer.id==='issuer-vw').overlaps.length,2);
  assert.ok(s.find(x=>x.issuer.id==='issuer-stripe').gap);assert.ok(s.every(x=>!('total' in x)&&!('capTable' in x)));
});
test('rejects cap tables, identifiers, natural persons, invented zeros, mismatched denominators and foreign links',()=>{
  for(const [field,value] of Object.entries({capTable:[],ownershipTotal:'100',cusip:'02079K305',isin:'GB0033986497',portfolioWeight:'1',issuerIdentity:'x',economicPercentRaw:'15'})){const d=copy();d.claims[0][field]=value;assert.throws(()=>validateIssuerPilot(d),field);}
  const changes=[
    d=>d.coverageLabel='Complete shareholder list',
    d=>d.coverageLabel='Disclosed holders above reporting thresholds (complete)',
    d=>d.holders.push({id:'issuer-h-person',name:'A Person',kind:'natural_person'}),
    d=>d.holders.find(h=>h.id==='issuer-h-alph-group').name='Directors',
    d=>claim(d,'issuer-claim-alph-blk-a').percentRaw='6.4',
    d=>claim(d,'issuer-claim-alph-blk-a').denominatorId='issuer-den-alph-b',
    d=>claim(d,'issuer-claim-alph-blk-a').denominatorId='issuer-den-alph-votes',
    d=>claim(d,'issuer-claim-alph-blk-a').reportDate='2026-03-31',
    d=>claim(d,'issuer-claim-alph-grp-a').percentRaw='0',
    d=>claim(d,'issuer-claim-alph-blk-a').quantityRaw='0',
    d=>claim(d,'issuer-claim-alph-blk-a').quantityRaw=356934964,
    d=>claim(d,'issuer-claim-alph-grp-vp').percentRaw='92.2',
    d=>claim(d,'issuer-claim-alph-grp-vp').denominatorId='issuer-den-alph-b',
    d=>d.denominators.find(x=>x.id==='issuer-den-alph-votes').valueRaw='6659444154',
    d=>d.denominators.find(x=>x.id==='issuer-den-alph-c').valueRaw='0',
    d=>d.denominators.find(x=>x.id==='issuer-den-alph-13g-a').reason=null,
    d=>d.issuers[0].classes[1].votesPerShareRaw='1',
    d=>claim(d,'issuer-claim-alph-vg-a').note='Vanguard sold its stake',
    d=>claim(d,'issuer-claim-alph-vg-a').quantityRaw='5',
    d=>claim(d,'issuer-claim-itv-blk').eventDate=null,
    d=>claim(d,'issuer-claim-itv-blk').framework='SEC_13d3',
    d=>claim(d,'issuer-claim-itv-blk').publishedDate='2026-03-25',
    d=>d.sources.find(s=>s.id==='issuer-src-itv-tr1-blk').url='https://data.fca.org.uk/artefacts/NSM/RNS/3eaca0fb-c783-4671-b2a9-5032066dc538.html',
    d=>d.sources[0].url='https://www.marketscreener.com/quote/stock/ALPHABET-INC/company/',
    d=>d.sources[0].url='synthetic://issuer/alphabet',
    d=>d.sources[0].asOf='2027-01-01',
    d=>d.sources[0].retrievedAt='2026-02-30',
    d=>d.overlapGroups=d.overlapGroups.filter(g=>g.id!=='issuer-overlap-vw-land'),
    d=>claim(d,'issuer-claim-vw-hanbg').percentRaw='25',
    d=>d.claims.push({...claim(d,'issuer-claim-alph-blk-a'),id:'issuer-claim-stripe-x',issuerId:'issuer-stripe',sourceId:'issuer-src-stripe'}),
    d=>claim(d,'issuer-claim-stripe-gap').holders={availability:'known',reason:'x'},
    d=>d.claims=d.claims.filter(c=>c.issuerId!=='issuer-stripe'),
    d=>d.issuers=d.issuers.filter(i=>i.regime==='US_SEC'),
    d=>{while(d.claims.length<=30)d.claims.push({...claim(d,'issuer-claim-itv-lg'),id:`issuer-claim-x${d.claims.length}`});},
    d=>d.claims.push(d.claims[0]),
    d=>d.exclusions[0].rowCount=0
  ];
  for(const [i,change] of changes.entries()){const d=copy();change(d);assert.throws(()=>validateIssuerPilot(d),`change ${i}`);}
});
test('off by default; filter scopes cards; evidence links; close restores focus',()=>{
  const dom=new JSDOM('<button id="launch">Issuer</button>');const {document}=dom.window;const launcher=document.querySelector('button');let opens=0;
  const {dialog}=mountIssuerPilot({document,launcher,beforeOpen:()=>opens++});
  dialog.showModal=()=>dialog.setAttribute('open','');dialog.close=()=>{dialog.removeAttribute('open');dialog.dispatchEvent(new dom.window.Event('close'));};
  assert.equal(dialog.open,false);assert.equal(dialog.querySelectorAll('article').length,0);assert.equal(launcher.getAttribute('aria-controls'),'issuer-dialog');
  launcher.click();assert.equal(opens,1);assert.equal(dialog.open,true);assert.equal(dialog.querySelectorAll('article').length,25);assert.equal(dialog.querySelectorAll('.issuer-card').length,5);
  const t=dialog.textContent;assert.match(t,/Who owns this issuer\? · Pilot/);assert.match(t,new RegExp(COVERAGE_LABEL.replace(/[.?]/g,'\\$&')));assert.match(t,/never added up/);
  assert.match(t,/14,181,455,523 votes at 2026-04-06 = 5,823,665,113 × 1 \+ 835,779,041 × 10/);assert.match(t,/Economic share across all classes: unknown/);
  assert.match(t,/Overlap, do not add/);assert.match(t,/not a sale/i);assert.match(t,/Not recorded \(natural person, 14 rows\)/);assert.doesNotMatch(t,/Larry Page|Zuckerberg|Kiesling/);
  const select=dialog.querySelector('select');select.value='issuer-stripe';select.dispatchEvent(new dom.window.Event('change'));
  assert.equal(dialog.querySelectorAll('article').length,1);assert.equal(dialog.querySelectorAll('.issuer-card').length,1);assert.match(dialog.textContent,/Shareholders: unknown/);
  select.value='issuer-itv';select.dispatchEvent(new dom.window.Event('change'));assert.equal(dialog.querySelectorAll('article').length,3);assert.match(dialog.textContent,/Not recomputed/);
  assert.ok([...dialog.querySelectorAll('a')].every(a=>a.rel==='noopener noreferrer'&&a.href.startsWith('https://')));
  assert.ok([...dialog.querySelectorAll('a')].filter(a=>a.href.includes('fca.org.uk')).every(a=>a.href==='https://data.fca.org.uk/#/nsm/nationalstoragemechanism'));
  dialog.querySelector('button').click();assert.equal(document.activeElement,launcher);
});
