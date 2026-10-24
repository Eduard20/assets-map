import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from '../data-foundation/fixtures/synthetic.mjs';
import {buildRelease,aggregateDisclosedSubset,validateRegistry} from '../scripts/foundation/core.mjs';

const build=f=>buildRelease({batches:[f.batch],registry:f.registry,sources:f.sources,review:f.review,fixtureMode:true});
const reject=(f,reason)=>{const release=build(f);assert.equal(release.validation.counts.active_claims,0);assert.ok(release.validation.results.flatMap(r=>r.reasons).includes(reason));};
function unspecifiedEquity() {
  const f=fixture();
  Object.assign(f.registry.securities[0],{instrument_kind:'equity_interest_unspecified',share_class:'not established',label:'Source-stated equity interest; class not established',identifiers:[]});
  f.registry.listings=[];
  f.batch.claims[0].metrics=[f.batch.claims[0].metrics.find(m=>m.metric_type==='equity_percentage')];
  f.batch.claims[0].qualifiers=['Source expressly states parent equity ownership; common/preferred class and share quantity are not established.'];
  Object.assign(f.batch.denominators[0],{value:null,availability:'unknown',label:'Source-stated equity basis; underlying share quantity not established'});
  return f;
}
test('unclassified direct equity preserves source-stated 60% and wholly-owned 100% without invented shares',()=>{
  for(const percentage of ['60','100']) {
    const f=unspecifiedEquity();f.batch.claims[0].metrics[0].value=percentage;
    const release=build(f),edge=release.projection.edges[0];
    assert.equal(release.validation.counts.active_claims,1);assert.equal(edge.relationship,'direct_equity_ownership');
    assert.equal(edge.metrics.length,1);assert.equal(edge.metrics[0].metric_type,'equity_percentage');
    assert.equal(edge.metrics[0].value,percentage);assert.equal(edge.metrics[0].denominator.value,null);
    assert.equal(edge.stakePercent,null);assert.equal(edge.target,'ent_002');
    assert.equal(release.registry.securities[0].instrument_kind,'equity_interest_unspecified');
    assert.equal(release.registry.securities[0].share_class,'not established');
    assert.throws(()=>aggregateDisclosedSubset(release,release.canonical.active_claim_revision_ids),/Missing compatible value/);
  }
});
test('unspecified equity cannot assert a common/preferred/ordinary or other identified share class',()=>{
  for(const shareClass of ['common','preferred','ordinary','Class A','not known']) {
    const f=unspecifiedEquity();f.registry.securities[0].share_class=shareClass;
    assert.throws(()=>validateRegistry(f.registry,{fixtureMode:true}),/Unspecified equity interest cannot establish a share class/);
  }
});
test('unspecified equity cannot acquire an official instrument identifier or any listing',()=>{
  const identified=unspecifiedEquity();identified.registry.securities[0].identifiers=[{namespace:'local_official',value:'invented-class-id',scope:'instrument',valid_from:null,valid_to:null,evidence_url:'synthetic://fixtures/identity'}];
  assert.throws(()=>build(identified),/Unspecified equity interest cannot establish a share class or instrument identifiers/);
  for(const validTo of [null,'2020-01-01']) {
    const listed=unspecifiedEquity();listed.registry.listings=[{...fixture().registry.listings[0],valid_to:validTo}];
    assert.throws(()=>build(listed),/Unspecified equity interest cannot have a listing/);
  }
});
test('unspecified equity is limited to explicit direct ownership, not beneficial, group, fund, management or voting roles',()=>{
  for(const predicate of ['record_ownership','beneficial_ownership','fund_holding','managed_holding','manages_fund','voting_authority','custody','control_assertion','subsidiary_of','reported_group_interest']) {
    const f=unspecifiedEquity();f.batch.claims[0].predicate=predicate;reject(f,'unspecified_equity_requires_direct_role');
  }
  const f=unspecifiedEquity();f.registry.perimeters[0].basis='consolidated_group';reject(f,'ownership_requires_own_account');
});
test('unspecified equity cannot carry share quantity, value, voting or non-equity percentages',()=>{
  for(const type of ['quantity','reported_value','beneficial_percentage','group_interest_percentage','voting_percentage','portfolio_weight']) {
    const f=unspecifiedEquity();f.batch.claims[0].metrics[0].metric_type=type;reject(f,'unspecified_equity_percentage_only');
  }
  const f=unspecifiedEquity();f.batch.claims[0].metrics.push(f.metric('quantity','quantity','10','shares'));reject(f,'unspecified_equity_percentage_only');
  f.batch.claims[0].metrics=[];reject(f,'unspecified_equity_percentage_only');
});
test('unclassified source percentages cannot manufacture a share denominator or omit qualifications',()=>{
  const f=unspecifiedEquity();Object.assign(f.batch.denominators[0],{value:'100',availability:'known'});reject(f,'unspecified_equity_denominator_must_remain_unresolved');
  Object.assign(f.batch.denominators[0],{value:null,availability:'unknown'});f.batch.claims[0].qualifiers=[];reject(f,'unspecified_equity_qualifier_required');
});
test('unspecified equity retains source, amendment, independent review and percentage-range admission gates',()=>{
  for(const [mutate,reason] of [
    [f=>{f.sources.sources[0].rights.derived_publication.status='unknown';},'rights_derived_publication_blocked'],
    [f=>{f.review.decisions[0].decision='needs_review';},'review_not_accepted'],
    [f=>{f.batch.documents[0].amendment_status='unknown';},'amendment_chain_incomplete_as_of_cutoff'],
    [f=>{f.batch.evidence[0].supported_predicates=[];},'evidence_predicate_mismatch'],
    [f=>{f.batch.claims[0].metrics[0].value='100.0001';},'percentage_out_of_range'],
    [f=>{f.batch.claims[0].metrics[0].source_reported=false;},'agent_derived_metric_not_allowed'],
  ]){const f=unspecifiedEquity();mutate(f);reject(f,reason);}
});
test('previous common, preferred and fund-unit instrument kinds remain available unchanged',()=>{
  for(const kind of ['common_equity','preferred_equity','fund_unit']) {
    const f=fixture();f.registry.securities[0].instrument_kind=kind;
    assert.doesNotThrow(()=>validateRegistry(f.registry,{fixtureMode:true}));
  }
  assert.equal(build(fixture()).projection.edges[0].stakePercent,'10');
});
