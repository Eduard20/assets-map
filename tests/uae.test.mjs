import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {projectUae,UAE_CANDIDATE_SCOPE,UAE_COVERAGE} from '../scripts/export-uae.mjs';
import {buildRelease} from '../scripts/foundation/core.mjs';
import {createModel,relatedEdges} from '../src/graph-model.js';
import {researchDetails} from '../src/research-view.js';
const get=async n=>JSON.parse(await readFile(new URL(`../data-foundation/uae/input/${n}.json`,import.meta.url)));
const input={batches:[await get('batch')],registry:await get('registry'),sources:await get('sources'),review:await get('review')};
test('unreviewed UAE drafts cannot be published and do not alter existing release',()=>{
  const held=structuredClone(input);held.review.publication={status:'held',authorized_by:null,authorization_url:null,intended_use:'noncommercial_research'};held.review.decisions.forEach(d=>d.decision='needs_review');
  const release=buildRelease(held);
  assert.equal(release.manifest.publication_status,'held');
  assert.equal(release.validation.counts.active_claims,0);
  assert.throws(()=>projectUae(held,UAE_CANDIDATE_SCOPE),/held/);
  for(const scope of [[],['unreviewed'],[UAE_CANDIDATE_SCOPE[0],UAE_CANDIDATE_SCOPE[0]]])assert.throws(()=>projectUae(input,scope),/exact/);
});
test('UAE direct equity semantics are distinct from management and work with ownership filter',()=>{
  const data={meta:{defaultRoot:'eia'},nodes:[{id:'eia',label:'EIA',kind:'sovereign'},{id:'issuer',label:'Issuer',kind:'company'}],sources:[{id:'s',title:'Issuer report',url:'https://example.com/official'}],edges:[{id:'e',source:'eia',target:'issuer',kind:'direct_equity_ownership',asOf:'2025-12-31',sourceIds:['s'],stakePercent:null,valueUsd:null}]};
  const model=createModel(data);assert.equal(relatedEdges(model,'eia',{filter:'ownership'}).length,1);assert.equal(relatedEdges(model,'eia',{filter:'managed_holding'}).length,0);
  const edge={...data.edges[0],disclosure:{securityLabel:'Ordinary shares',metrics:[{metric_type:'equity_percentage',value:'50.1',unit:'percent',reason:'Source-rounded percentage.'},{metric_type:'quantity',value:'2271728899',unit:'shares'}],caveats:['Capital ownership is not voting authority.'],perimeter:{definition:'One named direct shareholder, not the whole portfolio.'},coverage:[{description:'Partial coverage',expected_source_rows:null}],checkedThrough:'2026-10-22',evidence:[]}};
  const html=researchDetails(edge,data.nodes[0],data.nodes[1]);assert.match(html,/50.1%/);assert.match(html,/2,271,728,899/);assert.match(html,/Historical snapshot/);assert.match(html,/does not establish a current position/);assert.match(html,/not voting authority/);
});
test('coverage records broad remaining research lanes without claiming completeness',()=>{
  assert.equal(UAE_COVERAGE.length,6);assert.ok(UAE_COVERAGE.some(x=>/Northern/.test(x.label)));assert.ok(UAE_COVERAGE.some(x=>/private/.test(x.label)));assert.ok(UAE_COVERAGE.every(x=>x.status));
});

test('UAE exact reviewed production projection preserves partial group and direct roles',async()=>{
  const {loadUaeInput}=await import('../scripts/export-uae.mjs');
  const {input,approvedScope}=await loadUaeInput();const data=projectUae(input,approvedScope);
  assert.equal(data.edges.length,22);assert.equal(data.meta.investorIds.length,5);
  assert.equal(data.edges.filter(e=>e.kind==='reported_group_interest').length,20);
  assert.equal(data.edges.filter(e=>e.kind==='direct_equity_ownership').length,2);
  assert.equal(data.edges.filter(e=>e.disclosure.metrics[0].value===null).length,17);
  assert.ok(data.edges.every(e=>e.stakePercent===null&&e.valueUsd===null));
  assert.ok(data.edges.some(e=>e.disclosure.evidence.some(x=>x.published_at===null&&x.observed_by)));
  assert.ok(data.edges.every(e=>e.disclosure.caveats.every(x=>!x.includes('direct page open timed out'))));
  assert.throws(()=>projectUae(input,approvedScope.slice(1)),/exact approved claim set/);
});

test('UAE loader rejects incomplete pins and changed independently accepted input',async()=>{
  const {mkdtemp,cp,writeFile,rm}=await import('node:fs/promises');const {tmpdir}=await import('node:os');const {pathToFileURL}=await import('node:url');
  const {loadUaeInput}=await import('../scripts/export-uae.mjs');const dir=await mkdtemp(tmpdir()+'/uae-pins-');
  try{
    await cp(new URL('../data-foundation/uae/input/',import.meta.url),dir,{recursive:true});const root=pathToFileURL(dir+'/');
    const manifest=JSON.parse(await readFile(new URL('bundle-manifest.json',root)));delete manifest.files['batch.json'];await writeFile(new URL('bundle-manifest.json',root),JSON.stringify(manifest));
    await assert.rejects(()=>loadUaeInput(root),/pin all exact reviewed inputs/);
    await cp(new URL('../data-foundation/uae/input/bundle-manifest.json',import.meta.url),new URL('bundle-manifest.json',root));await writeFile(new URL('batch.json',root),'{}');
    await assert.rejects(()=>loadUaeInput(root),/hash mismatch/);
  }finally{await rm(dir,{recursive:true,force:true});}
});
