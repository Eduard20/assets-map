import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {createModel, initialState} from '../src/graph-model.js';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const data = JSON.parse(await readFile(new URL('../data/graph.json', import.meta.url), 'utf8'));
const researched = JSON.parse(await readFile(new URL('../data/researched.json', import.meta.url), 'utf8'));
const portfolios=JSON.parse(await readFile(new URL('../data/portfolios.json',import.meta.url),'utf8'));
const portfolioData=new Map(await Promise.all(portfolios.portfolios.map(async p=>[p.dataFile,JSON.parse(await readFile(new URL('../data/'+p.dataFile,import.meta.url),'utf8'))])));
const identity=JSON.parse(await readFile(new URL('../data/instrument-equivalence.json',import.meta.url),'utf8'));
const dom = new JSDOM(html, {url: 'http://localhost/'});
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  fetch: async url => ({ok: true, json: async () => String(url).includes('instrument-equivalence.json') ? identity : String(url).includes('researched.json') ? researched : String(url).includes('portfolios.json') ? portfolios : portfolioData.get(new URL(String(url)).pathname.split('/').pop()) || data})
});
// jsdom has no WebGL. Make that explicit instead of depending on its noisy
// "not implemented" canvas exception to exercise the fallback.
dom.window.HTMLCanvasElement.prototype.getContext = () => null;
dom.window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
dom.window.HTMLDialogElement.prototype.close = function () { this.open = false; };
const $ = selector => document.querySelector(selector);
const click = selector => $(selector).dispatchEvent(new dom.window.MouseEvent('click', {bubbles: true}));
async function waitFor(check, message) {
  const deadline = Date.now() + 3000;
  while (!check()) {
    assert.ok(Date.now() < deadline, message);
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}
await import('../src/app.js');
await waitFor(() => window.__assetsMap && window.__assetsMap.getState()?.view === '2d' && !$('#graph-2d').hidden, 'App did not settle into the no-WebGL 2D fallback');

assert.equal(window.__assetsMap.getModel().meta.mode,'portfolios');
assert.ok(window.__assetsMap.getModel().portfolio.reconciliation.shareRowCount>40000);
assert.equal(window.__assetsMap.getGraph().nodes.length,110);
assert.equal(window.__assetsMap.getGraph().edges.length,495);
assert.ok(document.querySelectorAll('.connection-card').length<=24);
$('#holdings-search').value='apple';$('#holdings-search').dispatchEvent(new dom.window.Event('input'));
assert.ok(document.querySelectorAll('.holding-row').length>0&&document.querySelectorAll('.holding-row').length<=50);
const beforeFocus=window.__assetsMap.getGraph().nodes.map(n=>n.id);
click('.holding-row');assert.match($('#detail-panel').textContent,/10 REPORTED INVESTORS/);
assert.equal(window.__assetsMap.getState().rootId,window.__assetsMap.getModel().nodes.find(n=>n.label==='APPLE INC'&&n.sector==='COM').id);
{const g=window.__assetsMap.getGraph(),root=window.__assetsMap.getState().rootId;
assert.equal(g.focused,true,'focusing a security isolates it');
assert.equal(g.nodes.length,11,'only Apple and its ten reported investors remain');
assert.ok(g.edges.every(e=>e.source===root||e.target===root),'every visible link touches the focus');
assert.ok(beforeFocus.length>g.nodes.length);assert.equal($('#show-whole-network').hidden,false);}
assert.equal($('#focus-back').hidden,false);
const focusedViewBox=$('#graph-2d svg').getAttribute('viewBox');
click('[data-view="2d"]');assert.equal($('#graph-2d svg').getAttribute('viewBox'),focusedViewBox);
window.dispatchEvent(new dom.window.Event('resize'));assert.equal($('#graph-2d svg').getAttribute('viewBox'),focusedViewBox);
click('[data-view="list"]');
click('#detail-panel [data-edge]');assert.match($('#detail-panel').textContent,/underlying row/);
click('#detail-panel [data-edge]');assert.match($('#detail-panel').textContent,/Information-table row/);
click('#focus-back');assert.equal(window.__assetsMap.getState().rootId,window.__assetsMap.getModel().rootId);
assert.equal($('#holdings-search').value,'apple');
// A manager click isolates its own neighborhood, repeat clicks page further; Back restores.
const baseline=window.__assetsMap.getGraph().nodes.map(n=>n.id).sort();
window.__assetsMap.selectNode('blackrock-2026-06-30');
{const g=window.__assetsMap.getGraph(),scope=new Set(g.focusScope);
assert.equal(g.focused,true);assert.ok(g.nodes.every(n=>scope.has(n.id)||g.edges.some(e=>(e.source===n.id||e.target===n.id)&&(scope.has(e.source)||scope.has(e.target)))),'only BlackRock and its direct connections remain');
assert.ok(g.nodes.filter(n=>n.kind==='manager'&&!scope.has(n.id)).every(n=>g.edges.some(e=>e.source===n.id&&scope.has(e.target))),'other filers appear only as reported holders of BlackRock stock');assert.ok(g.nodes.length<baseline.length+60);}
const firstExpanded=window.__assetsMap.getGraph().nodes.length;
window.__assetsMap.selectNode('blackrock-2026-06-30');
assert.ok(window.__assetsMap.getGraph().nodes.length>firstExpanded);
window.__assetsMap.goBack();assert.equal(window.__assetsMap.getGraph().nodes.length,firstExpanded);
window.__assetsMap.goBack();assert.deepEqual(window.__assetsMap.getGraph().nodes.map(n=>n.id).sort(),baseline);
await window.__assetsMap.setDataset('researched');
assert.equal(window.__assetsMap.getModel().meta.mode,'researched');
assert.match($('#dataset-context').textContent,/4 reviewed disclosures/);assert.match($('#dataset-context').textContent,/never add them as extra holdings/);
for(const edge of researched.edges){
  window.__assetsMap.selectEdge(edge.id);
  assert.match($('#detail-panel').textContent,/Historical snapshot/);
  assert.match($('#detail-panel').textContent,/does not establish a current position/);
  assert.ok($('#detail-panel a.source-link').href.startsWith('https://www.sec.gov/'));
  if(edge.kind==='beneficial_ownership')assert.match($('#detail-panel').textContent,/Less than 1%/);
}
click('[data-filter="ownership"]');
assert.equal(window.__assetsMap.getGraph().edges.length,2);
assert.ok(window.__assetsMap.getGraph().edges.every(e=>e.kind==='beneficial_ownership'));
click('[data-filter="voting_authority"]');
assert.equal(window.__assetsMap.getGraph().edges.length,1);
await window.__assetsMap.setDataset('sample');

function assertActiveView(view) {
  assert.equal(window.__assetsMap.getState().view, view);
  for (const name of ['2d', '3d', 'list']) {
    assert.equal($(`#graph-${name}`).hidden, name !== view, `${name} view visibility`);
    assert.equal($(`[data-view="${name}"]`).getAttribute('aria-pressed'), String(name === view), `${name} toggle state`);
  }
}

test('Relationship cards are the default without requiring WebGL', () => {
  assert.equal(initialState(createModel(data)).view, '2d');
  assertActiveView('2d');
  assert.equal($('#graph-3d canvas'), null);
  assert.equal(document.querySelectorAll('.relationship-card').length,4);
});

test('app initializes known nodes and distinguishes AUM from ownership', () => {
  assert.equal(document.querySelectorAll('.graph-node').length, 4);
  assert.match($('#detail-panel').textContent, /Client assets under management/);
  assert.match($('#detail-panel').textContent, /\$15.5T/);
});

test('search and root navigation work', () => {
  $('#search').value = 'Berkshire';
  $('#search').dispatchEvent(new dom.window.Event('input'));
  assert.equal(document.querySelectorAll('[data-search-node]').length, 1);
  click('[data-search-node="berkshire"]');
  assert.equal(window.__assetsMap.getState().rootId, 'berkshire');
  assert.equal(document.querySelectorAll('.graph-node').length, 6);
});

test('relationship filters and no-results state work', () => {
  click('[data-filter="managed_holding"]');
  assert.equal(document.querySelectorAll('.edge').length, 0);
  assert.equal($('#empty-state').hidden, false);
  click('[data-filter="all"]');
  assert.equal(document.querySelectorAll('.edge').length, 5);
});

test('connection evidence and unknown stake label are visible', () => {
  click('#detail-panel [data-edge]');
  assert.match($('#detail-panel').textContent, /CONNECTION DETAILS/);
  assert.match($('#detail-panel').textContent, /Not disclosed in sample/);
  assert.match($('#detail-panel').textContent, /2025/);
  assert.ok($('#detail-panel a.source-link').href.startsWith('https://'));
});

test('List remains useful after WebGL failure, and reset safely retries the default', async () => {
  click('[data-view="list"]');
  assertActiveView('list');
  assert.equal(document.querySelectorAll('.list-connection').length, 5);
  assert.equal($('.zoom-tools').hidden, true);
  click('#reset-map');
  await waitFor(() => window.__assetsMap.getState()?.view === '2d' && !$('#graph-2d').hidden, 'Reset did not return to a usable fallback');
  assert.equal(window.__assetsMap.getState().rootId, 'blackrock');
  assert.equal(window.__assetsMap.getState().selectedId, 'blackrock');
  assertActiveView('2d');
  assert.equal($('.zoom-tools').hidden, false);
});

test('an explicit 3D retry still falls back without leaving the controls inconsistent', async () => {
  await window.__assetsMap.setView('list');
  await window.__assetsMap.setView('3d');
  assertActiveView('2d');
  assert.equal($('#graph-3d canvas'), null);
  assert.equal($('#view-notice').hidden, false);
  assert.match($('#view-notice').textContent, /Showing the 2D map/i);
  assert.equal($('#status').hidden, false);
  assert.match($('#status').textContent, /3D.*(?:unavailable|not available|not supported|could not)/i);
});

test('fallback nodes remain keyboard accessible and zoom/reset controls work', () => {
  const node = document.querySelector('.graph-node:not([data-node="blackrock"])');
  assert.equal(node.getAttribute('role'), 'button');
  assert.equal(node.getAttribute('tabindex'), '0');
  node.dispatchEvent(new dom.window.KeyboardEvent('keydown', {key: 'Enter', bubbles: true}));
  assert.equal(window.__assetsMap.getState().selectedId, node.dataset.node);
  const transform = $('#graph-2d .viewport').getAttribute('transform');
  click('#zoom-in');
  assert.notEqual($('#graph-2d .viewport').getAttribute('transform'), transform);
  click('#fit-map');
  assert.equal($('#graph-2d .viewport').getAttribute('transform'), transform);
});

test('methodology controls explain the limits of the sample', () => {
  click('#about-button');
  assert.equal($('#info-dialog').open, true);
  assert.match($('#dialog-content').textContent, /not a complete ownership database/);
  click('#dialog-done');
  assert.equal($('#info-dialog').open, false);
});

test('unloaded entity is explicitly incomplete', () => {
  window.__assetsMap.exploreRoot('spacex');
  assert.equal(document.querySelectorAll('.graph-node').length, 1);
  assert.match($('#detail-panel').textContent, /Missing data does not mean no relationship/);
  assert.equal($('#empty-state').hidden, false);
});

test('switching datasets clears old detail, filter, search and dialog; repeated switches remain coherent',async()=>{
  click('#about-button');$('#search').value='old';
  await window.__assetsMap.setDataset('researched');
  assert.equal($('#info-dialog').open,false);assert.equal($('#search').value,'');
  assert.equal(window.__assetsMap.getState().rootId,'ent_apple');
  assert.equal(window.__assetsMap.getState().filter,'all');
  assert.equal(window.__assetsMap.getGraph().edges.length,4);
  await Promise.all([window.__assetsMap.setDataset('sample'),window.__assetsMap.setDataset('researched')]);
  assert.equal(window.__assetsMap.getModel().meta.mode,'researched');
  assert.equal($('#dataset').value,'researched');
});

test('phone filters and entity details have explicit open/close, Escape and focus restoration',()=>{
 const previous=window.matchMedia;window.matchMedia=()=>({matches:true});
 try{
  $('#mobile-options').focus();click('#mobile-options');
  assert.equal($('#mobile-controls').getAttribute('role'),'dialog');
  assert.equal($('#mobile-options').getAttribute('aria-expanded'),'true');
  assert.equal($('#mobile-scrim').hidden,false);
  document.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  assert.equal($('#mobile-options').getAttribute('aria-expanded'),'false');assert.equal(document.activeElement,$('#mobile-options'));
  $('#mobile-details').focus();click('#mobile-details');assert.equal($('#detail-sheet').getAttribute('aria-modal'),'true');
  click('#close-mobile-details');assert.equal($('#detail-sheet').hasAttribute('aria-modal'),false);
  assert.equal($('#mobile-scrim').hidden,true);assert.equal(document.activeElement,$('#mobile-details'));
 }finally{window.matchMedia=previous;}
});

test('shared securities mode keeps filer scope, evidence, Back, empty states and reset coherent',async()=>{
 await window.__assetsMap.setDataset('portfolios');
 $('#holdings-mode').value='shared';$('#holdings-mode').dispatchEvent(new dom.window.Event('change'));
 assert.equal(window.__assetsMap.getState().listMode,'shared');assert.equal(window.__assetsMap.getState().view,'list');
 assert.equal(document.querySelectorAll('.shared-instrument-row').length,50);
 assert.match($('#graph-list').textContent,/not ownership, control or complete investor coverage/);
 $('#holdings-search').value='apple';$('#holdings-search').dispatchEvent(new dom.window.Event('input'));
 const row=$('.shared-instrument-row');assert.ok(row);assert.match(row.textContent,/10reported investors/);
 click('.shared-instrument-row');assert.match($('#detail-panel').textContent,/10 REPORTED INVESTORS/);
 click('#detail-panel [data-edge]');assert.match($('#detail-panel').textContent,/underlying row|Information-table row/);
 click('#focus-back');assert.equal($('#holdings-mode').value,'shared');assert.equal($('#holdings-search').value,'apple');
 $('#portfolio').value='berkshire-2026-06-30';$('#portfolio').dispatchEvent(new dom.window.Event('change'));
 assert.match($('#graph-list h2').textContent,/Berkshire/i);assert.ok(document.querySelectorAll('.shared-instrument-row').length>0);
 $('#holdings-search').value='no such security xyz';$('#holdings-search').dispatchEvent(new dom.window.Event('input'));
 assert.match($('#graph-list').textContent,/absence of a match does not mean no other investors/);
 assert.equal(document.querySelectorAll('.shared-instrument-row').length,0);
 $('#holdings-search').value='';$('#holdings-search').dispatchEvent(new dom.window.Event('input'));
 click('#detail-panel [data-open-holdings]');assert.equal($('#holdings-mode').value,'rows');assert.match($('#graph-list').textContent,/ALL REPORTED SHARE POSITIONS/);
 click('#focus-back');assert.equal($('#holdings-mode').value,'shared');assert.match($('#graph-list h2').textContent,/Shared securities/);
 $('#holdings-mode').value='shared';$('#holdings-mode').dispatchEvent(new dom.window.Event('change'));
 click('#reset-map');assert.equal($('#holdings-mode').value,'rows');assert.equal($('#holdings-search').value,'');
 await window.__assetsMap.setDataset('researched');await window.__assetsMap.setDataset('portfolios');assert.equal($('#holdings-mode').value,'rows');
});

test('phone list rows open investor details immediately and restore the selected row after drill-down',async()=>{
 const previous=window.matchMedia;window.matchMedia=()=>({matches:true});
 try{
  await window.__assetsMap.setDataset('portfolios');
  for(const mode of ['rows','shared']){
   $('#holdings-mode').value=mode;$('#holdings-mode').dispatchEvent(new dom.window.Event('change'));
   $('#holdings-search').value='APPLE INC';$('#holdings-search').dispatchEvent(new dom.window.Event('input'));
   const id=$('.holding-row').dataset.select;
   click('.holding-row');
   assert.equal($('#detail-sheet').getAttribute('aria-modal'),'true');
   assert.equal(window.__assetsMap.getState().view,'list');
   assert.match($('#detail-panel').textContent,/10 REPORTED INVESTORS/);
   click('#detail-panel [data-edge]');click('#detail-panel [data-edge]');
   assert.match($('#detail-panel').textContent,/Information-table row/);
   click('#close-mobile-details');
   assert.equal($('#mobile-scrim').hidden,true);
   assert.equal(document.activeElement.dataset.select,id);
   assert.equal(document.activeElement.closest('#graph-list'),$('#graph-list'));
   click('.holding-row');assert.equal($('#detail-sheet').getAttribute('aria-modal'),'true');
   document.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
   assert.equal($('#detail-sheet').hasAttribute('aria-modal'),false);
  }
  await window.__assetsMap.setView('2d');
  window.__assetsMap.selectNode('blackrock-2026-06-30');
  assert.equal($('#detail-sheet').hasAttribute('aria-modal'),false,'graph navigation must stay unobstructed');
 }finally{window.matchMedia=previous;}
});
