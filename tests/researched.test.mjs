import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {loadReviewedInput,projectResearched,APPROVED_SCOPE} from '../scripts/export-researched.mjs';
import {buildRelease,pretty} from '../scripts/foundation/core.mjs';
import {createModel,relatedEdges} from '../src/graph-model.js';
import {researchDetails,decimalLabel} from '../src/research-view.js';
const input=await loadReviewedInput();
const graph=projectResearched(input);
test('public researched graph is exactly reproducible from the independently approved four claims',async()=>{
  assert.equal(await readFile(new URL('../data/researched.json',import.meta.url),'utf8'),pretty(graph));
  const r=buildRelease(input);assert.equal(r.validation.counts.active_claims,4);
  assert.deepEqual(r.canonical.claim_revisions.map(c=>c.assertion_key).sort(),[...APPROVED_SCOPE].sort());
  assert.equal(graph.nodes.length,4);assert.equal(graph.edges.length,4);
  assert.ok(graph.edges.every(e=>e.stakePercent===null&&e.valueUsd===null));
  assert.ok(!JSON.stringify(graph).match(/cusip|isin|api_key|raw_content|ent_blackrock|ent_vanguard_group_historical/i));
});
test('publication hold, missing independent admission, incomplete amendment and source rights fail closed',()=>{
  for(const mutate of [i=>{i.review.publication.status='held';},i=>{i.review.decisions[0].decision='needs_review';},i=>{i.batches[0].documents.find(d=>d.document_id==='doc_apple_proxy2026').amendment_status='incomplete';},i=>{i.sources.sources[0].rights.derived_publication.status='unknown';}]){
    const copy=structuredClone(input);mutate(copy);assert.throws(()=>projectResearched(copy));
  }
});
test('role filters and historical metrics cannot imply cap-table totals or current holdings',()=>{
  const model=createModel(graph);
  assert.equal(relatedEdges(model,'ent_apple',{filter:'ownership'}).length,2);
  assert.equal(relatedEdges(model,'ent_apple',{filter:'managed_holding'}).length,1);
  assert.equal(relatedEdges(model,'ent_apple',{filter:'voting_authority'}).length,1);
  for(const e of graph.edges){
    const html=researchDetails(e,model.nodeMap.get(e.source),model.nodeMap.get(e.target));
    assert.match(html,/Historical snapshot/);assert.match(html,/does not establish a current position/);assert.match(html,/Coverage/);
    assert.ok(e.disclosure.evidence.every(x=>x.url.startsWith('https://www.sec.gov/')&&x.published_at&&x.locator));
    if(e.kind==='beneficial_ownership'){
      assert.equal(e.asOf,'2026-01-02');const m=e.disclosure.metrics.find(m=>m.metric_type==='beneficial_percentage');assert.equal(m.value,null);assert.match(html,/Less than 1%/);assert.match(html,/14,697,926,000/);
    }else{
      assert.equal(e.asOf,'2026-06-30');assert.match(html,/31,661,076/);assert.match(html,/same position/);
    }
  }
});
test('decimal formatting preserves exact values and source strings are escaped',()=>{
  assert.equal(decimalLabel('9007199254740993.25'),'9,007,199,254,740,993.25');
  const e=structuredClone(graph.edges[0]);e.disclosure.caveats.push('<script>alert(1)</script>');
  const html=researchDetails(e,{id:'a',label:'<img src=x>'},{id:'b',label:'Apple'});
  assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<img'));assert.ok(html.includes('&lt;script&gt;'));
});
