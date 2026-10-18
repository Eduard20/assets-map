import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildRelease,canonicalJSON,aggregateDisclosedSubset,queryIssuerDisclosures,queryReportedPortfolio} from '../scripts/foundation/core.mjs';
import {fixture} from '../data-foundation/fixtures/synthetic.mjs';
const read=async name=>JSON.parse(await readFile(new URL(`../data-foundation/pilot/input/${name}.json`,import.meta.url),'utf8'));
async function pilot(){return {batches:[await read('batch')],registry:await read('registry'),sources:await read('sources'),review:await read('review')};}
test('real bounded pilot reproducibly holds all seven; no quarantined facts reach canonical/graph',async()=>{
  const input=await pilot(),r=buildRelease(input);assert.equal(input.batches[0].claims.length,7);assert.equal(r.validation.counts.active_claims,0);assert.equal(r.validation.counts.quarantined,7);assert.equal(r.projection.edges.length,0);assert.equal(r.canonical.claim_revisions.length,0);assert.equal(r.canonical.documents.length,0);assert.equal(r.canonical.evidence.length,0);
  assert.ok(r.validation.results.every(c=>c.reasons.includes('amendment_chain_incomplete_as_of_cutoff')));
  const expected=JSON.parse(await readFile(new URL('../data-foundation/pilot/validation-report.json',import.meta.url),'utf8'));assert.equal(canonicalJSON(r.validation),canonicalJSON(expected));
});
test('historical labels, optimistic reviews and rights alone cannot bypass incomplete amendment gate',async()=>{
  const input=await pilot();for(const d of input.review.decisions)d.decision='accepted_for_model';for(const c of ['entities','securities','perimeters'])for(const row of input.registry[c])row.review.status='accepted';for(const s of input.sources.sources){s.admission.status='scope_admitted';s.admitted_document_ids=input.batches[0].documents.filter(d=>d.source_id===s.source_id).map(d=>d.document_id);for(const right of Object.values(s.rights))right.status='allowed';}
  input.batches[0].gaps=[];const r=buildRelease(input);assert.equal(r.validation.counts.active_claims,0);assert.equal(r.validation.counts.quarantined,7);assert.ok(r.validation.results.every(c=>c.reasons.includes('amendment_chain_incomplete_as_of_cutoff')));
});
test('real source bounds and mixed-date source percentages retain qualifications',async()=>{
  const {batches:[b]}=await pilot();for(const id of ['cand_apple_proxy_cook','cand_apple_proxy_management_group']){const c=b.claims.find(c=>c.candidate_id===id),m=c.metrics.find(m=>m.metric_type==='beneficial_percentage');assert.equal(m.value,null);assert.match(m.reason,/<1%/);}
  for(const id of ['cand_apple_proxy_vanguard','cand_apple_proxy_blackrock']){const c=b.claims.find(c=>c.candidate_id===id),m=c.metrics.find(m=>m.metric_type==='beneficial_percentage'),d=b.denominators.find(d=>d.denominator_id===m.denominator_id);assert.notEqual(c.report_date,d.as_of_date);}
});
test('Vanguard affiliates and old/new BlackRock identities are not conflated',async()=>{
  const {registry,batches:[b]}=await pilot();const vga=registry.entities.find(e=>e.identifiers.some(i=>i.namespace==='cik'&&i.value.replace(/^0+/,'')==='1811242')),parent=registry.entities.find(e=>e.identifiers.some(i=>i.namespace==='cik'&&i.value.replace(/^0+/,'')==='102909'));assert.ok(vga&&parent);assert.notEqual(vga.entity_id,parent.entity_id);assert.equal(registry.perimeters.find(p=>p.reporting_perimeter_id==='per_vga_13f2026q2').basis,'reported_discretion');
  assert.ok(!registry.entities.some(e=>e.identifiers.some(i=>i.namespace==='cik'&&i.value.replace(/^0+/,'')==='2012383')));
  const group=b.claims.find(c=>c.candidate_id==='cand_apple_proxy_management_group'),cook=b.claims.find(c=>c.candidate_id==='cand_apple_proxy_cook');assert.ok(group.overlap_group_ids.some(x=>cook.overlap_group_ids.includes(x)));
});
test('issuer and portfolio query contracts preserve role and explicit scope',()=>{
  const f=fixture(),r=buildRelease({batches:[f.batch],registry:f.registry,sources:f.sources,review:f.review,fixtureMode:true});const issuer=queryIssuerDisclosures(r,'ent_002',{reportDate:'2025-06-30'});assert.equal(issuer.ownership.length,1);assert.equal(issuer.managed_exposure.length,0);assert.equal(issuer.total_ownership_percentage,null);
  assert.throws(()=>queryReportedPortfolio(r,{entityId:'ent_001'}),/Choose entity/);const p=queryReportedPortfolio(r,{entityId:'ent_001',perimeterId:'per_001',perimeterVersion:'1',reportDate:'2025-06-30'});assert.equal(p.positions.length,1);assert.equal(p.whole_portfolio_value,null);
});
