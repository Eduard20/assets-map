import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fixture,clone} from '../data-foundation/fixtures/synthetic.mjs';
import {buildRelease,aggregateDisclosedSubset,queryIssuerDisclosures,queryReportedPortfolio,pretty} from '../scripts/foundation/core.mjs';
import {loadReviewedInput,projectResearched} from '../scripts/export-researched.mjs';

const build=(f,options={})=>buildRelease({batches:[f.batch],registry:f.registry,sources:f.sources,review:f.review,fixtureMode:true,...options});
const reasons=release=>release.validation.results.flatMap(row=>row.reasons);
const reject=(f,reason)=>{const release=build(f);assert.equal(release.validation.counts.active_claims,0);assert.ok(reasons(release).includes(reason),reasons(release).join(', '));return release;};
function groupFixture() {
  const f=fixture(),claim=f.batch.claims[0],denominator=f.batch.denominators[0];
  f.registry.perimeters[0].basis='consolidated_group';
  f.registry.perimeters[0].definition='Consolidated group reporting, without identifying the immediate legal shareholder.';
  claim.predicate='reported_group_interest';claim.object_id='ent_002';
  claim.qualifiers=['Source-stated ownership interest of the consolidated group, not direct legal ownership or voting authority.'];
  claim.metrics=[f.metric('group_metric','group_interest_percentage','50.1','percent','den_001')];
  Object.assign(denominator,{kind:'reported_group_interest',label:'Source ownership interests basis; underlying denominator is not separately disclosed.',value:null,availability:'unknown',unit:'percent',currency:null,security_ids:[],qualifiers:['No share denominator or immediate legal holder inferred.']});
  f.batch.evidence[0].supported_predicates=['reported_group_interest'];
  f.sources.sources[0].allowed_predicates.push('reported_group_interest');
  return f;
}
function unknownPublication(f=groupFixture()) {
  Object.assign(f.batch.documents[0],{published_at:null,observed_by:'2025-07-21',publication_date_basis:'unknown_observed_by'});
  f.review.document_decisions.push({batch_id:f.batch.manifest.batch_id,document_id:'doc_001',decision:'accepted_for_model',rationale:'Independently reviewed observation bound. The actual publication date is unknown.'});
  return f;
}

test('reported consolidated group interest stays entity-level, source-rounded and non-additive',()=>{
  const release=build(groupFixture()),edge=release.projection.edges[0];
  assert.equal(release.validation.counts.active_claims,1);
  assert.equal(edge.relationship,'reported_group_interest');assert.equal(edge.target,'ent_002');
  assert.equal(edge.security_id,null);assert.equal(edge.stakePercent,null);
  assert.equal(edge.metrics[0].value,'50.1');assert.equal(edge.metrics[0].denominator.value,null);
  assert.ok(edge.warnings.includes('non_comparable_percentage:group_metric'));
  assert.throws(()=>aggregateDisclosedSubset(release,release.canonical.active_claim_revision_ids),/Non-additive ownership role/);
  const issuer=queryIssuerDisclosures(release,'ent_002');
  assert.equal(issuer.ownership.length,0);assert.equal(issuer.other.length,1);assert.equal(issuer.total_ownership_percentage,null);
  const portfolio=queryReportedPortfolio(release,{entityId:'ent_001',perimeterId:'per_001',perimeterVersion:'1',reportDate:'2025-06-30'});
  assert.equal(portfolio.positions.length,0);assert.equal(portfolio.whole_portfolio_value,null);
});
test('group reporters can be legal entities, governments or explicitly reported groups, never brands or people',()=>{
  for(const type of ['legal_entity','government','reported_group']){const f=groupFixture();f.registry.entities[0].entity_type=type;assert.equal(build(f).validation.counts.active_claims,1);}
  for(const type of ['brand','person','fund']){const f=groupFixture();f.registry.entities[0].entity_type=type;reject(f,'group_interest_reporter_required');}
});
test('group interest accepts a source-named reported group without inventing legal title',()=>{
  const f=groupFixture();f.registry.entities[1].entity_type='reported_group';
  const release=build(f);assert.equal(release.validation.counts.active_claims,1);
  assert.equal(release.projection.nodes.find(n=>n.id==='ent_002').entity_type,'reported_group');
  assert.equal(release.projection.edges[0].target,'ent_002');assert.equal(release.projection.edges[0].security_id,null);
  assert.equal(release.projection.edges[0].stakePercent,null);
});
test('group interest cannot manufacture a security or target a brand or individual',()=>{
  const f=groupFixture();f.batch.claims[0].object_id='sec_001';reject(f,'group_interest_entity_target_required');
  for(const type of ['brand','person','government','fund']){const f=groupFixture();f.registry.entities[1].entity_type=type;reject(f,'group_interest_entity_target_required');}
});
test('every non-consolidated perimeter is rejected for group interests',()=>{
  for(const basis of ['own_account','client_aggregate','fund','beneficial_attribution','unknown','reported_discretion']) {
    const f=groupFixture();f.registry.perimeters[0].basis=basis;reject(f,'group_interest_requires_consolidated_group');
  }
});
test('group interest cannot become a continuing holding or lose its source-basis qualifier',()=>{
  const f=groupFixture();f.batch.claims[0].temporal_kind='event';reject(f,'group_interest_requires_snapshot');
  f.batch.claims[0].temporal_kind='snapshot';f.batch.claims[0].qualifiers=[];reject(f,'group_interest_basis_qualifier_required');
});
test('group percentages cannot be assigned to any other relationship',()=>{
  for(const predicate of ['record_ownership','beneficial_ownership','direct_equity_ownership','fund_holding','managed_holding','manages_fund','voting_authority','custody','control_assertion','subsidiary_of']) {
    const f=groupFixture();f.batch.claims[0].predicate=predicate;reject(f,'group_interest_metric_requires_group_role');
  }
});
test('group interests cannot carry share quantity, value, equity, voting or portfolio metrics',()=>{
  for(const type of ['quantity','reported_value','equity_percentage','beneficial_percentage','voting_percentage','portfolio_weight']) {
    const f=groupFixture();f.batch.claims[0].metrics[0].metric_type=type;reject(f,'group_interest_metric_required');
  }
  const f=groupFixture();f.batch.claims[0].metrics=[];reject(f,'group_interest_metric_required');
  f.batch.claims[0].metrics=[f.metric('group_metric','group_interest_percentage','50.1','percent','den_001'),f.metric('quantity','quantity','10','shares')];reject(f,'group_interest_metric_required');
});
test('group denominator cannot masquerade as a share denominator, another perimeter or numeric total',()=>{
  const mutations=[
    [f=>{f.batch.denominators[0].kind='outstanding_equity';},'denominator_meaning_mismatch'],
    [f=>{f.batch.denominators[0].unit='shares';},'denominator_unit_mismatch'],
    [f=>{f.batch.denominators[0].currency='USD';},'denominator_unit_mismatch'],
    [f=>{f.batch.denominators[0].security_ids=['sec_001'];},'group_interest_denominator_has_security'],
    [f=>{f.batch.denominators[0].reporting_perimeter_id='per_005';},'denominator_perimeter_mismatch'],
    [f=>{Object.assign(f.batch.denominators[0],{value:'100',availability:'known'});},'group_interest_denominator_must_remain_unresolved'],
    [f=>{f.batch.claims[0].metrics[0].denominator_id=null;},'percentage_denominator_required'],
    [f=>{f.batch.claims[0].metrics[0].currency='USD';},'group_interest_not_valuation'],
  ];
  for(const [mutate,reason] of mutations){const f=groupFixture();mutate(f);reject(f,reason);}
});
test('group interest numeric, source and unit gates remain fail closed',()=>{
  for(const [value,reason] of [['100.000001','percentage_out_of_range'],['-0.1','negative_long_equity_metric']]){const f=groupFixture();f.batch.claims[0].metrics[0].value=value;reject(f,reason);}
  for(const value of ['0','100','50.10']){const f=groupFixture();f.batch.claims[0].metrics[0].value=value;assert.equal(build(f).projection.edges[0].metrics[0].value,value);}
  const f=groupFixture();f.batch.claims[0].metrics[0].unit='shares';reject(f,'percentage_unit_mismatch');
  f.batch.claims[0].metrics[0].unit='percent';f.batch.claims[0].metrics[0].source_reported=false;reject(f,'agent_derived_metric_not_allowed');
  f.batch.claims[0].metrics[0].source_reported=true;f.batch.claims[0].metrics[0].measurement_basis='target_allocation';reject(f,'target_is_not_observation');
});
test('new role preserves source admission, rights, independent claim review and amendment gates',()=>{
  for(const [mutate,reason] of [
    [f=>{f.sources.sources[0].rights.derived_publication.status='unknown';},'rights_derived_publication_blocked'],
    [f=>{f.sources.sources[0].admission.status='needs_review';},'source_not_admitted'],
    [f=>{f.sources.sources[0].allowed_predicates=[];},'source_predicate_mismatch'],
    [f=>{f.sources.sources[0].admitted_document_ids=[];},'document_not_admitted'],
    [f=>{f.review.decisions[0].decision='needs_review';},'review_not_accepted'],
    [f=>{f.registry.perimeters[0].review.status='proposed';},'identity_or_perimeter_review_required'],
    [f=>{f.batch.documents[0].amendment_status='unknown';},'amendment_chain_incomplete_as_of_cutoff'],
  ]){const f=unknownPublication();mutate(f);const r=reject(f,reason);assert.equal(r.canonical.documents.length,0);assert.equal(r.canonical.evidence.length,0);}
});
test('unknown publication is retained as null with independently reviewed observed-by provenance',()=>{
  const release=build(unknownPublication()),doc=release.canonical.documents[0],evidence=release.projection.edges[0].evidence[0];
  assert.equal(release.validation.counts.active_claims,1);assert.equal(doc.published_at,null);
  assert.equal(evidence.published_at,null);assert.equal(evidence.observed_by,'2025-07-21');assert.equal(evidence.publication_date_basis,'unknown_observed_by');
  assert.ok(release.projection.edges[0].warnings.includes('unknown_publication_date:doc_001'));
  // Date policy is additive for existing direct-equity claims too, not a parallel validator.
  assert.equal(build(unknownPublication(fixture())).validation.counts.active_claims,1);
});
test('unknown publication requires both explicit date fields and an independent exact document decision',()=>{
  for(const [mutate,reason] of [
    [f=>{delete f.batch.documents[0].observed_by;},'unknown_publication_requires_observed_by'],
    [f=>{delete f.batch.documents[0].publication_date_basis;},'unknown_publication_requires_observed_by'],
    [f=>{f.batch.documents[0].publication_date_basis='known_publication';},'unknown_publication_requires_observed_by'],
    [f=>{f.review.document_decisions=[];},'unknown_publication_document_review_required'],
    [f=>{f.review.document_decisions[0].batch_id='another-batch';},'unknown_publication_document_review_required'],
    [f=>{f.review.document_decisions[0].document_id='another-document';},'unknown_publication_document_review_required'],
    [f=>{f.review.document_decisions[0].decision='needs_review';},'unknown_publication_document_review_required'],
    [f=>{f.review.reviewer=f.batch.manifest.agent_id;},'unknown_publication_document_review_required'],
  ]){const f=unknownPublication();mutate(f);reject(f,reason);}
});
test('observed-by dates reject malformed, future, after-retrieval and contradictory publication dates',()=>{
  for(const invalid of [null,'','2025-02-29','2025-02-30','2025-7-21','2025-07-21T10:00:00Z']) {
    const f=unknownPublication();f.batch.documents[0].observed_by=invalid;assert.throws(()=>build(f),/Invalid batch/);
  }
  const future=unknownPublication();future.batch.documents[0].observed_by='2025-07-22';reject(future,'document_observed_after_knowledge_cutoff');
  const retrieval=unknownPublication();retrieval.batch.observations[0].retrieved_at='2025-07-20T10:00:00Z';reject(retrieval,'retrieval_before_observed_by');
  const known=groupFixture();known.batch.documents[0].publication_date_basis='unknown_observed_by';known.batch.documents[0].observed_by='2025-07-21';reject(known,'publication_date_basis_mismatch');
  known.batch.documents[0].publication_date_basis='known_publication';known.batch.documents[0].observed_by='2025-07-19';reject(known,'observation_bound_before_publication');
});
test('unknown publication cannot waive observation time or transitive source gates',()=>{
  for(const field of ['retrieved_at','recorded_at']) {
    const f=unknownPublication();f.batch.observations[0][field]='2025-07-22T10:00:00Z';
    if(field==='retrieved_at')f.batch.observations[0].recorded_at='2025-07-22T10:00:00Z';
    reject(f,'observation_after_knowledge_cutoff');
  }
  const f=groupFixture();
  f.batch.documents.push({...f.batch.documents[0],document_id:'doc_context',published_at:null,observed_by:'2025-07-21',publication_date_basis:'unknown_observed_by'});
  f.sources.sources[0].admitted_document_ids.push('doc_context');
  f.batch.evidence.push({...f.batch.evidence[0],evidence_id:'ev_context',document_id:'doc_context'});
  f.batch.observations.push({...f.batch.observations[0],observation_id:'obs_context',document_id:'doc_context',evidence_ids:['ev_context']});
  f.batch.claims[0].observation_ids.push('obs_context');f.batch.denominators[0].evidence_ids=['ev_context'];
  reject(f,'unknown_publication_document_review_required');
  f.review.document_decisions.push({batch_id:f.batch.manifest.batch_id,document_id:'doc_context',decision:'accepted_for_model',rationale:'Independently reviewed context observation.'});
  const first=build(f),batch=clone(f.batch);batch.manifest.batch_id='following-context';batch.manifest.base_release_id=first.manifest.release_id;batch.claims=[];
  const next=build(f,{batches:[batch],base:first});
  assert.ok(next.projection.edges[0].warnings.includes('unknown_publication_date:doc_context'));
  assert.deepEqual(next.projection.edges[0].warnings,first.projection.edges[0].warnings);
});
function unknownRestatement() {
  const f=groupFixture();f.sources.sources[0].admitted_document_ids.push('doc_002');
  const first=build(f),batch=clone(f.batch);batch.manifest.batch_id='restatement';batch.manifest.base_release_id=first.manifest.release_id;
  batch.documents=[{...batch.documents[0],document_id:'doc_002',version:'2',amendment_kind:'restatement',supersedes_document_ids:['doc_001'],published_at:null,observed_by:'2025-07-21',publication_date_basis:'unknown_observed_by'}];
  batch.evidence=[{...batch.evidence[0],evidence_id:'ev_002',document_id:'doc_002'}];
  batch.observations=[{...batch.observations[0],observation_id:'obs_002',document_id:'doc_002',evidence_ids:['ev_002']}];
  batch.claims=[];batch.denominators=[];batch.coverage=[];
  f.review.document_decisions.push({batch_id:'restatement',document_id:'doc_002',decision:'accepted_for_model',rationale:'Independently reviewed complete source restatement with an observed-by bound, not a known publication date.'});
  return {f,first,batch};
}
test('claimless unknown-date restatements use the same independent date gate',()=>{
  for(const mutate of [
    ({f})=>{f.review.document_decisions=[];},
    ({batch})=>{delete batch.documents[0].observed_by;},
    ({batch})=>{batch.documents[0].observed_by='2025-07-22';},
    ({batch})=>{batch.observations=[];batch.evidence=[];},
    ({batch})=>{batch.observations[0].retrieved_at='2025-07-20T10:00:00Z';},
    ({batch})=>{batch.observations[0].recorded_at='2025-07-22T10:00:00Z';},
  ]){const input=unknownRestatement();mutate(input);assert.equal(build(input.f,{batches:[input.batch],base:input.first}).validation.counts.active_claims,1);}
  const {f,first,batch}=unknownRestatement(),release=build(f,{batches:[batch],base:first});
  assert.equal(release.validation.counts.active_claims,0);assert.equal(release.canonical.claim_revisions.length,1);
  assert.equal(release.canonical.documents.find(d=>d.document_id==='doc_002').published_at,null);
  assert.ok(release.canonical.observations.some(o=>o.observation_id==='obs_002'));
  assert.ok(release.canonical.evidence.some(e=>e.evidence_id==='ev_002'));
  const next=clone(batch);next.manifest.batch_id='after-restatement';next.manifest.base_release_id=release.manifest.release_id;next.documents=[];next.evidence=[];next.observations=[];
  const inherited=build(f,{batches:[next],base:release});
  assert.ok(inherited.canonical.documents.some(d=>d.document_id==='doc_002'));
  assert.ok(inherited.canonical.observations.some(o=>o.observation_id==='obs_002'));
  assert.ok(inherited.canonical.evidence.some(e=>e.evidence_id==='ev_002'));
});
test('inherited group disclosures retain unknown-publication and denominator caveats',()=>{
  const f=unknownPublication(),first=build(f),batch=clone(f.batch);batch.manifest.batch_id='empty-following-batch';batch.manifest.base_release_id=first.manifest.release_id;batch.claims=[];
  const next=build(f,{batches:[batch],base:first});assert.deepEqual(next.projection.edges[0].warnings,first.projection.edges[0].warnings);
  assert.equal(next.projection.edges[0].evidence[0].published_at,null);assert.equal(next.projection.edges[0].stakePercent,null);
});
test('bounded group batches still reject more than 30 candidate claims',()=>{
  const f=groupFixture();f.batch.claims=Array.from({length:31},(_,i)=>({...clone(f.batch.claims[0]),candidate_id:`candidate_${i}`}));assert.throws(()=>build(f),/Batch exceeds authorized claim cap/);
  f.batch.claims.length=1;f.batch.manifest.scope.max_claims=31;assert.throws(()=>build(f),/above maximum/);
});
test('combined group releases cannot exceed 30 active accepted claims across batches',()=>{
  const f=groupFixture(),batches=[];f.review.decisions=[];
  for(const [start,count] of [[0,30],[30,1]]) {
    const batch=clone(f.batch);batch.manifest.batch_id=`group-batch-${start}`;batch.claims=[];
    for(let i=start;i<start+count;i++) {
      const evidence={...clone(f.batch.evidence[0]),evidence_id:`group_evidence_${i}`,source_record_key:`row_${i}`};
      batch.evidence.push(evidence);batch.observations[0].evidence_ids.push(evidence.evidence_id);
      const claim={...clone(f.batch.claims[0]),candidate_id:`group_candidate_${i}`,assertion_key:`group_assertion_${i}`,position_scope_id:`position_scope_${i}`,primary_evidence_ids:[evidence.evidence_id],evidence_ids:[evidence.evidence_id]};
      batch.claims.push(claim);f.review.decisions.push({batch_id:batch.manifest.batch_id,candidate_id:claim.candidate_id,decision:'accepted_for_model',rationale:'Independent synthetic row review.'});
    }
    batch.observations[0].observation_id=`group_observation_${start}`;batch.claims.forEach(c=>{c.observation_ids=[batch.observations[0].observation_id];});
    batches.push(batch);
  }
  assert.equal(build(f,{batches:[batches[0]]}).validation.counts.active_claims,30);
  assert.throws(()=>build(f,{batches}),/Combined pilot exceeds 30 accepted active claims/);
});
test('additive role/date extension leaves the exact reviewed Apple public output unchanged',async()=>{
  const input=await loadReviewedInput(),release=buildRelease(input);
  assert.equal(release.validation.counts.active_claims,4);
  assert.equal(pretty(projectResearched(input)),await readFile(new URL('../data/researched.json',import.meta.url),'utf8'));
  assert.ok(release.projection.edges.every(edge=>edge.evidence.every(e=>e.published_at&&!Object.hasOwn(e,'observed_by')&&!Object.hasOwn(e,'publication_date_basis'))));
});
