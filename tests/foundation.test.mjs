import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,mkdir,readdir,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fixture,clone} from '../data-foundation/fixtures/synthetic.mjs';
import {buildRelease,validateRegistry,aggregateDisclosedSubset,comparePerimeterSnapshots,percent,hash,canonicalJSON} from '../scripts/foundation/core.mjs';
import {validateSchema,schema} from '../scripts/foundation/schema.mjs';
import {stageBatch,writeRelease,readCurrent,readRelease,rollbackShadow} from '../scripts/foundation/store.mjs';
import {prepareSite,PUBLIC_FILES} from '../scripts/prepare-site.mjs';
const build=(f,opts={})=>buildRelease({batches:[f.batch],registry:f.registry,sources:f.sources,review:f.review,fixtureMode:true,...opts});
const addReview=(f,batch)=>f.review.decisions.push(...batch.claims.map(c=>({batch_id:batch.manifest.batch_id,candidate_id:c.candidate_id,decision:'accepted_for_model',rationale:'Synthetic independent review'})));
const reasons=r=>r.validation.results.flatMap(x=>x.reasons);
const temp=()=>mkdtemp(path.join(tmpdir(),'assets-foundation-'));

test('strict schema rejects malformed dates, unknown fields and wrong scalar types',()=>{
  const f=fixture();assert.deepEqual(validateSchema(f.batch,schema('batch')),[]);
  f.batch.claims[0].report_date='2025-02-30';assert.match(validateSchema(f.batch,schema('batch')).join(),/invalid date/);
  f.batch.claims[0].report_date='2025-06-30';f.batch.claims[0].unknown=true;assert.throws(()=>build(f),/additional property/);
});
test('synthetic fixtures cannot enter production validation',()=>assert.throws(()=>build(fixture(),{fixtureMode:false}),/official source URLs/));
test('source-specific unknown rights and raw identifier fields fail closed',()=>{
  const f=fixture();f.sources.sources[0].rights.derived_publication.status='unknown';const r=build(f);assert.equal(r.validation.counts.active_claims,0);assert.ok(reasons(r).includes('rights_derived_publication_blocked'));
  f.batch.claims[0].cusip='restricted';assert.throws(()=>build(f),/additional property/);
});
test('same-name entities are distinct; aliases never merge canonical identity',()=>{
  const f=fixture();f.registry.entities[1].legal_name=f.registry.entities[0].legal_name;const i=validateRegistry(f.registry,{fixtureMode:true});assert.equal(i.entities.size,5);
});
test('renamed entity keeps ID and dated name history',()=>{
  const f=fixture();f.registry.entities[0].aliases.push({name:'Old Investor Name',valid_from:'2000-01-01',valid_to:'2020-12-31'});f.registry.entities[0].legal_name='Renamed Investor';assert.equal(build(f).projection.nodes.find(n=>n.id==='ent_001').label,'Renamed Investor');
});
test('share classes remain separate; multiple listings reference one security',()=>{
  const f=fixture();f.registry.listings.push({...f.registry.listings[0],listing_id:'listing_002',exchange:'OTHER'});const i=validateRegistry(f.registry,{fixtureMode:true});assert.equal(i.securities.size,3);assert.equal(f.registry.listings.filter(l=>l.security_id==='sec_001').length,2);
  f.batch.denominators[0].security_ids=['sec_002'];assert.ok(reasons(build(f)).includes('denominator_security_mismatch'));
});
test('manager, fund and subsidiaries retain separate identities',()=>{
  const f=fixture();const c=f.batch.claims[0];c.subject_id='ent_005';c.reporting_perimeter_id='per_005';c.predicate='direct_equity_ownership';const r=build(f);assert.ok(reasons(r).includes('ownership_requires_own_account'));assert.equal(r.registry.entities.length,5);
});
test('conflicting identifiers quarantine the registry, including scoped dates',()=>{
  const f=fixture(),id={namespace:'cik',value:'1234',scope:'SEC filer',valid_from:null,valid_to:null,evidence_url:'synthetic://fixtures/id'};f.registry.entities[0].identifiers=[id];f.registry.entities[1].identifiers=[clone(id)];assert.throws(()=>build(f),/Identifier conflict/);
  f.registry.entities[0].identifiers[0].valid_to='2020-12-31';f.registry.entities[1].identifiers[0].valid_from='2021-01-01';assert.doesNotThrow(()=>build(f));
});
test('unresolved identity is not assigned a namesake',()=>{
  const f=fixture();f.batch.claims[0].object_id='sec_unresolved';assert.ok(reasons(build(f)).includes('security_identity_required'));
});
test('merge/split history is reversible and does not rewrite existing claim IDs',()=>{
  const f=fixture(),review=f.registry.entities[0].review;f.registry.identity_history=[{decision_id:'merge-1',action:'merge',from_ids:['ent_002'],to_ids:['ent_003'],reverses_decision_id:null,evidence_urls:['synthetic://fixtures/identity'],review},{decision_id:'reverse-1',action:'reverse',from_ids:['ent_003'],to_ids:['ent_002'],reverses_decision_id:'merge-1',evidence_urls:['synthetic://fixtures/identity-reversal'],review}];const r=build(f);assert.equal(r.canonical.claim_revisions[0].object_id,'sec_001');assert.equal(r.registry.identity_history.length,2);
});
test('independent agents proposing the same assertion and replay do not inflate holdings',()=>{
  const f=fixture(),b=clone(f.batch);b.manifest.batch_id='synthetic-batch-b';b.manifest.agent_id='agent-b';b.claims[0].candidate_id='other-candidate';addReview(f,b);
  const r=build(f,{batches:[f.batch,b]});assert.equal(r.validation.counts.active_claims,1);assert.equal(r.validation.counts.retained_revisions,1);assert.equal(r.validation.counts.duplicates,1);
  assert.equal(build(f,{batches:[b,f.batch]}).manifest.release_id,r.manifest.release_id);
  assert.equal(build(f,{batches:[f.batch,b],base:r}).manifest.release_id,r.manifest.release_id);
});
test('new observations do not create a new claim revision',()=>{
  const f=fixture(),first=build(f),b=clone(f.batch);b.manifest.batch_id='new-observation';b.manifest.base_release_id=first.manifest.release_id;b.observations[0].observation_id='obs_002';b.claims[0].observation_ids=['obs_002'];addReview(f,b);
  const r=build(f,{batches:[b],base:first});assert.equal(r.validation.counts.active_claims,1);assert.equal(r.validation.counts.retained_revisions,1);assert.equal(r.canonical.observations.length,2);
});
test('changed batch ID content and stale base/schema/registry are rejected',()=>{
  const f=fixture(),first=build(f),b=clone(f.batch);b.claims[0].metrics[0].value='11';assert.throws(()=>build(f,{batches:[b],base:first}),/reused with changed content/);
  b.manifest.batch_id='new';assert.throws(()=>build(f,{batches:[b],base:first}),/Stale base/);
  b.manifest.registry_version='old';assert.throws(()=>build(f,{batches:[b]}),/Stale registry/);
  b.manifest.schema_version='0.0';assert.throws(()=>build(f,{batches:[b]}),/invalid constant/);
});
test('immutable document changes and missing locators cannot pass',()=>{
  const f=fixture(),b=clone(f.batch);b.manifest.batch_id='b';b.documents[0].published_at='2025-07-19';assert.throws(()=>build(f,{batches:[f.batch,b]}),/Immutable document_id changed/);
  f.batch.evidence[0].locator='';assert.throws(()=>build(f),/empty string/);
});
test('unknown stakes are null; known zero stays zero; invalid coercion quarantines',()=>{
  const f=fixture(),m=f.batch.claims[0].metrics[2];m.value=null;m.availability='unknown';m.reason='not disclosed';f.batch.denominators[0].value=null;f.batch.denominators[0].availability='unknown';const r=build(f);assert.equal(r.projection.edges[0].stakePercent,null);assert.equal(r.canonical.claim_revisions[0].metrics.find(m=>m.metric_type==='equity_percentage').value,null);
  m.value='0';assert.ok(reasons(build(f)).includes('null_availability_mismatch'));
  m.availability='known';f.batch.denominators[0].value='100';f.batch.denominators[0].availability='known';assert.equal(build(f).projection.edges[0].stakePercent,'0');
});
test('manager discretion cannot turn into ownership, votes or inferred control',()=>{
  const f=fixture();f.batch.evidence[0].supported_predicates=['managed_holding'];assert.ok(reasons(build(f)).includes('evidence_predicate_mismatch'));
  f.batch.claims[0].metrics[2].metric_type='voting_percentage';assert.ok(reasons(build(f)).includes('voting_metric_requires_voting_claim'));
});
test('source percentages with unresolved/mismatched-date denominators remain non-comparable',()=>{
  const f=fixture();f.batch.denominators[0].as_of_date='2025-06-01';const r=build(f);assert.equal(r.projection.edges[0].stakePercent,null);assert.ok(r.validation.results[0].warnings.some(x=>x.startsWith('non_comparable_percentage')));
});
test('zero denominator, target allocation and unsupported complete coverage fail',()=>{
  const f=fixture();f.batch.denominators[0].value='0';assert.ok(reasons(build(f)).includes('non_positive_denominator'));f.batch.denominators[0].value='100';f.batch.claims[0].metrics[1].measurement_basis='target_allocation';assert.ok(reasons(build(f)).includes('target_is_not_observation'));
  f.batch.coverage[0].status='complete_for_declared_scope';assert.throws(()=>build(f),/Unsupported complete coverage/);
});
test('independent conflicting same-scope claims remain retained but both are quarantined',()=>{
  const f=fixture(),b=clone(f.batch);b.manifest.batch_id='different-assertion';b.claims[0].assertion_key='independent source claim';b.claims[0].metrics[0].value='11';addReview(f,b);const r=build(f,{batches:[f.batch,b]});assert.equal(r.validation.counts.active_claims,0);assert.equal(r.validation.counts.retained_revisions,2);assert.equal(r.validation.counts.quarantined,2);
});
function correction(f,first) {
  const b=clone(f.batch);b.manifest.batch_id='correction';b.manifest.base_release_id=first.manifest.release_id;b.documents[0].document_id='doc_002';b.documents[0].version='2';b.documents[0].amendment_kind='partial';b.documents[0].supersedes_document_ids=['doc_001'];b.evidence[0].evidence_id='ev_002';b.evidence[0].document_id='doc_002';b.observations[0].observation_id='obs_002';b.observations[0].document_id='doc_002';b.observations[0].evidence_ids=['ev_002'];b.claims[0].primary_evidence_ids=['ev_002'];b.claims[0].evidence_ids=['ev_002'];b.claims[0].observation_ids=['obs_002','obs_001'];b.claims[0].metrics[0].value='12';b.claims[0].supersedes_claim_revision_ids=first.canonical.active_claim_revision_ids;b.claims[0].correction_kind='partial';b.claims[0].correction_reason='Fictional partial correction';addReview(f,b);return b;
}
test('partial amendment appends immutable revision; base and prior output stay reproducible',()=>{
  const f=fixture();f.sources.sources[0].admitted_document_ids.push('doc_002');const first=build(f),before=canonicalJSON(first),b=correction(f,first),r=build(f,{batches:[b],base:first});assert.equal(r.validation.counts.active_claims,1);assert.equal(r.canonical.claim_revisions.length,2);assert.equal(r.canonical.claim_families.length,1);assert.equal(canonicalJSON(first),before);assert.notEqual(r.canonical.active_claim_revision_ids[0],first.canonical.active_claim_revision_ids[0]);
});
test('unexplained revision overwrite and additive replacement are blocked',()=>{
  const f=fixture();f.sources.sources[0].admitted_document_ids.push('doc_002');const first=build(f),b=correction(f,first);b.claims[0].correction_kind='addition';assert.ok(reasons(build(f,{batches:[b],base:first})).includes('addition_cannot_replace'));
});
test('subset arithmetic uses exact decimals, revision lineage and Unclassified bucket',()=>{
  const r=build(fixture()),a=aggregateDisclosedSubset(r,r.canonical.active_claim_revision_ids);assert.equal(a.denominator.value,'100');assert.equal(a.industry_allocation[0].label,'Unclassified');assert.equal(a.positions[0].percent_of_selected_disclosed_value,'100.000000');assert.deepEqual(a.claim_revision_ids,r.canonical.active_claim_revision_ids);assert.equal(a.denominator.whole_portfolio_coverage,null);assert.equal(percent('0.1','0.3'),'33.333333');assert.throws(()=>percent('0','0'),/positive/);
});
test('mixed manager/fund, currencies, dates and overlap cannot silently aggregate',()=>{
  const r=build(fixture()),c=clone(r.canonical.claim_revisions[0]);c.claim_revision_id='clmrev_other';c.object_id='sec_003';c.metrics=c.metrics.filter(m=>m.metric_type==='reported_value');r.canonical.claim_revisions.push(c);r.canonical.active_claim_revision_ids.push(c.claim_revision_id);
  c.subject_id='ent_005';assert.throws(()=>aggregateDisclosedSubset(r,r.canonical.active_claim_revision_ids),/Mixed roles/);c.subject_id='ent_001';c.metrics[0].currency='EUR';assert.throws(()=>aggregateDisclosedSubset(r,r.canonical.active_claim_revision_ids),/Mixed currencies/);c.metrics[0].currency='USD';c.report_date='2025-03-31';assert.throws(()=>aggregateDisclosedSubset(r,r.canonical.active_claim_revision_ids),/Mixed roles/);c.report_date='2025-06-30';c.overlap_group_ids=['same'];r.canonical.claim_revisions[0].overlap_group_ids=['same'];assert.throws(()=>aggregateDisclosedSubset(r,r.canonical.active_claim_revision_ids),/Overlapping/);
});
test('reporting perimeter changes never imply a disposal',()=>{
  const f=fixture(),a=f.batch.claims[0],b=clone(a);b.reporting_perimeter_version='2';assert.throws(()=>comparePerimeterSnapshots(a,b,f.registry),/not an economic disposal/);b.reporting_perimeter_version='1';assert.equal(comparePerimeterSnapshots(a,b,f.registry).trade_inference_allowed,false);
});
test('staging is idempotent, immutable and path-safe',async()=>{
  const root=await temp(),f=fixture();assert.equal((await stageBatch(root,f.batch)).replayed,false);assert.equal((await stageBatch(root,f.batch)).replayed,true);f.batch.claims[0].metrics[0].value='12';await assert.rejects(()=>stageBatch(root,f.batch),/different content/);f.batch.manifest.batch_id='../bad';await assert.rejects(()=>stageBatch(root,f.batch),/Unsafe batch/);
});
test('atomic write failure preserves current pointer; retry and rollback preserve all releases',async()=>{
  const root=await temp(),f=fixture();f.sources.sources[0].admitted_document_ids.push('doc_002');const first=build(f);await writeRelease(root,first);const b=correction(f,first),second=build(f,{batches:[b],base:first});
  await assert.rejects(()=>writeRelease(root,second,{expectedReleaseId:first.manifest.release_id,failAt:'before_pointer'}),/Injected failure/);assert.equal((await readCurrent(root)).manifest.release_id,first.manifest.release_id);
  await writeRelease(root,second,{expectedReleaseId:first.manifest.release_id});assert.equal((await readCurrent(root)).manifest.release_id,second.manifest.release_id);
  await rollbackShadow(root,first.manifest.release_id,{expectedReleaseId:second.manifest.release_id});assert.equal((await readCurrent(root)).manifest.release_id,first.manifest.release_id);assert.equal((await readRelease(root,second.manifest.release_id)).manifest.release_id,second.manifest.release_id);
});
test('failure before directory rename and stale publication cannot partially publish',async()=>{
  const root=await temp(),r=build(fixture());await assert.rejects(()=>writeRelease(root,r,{failAt:'after_files'}),/Injected failure/);assert.equal(await readCurrent(root),null);await assert.rejects(()=>writeRelease(root,r,{expectedReleaseId:'unexpected'}),/stale expected/);await writeRelease(root,r);await writeFile(path.join(root,'releases',r.manifest.release_id,'shadow-graph.json'),'tampered');await assert.rejects(()=>readCurrent(root),/integrity failure/);
});
test('live 17/12 sample is preserved, migration inventory pins exact bytes',async()=>{
  const bytes=await readFile(new URL('../data/graph.json',import.meta.url),'utf8'),inventory=JSON.parse(await readFile(new URL('../data-foundation/legacy-inventory.json',import.meta.url),'utf8'));assert.equal(hash(bytes),inventory.legacy_graph_sha256);assert.equal(inventory.nodes.length,17);assert.equal(inventory.edges.length,12);assert.ok(inventory.nodes.every(n=>n.canonical_entity_id===null));
});
test('deployment allowlist cannot leak canonical, staging, raw or unexpected data files',async()=>{
  const root=await temp();for(const file of PUBLIC_FILES){await mkdir(path.dirname(path.join(root,file)),{recursive:true});await writeFile(path.join(root,file),'public');}await writeFile(path.join(root,'data','private.json'),'secret');const out=await temp();const files=await prepareSite(out,root);assert.equal(files.length,PUBLIC_FILES.length+1);assert.deepEqual((await readdir(path.join(out,'data'))).sort(),['berkshire-2026-06-30.json','blackrock-2026-06-30.json','cpp-2026-06-30.json','geode-2026-06-30.json','goldmansachs-2026-06-30.json','graph.json','instrument-equivalence.json','jpmorgan-2026-06-30.json','morganstanley-2026-06-30.json','nbim-equities-2026-06-30.json','norgesbank-2026-06-30.json','nps-2026-06-30.json','pif-2026-06-30.json','portfolios.json','researched.json','snb-2026-06-30.json','statestreet-2026-06-30.json','uae.json','vanguardglobaladvisers-2026-06-30.json']);await assert.rejects(()=>prepareSite(out,root),/must be empty/);
});
test('an incomplete amendment check cannot pass by claiming a recent checked-through date',()=>{
  const f=fixture();f.batch.documents[0].amendment_status='incomplete';const r=build(f);assert.equal(r.validation.counts.active_claims,0);assert.ok(reasons(r).includes('amendment_chain_incomplete_as_of_cutoff'));assert.equal(r.canonical.evidence.length,0);assert.equal(r.canonical.documents.length,0);
});
test('unreviewed identity metadata never becomes an admitted claim',()=>{
  const f=fixture();f.registry.entities[0].review.status='proposed';assert.ok(reasons(build(f)).includes('identity_or_perimeter_review_required'));
});
test('full restatement removes omitted source rows but preserves immutable history without zeros',()=>{
  const f=fixture();f.sources.sources[0].admitted_document_ids.push('doc_002');const first=build(f),b=clone(f.batch);b.manifest.batch_id='restatement';b.manifest.base_release_id=first.manifest.release_id;b.claims=[];b.documents=[{...b.documents[0],document_id:'doc_002',version:'2',amendment_kind:'restatement',supersedes_document_ids:['doc_001']}];b.evidence=[];b.observations=[];b.denominators=[];b.coverage=[];
  f.review.document_decisions.push({batch_id:'restatement',document_id:'doc_002',decision:'accepted_for_model',rationale:'Synthetic complete source replacement reviewed'});
  const r=build(f,{batches:[b],base:first});assert.equal(r.validation.counts.active_claims,0);assert.equal(r.canonical.claim_revisions.length,1);assert.equal(r.canonical.claim_revisions[0].metrics[0].value,'10');assert.ok(reasons(r).includes('restated_source_row_omitted'));assert.equal(r.canonical.documents.length,2);
});
test('additive amendment adds only a new scoped row and retains original active position',()=>{
  const f=fixture();f.sources.sources[0].admitted_document_ids.push('doc_002');const first=build(f),b=correction(f,first);b.documents[0].amendment_kind='addition';b.claims[0].candidate_id='addition';b.claims[0].assertion_key='new independent selected position';b.claims[0].object_id='sec_003';b.claims[0].correction_kind='addition';b.claims[0].supersedes_claim_revision_ids=[];b.claims[0].metrics=b.claims[0].metrics.filter(m=>m.metric_type!=='equity_percentage');b.claims[0].observation_ids=['obs_002'];b.denominators=[];addReview(f,b);const r=build(f,{batches:[b],base:first});assert.equal(r.validation.counts.active_claims,2);assert.equal(r.canonical.claim_revisions.length,2);
});
test('schema rejects inherited-key escape attempts',()=>{
  for(const key of ['constructor','__proto__','toString']){const f=fixture();Object.defineProperty(f.batch.claims[0],key,{value:'not allowed',enumerable:true});assert.throws(()=>build(f),/additional property/);}
});
test('blocked transitive denominator evidence cannot be laundered into an accepted claim',()=>{
  const f=fixture(),source=clone(f.sources.sources[0]);source.source_id='src_blocked';source.admission.status='blocked';source.rights.derived_publication.status='blocked';source.admitted_document_ids=[];f.sources.sources.push(source);
  f.batch.documents.push({...f.batch.documents[0],document_id:'doc_blocked',source_id:source.source_id,amendment_status:'incomplete'});f.batch.evidence.push({...f.batch.evidence[0],evidence_id:'ev_blocked',document_id:'doc_blocked'});f.batch.denominators[0].evidence_ids=['ev_blocked'];
  const r=build(f);assert.equal(r.validation.counts.active_claims,0);assert.ok(reasons(r).includes('rights_derived_publication_blocked'));assert.equal(r.canonical.evidence.length,0);
});
test('denominator units and ambiguous metric types cannot be silently selected',()=>{
  const f=fixture();f.batch.denominators[0].unit='USD';f.batch.denominators[0].currency='USD';assert.ok(reasons(build(f)).includes('denominator_unit_mismatch'));f.batch.denominators[0].unit='shares';f.batch.denominators[0].currency=null;f.batch.claims[0].metrics.push({...f.batch.claims[0].metrics[2],metric_id:'metric_other',value:'90'});assert.ok(reasons(build(f)).includes('ambiguous_metric_type'));
});
test('perimeter validity and unreferenced future observations are enforced',()=>{
  const f=fixture();f.registry.perimeters[0].valid_to='2020-01-01';assert.ok(reasons(build(f)).includes('reporting_perimeter_outside_validity'));f.registry.perimeters[0].valid_to=null;f.batch.observations.push({...f.batch.observations[0],observation_id:'obs_future',retrieved_at:'2026-01-01T00:00:00Z',recorded_at:'2026-01-01T00:00:00Z'});const r=build(f);assert.equal(r.validation.counts.active_claims,1);assert.equal(r.canonical.observations.length,1);
});
test('conflicting source row identity quarantines all mappings independent of input order',()=>{
  const f=fixture(),b=clone(f.batch);b.manifest.batch_id='other';b.claims[0].candidate_id='other';b.claims[0].object_id='sec_003';b.claims[0].metrics=b.claims[0].metrics.filter(m=>m.metric_type!=='equity_percentage');addReview(f,b);
  const r=build(f,{batches:[f.batch,b]});assert.equal(r.validation.counts.active_claims,0);assert.equal(r.validation.counts.quarantined,2);assert.equal(build(f,{batches:[b,f.batch]}).manifest.release_id,r.manifest.release_id);
});
test('claimless restatement requires independent document review and valid knowledge time',()=>{
  const f=fixture();f.sources.sources[0].admitted_document_ids.push('doc_002');const first=build(f),b=clone(f.batch);b.manifest.batch_id='restatement';b.manifest.base_release_id=first.manifest.release_id;b.claims=[];b.documents=[{...b.documents[0],document_id:'doc_002',version:'2',amendment_kind:'restatement',supersedes_document_ids:['doc_001'],published_at:'2026-01-01'}];b.evidence=[];b.observations=[];b.denominators=[];b.coverage=[];
  assert.equal(build(f,{batches:[b],base:first}).validation.counts.active_claims,1);f.review.document_decisions.push({batch_id:'restatement',document_id:'doc_002',decision:'accepted_for_model',rationale:'Synthetic reviewer'});assert.equal(build(f,{batches:[b],base:first}).validation.counts.active_claims,1);
});
test('batch-local gap blockers cannot quarantine another agent with the same candidate ID',()=>{
  const f=fixture(),b=clone(f.batch);b.manifest.batch_id='b';b.gaps=[{gap_id:'only-b-gap',category:'identity',description:'Only this candidate is unresolved',source_urls:[],blocks_claim_candidate_ids:['candidate_001']}];addReview(f,b);const r=build(f,{batches:[f.batch,b]});assert.equal(r.validation.counts.active_claims,1);assert.equal(r.validation.results.find(r=>r.batch_id===f.batch.manifest.batch_id).status,'accepted');assert.equal(r.validation.results.find(r=>r.batch_id==='b').status,'quarantined');
});
test('equivalent exact decimal strings do not create a factual conflict',()=>{
  const f=fixture(),b=clone(f.batch);b.manifest.batch_id='b';b.claims[0].assertion_key='independent equivalent statement';b.claims[0].metrics[0].value='10.0';addReview(f,b);const r=build(f,{batches:[f.batch,b]});assert.equal(r.validation.counts.active_claims,1);assert.equal(r.validation.counts.quarantined,0);assert.ok(r.canonical.claim_revisions.some(c=>c.metrics[0].value==='10.0'));
});
test('dot-segment batch IDs and symlink aliases cannot escape storage boundaries',async()=>{
  const f=fixture(),root=await temp();for(const id of ['.','..']){f.batch.manifest.batch_id=id;await assert.rejects(()=>stageBatch(root,f.batch),/Unsafe batch/);}
  const alias=path.join(root,'public-alias');await symlink(new URL('../data',import.meta.url).pathname,alias);await assert.rejects(()=>stageBatch(alias,fixture().batch),/public application path/);
});
test('leftover temporary paths do not prevent retry and missing integrity entries fail closed',async()=>{
  const root=await temp(),r=build(fixture());await mkdir(path.join(root,'releases',`.tmp-${r.manifest.release_id}`),{recursive:true});await writeFile(path.join(root,'releases',`.tmp-${r.manifest.release_id}`,'partial'),'leftover');await writeRelease(root,r);assert.equal((await readCurrent(root)).manifest.release_id,r.manifest.release_id);
  const dir=path.join(root,'releases',r.manifest.release_id),integrity=JSON.parse(await readFile(path.join(dir,'integrity.json'),'utf8'));delete integrity.files['shadow-graph.json'];await writeFile(path.join(dir,'integrity.json'),JSON.stringify(integrity));await writeFile(path.join(dir,'shadow-graph.json'),'tampered');await assert.rejects(()=>readCurrent(root),/incomplete artifact set/);
});
test('site allowlist refuses symlinked files and ancestors',async()=>{
  const root=await temp();for(const file of PUBLIC_FILES){await mkdir(path.dirname(path.join(root,file)),{recursive:true});if(file!=='data/graph.json')await writeFile(path.join(root,file),'public');}const privateFile=path.join(root,'private.json');await writeFile(privateFile,'private canonical data');await symlink(privateFile,path.join(root,'data/graph.json'));const out=await temp();await assert.rejects(()=>prepareSite(out,root),/symlink/);
});
test('inherited releases cannot silently expand noncommercial rights to commercial use',()=>{
  const f=fixture(),first=build(f),b=clone(f.batch);b.manifest.batch_id='next';b.manifest.base_release_id=first.manifest.release_id;b.claims=[];f.review.publication.intended_use='commercial';assert.throws(()=>build(f,{batches:[b],base:first}),/Intended-use changes require/);
});
test('an empty subsequent batch preserves material warnings on inherited active claims',()=>{
  const f=fixture();f.batch.denominators[0].as_of_date='2025-06-01';const first=build(f),b=clone(f.batch);b.manifest.batch_id='next';b.manifest.base_release_id=first.manifest.release_id;b.claims=[];const second=build(f,{batches:[b],base:first});assert.deepEqual(second.projection.edges[0].warnings,first.projection.edges[0].warnings);assert.ok(second.projection.edges[0].warnings[0].startsWith('non_comparable_percentage'));
});
test('new unadmitted coverage cannot attach blocked evidence to an inherited claim',()=>{
  const f=fixture(),source=clone(f.sources.sources[0]);source.source_id='blocked';source.admission.status='blocked';source.rights.derived_publication.status='blocked';source.admitted_document_ids=[];f.sources.sources.push(source);const first=build(f),b=clone(f.batch);b.manifest.batch_id='coverage-injection';b.manifest.base_release_id=first.manifest.release_id;b.claims=[];b.denominators=[];b.observations=[];b.documents=[{...b.documents[0],document_id:'doc_blocked',source_id:'blocked',amendment_status:'incomplete'}];b.evidence=[{...b.evidence[0],evidence_id:'ev_blocked',document_id:'doc_blocked'}];b.coverage=[{...b.coverage[0],coverage_id:'cov_blocked',status:'complete_for_declared_scope',expected_source_rows:1,captured_source_rows:1,count_evidence_ids:['ev_blocked']}];
  const r=build(f,{batches:[b],base:first});assert.equal(r.validation.counts.active_claims,1);assert.ok(!r.canonical.coverage.some(c=>c.coverage_id==='cov_blocked'));assert.ok(!r.canonical.evidence.some(e=>e.evidence_id==='ev_blocked'));assert.ok(!r.canonical.documents.some(d=>d.document_id==='doc_blocked'));
});
