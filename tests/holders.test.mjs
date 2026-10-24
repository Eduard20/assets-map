import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {holdersPilot,validateHoldersPilot,reconcilesWithinRounding,equityRelationships,CATEGORIES,COVERAGE_LABEL} from '../src/holders-data.js';
import {mountHoldersPilot,caseSummaries,measureLines} from '../src/holders-view.js';
const copy=()=>structuredClone(holdersPilot);
const claim=(d,id)=>d.claims.find(c=>c.id===`holders-claim-${id}`);
const entity=(d,id)=>d.entities.find(e=>e.id===`holders-e-${id}`);
test('bounded: six categories, one case each, 1–3 equity relationships, at most 30 claims',()=>{
  const d=validateHoldersPilot(copy());assert.deepEqual(d.cases.map(c=>c.category).sort(),[...CATEGORIES].sort());assert.equal(d.claims.length,30);
  assert.deepEqual(d.cases.map(c=>equityRelationships(d,c.id).length),[1,1,2,2,1,1]);assert.ok(d.cases.every(c=>c.status==='documented'&&c.snapshot.date));
  assert.ok(d.sources.every(s=>s.retrievedAt==='2026-10-24'&&s.reuse));assert.equal(d.entities.filter(e=>e.kind==='individual').length,1);
  assert.match(d.coverageLabel,/^One documented case per holder category/);
});
test('figures are kept exactly as filed and reconcile with their own denominators',()=>{
  const d=copy();assert.equal(claim(d,'bank-13d').measure.quantityRaw,'380010887');assert.equal(claim(d,'bank-equity-method').measure.percentRaw,'23.87');
  assert.equal(claim(d,'bank-fiduciary').measure.quantityRaw,'2925720');assert.equal(claim(d,'pe-record').measure.percentRaw,'25.4');
  assert.equal(claim(d,'ins-13da').measure.quantityRaw,'126604050');assert.equal(claim(d,'corp-class-b').measure.votingPowerRaw,'96.9');assert.equal(claim(d,'ind-proxy').measure.quantityRaw,'950434581');
  for(const [q,den,p] of [['380010887','1581386814','24.0'],['84587035','332421972','25.4'],['121992454','445772522','27.37'],['126604050','445772522','28.4'],['50000000','244418126','20.5'],['950434581','10751236247','8.8']])assert.equal(reconcilesWithinRounding(q,den,p),true,p);
  assert.equal(reconcilesWithinRounding('380010887','1581386814','24.1'),false);
  // Mobileye vote check (not stored): Intel 50,000,000×1 + 597,768,015×10 of 244,418,126×1 + 597,768,015×10 votes.
  assert.equal(reconcilesWithinRounding(String(50000000n+5977680150n),String(244418126n+5977680150n),'96.9'),true);
  assert.equal(126570779+33271,126604050);
});
test('roles are not collapsed: role claims carry no stake; sponsors and beneficiaries never own',()=>{
  const d=copy();for(const c of d.claims.filter(c=>['managed_holding','custody','manages_fund','gp_chain_link','control_assertion','governs','beneficiaries_of','subsidiary_of'].includes(c.type)))assert.deepEqual(c.stake,{status:'not_applicable',reason:null});
  const s=caseSummaries(d);assert.ok(s.every(x=>!('total' in x)));assert.equal(s.find(x=>x.case.category==='pe_sponsor').paths[0].claimIds.length,10);
  assert.ok(d.paths.every(p=>p.derived.status==='unknown'&&p.derived.percentRaw===null));
  assert.match(measureLines(claim(d,'ind-f4-indirect')).join(' '),/Percentage unknown/);
});
test('rejects collapsed roles, implied percentages, personal data, totals, identifiers and foreign links',()=>{
  for(const [field,value] of Object.entries({address:'x',birthDate:'1964-01-12',spouse:'x',netWorth:'1',nationality:'x',family:[]})){const d=copy();entity(d,'bezos')[field]=value;assert.throws(()=>validateHoldersPilot(d),field);}
  for(const [field,value] of Object.entries({total:'1',portfolioWeight:'1',cusip:'x',isin:'GB0033986497',ticker:'AMZN'})){const d=copy();d.claims[0][field]=value;assert.throws(()=>validateHoldersPilot(d),field);}
  const changes=[
    d=>d.coverageLabel='Complete list of holdings',
    d=>d.cases.pop(),
    d=>d.cases[1].category='bank',
    d=>{d.claims.push({...claim(d,'pe-1'),id:'holders-claim-x'});},
    d=>claim(d,'bank-fiduciary').stake={status:'known',reason:null},
    d=>claim(d,'bank-fiduciary').measure.percentRaw='0.2',
    d=>claim(d,'tsp-manager-blackrock').measure={...claim(d,'pe-record').measure},
    d=>claim(d,'tsp-governs').capacity='own_account',
    d=>claim(d,'pe-record').from='holders-e-carlyle',
    d=>{const c=claim(d,'pe-record');c.from='holders-e-tcg7-lp';},
    d=>claim(d,'tsp-beneficiaries').type='beneficial_ownership',
    d=>claim(d,'pe-record').capacity='own_account',
    d=>claim(d,'pe-record').measure.percentRaw='30',
    d=>claim(d,'bank-13d').measure.denominatorRaw='0',
    d=>claim(d,'tsp-c-account').measure.percentRaw='100',
    d=>claim(d,'ind-f4-direct').stake={status:'unknown',reason:null},
    d=>claim(d,'ind-f4-direct').measure.quantityRaw=879323424,
    d=>claim(d,'ind-proxy').note='Owns the stake with his wife',
    d=>entity(d,'bezos').publicCapacity='Lives at 100 Main Street',
    d=>d.entities.push({id:'holders-e-person',caseId:'holders-case-bank',name:'A banker',kind:'individual',publicCapacity:'x'}),
    d=>d.paths[0].derived={status:'known',percentRaw:'25.4',reason:'multiplied'},
    d=>d.paths[0].claimIds.splice(4,1),
    d=>d.paths.shift(),
    d=>d.overlaps=d.overlaps.filter(o=>o.id!=='holders-overlap-bank-fiduciary'),
    d=>d.gaps=d.gaps.filter(g=>g.field!=='custody'||g.caseId!=='holders-case-bank'),
    d=>d.gaps=d.gaps.filter(g=>g.field!=='third_party_management'),
    d=>d.gaps=d.gaps.filter(g=>g.field!=='pe_fund'),
    d=>d.claims=d.claims.filter(c=>c.type!=='governs'),
    d=>{d.claims=d.claims.filter(c=>c.caseId!=='holders-case-individual');d.overlaps=d.overlaps.filter(o=>o.caseId!=='holders-case-individual');},
    d=>d.cases.find(c=>c.category==='individual').status='source_unavailable',
    d=>claim(d,'pe-3').sourceRole='owner',
    d=>claim(d,'pe-3').sourceRole=null,
    d=>d.sources[0].url='https://www.marketscreener.com/x',
    d=>d.sources[0].url='https://data.fca.org.uk/x',
    d=>d.sources.find(s=>s.caseId==='holders-case-individual').url='https://www.frtib.gov/x.pdf',
    d=>d.sources[0].asOf='2027-01-01',
    d=>d.sources[0].retrievedAt='2026-02-30',
    d=>claim(d,'bank-13d').asOf='2026-12-01',
    d=>d.cases[0].snapshot.date='2026-01-01',
    d=>d.claims.push(d.claims[0]),
    d=>d.exclusions[0].reason=''
  ];
  for(const [i,change] of changes.entries()){const d=copy();change(d);assert.throws(()=>validateHoldersPilot(d),`change ${i}`);}
});
test('gapped category is accepted only with an evidence-backed source_unavailable gap and no claims',()=>{
  const d=copy(),k=d.cases.find(c=>c.category==='individual');k.status='source_unavailable';
  d.claims=d.claims.filter(c=>c.caseId!==k.id);d.overlaps=d.overlaps.filter(o=>o.caseId!==k.id);
  d.gaps.push({id:'holders-gap-ind-none',caseId:k.id,subject:'holders-e-bezos',field:'holding',status:'source_unavailable',reason:'test',note:'test',sourceId:'holders-src-amzn-proxy'});
  assert.doesNotThrow(()=>validateHoldersPilot(d));
});
test('off by default; filter scopes cases; evidence links; close restores focus',()=>{
  const dom=new JSDOM('<button id="launch">Holders</button>');const {document}=dom.window;const launcher=document.querySelector('button');let opens=0;
  const {dialog}=mountHoldersPilot({document,launcher,beforeOpen:()=>opens++});
  dialog.showModal=()=>dialog.setAttribute('open','');dialog.close=()=>{dialog.removeAttribute('open');dialog.dispatchEvent(new dom.window.Event('close'));};
  assert.equal(dialog.open,false);assert.equal(dialog.querySelectorAll('article').length,0);assert.equal(launcher.getAttribute('aria-controls'),'holders-dialog');
  launcher.click();assert.equal(opens,1);assert.equal(dialog.querySelectorAll('article').length,30);assert.equal(dialog.querySelectorAll('.holders-case').length,6);
  const t=dialog.textContent;assert.match(t,/Bank, pension, insurer and private holders · Pilot/);assert.ok(t.includes(COVERAGE_LABEL));assert.match(t,/never added up/);
  assert.match(t,/The Carlyle Group Inc\. → Carlyle Holdings I GP Inc\. → .* → StandardAero, Inc\. · derived share: unknown/);assert.match(t,/Overlap, do not add/);assert.match(t,/custody: not disclosed/);
  assert.match(t,/96\.9% of total voting power/);assert.match(t,/approximately 23\.87% of Morgan Stanley common stock/);assert.doesNotMatch(t,/Pennsylvania Avenue|Marunouchi|spouse/);
  const select=dialog.querySelector('select');select.value='holders-case-pe';select.dispatchEvent(new dom.window.Event('change'));
  assert.equal(dialog.querySelectorAll('article').length,10);assert.equal(dialog.querySelectorAll('.holders-case').length,1);assert.match(dialog.textContent,/pe fund: not disclosed/);
  select.value='holders-case-pension';select.dispatchEvent(new dom.window.Event('change'));assert.equal(dialog.querySelectorAll('article').length,5);assert.match(dialog.textContent,/Role only · carries no ownership stake/);
  assert.ok([...dialog.querySelectorAll('a')].every(a=>a.rel==='noopener noreferrer'&&a.href.startsWith('https://')));
  dialog.querySelector('button').click();assert.equal(document.activeElement,launcher);
});
