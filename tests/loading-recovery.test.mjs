import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
const read=async path=>JSON.parse(await readFile(new URL('../data/'+path,import.meta.url),'utf8'));
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const sample=await read('graph.json'),research=await read('researched.json');
const manifest=await read('portfolios.json');
const rows=new Map(await Promise.all(manifest.portfolios.map(async p=>[p.dataFile,await read(p.dataFile)])));
const identity=await read('instrument-equivalence.json');
const dom=new JSDOM(html,{url:'http://localhost/'});
dom.window.matchMedia=()=>({matches:true,addEventListener(){}});
dom.window.HTMLCanvasElement.prototype.getContext=()=>null;
dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;};
let mode='fail',manifestCalls=0,researchMode='ok',release;
Object.assign(globalThis,{window:dom.window,document:dom.window.document,fetch:async url=>{
 const path=new URL(url).pathname.split('/').pop();
 if(path==='portfolios.json'){
  manifestCalls++;
  if(mode==='fail')throw new Error('offline');
  if(mode==='delayed')await new Promise(resolve=>{release=resolve;});
  return {ok:true,json:async()=>structuredClone(manifest)};
 }
 if(path==='instrument-equivalence.json')return {ok:true,json:async()=>mode==='mixed'?{...identity,coverage:{...identity.coverage,eligibleSourceRows:999}}:structuredClone(identity)};
 if(rows.has(path))return {ok:true,json:async()=>structuredClone(rows.get(path))};
 return {ok:true,json:async()=>path==='researched.json'?(researchMode==='invalid'?{}:researchMode==='missing-meta'?{...research,meta:undefined}:researchMode==='wrong-mode'?structuredClone(sample):structuredClone(research)):structuredClone(sample)};
}});
const $=s=>document.querySelector(s);
const tick=()=>new Promise(r=>setTimeout(r,15));
await import('../src/app.js');
const api=window.__assetsMap;
test('phone recovery is visible, retries in place, validates atomically and ignores obsolete results',async()=>{
 await tick();
 assert.equal($('#load-feedback').hidden,false);
 assert.equal($('#load-feedback').closest('#detail-sheet'),null);
 assert.equal($('#load-feedback-text').getAttribute('role'),'alert');
 assert.equal($('#retry-dataset').disabled,false);
 assert.equal(api.getModel(),undefined);
 assert.equal($('#graph-stage').getAttribute('aria-busy'),'false');
 mode='delayed';$('#retry-dataset').click();await tick();
 assert.equal($('#retry-dataset').disabled,true);
 const calls=manifestCalls;$('#retry-dataset').click();assert.equal(manifestCalls,calls);
 await api.setDataset('sample');
 const sampleModel=api.getModel();
 release();await tick();
 assert.equal(api.getModel(),sampleModel);
 assert.equal($('#dataset').value,'sample');
 assert.equal($('#load-feedback').hidden,true);
 // The obsolete successful bundle must not seed the cache; this fresh bad
 // identity must be fetched and rejected without touching the current map.
 mode='mixed';await api.setDataset('portfolios');
 assert.equal(manifestCalls,calls+1);
 assert.equal(api.getModel(),sampleModel);
 assert.equal($('#dataset').value,'sample');
 assert.match($('#load-feedback-text').textContent,/current map is unchanged/);
 assert.equal($('#load-feedback').hidden,false);
 mode='ok';$('#retry-dataset').click();
 for(let n=0;n<100&&api.getModel()===sampleModel;n++)await tick();
 assert.equal(manifestCalls,calls+2,'failed manifest is fetched again');
 assert.equal(api.getModel().meta.mode,'portfolios');
 assert.equal($('#load-feedback').hidden,true);
 const goodModel=api.getModel(),goodState=api.getState(),goodGraph=api.getGraph();
 researchMode='invalid';await api.setDataset('researched');
 assert.equal(api.getModel(),goodModel);assert.equal(api.getState(),goodState);assert.equal(api.getGraph(),goodGraph);
 assert.equal($('#dataset').value,'portfolios');assert.equal($('#load-feedback').hidden,false);
 for(const bad of ['missing-meta','wrong-mode']){
  researchMode=bad;await api.setDataset('researched');
  assert.equal(api.getModel(),goodModel);assert.equal(api.getState(),goodState);assert.equal(api.getGraph(),goodGraph);
  assert.equal($('#load-feedback').hidden,false);
 }
 researchMode='ok';await api.setDataset('researched');
 assert.equal(api.getModel().meta.mode,'researched');assert.equal($('#load-feedback').hidden,true);
});
