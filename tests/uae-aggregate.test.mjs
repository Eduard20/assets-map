import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {fixture} from '../data-foundation/fixtures/synthetic.mjs';
import {buildRelease,hash,pretty,SOURCE_SNAPSHOT_QUALIFIER} from '../scripts/foundation/core.mjs';
import {projectUae,projectUaeReleases,loadUaeReleases,UAE_CANDIDATE_SCOPE} from '../scripts/export-uae.mjs';

// Wholly fictional records and example.test URLs, used only in temporary test
// bundles. Nothing in this module writes production inputs or public output.
function inputFor(key,count=1){
  const base=fixture();delete base.metric;
  const f=JSON.parse(JSON.stringify(base).replaceAll('synthetic://fixtures/','https://example.test/fixtures/').replace(/"(ent|sec|src|doc|per)_(\d+)"/g,(_,prefix,id)=>`"${prefix}_${key}_${id}"`));
  f.batch.manifest.batch_id=`batch-${key}`;f.batch.manifest.agent_id=`researcher-${key}`;
  f.review.reviewer='fictional-maintainer';f.review.reviewer_role='maintainer';f.review.review_id=`review-${key}`;
  f.review.publication={status:'approved',authorized_by:'fictional-test-owner',authorization_url:'https://example.test/test-authorization',intended_use:'noncommercial_research'};
  const claimTemplate=structuredClone(f.batch.claims[0]),evidenceTemplate=structuredClone(f.batch.evidence[0]),denominatorTemplate=structuredClone(f.batch.denominators[0]);
  f.registry.perimeters[0].basis='consolidated_group';f.sources.sources[0].allowed_predicates=['reported_group_interest'];
  f.batch.claims=[];f.batch.evidence=[];f.batch.denominators=[];f.review.decisions=[];
  for(let i=0;i<count;i++){
    const id=`candidate-${key}-${i}`,eid=`evidence-${key}-${i}`,did=`denominator-${key}-${i}`;
    f.batch.claims.push({...structuredClone(claimTemplate),candidate_id:id,assertion_key:id,predicate:'reported_group_interest',object_id:`ent_${key}_002`,position_scope_id:`scope-${i}`,primary_evidence_ids:[eid],evidence_ids:[eid],metrics:[{...claimTemplate.metrics[2],metric_id:`metric-${i}`,metric_type:'group_interest_percentage',value:'50.1',availability:'known',reason:null,denominator_id:did}],overlap_group_ids:['parent-chain-do-not-add'],qualifiers:['Fictional source-stated group interest, not direct title or an additive portfolio.']});
    f.batch.evidence.push({...structuredClone(evidenceTemplate),evidence_id:eid,source_record_key:`row-${i}`,supported_predicates:['reported_group_interest']});
    f.batch.denominators.push({...structuredClone(denominatorTemplate),denominator_id:did,kind:'reported_group_interest',value:null,availability:'unknown',unit:'percent',currency:null,security_ids:[],evidence_ids:[eid]});
    f.review.decisions.push({batch_id:f.batch.manifest.batch_id,candidate_id:id,decision:'accepted_for_model',rationale:'Fictional exact candidate acceptance for the test.'});
  }
  f.batch.observations[0].evidence_ids=f.batch.evidence.map(e=>e.evidence_id);f.batch.coverage[0].captured_source_rows=count;
  return {batches:[f.batch],registry:f.registry,sources:f.sources,review:f.review};
}
function entryFor(input,key){
  const release=buildRelease(input);
  return {releaseKey:key,input,approvedScope:input.batches[0].claims.map(c=>c.candidate_id),expectedReleaseId:release.manifest.release_id,expectedReviewId:release.manifest.review_id,bundleManifestSha256:hash(`fictional bundle ${key}`)};
}
function changeSubject(input,id,label){
  const old=input.batches[0].claims[0].subject_id;
  const changed=JSON.parse(JSON.stringify(input).replaceAll(old,id));
  if(label)changed.registry.entities.find(e=>e.entity_id===id).legal_name=label;
  return changed;
}
async function writeBundle(root,input,inputPath='input/',releaseKey='release-one'){
  const dir=path.join(root,inputPath);await mkdir(dir,{recursive:true});
  const files={'batch.json':input.batches[0],'registry.json':input.registry,'sources.json':input.sources,'review.json':input.review};
  const text=Object.fromEntries(Object.entries(files).map(([name,data])=>[name,pretty(data)]));
  const hashes=Object.fromEntries(Object.entries(text).map(([name,value])=>[name,hash(value)]));
  text['independent-review.json']=pretty({review_id:'independent-'+releaseKey,reviewer:'fictional-independent-reviewer',reviewer_role:'agent_review',decisions:input.review.decisions,document_decisions:input.review.document_decisions,reviewed_input_sha256:{batch:hashes['batch.json'],registry:hashes['registry.json'],sources:hashes['sources.json']}});
  text['release-decision.json']=pretty({authorization_url:input.review.publication.authorization_url,authorization_readback_verified:true,authorized_candidate_ids:input.batches[0].claims.map(c=>c.candidate_id),reviewed_input_sha256:hashes});
  const manifest=pretty({bundle_id:releaseKey,files:Object.fromEntries(Object.entries(text).map(([name,value])=>[name,hash(value)]))});
  await Promise.all(Object.entries({...text,'bundle-manifest.json':manifest}).map(([name,value])=>writeFile(path.join(dir,name),value)));
  const release=buildRelease(input);
  return {release_key:releaseKey,input_path:inputPath,approved_candidate_ids:input.batches[0].claims.map(c=>c.candidate_id),bundle_manifest_sha256:hash(manifest),release_id:release.manifest.release_id,review_id:release.manifest.review_id};
}
async function withBundle(callback){
  const dir=await mkdtemp(path.join(tmpdir(),'uae-aggregate-'));
  try{const entry=await writeBundle(dir,inputFor('a'));const manifest={schema_version:'1.0.0',releases:[entry]};const url=pathToFileURL(path.join(dir,'releases.json'));await writeFile(url,pretty(manifest));await callback({dir,entry,manifest,url});}finally{await rm(dir,{recursive:true,force:true});}
}

test('separate 30-claim releases make a complete 60-row inventory without weakening either foundation cap',()=>{
  const a=entryFor(inputFor('a',30),'first'),b=entryFor(inputFor('b',30),'second');
  const graph=projectUaeReleases([a,b]);assert.equal(graph.edges.length,60);assert.equal(graph.meta.releases.length,2);assert.equal(graph.meta.investorIds.length,2);
  assert.ok(graph.edges.every(e=>e.stakePercent===null&&e.valueUsd===null));assert.match(graph.meta.coverage,/60 selected/);
  assert.throws(()=>buildRelease({...a.input,batches:[a.input.batches[0],b.input.batches[0]]}),/Stale registry|Invalid approved universe/);
  const oversized=inputFor('too-many',31);assert.throws(()=>projectUaeReleases([{...a,input:oversized,approvedScope:oversized.batches[0].claims.map(c=>c.candidate_id)}]),/bounded to 30/);
});
test('aggregation is deterministic across input order and preserves release, date, perimeter and non-additive lineage',()=>{
  const a=entryFor(inputFor('a'),'first'),b=entryFor(inputFor('b'),'second');
  const graph=projectUaeReleases([b,a]);assert.equal(pretty(graph),pretty(projectUaeReleases([a,b])));
  for(const edge of graph.edges){
    assert.equal(edge.asOf,'2025-06-30');assert.equal(edge.disclosure.temporalKind,'snapshot');assert.equal(edge.disclosure.reportingPerimeterVersion,'1');
    assert.deepEqual(edge.disclosure.overlapGroupIds,['parent-chain-do-not-add']);
    assert.equal(edge.disclosure.releaseProvenance.length,1);assert.ok(graph.meta.releaseIds.includes(edge.disclosure.releaseProvenance[0].releaseId));
    assert.ok(edge.disclosure.evidence[0].document_id);assert.ok(edge.disclosure.evidence[0].evidence_id);
  }
});
test('identical accepted claims appear once with every separately pinned review provenance',()=>{
  const input=inputFor('a'),next=structuredClone(input);next.review.review_id='second-review';next.review.reviewed_at='2025-07-22T10:00:00Z';
  const graph=projectUaeReleases([entryFor(input,'first'),entryFor(next,'second')]);
  assert.equal(graph.edges.length,1);assert.equal(graph.sources.length,1);assert.equal(graph.edges[0].disclosure.releaseProvenance.length,2);assert.equal(graph.meta.reviewIds.length,2);
});
test('conflicting reviewed revisions of one claim family cannot silently pick a winner',()=>{
  const input=inputFor('a'),next=structuredClone(input);next.batches[0].claims[0].metrics[0].value='51';
  assert.throws(()=>projectUaeReleases([entryFor(input,'first'),entryFor(next,'second')]),/Conflicting UAE claim family ID/);
});
test('conflicting source document facts fail rather than choosing one source by release order',()=>{
  const input=inputFor('a'),next=structuredClone(input);next.batches[0].documents[0].publisher='Contradictory publisher';
  assert.throws(()=>projectUaeReleases([entryFor(input,'first'),entryFor(next,'second')]),/Conflicting UAE document ID/);
});
test('reviewed shared entity identity merges sources and benign summaries, not unrelated same-name entities',()=>{
  const first=inputFor('a'),second=changeSubject(inputFor('b'),'ent_a_002','Issuer B');
  const graph=projectUaeReleases([entryFor(first,'first'),entryFor(second,'second')]);
  const node=graph.nodes.find(n=>n.id==='ent_a_002');assert.equal(node.sourceIds.length,2);assert.equal(node.summaries.length,2);assert.equal(node.kind,'company');assert.ok(graph.meta.investorIds.includes(node.id));
  const unrelated=projectUaeReleases([entryFor(inputFor('a'),'first'),entryFor(inputFor('b'),'second')]);assert.equal(unrelated.nodes.filter(n=>n.label==='Investor A').length,2);
});
test('same entity ID with conflicting legal label or entity type is held',()=>{
  for(const kind of ['label','type']){
    const first=inputFor('a'),second=changeSubject(inputFor('b'),'ent_a_001',kind==='label'?'Different legal name':'Investor A');
    if(kind==='type')second.registry.entities.find(e=>e.entity_id==='ent_a_001').entity_type='reported_group';
    assert.throws(()=>projectUaeReleases([entryFor(first,'first'),entryFor(second,'second')]),/Conflicting UAE entity identity ID/);
  }
});
test('cross-release scoped identifiers cannot map one identity to two canonical entities',()=>{
  const first=inputFor('a'),second=inputFor('b');
  for(const input of [first,second])input.registry.entities[0].identifiers=[{namespace:'local_official',scope:'legal entity',value:'SAME-ID',valid_from:null,valid_to:null,evidence_url:'https://example.test/official-identity'}];
  assert.throws(()=>projectUaeReleases([entryFor(first,'first'),entryFor(second,'second')]),/Conflicting UAE scoped entity identifier/);
});
test('all source date fields survive the union without relabeling observed-by as publication',()=>{
  const input=inputFor('a'),batch=input.batches[0];Object.assign(batch.documents[0],{published_at:null,observed_by:'2025-07-21',publication_date_basis:'unknown_observed_by'});
  input.review.document_decisions=[{batch_id:batch.manifest.batch_id,document_id:batch.documents[0].document_id,decision:'accepted_for_model',rationale:'Fictional independently reviewed observation bound.'}];
  const graph=projectUaeReleases([entryFor(input,'first')]);
  assert.equal(graph.sources[0].publishedAt,null);assert.equal(graph.sources[0].observedBy,'2025-07-21');assert.equal(graph.sources[0].publicationDateBasis,'unknown_observed_by');
  assert.equal(graph.edges[0].disclosure.evidence[0].published_at,null);assert.equal(graph.edges[0].disclosure.evidence[0].publication_date_basis,'unknown_observed_by');
});
test('release/review pins, exact scope, publication hold and rights gates cannot be bypassed by aggregation',()=>{
  const first=entryFor(inputFor('a'),'first');
  for(const field of ['expectedReleaseId','expectedReviewId']){const entry=structuredClone(first);entry[field]='changed';assert.throws(()=>projectUaeReleases([entry]),/pin mismatch/);}
  const changed=structuredClone(first);changed.input.batches[0].claims[0].metrics[0].value='99';assert.throws(()=>projectUaeReleases([changed]),/pin mismatch/);
  const wrongScope=structuredClone(first);wrongScope.approvedScope=['not-approved'];assert.throws(()=>projectUaeReleases([wrongScope]),/exact approved claim set/);
  const held=inputFor('held');held.review.publication={...held.review.publication,status:'held',authorized_by:null,authorization_url:null};assert.throws(()=>projectUaeReleases([entryFor(held,'held')]),/publication is held/);
  const rights=inputFor('rights');rights.sources.sources[0].rights.derived_publication.status='unknown';assert.throws(()=>projectUaeReleases([entryFor(rights,'rights')]),/exact approved claim set/);
  assert.throws(()=>projectUaeReleases([first,first]),/Duplicate or invalid/);
  const duplicatedAssertion=inputFor('duplicates',2);duplicatedAssertion.batches[0].claims[1].assertion_key=duplicatedAssertion.batches[0].claims[0].assertion_key;
  assert.throws(()=>projectUaeReleases([entryFor(duplicatedAssertion,'duplicates')]),/exact approved claim set/);
});
test('manifest loader independently loads all pinned bundles and preserves arbitrary approved bounded scopes',async()=>{
  await withBundle(async({dir,manifest,url})=>{
    manifest.releases.push(await writeBundle(dir,inputFor('b'),'dubai/input/','dubai'));
    await writeFile(url,pretty(manifest));const entries=await loadUaeReleases(url);assert.equal(entries.length,2);
    const graph=projectUaeReleases(entries);assert.equal(graph.edges.length,2);assert.equal(graph.meta.investorIds.length,2);
  });
});
test('manifest pins reject an omitted review, changed bundle, changed release or broadened scope',async()=>{
  for(const mutate of [m=>{delete m.releases[0].review_id;},m=>{m.releases[0].bundle_manifest_sha256='0'.repeat(64);},m=>{m.releases[0].release_id='release_'+'0'.repeat(24);},m=>{m.releases[0].approved_candidate_ids.push('unreviewed');}]){
    await withBundle(async({manifest,url})=>{mutate(manifest);await writeFile(url,pretty(manifest));await assert.rejects(()=>loadUaeReleases(url),/fields|hash mismatch|pin mismatch|exact reviewed scope/);});
  }
});
test('manifest paths cannot escape, use file URLs or alias another release through a symlink',async()=>{
  for(const inputPath of ['../input/','/tmp/input/','https://example.test/input/','input/../input/']){
    await withBundle(async({manifest,url})=>{manifest.releases[0].input_path=inputPath;await writeFile(url,pretty(manifest));await assert.rejects(()=>loadUaeReleases(url),/input path/);});
  }
  await withBundle(async({dir,manifest,url})=>{await mkdir(path.join(dir,'alias'));await symlink(path.join(dir,'input'),path.join(dir,'alias','input'));manifest.releases[0].input_path='alias/input/';await writeFile(url,pretty(manifest));await assert.rejects(()=>loadUaeReleases(url),/without symlink aliases/);});
  await withBundle(async({dir,url})=>{const source=path.join(dir,'input','sources.json'),alias=path.join(dir,'aliased-source.json');await writeFile(alias,await readFile(source));await rm(source);await symlink(alias,source);await assert.rejects(()=>loadUaeReleases(url),/files must not use symlink aliases/);});
});
test('bundle changes cannot retain old manifest pins or reuse mismatched independent acceptance',async()=>{
  await withBundle(async({dir,url})=>{await writeFile(path.join(dir,'input','sources.json'),'{}');await assert.rejects(()=>loadUaeReleases(url),/hash mismatch/);});
  await withBundle(async({dir,manifest,url})=>{
    const root=path.join(dir,'input'),independent=JSON.parse(await readFile(path.join(root,'independent-review.json'),'utf8'));independent.reviewed_input_sha256.sources='0'.repeat(64);
    const bytes=pretty(independent);await writeFile(path.join(root,'independent-review.json'),bytes);
    const bundle=JSON.parse(await readFile(path.join(root,'bundle-manifest.json'),'utf8'));bundle.files['independent-review.json']=hash(bytes);const bundleBytes=pretty(bundle);await writeFile(path.join(root,'bundle-manifest.json'),bundleBytes);
    manifest.releases[0].bundle_manifest_sha256=hash(bundleBytes);await writeFile(url,pretty(manifest));await assert.rejects(()=>loadUaeReleases(url),/differs from independent acceptance/);
  });
});
test('legacy projectUae retains its exact initial-scope boundary',()=>{
  const input=inputFor('legacy'),candidate=UAE_CANDIDATE_SCOPE[0];
  input.batches[0].claims[0].candidate_id=candidate;input.batches[0].claims[0].assertion_key=candidate;input.review.decisions[0].candidate_id=candidate;
  assert.equal(projectUae(input,[candidate]).edges.length,1);
  assert.throws(()=>projectUae(input,['not-in-first-bundle']),/exact independently approved scope/);
});

function renamedAssertion(input,suffix){
  const next=structuredClone(input),batch=next.batches[0],old=batch.claims[0].candidate_id;
  batch.manifest.batch_id+='-'+suffix;batch.claims[0].candidate_id=old+'-'+suffix;batch.claims[0].assertion_key=old+'-'+suffix;
  next.review.review_id+='-'+suffix;next.review.decisions[0].batch_id=batch.manifest.batch_id;next.review.decisions[0].candidate_id=batch.claims[0].candidate_id;
  return next;
}
test('changing assertion and candidate IDs cannot admit contradictory percentages for the same source row',()=>{
  const a=inputFor('a'),b=renamedAssertion(a,'different');b.batches[0].claims[0].metrics[0].value='75';
  assert.throws(()=>projectUaeReleases([entryFor(a,'one'),entryFor(b,'two')]),/Conflicting UAE source-row economic assertion/);
});
test('same source row cannot acquire a different target or position scope across reviewed releases',()=>{
  for(const mutate of [c=>{c.object_id='ent_a_003';},c=>{c.position_scope_id='another-scope';}]){
    const a=inputFor('a'),b=renamedAssertion(a,'different');mutate(b.batches[0].claims[0]);
    assert.throws(()=>projectUaeReleases([entryFor(a,'one'),entryFor(b,'two')]),/Conflicting UAE source-row economic assertion/);
  }
});
test('identical economic disclosures under different assertion IDs deduplicate without losing their separate provenance',()=>{
  const a=inputFor('a'),b=renamedAssertion(a,'duplicate');b.batches[0].claims[0].metrics[0].value='50.10';b.batches[0].claims[0].qualifiers.push('Second independently accepted assertion.');
  const graph=projectUaeReleases([entryFor(b,'two'),entryFor(a,'one')]);assert.equal(graph.edges.length,1);assert.equal(graph.meta.inputClaimCount,2);assert.equal(graph.meta.duplicateAssertionCount,1);
  const edge=graph.edges[0];assert.equal(edge.disclosure.claimIds.length,2);assert.equal(edge.disclosure.claimRevisionIds.length,2);assert.equal(edge.disclosure.sourceAssertions.length,2);assert.equal(edge.disclosure.releaseProvenance.length,2);assert.ok(edge.disclosure.sourceAssertions.every(a=>a.reportDate==='2025-06-30'&&a.checkedThrough==='2025-07-21'&&a.reportingPerimeterId==='per_a_001'&&a.temporalKind==='snapshot'));
  assert.deepEqual(edge.disclosure.sourceAssertions.map(x=>x.metrics[0].value).sort(),['50.1','50.10']);assert.ok(edge.disclosure.caveats.includes('Second independently accepted assertion.'));
  assert.equal(pretty(graph),pretty(projectUaeReleases([entryFor(a,'one'),entryFor(b,'two')])));
});
test('different source rows cannot silently disagree on the same economic snapshot',()=>{
  const a=inputFor('a');let b=renamedAssertion(a,'independent');
  b=JSON.parse(JSON.stringify(b).replaceAll('doc_a_001','doc_a_second').replaceAll('evidence-a-0','evidence-a-second').replaceAll('denominator-a-0','denominator-a-second'));
  b.batches[0].evidence[0].source_record_key='another-row';b.batches[0].claims[0].metrics[0].value='75';
  assert.throws(()=>projectUaeReleases([entryFor(a,'one'),entryFor(b,'two')]),/Conflicting UAE same-scope economic assertion/);
});
test('reused canonical perimeter and security IDs cannot change semantic definition between releases',()=>{
  for(const mutate of [b=>{b.registry.perimeters[0].definition='Changed reporting membership';},b=>{b.registry.perimeters[0].included_entity_ids.push('ent_a_003');},b=>{b.registry.securities[0].issuer_id='ent_a_003';},b=>{b.registry.securities[0].share_class='Other class';}]){
    const a=inputFor('a'),b=renamedAssertion(a,'different');mutate(b);assert.throws(()=>projectUaeReleases([entryFor(a,'one'),entryFor(b,'two')]),/Conflicting UAE (perimeter|security) ID/);
  }
});
test('legal-entity roots remain neutral companies, never inferred sovereigns',()=>{
  const graph=projectUaeReleases([entryFor(inputFor('a'),'one'),entryFor(inputFor('b'),'two')]);
  assert.ok(graph.meta.investorIds.every(id=>graph.nodes.find(n=>n.id===id).kind==='company'));assert.ok(!graph.nodes.some(n=>n.kind==='sovereign'));
});
test('source-snapshot correction uncertainty survives public sources, claims, evidence and duplicate lineage',()=>{
  const input=inputFor('a'),batch=input.batches[0];input.sources.sources[0].source_kind='public_news';input.sources.sources[0].identifier_namespaces=['local_official'];
  Object.assign(batch.documents[0],{amendment_status:'source_snapshot_only',correction_scope:'nonexhaustive'});batch.claims[0].qualifiers.push(SOURCE_SNAPSHOT_QUALIFIER);
  input.review.document_decisions=[{batch_id:batch.manifest.batch_id,document_id:batch.documents[0].document_id,decision:'accepted_for_model',rationale:'Fictional exact news-snapshot review.'}];
  const graph=projectUaeReleases([entryFor(input,'one')]),d=graph.edges[0].disclosure;
  assert.equal(d.correctionStatus,'source_snapshot_only');assert.equal(d.correctionScope,'nonexhaustive');assert.equal(d.correctionCompleteness,'not_established');assert.equal(d.evidence[0].amendment_status,'source_snapshot_only');assert.equal(d.evidence[0].correction_scope,'nonexhaustive');assert.equal(graph.sources[0].correctionCompleteness,'not_established');
});
test('a snapshot-only denominator source conservatively marks the public disclosure even with strict primary evidence',()=>{
  const input=inputFor('a'),batch=input.batches[0];input.sources.sources[0].source_kind='public_news';input.sources.sources[0].identifier_namespaces=['local_official'];
  batch.documents.push({...structuredClone(batch.documents[0]),document_id:'support-news',document_family_id:'support-family',amendment_status:'source_snapshot_only',correction_scope:'nonexhaustive'});
  input.sources.sources[0].admitted_document_ids.push('support-news');
  batch.evidence.push({...structuredClone(batch.evidence[0]),evidence_id:'support-evidence',document_id:'support-news',source_record_key:'denominator-basis'});
  batch.observations.push({...structuredClone(batch.observations[0]),observation_id:'support-observation',document_id:'support-news',evidence_ids:['support-evidence']});
  batch.denominators[0].evidence_ids=['support-evidence'];batch.claims[0].observation_ids.push('support-observation');batch.claims[0].qualifiers.push(SOURCE_SNAPSHOT_QUALIFIER);
  input.review.document_decisions=[{batch_id:batch.manifest.batch_id,document_id:'support-news',decision:'accepted_for_model',rationale:'Independently reviewed nonexhaustive supporting news observation.'}];
  const graph=projectUaeReleases([entryFor(input,'one')]);assert.equal(graph.edges[0].disclosure.evidence[0].amendment_status,undefined);assert.equal(graph.edges[0].disclosure.correctionStatus,'source_snapshot_only');assert.equal(graph.edges[0].disclosure.correctionCompleteness,'not_established');
});
test('a maintainer cannot invent a missing independent document decision for snapshot publication',async()=>{
  await withBundle(async({dir,manifest,url})=>{
    const input=inputFor('a'),batch=input.batches[0];input.sources.sources[0].source_kind='public_news';input.sources.sources[0].identifier_namespaces=['local_official'];
    Object.assign(batch.documents[0],{amendment_status:'source_snapshot_only',correction_scope:'nonexhaustive'});batch.claims[0].qualifiers.push(SOURCE_SNAPSHOT_QUALIFIER);
    input.review.document_decisions=[{batch_id:batch.manifest.batch_id,document_id:batch.documents[0].document_id,decision:'accepted_for_model',rationale:'Fictional maintainer document decision.'}];
    manifest.releases=[await writeBundle(dir,input)];const root=path.join(dir,'input');
    const independent=JSON.parse(await readFile(path.join(root,'independent-review.json'),'utf8'));independent.document_decisions=[];const independentBytes=pretty(independent);await writeFile(path.join(root,'independent-review.json'),independentBytes);
    const bundle=JSON.parse(await readFile(path.join(root,'bundle-manifest.json'),'utf8'));bundle.files['independent-review.json']=hash(independentBytes);const bytes=pretty(bundle);await writeFile(path.join(root,'bundle-manifest.json'),bytes);manifest.releases[0].bundle_manifest_sha256=hash(bytes);await writeFile(url,pretty(manifest));
    await assert.rejects(()=>loadUaeReleases(url),/requires exact independent document acceptance/);
  });
});
