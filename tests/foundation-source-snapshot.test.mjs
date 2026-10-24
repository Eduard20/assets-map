import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture} from '../data-foundation/fixtures/synthetic.mjs';
import {buildRelease,SOURCE_SNAPSHOT_QUALIFIER} from '../scripts/foundation/core.mjs';

const build=f=>buildRelease({batches:[f.batch],registry:f.registry,sources:f.sources,review:f.review,fixtureMode:true});
function snapshot(){
  const f=fixture();
  Object.assign(f.sources.sources[0],{source_kind:'public_news',identifier_namespaces:['local_official']});
  Object.assign(f.batch.documents[0],{amendment_status:'source_snapshot_only',correction_scope:'nonexhaustive',amendment_discovery:'Bounded source observation, not an enumerated correction history.'});
  f.batch.claims[0].qualifiers.push(SOURCE_SNAPSHOT_QUALIFIER);
  f.review.document_decisions=[{batch_id:f.batch.manifest.batch_id,document_id:'doc_001',decision:'accepted_for_model',rationale:'Independently checked dated public-news observation, nonexhaustive correction scope.'}];
  return f;
}
function reject(f,reason){const r=build(f);assert.equal(r.validation.counts.active_claims,0);assert.ok(r.validation.results.flatMap(r=>r.reasons).includes(reason),JSON.stringify(r.validation.results));return r;}
test('independently reviewed public news admits only a qualified dated observation with correction uncertainty retained',()=>{
  const r=build(snapshot());assert.equal(r.validation.counts.active_claims,1);
  const e=r.projection.edges[0];assert.equal(e.temporal_kind,'snapshot');assert.equal(e.evidence[0].amendment_status,'source_snapshot_only');assert.equal(e.evidence[0].correction_scope,'nonexhaustive');
  assert.ok(e.warnings.includes('correction_completeness_not_established:doc_001'));
  assert.ok(r.canonical.claim_revisions[0].qualifiers.includes(SOURCE_SNAPSHOT_QUALIFIER));
});
test('the additive news route does not change unknown, incomplete or strict filing gates',()=>{
  for(const status of ['unknown','incomplete']){const f=snapshot();f.batch.documents[0].amendment_status=status;delete f.batch.documents[0].correction_scope;reject(f,'amendment_chain_incomplete_as_of_cutoff');}
  const f=fixture();f.batch.documents[0].amendment_checked_through='2025-07-20';reject(f,'amendment_chain_incomplete_as_of_cutoff');
  const strict=build(fixture());assert.equal(strict.validation.counts.active_claims,1);assert.equal(strict.projection.edges[0].evidence[0].amendment_status,undefined);
});
test('source snapshot requires explicit public-news classification, never generic nonfiling fallback',()=>{
  for(const kind of [undefined,'regulatory_filing','portfolio_page','annual_report']){const f=snapshot();if(kind===undefined)delete f.sources.sources[0].source_kind;else f.sources.sources[0].source_kind=kind;reject(f,'source_snapshot_public_news_only');}
  const f=snapshot();f.sources.sources[0].source_kind='other';assert.throws(()=>build(f),/Invalid sources/);
});
test('SEC URLs, filing namespaces and regulated source families cannot masquerade as public news',()=>{
  for(const mutate of [
    f=>{f.sources.sources[0].identifier_namespaces=['cik'];},
    f=>{f.sources.sources[0].identifier_namespaces=['sec_series'];},
    f=>{f.sources.sources[0].source_family='SEC_ownership_filings';},
    f=>{f.sources.sources[0].source_family='statutory_filing';},
    f=>{f.sources.sources[0].publication_host='www.sec.gov';},
    f=>{f.sources.sources[0].allowed_url_prefixes.push('https://data.sec.gov/');},
    f=>{f.batch.documents[0].url='https://www.sec.gov/Archives/filing';f.sources.sources[0].allowed_url_prefixes.push('https://www.sec.gov/');},
  ]){const f=snapshot();mutate(f);reject(f,'source_snapshot_public_news_only');}
});
test('exact independent document and source reviews are mandatory',()=>{
  for(const mutate of [f=>{f.review.document_decisions=[];},f=>{f.review.document_decisions[0].batch_id='other';},f=>{f.review.document_decisions[0].document_id='other';},f=>{f.review.document_decisions[0].decision='needs_review';},f=>{f.review.reviewer=f.batch.manifest.agent_id;}]){const f=snapshot();mutate(f);reject(f,'source_snapshot_independent_document_review_required');}
  const f=snapshot();f.sources.sources[0].admission.reviewer=f.batch.manifest.agent_id;reject(f,'source_snapshot_independent_source_review_required');
});
test('nonexhaustive scope and exact source-observation qualifier cannot be omitted or changed',()=>{
  const f=snapshot();delete f.batch.documents[0].correction_scope;reject(f,'source_snapshot_nonexhaustive_scope_required');
  for(const qualifiers of [[],['Current latest ownership, corrections complete.'],['Historical source only.']]){const f=snapshot();f.batch.claims[0].qualifiers=qualifiers;reject(f,'source_snapshot_explicit_qualifier_required');}
  const known=snapshot();known.batch.documents[0].amendment_status='complete';reject(known,'correction_scope_status_mismatch');
});
test('news route cannot admit amendments, restatements, withdrawals, effective intervals or claim corrections',()=>{
  for(const kind of ['addition','partial','restatement','withdrawal']){const f=snapshot();f.batch.documents.push({...structuredClone(f.batch.documents[0]),document_id:'prior',version:'0'});f.batch.documents[0].supersedes_document_ids=['prior'];f.batch.documents[0].amendment_kind=kind;reject(f,'source_snapshot_original_document_only');}
  for(const kind of ['event','interval']){const f=snapshot();f.batch.claims[0].temporal_kind=kind;reject(f,'source_snapshot_not_correction_or_continuing_holding');}
  const f=snapshot();f.batch.claims[0].correction_kind='addition';reject(f,'source_snapshot_not_correction_or_continuing_holding');
  const supersedes=snapshot();supersedes.batch.documents.push({...structuredClone(supersedes.batch.documents[0]),document_id:'prior',version:'0'});supersedes.batch.documents[0].supersedes_document_ids=['prior'];reject(supersedes,'source_snapshot_original_document_only');
});
test('claimless snapshot-only corrections cannot retire a previously accepted filing',()=>{
  const f=snapshot();f.batch.documents[0].amendment_status='complete';delete f.batch.documents[0].correction_scope;
  const base=build(f),next=snapshot();next.batch.manifest.batch_id='next';next.batch.manifest.base_release_id=base.manifest.release_id;
  const doc=next.batch.documents[0];doc.document_id='doc_002';doc.amendment_kind='restatement';doc.supersedes_document_ids=['doc_001'];doc.version='2';
  next.batch.claims=[];next.batch.evidence=[];next.batch.observations=[];next.batch.denominators=[];next.batch.coverage=[];
  next.sources=f.sources;next.review.document_decisions=[{batch_id:'next',document_id:'doc_002',decision:'accepted_for_model',rationale:'Even independent review cannot make nonexhaustive news a filing amendment.'}];
  const r=buildRelease({batches:[next.batch],registry:f.registry,sources:f.sources,review:next.review,base,fixtureMode:true});assert.deepEqual(r.canonical.active_claim_revision_ids,base.canonical.active_claim_revision_ids);assert.ok(!r.canonical.documents.some(d=>d.document_id==='doc_002'));
  next.batch.documents[0].amendment_status='complete';const inconsistent=buildRelease({batches:[next.batch],registry:f.registry,sources:f.sources,review:next.review,base,fixtureMode:true});assert.deepEqual(inconsistent.canonical.active_claim_revision_ids,base.canonical.active_claim_revision_ids);
});
test('snapshot-only observation and knowledge bounds remain mandatory',()=>{
  for(const [mutate,reason] of [
    [f=>{f.batch.documents[0].published_at='2025-07-22';},'document_after_knowledge_cutoff'],
    [f=>{f.batch.documents[0].amendment_checked_through='2025-07-22';},'source_snapshot_check_after_cutoff'],
    [f=>{f.batch.claims[0].observation_ids=[];},'source_snapshot_observation_required'],
    [f=>{f.batch.observations[0].retrieved_at='2025-07-22T10:00:00Z';f.batch.observations[0].recorded_at='2025-07-22T10:00:00Z';},'observation_after_knowledge_cutoff'],
    [f=>{f.batch.documents[0].published_at=null;},'unknown_publication_requires_observed_by'],
  ]){const f=snapshot();mutate(f);reject(f,reason);}
  const f=snapshot();Object.assign(f.batch.documents[0],{published_at:null,observed_by:'2025-07-21',publication_date_basis:'unknown_observed_by'});const r=build(f);assert.equal(r.projection.edges[0].evidence[0].published_at,null);assert.equal(r.projection.edges[0].evidence[0].observed_by,'2025-07-21');
});
test('news observation status cannot bypass source rights or admitted-document boundaries',()=>{
  const f=snapshot();f.sources.sources[0].rights.derived_publication.status='unknown';reject(f,'rights_derived_publication_blocked');
  const blocked=snapshot();blocked.sources.sources[0].admitted_document_ids=[];reject(blocked,'document_not_admitted');
});

test('inherited source snapshot claims retain correction uncertainty without a current validation result',()=>{
  const f=snapshot(),base=build(f),next=structuredClone(f.batch);next.manifest.batch_id='empty-next';next.manifest.base_release_id=base.manifest.release_id;
  for(const key of ['claims','documents','evidence','observations','denominators','coverage','gaps'])next[key]=[];
  const r=buildRelease({batches:[next],registry:f.registry,sources:f.sources,review:f.review,base,fixtureMode:true});
  assert.equal(r.validation.results.length,0);assert.ok(r.projection.edges[0].warnings.includes('correction_completeness_not_established:doc_001'));assert.equal(r.projection.edges[0].evidence[0].correction_scope,'nonexhaustive');
});
