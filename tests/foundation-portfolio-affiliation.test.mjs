import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from '../data-foundation/fixtures/synthetic.mjs';
import {buildRelease,aggregateDisclosedSubset,queryIssuerDisclosures,queryReportedPortfolio,hash} from '../scripts/foundation/core.mjs';
import {projectUaeReleases} from '../scripts/export-uae.mjs';

const build=f=>buildRelease({batches:[f.batch],registry:f.registry,sources:f.sources,review:f.review,fixtureMode:true});
const reject=(f,reason)=>{const release=build(f);assert.equal(release.validation.counts.active_claims,0);assert.ok(release.validation.results.flatMap(r=>r.reasons).includes(reason));};
function affiliation(type='real_asset'){
  const f=fixture();f.batch.manifest.scope.asset_class='equity_and_reported_affiliations';
  f.registry.entities[1].entity_type=type;f.registry.perimeters[0].basis='consolidated_group';
  Object.assign(f.batch.claims[0],{predicate:'reported_portfolio_affiliation',object_id:'ent_002',metrics:[],qualifiers:['A source-named hotel property acquisition. Prior operation or management alone was not ownership. This is not equity in an identified company.']});
  f.batch.denominators=[];f.batch.evidence[0].supported_predicates=['reported_portfolio_affiliation'];
  f.sources.sources[0].allowed_predicates=['reported_portfolio_affiliation'];
  return f;
}
test('reviewed real assets and brands are typed affiliations, never shares, equity percentages or additive holdings',()=>{
  for(const type of ['real_asset','brand']){
    const f=affiliation(type),release=build(f),edge=release.projection.edges[0];
    assert.equal(release.validation.counts.active_claims,1);assert.equal(edge.relationship,'reported_portfolio_affiliation');
    assert.equal(edge.security_id,null);assert.equal(edge.stakePercent,null);assert.deepEqual(edge.metrics,[]);
    assert.equal(release.projection.nodes.find(n=>n.id==='ent_002').entity_type,type);
    assert.equal(queryIssuerDisclosures(release,'ent_002').ownership.length,0);
    assert.equal(queryIssuerDisclosures(release,'ent_002').other.length,1);
    assert.equal(queryReportedPortfolio(release,{entityId:'ent_001',perimeterId:'per_001',perimeterVersion:'1',reportDate:'2025-06-30'}).positions.length,0);
    assert.throws(()=>aggregateDisclosedSubset(release,release.canonical.active_claim_revision_ids),/Non-additive ownership role/);
  }
});
test('portfolio affiliations require explicitly authorized mixed scope and consolidated group perimeter',()=>{
  const f=affiliation();f.batch.manifest.scope.asset_class='equity';reject(f,'portfolio_affiliation_requires_mixed_scope');
  f.batch.manifest.scope.asset_class='equity_and_reported_affiliations';
  for(const basis of ['own_account','client_aggregate','fund','beneficial_attribution','unknown','reported_discretion']){f.registry.perimeters[0].basis=basis;reject(f,'portfolio_affiliation_requires_consolidated_group');}
});
test('portfolio affiliation cannot target a company, reported group, government, fund, person or security',()=>{
  for(const type of ['legal_entity','reported_group','government','fund','person']){const f=affiliation();f.registry.entities[1].entity_type=type;reject(f,'portfolio_affiliation_asset_or_brand_required');}
  const f=affiliation();f.batch.claims[0].object_id='sec_001';reject(f,'portfolio_affiliation_asset_or_brand_required');
});
test('every metric type is forbidden on portfolio affiliations, including null unknown percentages',()=>{
  for(const type of ['quantity','reported_value','equity_percentage','beneficial_percentage','voting_percentage','portfolio_weight','group_interest_percentage']){
    for(const value of [null,'0','100']){
      const f=affiliation();f.batch.claims[0].metrics=[f.metric('forbidden',type,value,type==='quantity'?'shares':type==='reported_value'?'USD':'percent')];reject(f,'portfolio_affiliation_must_not_have_metrics');
    }
  }
});
test('affiliation requires source-specific qualifications and snapshot semantics',()=>{
  const f=affiliation();f.batch.claims[0].qualifiers=[];reject(f,'portfolio_affiliation_source_qualifier_required');
  f.batch.claims[0].qualifiers=['Reported brand membership, not corporate equity.'];f.batch.claims[0].temporal_kind='event';reject(f,'portfolio_affiliation_requires_snapshot');
});
test('brands and real assets cannot report holdings or be relabeled as equity issuers',()=>{
  for(const type of ['brand','real_asset','person','fund']){const f=affiliation();f.registry.entities[0].entity_type=type;reject(f,'portfolio_affiliation_reporter_required');}
  for(const type of ['brand','real_asset']){
    const f=fixture();f.registry.entities[1].entity_type=type;reject(f,'non_entity_cannot_issue_equity');
    const group=affiliation(type);group.batch.claims[0].predicate='reported_group_interest';reject(group,'non_equity_target_requires_affiliation');
  }
});
test('affiliation retains exact source rights, document, identity, review, time and evidence gates',()=>{
  for(const [mutate,reason] of [
    [f=>{f.sources.sources[0].rights.derived_publication.status='unknown';},'rights_derived_publication_blocked'],
    [f=>{f.sources.sources[0].allowed_predicates=[];},'source_predicate_mismatch'],
    [f=>{f.batch.evidence[0].supported_predicates=[];},'evidence_predicate_mismatch'],
    [f=>{f.batch.documents[0].amendment_status='unknown';},'amendment_chain_incomplete_as_of_cutoff'],
    [f=>{f.review.decisions[0].decision='needs_review';},'review_not_accepted'],
    [f=>{f.registry.entities[1].review.status='proposed';},'object_identity_review_required'],
    [f=>{f.batch.documents[0].published_at='2025-07-22';},'document_after_knowledge_cutoff'],
  ]){const f=affiliation();mutate(f);reject(f,reason);}
});
test('mixed scope still permits reviewed equities without changing legacy default scope',()=>{
  const f=fixture();assert.equal(f.batch.manifest.scope.asset_class,'equity');assert.equal(build(f).validation.counts.active_claims,1);
  f.batch.manifest.scope.asset_class='equity_and_reported_affiliations';assert.equal(build(f).validation.counts.active_claims,1);
  f.batch.manifest.scope.asset_class='all_assets';assert.throws(()=>build(f),/invalid enum/);
});
test('public aggregate visibly retains asset/brand types, source wording and empty metrics',()=>{
  for(const [type,kind] of [['real_asset','asset'],['brand','brand']]){
    const f=affiliation(type);delete f.metric;
    const input=JSON.parse(JSON.stringify({batches:[f.batch],registry:f.registry,sources:f.sources,review:f.review}).replaceAll('synthetic://fixtures/','https://example.test/affiliation-fixtures/'));
    input.review.reviewer_role='maintainer';input.review.publication={status:'approved',authorized_by:'fictional-test-owner',authorization_url:'https://example.test/test-authorization',intended_use:'noncommercial_research'};
    input.batches[0].claims[0].assertion_key=input.batches[0].claims[0].candidate_id;
    const release=buildRelease(input),graph=projectUaeReleases([{releaseKey:'affiliation',input,approvedScope:['candidate_001'],expectedReleaseId:release.manifest.release_id,expectedReviewId:release.manifest.review_id,bundleManifestSha256:hash('fictional-only')}]);
    assert.equal(graph.nodes.find(n=>n.id==='ent_002').kind,kind);assert.deepEqual(graph.edges[0].disclosure.metrics,[]);
    assert.equal(graph.edges[0].kind,'reported_portfolio_affiliation');assert.equal(graph.edges[0].stakePercent,null);
    assert.match(graph.edges[0].disclosure.securityLabel,/not a security or corporate equity claim/);
    assert.ok(graph.edges[0].disclosure.caveats.includes(f.batch.claims[0].qualifiers[0]));
    assert.equal(graph.edges[0].disclosure.releaseProvenance[0].releaseId,release.manifest.release_id);
  }
});
