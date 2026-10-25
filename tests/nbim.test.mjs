import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {JSDOM} from 'jsdom';
import {validateNbimEquities,nbimRows,NBIM_FIELDS} from '../src/nbim-data.js';
import {mountNbimLayer,filterNbim,holdingLines,NBIM_PAGE} from '../src/nbim-view.js';
import {normalize} from '../scripts/import-nbim.mjs';
const bytes=await readFile(new URL('../data/nbim-equities-2026-06-30.json',import.meta.url));
const manifest=JSON.parse(await readFile(new URL('../data-foundation/nbim/manifest.json',import.meta.url),'utf8'));
const data=JSON.parse(bytes),rows=nbimRows(data),copy=()=>structuredClone(data);
const find=name=>rows.find(r=>r.name===name);
test('published list is pinned, complete for equities and dated',()=>{
  assert.equal(createHash('sha256').update(bytes).digest('hex'),manifest.outputSha256);
  validateNbimEquities(data);assert.equal(rows.length,7077);assert.equal(data.asOf,'2026-06-30');
  assert.deepEqual(data.coverage.excludedRows,{fixedIncome:1664,unlistedRealEstate:47,renewableInfrastructure:9});
  assert.equal(new Set(rows.map(r=>r.country)).size,54);assert.ok(data.source.reuse.includes('non-chargeable'));
});
test('figures stay exactly as NBIM publishes them',()=>{
  assert.deepEqual(find('NVIDIA Corp'),{id:'5rc7ty8jc4vk',name:'NVIDIA Corp',country:'US',incorporation:null,sector:'Technology',code:'NVDA',usd:61847326779,nok:612010222138,ownershipPct:1.28,votingPct:1.28});
  const alphabet=find('Alphabet Inc');assert.equal(alphabet.ownershipPct,1.17);assert.equal(alphabet.votingPct,0.52,'voting differs from ownership and is kept separate');
  assert.equal(find('Taiwan Semiconductor Manufacturing Co Ltd').ownershipPct,1.7);
  assert.equal(rows[0].name,'NVIDIA Corp','ordered by published USD value');
});
test('validator rejects malformed or altered rows',()=>{
  const bad=[
    d=>{d.rows[0][8]=101;},d=>{d.rows[0][8]=1.234;},d=>{d.rows[1][0]=d.rows[0][0];},d=>{d.rows[0][4]='Crypto';},
    d=>{d.rows[0][6]=0;},d=>{d.rows[0][6]=1.5;},d=>{d.rows[0][2]='usa';},d=>{d.rows.pop();},d=>{[d.rows[0],d.rows[1]]=[d.rows[1],d.rows[0]];},
    d=>{d.source.dataUrl='https://example.com/x.json';},d=>{d.fields=[...NBIM_FIELDS].reverse();},d=>{d.rows[0].push('extra');},d=>{d.rows[0][1]=' NVIDIA Corp';}
  ];
  for(const change of bad){const d=copy();change(d);assert.throws(()=>validateNbimEquities(d),/Invalid NBIM equities/);}
});
test('normalizer keeps only equities and fails on unexpected counts',()=>{
  const raw={data:[{id:'aaaaaaaaaaaa',cc:'NO',n:'Equinor ASA',a:{e:10,n:100},at:0,o:0.5,eq:{vid:'EQNR',v:0.5,s:'Energy'}},{id:'bbbbbbbbbbbb',cc:'NO',n:'Government of Norway',a:{e:5,n:50},at:1,fi:{s:'Treasuries'}}]};
  const m={...manifest,rawCounts:{byAssetClassCode:{0:1,1:1}}};
  const out=normalize(JSON.stringify(raw),m);assert.deepEqual(out.rows,[['aaaaaaaaaaaa','Equinor ASA','NO',null,'Energy','EQNR',10,100,0.5,0.5]]);assert.equal(out.coverage.excludedRows.fixedIncome,1);
  assert.throws(()=>normalize(JSON.stringify(raw),manifest),/Asset-class counts differ/);
});
test('filtering searches names and exact codes, never totals',()=>{
  assert.deepEqual(filterNbim(rows,{query:'nvda'}).map(r=>r.name),['NVIDIA Corp']);
  assert.ok(filterNbim(rows,{query:'alphabet'}).some(r=>r.name==='Alphabet Inc'));
  assert.equal(filterNbim(rows,{country:'NO'}).length,0,'the fund invests only outside Norway');const japan=filterNbim(rows,{country:'JP'});assert.ok(japan.length>0&&japan.every(r=>r.country==='JP'));
  const owned=filterNbim(rows,{sort:'ownership'});assert.ok(owned[0].ownershipPct>=owned[1].ownershipPct);
  const lines=holdingLines(find('Alphabet Inc'));assert.match(lines[1],/US\$50,466,058,081 · NOK 499,386,877,736/);assert.match(lines[2],/voting differs/);
  assert.match(holdingLines(rows.find(r=>r.ownershipPct===0))[2],/published as 0, not evidence of no holding/);
});
test('layer loads on open, pages results and returns focus',async()=>{
  const dom=new JSDOM('<!doctype html><body><button id="l">NBIM</button></body>');const {document}=dom.window;
  dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new dom.window.Event('close'));};
  let loads=0;const launcher=document.querySelector('#l');
  const {dialog,open}=mountNbimLayer({document,launcher,load:async()=>{loads++;return copy();}});
  assert.equal(loads,0,'no request before the layer is opened');
  await open();assert.equal(loads,1);assert.equal(dialog.querySelectorAll('article').length,NBIM_PAGE);
  assert.match(dialog.querySelector('[role="status"]').textContent,/25 of 7,077 matching holdings/);
  dialog.querySelector('#nbim-search').value='alphabet';dialog.querySelector('#nbim-search').dispatchEvent(new dom.window.Event('input'));
  assert.ok([...dialog.querySelectorAll('article h3')].some(h=>h.textContent==='Alphabet Inc'));
  await open({query:'NVDA'});assert.equal(loads,1,'loaded once');assert.equal(dialog.querySelectorAll('article').length,1);
  dialog.querySelector('button').click();assert.equal(dialog.open,false);assert.equal(document.activeElement,launcher);
  const failing=mountNbimLayer({document,launcher,load:async()=>{throw new Error('offline');}});
  await failing.open();assert.match(failing.dialog.querySelector('[role="status"]').textContent,/could not load/);
});
