import {createHash} from 'node:crypto';
import {assertSchema} from './schema.mjs';
export const SCHEMA_VERSION = '1.0.0';
export const GENERATOR_VERSION = 'foundation-1.0.0';
export const canonicalJSON = value => JSON.stringify(sortKeys(value));
function sortKeys(v) { return Array.isArray(v) ? v.map(sortKeys) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k,sortKeys(v[k])])) : v; }
export const hash = value => createHash('sha256').update(typeof value === 'string' ? value : canonicalJSON(value)).digest('hex');
export const idFor = (prefix,value) => `${prefix}_${hash(value).slice(0,24)}`;
export const pretty = value => JSON.stringify(sortKeys(value),null,2)+'\n';
const sorted = (rows,key) => [...rows].sort((a,b) => a[key].localeCompare(b[key],'en'));
const unique = v => [...new Set(v)].sort();
const allowed = right => right?.status === 'allowed' || (right?.status === 'conditional' && right.conditions_satisfied);
const HTTP = /^https:\/\//;
function checkUrl(url, fixtureMode = false) { return HTTP.test(url) || (fixtureMode && url.startsWith('synthetic://')); }
function indexUnique(rows,key,label) {
  const index = new Map();
  for (const row of rows) { if(index.has(row[key])) throw new Error(`Duplicate ${label}: ${row[key]}`); index.set(row[key],row); }
  return index;
}
function requireValid(condition,message) { if(!condition) throw new Error(message); }
function rejectRestrictedData(value) {
  // Restricted identifier namespaces cannot appear even as added schema fields.
  // Source references may link to a filing; no raw source payloads are accepted.
  const visit = (v,path='$') => {
    if(v && typeof v === 'object') for (const [k,x] of Object.entries(v)) {
      if (/cusip|isin|raw_content|raw_document|excerpt|api_key|password/i.test(k)) throw new Error(`Restricted/raw field ${path}.${k}`);
      if (k === 'namespace' && /cusip|isin/i.test(String(x))) throw new Error(`Restricted identifier at ${path}`);
      visit(x,`${path}.${k}`);
    }
  }; visit(value);
}
function datesOverlap(a,b) { return (a.valid_from ?? '0000') <= (b.valid_to ?? '9999') && (b.valid_from ?? '0000') <= (a.valid_to ?? '9999'); }
export function validateRegistry(registry,{fixtureMode=false}={}) {
  assertSchema(registry,'registry'); rejectRestrictedData(registry);
  const entities=indexUnique(registry.entities,'entity_id','entity'), securities=indexUnique(registry.securities,'security_id','security');
  const perimeters=indexUnique(registry.perimeters.map(p=>({...p,key:`${p.reporting_perimeter_id}@${p.version}`})),'key','perimeter');
  indexUnique(registry.listings,'listing_id','listing');
  const identifiers=new Map();
  for(const row of [...registry.entities,...registry.securities]) {
    const id=row.entity_id??row.security_id;
    requireValid(row.source_urls.length>0 && row.source_urls.every(u=>checkUrl(u,fixtureMode)),`Identity ${id} needs official source URLs`);
    if(row.security_id) requireValid(entities.has(row.issuer_id),`Unknown issuer ${row.issuer_id}`);
    for(const ident of row.identifiers) {
      requireValid(checkUrl(ident.evidence_url,fixtureMode),`Invalid identity evidence URL ${id}`);
      requireValid(!ident.valid_from || !ident.valid_to || ident.valid_from<=ident.valid_to,`Invalid identity interval ${id}`);
      const key=canonicalJSON([ident.namespace,ident.value,ident.scope]);
      for(const previous of identifiers.get(key)??[]) requireValid(previous.id===id||!datesOverlap(previous.ident,ident),`Identifier conflict: ${id} and ${previous.id}`);
      identifiers.set(key,[...(identifiers.get(key)??[]),{id,ident}]);
    }
  }
  for(const listing of registry.listings) requireValid(securities.has(listing.security_id)&&checkUrl(listing.evidence_url,fixtureMode),`Invalid listing ${listing.listing_id}`);
  for(const p of registry.perimeters) {
    requireValid(entities.has(p.reporting_entity_id),`Unknown reporting entity ${p.reporting_entity_id}`);
    requireValid([...p.included_entity_ids,...p.excluded_entity_ids].every(x=>entities.has(x)),`Unknown perimeter member ${p.reporting_perimeter_id}`);
    requireValid(p.source_urls.length>0&&p.source_urls.every(u=>checkUrl(u,fixtureMode)),`Missing perimeter evidence ${p.reporting_perimeter_id}`);
    requireValid(!p.included_entity_ids.some(x=>p.excluded_entity_ids.includes(x)),`Contradictory perimeter ${p.reporting_perimeter_id}`);
  }
  const decisions=indexUnique(registry.identity_history,'decision_id','identity decision');
  for(const d of decisions.values()) {
    requireValid(d.evidence_urls.length>0&&d.evidence_urls.every(u=>checkUrl(u,fixtureMode)),`Identity decision ${d.decision_id} needs evidence`);
    requireValid([...d.from_ids,...d.to_ids].every(x=>entities.has(x)||securities.has(x)),`Unknown identity history target ${d.decision_id}`);
    if(d.action==='reverse') requireValid(decisions.has(d.reverses_decision_id)&&d.reverses_decision_id!==d.decision_id,`Invalid reversal ${d.decision_id}`);
    // History is audit-only. It never silently rewrites claims or source identities.
  }
  indexUnique(registry.scope_transitions,'transition_id','scope transition');
  for(const t of registry.scope_transitions) requireValid(perimeters.has(`${t.from_perimeter_id}@${t.from_version}`)&&perimeters.has(`${t.to_perimeter_id}@${t.to_version}`)&&t.evidence_urls.length>0,`Invalid scope transition ${t.transition_id}`);
  return {entities,securities,perimeters};
}
function mergeRecords(previous,incoming,key) {
  const map=new Map(previous.map(x=>[x[key],x]));
  for(const row of incoming) {
    const old=map.get(row[key]);
    requireValid(!old||canonicalJSON(old)===canonicalJSON(row),`Immutable ${key} changed: ${row[key]}`);
    map.set(row[key],row);
  }
  return sorted([...map.values()],key);
}
function rational(decimal) {
  const [whole,fraction='']=decimal.split('.'); return [BigInt(whole+fraction),10n**BigInt(fraction.length)];
}
export function percent(n,d,places=6) {
  const [nv,ns]=rational(n),[dv,ds]=rational(d);
  requireValid(dv>0n,'Denominator must be positive');
  const scale=10n**BigInt(places); const top=nv*ds*100n*scale; const bottom=dv*ns;
  const rounded=(top+bottom/2n)/bottom;
  return `${rounded/scale}.${(rounded%scale).toString().padStart(places,'0')}`;
}
function decimalSum(values) {
  const parts=values.map(rational); const scale=parts.reduce((a,[,s])=>s>a?s:a,1n); const n=parts.reduce((a,[v,s])=>a+v*(scale/s),0n);
  const digits=scale.toString().length-1; return digits ? `${n/scale}.${(n%scale).toString().padStart(digits,'0')}` : n.toString();
}
function normalizedDecimal(value) {if(value===null)return null;const v=value.includes('.')?value.replace(/0+$/,'').replace(/\.$/,''):value;return v==='-0'?'0':v;}
function semanticMetric(m) { const {metric_id,...value}=m; return {...value,value:normalizedDecimal(value.value)}; }
function economicKey(c) {return canonicalJSON([c.subject_id,c.predicate,c.object_id,c.report_date,c.reporting_perimeter_id,c.reporting_perimeter_version,c.position_scope_id]);}
function metricSignature(c) {return canonicalJSON(c.metrics.map(semanticMetric).sort((a,b)=>a.metric_type.localeCompare(b.metric_type)));}
function revisionBody(c,sourceFamilies) {
  const {candidate_id,observation_ids,...body}=c;
  return {...body,evidence_ids:unique(body.evidence_ids),overlap_group_ids:unique(body.overlap_group_ids),supersedes_claim_revision_ids:unique(body.supersedes_claim_revision_ids),source_family_ids:sourceFamilies,metrics:sorted(body.metrics,'metric_id')};
}
function claimFamily(c,sourceFamilies) { return idFor('clm',[sourceFamilies,c.assertion_key,c.subject_id,c.predicate,c.object_id,c.report_date,c.reporting_perimeter_id,c.reporting_perimeter_version,c.position_scope_id]); }
export function buildRelease({batches,registry,sources,review,base=null,fixtureMode=false}) {
  requireValid(!fixtureMode||review.publication.status==='held','Synthetic fixture release must remain held');
  const identity=validateRegistry(registry,{fixtureMode});
  assertSchema(sources,'sources'); assertSchema(review,'review'); rejectRestrictedData(sources);
  requireValid(review.registry_version===registry.registry_version&&review.source_registry_version===sources.source_registry_version,'Review snapshot version mismatch');
  requireValid(review.publication.status==='held'||(review.reviewer_role==='maintainer'&&review.publication.authorized_by&&checkUrl(review.publication.authorization_url)), 'Public release requires explicit maintainer authorization');
  if(base)requireValid(base.review.publication.intended_use===review.publication.intended_use,'Intended-use changes require explicit rebase and rights review');
  if(base) requireValid(base.manifest.registry_version===registry.registry_version&&base.manifest.source_registry_version===sources.source_registry_version&&base.manifest.registry_sha256===hash(registry)&&base.manifest.sources_sha256===hash(sources),'Registry/source migration requires an explicit reviewed rebase, not implicit overwrite');
  const sourceIndex=indexUnique(sources.sources,'source_id','source');
  for(const source of sources.sources) {
    requireValid(source.allowed_url_prefixes.length>0&&source.allowed_url_prefixes.every(u=>checkUrl(u,fixtureMode)),`Invalid source URL allowlist ${source.source_id}`);
    for(const right of Object.values(source.rights)) requireValid(right.terms_urls.length>0&&right.terms_urls.every(u=>checkUrl(u,fixtureMode)),`Missing source-rights evidence ${source.source_id}`);
  }
  const documentDecisions=indexUnique(review.document_decisions.map(d=>({...d,key:`${d.batch_id}/${d.document_id}`})),'key','document review');
  const decisions=indexUnique(review.decisions.map(d=>({...d,key:`${d.batch_id}/${d.candidate_id}`})),'key','claim review');
  const prior=base?.canonical??{documents:[],evidence:[],observations:[],denominators:[],coverage:[],claim_families:[],claim_revisions:[],active_claim_revision_ids:[],batch_receipts:[],gaps:[]};
  const incoming=[], seenBatches=new Map(prior.batch_receipts.map(r=>[r.batch_id,r]));
  for(const batch of [...batches].sort((a,b)=>a.manifest.batch_id.localeCompare(b.manifest.batch_id))) {
    assertSchema(batch,'batch'); rejectRestrictedData(batch);
    const m=batch.manifest, digest=hash(batch), existing=seenBatches.get(m.batch_id);
    if(existing) { requireValid(existing.sha256===digest,`Batch ID reused with changed content: ${m.batch_id}`); continue; }
    requireValid(m.registry_version===registry.registry_version&&m.source_registry_version===sources.source_registry_version,'Stale registry/source version');
    requireValid(m.base_release_id===(base?.manifest.release_id??null),'Stale base release');
    requireValid(batch.claims.length<=m.scope.max_claims,'Batch exceeds authorized claim cap');
    requireValid(m.scope.max_claims<=30&&m.scope.entity_ids.every(x=>identity.entities.has(x))&&m.scope.security_ids.every(x=>identity.securities.has(x))&&m.scope.source_ids.every(x=>sourceIndex.has(x)),'Invalid approved universe');
    for(const [collection,key] of [['documents','document_id'],['evidence','evidence_id'],['observations','observation_id'],['denominators','denominator_id'],['coverage','coverage_id'],['claims','candidate_id'],['gaps','gap_id']]) indexUnique(batch[collection],key,`${m.batch_id} ${collection}`);
    seenBatches.set(m.batch_id,{batch_id:m.batch_id,sha256:digest,agent_id:m.agent_id,task_id:m.task_id}); incoming.push(batch);
  }
  if(base&&!incoming.length) return base;
  const merged={};
  for(const [collection,key] of [['documents','document_id'],['evidence','evidence_id'],['observations','observation_id'],['denominators','denominator_id'],['coverage','coverage_id'],['gaps','gap_id']]) merged[collection]=mergeRecords(prior[collection],incoming.flatMap(b=>b[collection]),key);
  const documents=new Map(merged.documents.map(d=>[d.document_id,d])), evidence=new Map(merged.evidence.map(e=>[e.evidence_id,e])), observations=new Map(merged.observations.map(o=>[o.observation_id,o])), denominators=new Map(merged.denominators.map(d=>[d.denominator_id,d]));
  for(const doc of documents.values()) {
    const source=sourceIndex.get(doc.source_id);
    requireValid(source,`Unknown document source ${doc.source_id}`);
    requireValid(checkUrl(doc.url,fixtureMode)&&source.allowed_url_prefixes.some(prefix=>doc.url.startsWith(prefix)),`Document outside admitted channel/scope ${doc.document_id}`);
    requireValid(doc.content_sha256===null||/^[a-f0-9]{64}$/.test(doc.content_sha256),`Invalid content hash ${doc.document_id}`);
    requireValid(doc.supersedes_document_ids.every(id=>documents.has(id)&&id!==doc.document_id&&documents.get(id).document_family_id===doc.document_family_id),`Invalid document amendment ${doc.document_id}`);
  }
  for(const e of evidence.values()) requireValid(documents.has(e.document_id)&&e.locator.trim().length>2&&e.source_record_key.trim().length>0,`Missing evidence document/locator ${e.evidence_id}`);
  for(const o of observations.values()) requireValid(documents.has(o.document_id)&&o.evidence_ids.length>0&&o.evidence_ids.every(id=>evidence.get(id)?.document_id===o.document_id)&&o.retrieved_at<=o.recorded_at,`Invalid observation ${o.observation_id}`);
  for(const d of denominators.values()) {
    requireValid(identity.perimeters.has(`${d.reporting_perimeter_id}@${d.reporting_perimeter_version}`)&&d.security_ids.every(x=>identity.securities.has(x))&&d.evidence_ids.length>0&&d.evidence_ids.every(x=>evidence.has(x)),`Invalid denominator scope/lineage ${d.denominator_id}`);
    requireValid((d.availability==='known')===(d.value!==null),`Invalid denominator null ${d.denominator_id}`);
  }
  for(const c of merged.coverage) {
    requireValid(identity.perimeters.has(`${c.reporting_perimeter_id}@${c.reporting_perimeter_version}`),`Invalid coverage perimeter ${c.coverage_id}`);
    requireValid(c.expected_source_rows===null||(c.count_evidence_ids.length>0&&c.count_evidence_ids.every(x=>evidence.has(x))&&c.captured_source_rows<=c.expected_source_rows),`Unsupported source-count denominator ${c.coverage_id}`);
    requireValid(c.status!=='complete_for_declared_scope'||(c.expected_source_rows!==null&&c.expected_source_rows===c.captured_source_rows),`Unsupported complete coverage ${c.coverage_id}`);
    requireValid(c.freshness_status!=='stale'||c.freshness_policy_id!==null,`Staleness needs policy ${c.coverage_id}`);
  }
  const revisions=new Map(prior.claim_revisions.map(c=>[c.claim_revision_id,c])), families=new Map(prior.claim_families.map(c=>[c.claim_id,c]));
  const active=new Set(prior.active_claim_revision_ids), admittedObservations=new Set(prior.observations.map(o=>o.observation_id)), admittedCoverage=new Set(prior.coverage.map(c=>c.coverage_id)), appliedAmendments=new Set(), report=[], pending=[];
  for(const batch of incoming) for(const claim of sorted(batch.claims,'candidate_id')) {
    const m=batch.manifest, reasons=[], warnings=[];
    const fail=(test,reason)=>{if(!test) reasons.push(reason);};
    const decision=decisions.get(`${m.batch_id}/${claim.candidate_id}`);
    fail(decision?.decision==='accepted_for_model','review_not_accepted');
    fail(m.scope.entity_ids.includes(claim.subject_id),'subject_outside_universe');
    fail(m.scope.entity_ids.includes(claim.object_id)||m.scope.security_ids.includes(claim.object_id),'object_outside_universe');
    fail(m.scope.report_dates.includes(claim.report_date),'report_date_outside_universe');
    fail(claim.report_date<=m.knowledge_cutoff,'report_after_knowledge_cutoff');
    const perimeter=identity.perimeters.get(`${claim.reporting_perimeter_id}@${claim.reporting_perimeter_version}`);
    fail(perimeter&&perimeter.reporting_entity_id===claim.subject_id,'reporting_perimeter_mismatch');
    fail(perimeter&&(!perimeter.valid_from||claim.report_date>=perimeter.valid_from)&&(!perimeter.valid_to||claim.report_date<=perimeter.valid_to),'reporting_perimeter_outside_validity');
    fail(identity.entities.get(claim.subject_id)?.entity_type!=='brand','brand_not_legal_reporting_entity');
    fail(identity.entities.get(claim.subject_id)?.review.status==='accepted'&&perimeter?.review.status==='accepted','identity_or_perimeter_review_required');
    const sec=identity.securities.get(claim.object_id);
    fail(sec ? sec.review.status==='accepted'&&identity.entities.get(sec.issuer_id)?.review.status==='accepted' : identity.entities.get(claim.object_id)?.review.status==='accepted','object_identity_review_required');
    if(['record_ownership','beneficial_ownership','direct_equity_ownership','fund_holding','managed_holding','voting_authority','custody'].includes(claim.predicate)) fail(!!sec,'security_identity_required');
    if(claim.predicate==='managed_holding') fail(['client_aggregate','reported_discretion'].includes(perimeter?.basis),'managed_role_mismatch');
    if(claim.predicate==='fund_holding') fail(perimeter?.basis==='fund'&&identity.entities.get(claim.subject_id)?.entity_type==='fund','fund_role_mismatch');
    if(claim.predicate==='direct_equity_ownership') fail(perimeter?.basis==='own_account','ownership_requires_own_account');
    if(claim.predicate==='beneficial_ownership') fail(claim.qualifiers.length>0,'beneficial_framework_required');
    if(claim.predicate==='control_assertion') fail(claim.qualifiers.length>0,'control_mechanism_required');
    fail(claim.evidence_ids.length>0&&claim.evidence_ids.every(x=>evidence.has(x)),'evidence_missing');
    fail(claim.observation_ids.length>0&&claim.observation_ids.every(x=>observations.has(x)),'observation_missing');
    const claimCoverage=merged.coverage.filter(c=>c.reporting_perimeter_id===claim.reporting_perimeter_id&&c.reporting_perimeter_version===claim.reporting_perimeter_version&&c.report_date===claim.report_date);
    const supportingIds=unique([...claim.evidence_ids,...claim.metrics.flatMap(metric=>denominators.get(metric.denominator_id)?.evidence_ids??[]),...claimCoverage.flatMap(c=>c.count_evidence_ids)]);
    const claimEvidence=supportingIds.map(x=>evidence.get(x)).filter(Boolean), claimDocs=claimEvidence.map(x=>documents.get(x.document_id)).filter(Boolean), claimSources=claimDocs.map(d=>sourceIndex.get(d.source_id));
    fail(claim.primary_evidence_ids.length>0&&claim.primary_evidence_ids.every(id=>claim.evidence_ids.includes(id)),'primary_evidence_required');
    for(const e of claimEvidence.filter(e=>claim.primary_evidence_ids.includes(e.evidence_id)))fail(e.supported_predicates.includes(claim.predicate),'evidence_predicate_mismatch');
    for(const doc of claimDocs) {fail(doc.published_at<=m.knowledge_cutoff,'document_after_knowledge_cutoff'); fail(doc.amendment_status==='complete'&&doc.amendment_checked_through>=m.knowledge_cutoff,'amendment_chain_incomplete_as_of_cutoff');fail(sourceIndex.get(doc.source_id).admitted_document_ids.includes(doc.document_id),'document_not_admitted');}
    for(const source of claimSources) {
      fail(m.scope.source_ids.includes(source.source_id)&&source.admission.status==='scope_admitted','source_not_admitted');
      fail(source.allowed_predicates.includes(claim.predicate),'source_predicate_mismatch');
      for(const axis of ['automated_collection','internal_extraction','identifier_database_use','derived_publication','attribution']) fail(allowed(source.rights[axis]),`rights_${axis}_blocked`);
      if(review.publication.intended_use==='commercial') fail(allowed(source.rights.commercial_use),'rights_commercial_use_blocked');
    }
    for(const oid of claim.observation_ids) {
      const o=observations.get(oid); if(!o)continue;
      fail(o.evidence_ids.some(x=>supportingIds.includes(x)),'observation_evidence_mismatch');
      fail(o.retrieved_at.slice(0,10)<=m.knowledge_cutoff&&o.recorded_at.slice(0,10)<=m.knowledge_cutoff,'observation_after_knowledge_cutoff');
      fail(documents.get(o.document_id)?.published_at<=o.retrieved_at.slice(0,10),'retrieval_before_publication');
    }
    fail(supportingIds.every(eid=>claim.observation_ids.some(oid=>observations.get(oid)?.evidence_ids.includes(eid))),'supporting_evidence_observation_missing');
    fail(!claim.effective_from||!claim.effective_to||claim.effective_from<=claim.effective_to,'invalid_effective_interval');
    if(claim.temporal_kind==='snapshot') fail(claim.effective_to===null&&claim.effective_date_basis==='reporting_snapshot','snapshot_is_not_continuous_holding');
    if(claim.temporal_kind==='interval') fail(claim.effective_from!==null&&claim.end_semantics!=='not_applicable','interval_boundary_required');
    fail(merged.coverage.some(c=>c.reporting_perimeter_id===claim.reporting_perimeter_id&&c.reporting_perimeter_version===claim.reporting_perimeter_version&&c.report_date===claim.report_date),'coverage_missing');
    fail(new Set(claim.metrics.map(m=>m.metric_id)).size===claim.metrics.length,'duplicate_metric_id');
    fail(new Set(claim.metrics.map(m=>m.metric_type)).size===claim.metrics.length,'ambiguous_metric_type');
    for(const metric of claim.metrics) {
      fail((metric.availability==='known')===(metric.value!==null),'null_availability_mismatch');
      fail(metric.availability==='known'||metric.reason!==null,'unknown_reason_required');
      fail(metric.source_reported,'agent_derived_metric_not_allowed');
      fail(metric.measurement_basis==='observed_position'||metric.measurement_basis==='reported_actual_allocation','target_is_not_observation');
      if(metric.value!==null) fail(!metric.value.startsWith('-'),'negative_long_equity_metric');
      if(metric.metric_type==='quantity') fail(['shares','fund_units'].includes(metric.unit)&&metric.denominator_id===null,'quantity_unit_mismatch');
      if(metric.metric_type==='reported_value') fail(metric.currency===metric.unit&&metric.valuation_date!==null&&metric.valuation_basis!=='not_applicable','value_basis_missing');
      if(metric.metric_type.endsWith('_percentage')||metric.metric_type==='portfolio_weight') {
        fail(metric.unit==='percent','percentage_unit_mismatch');
        const d=denominators.get(metric.denominator_id);
        fail(!!d,'percentage_denominator_required');
        if(d) {
          const kinds={equity_percentage:['outstanding_equity'],beneficial_percentage:['beneficial_adjusted','outstanding_equity'],voting_percentage:['eligible_votes'],portfolio_weight:['selected_disclosed_value','net_assets','whole_portfolio_assets']};
          fail(kinds[metric.metric_type].includes(d.kind),'denominator_meaning_mismatch');
          if(['outstanding_equity','beneficial_adjusted'].includes(d.kind))fail(d.unit==='shares'&&d.currency===null,'denominator_unit_mismatch');
          if(d.kind==='eligible_votes')fail(['votes','voting_units'].includes(d.unit)&&d.currency===null,'denominator_unit_mismatch');
          if(['selected_disclosed_value','net_assets','whole_portfolio_assets'].includes(d.kind))fail(d.currency!==null&&d.unit===d.currency,'denominator_unit_mismatch');
          if(metric.metric_type==='portfolio_weight')fail(d.reporting_perimeter_id===claim.reporting_perimeter_id&&d.reporting_perimeter_version===claim.reporting_perimeter_version,'denominator_perimeter_mismatch');
          fail(!sec||d.security_ids.includes(sec.security_id)||metric.metric_type==='portfolio_weight','denominator_security_mismatch');
          if(d.value===null||d.as_of_date!==claim.report_date) warnings.push(`non_comparable_percentage:${metric.metric_id}`);
          else fail(rational(d.value)[0]>0n,'non_positive_denominator');
        }
        if(metric.value!==null&&metric.metric_type!=='portfolio_weight') fail(rational(metric.value)[0]<=100n*rational(metric.value)[1],'percentage_out_of_range');
      }
      if(claim.predicate==='managed_holding') fail(!['equity_percentage','beneficial_percentage'].includes(metric.metric_type),'managed_not_corporate_ownership');
      if(metric.metric_type==='beneficial_percentage')fail(claim.predicate==='beneficial_ownership','beneficial_metric_requires_beneficial_claim');
      if(metric.metric_type==='equity_percentage')fail(['direct_equity_ownership','record_ownership','fund_holding'].includes(claim.predicate),'equity_metric_requires_equity_role');
      if(metric.metric_type==='voting_percentage') fail(claim.predicate==='voting_authority','voting_metric_requires_voting_claim');
    }
    fail(claim.correction_kind!=='none'||claim.supersedes_claim_revision_ids.length===0,'unexplained_supersession');
    if(claim.supersedes_claim_revision_ids.length) fail(claim.correction_reason!==null,'correction_reason_required');
    if(claim.correction_kind==='addition') fail(!claim.supersedes_claim_revision_ids.length,'addition_cannot_replace');
    for(const gap of batch.gaps) if(gap.blocks_claim_candidate_ids.includes(claim.candidate_id)) reasons.push(`gap:${gap.gap_id}`);
    const sourceFamilies=unique(claim.primary_evidence_ids.map(id=>sourceIndex.get(documents.get(evidence.get(id)?.document_id)?.source_id)?.source_family).filter(Boolean)), claim_id=claimFamily(claim,sourceFamilies), body=revisionBody(claim,sourceFamilies), claim_revision_id=idFor('clmrev',{claim_id,...body});
    const record={claim_id,claim_revision_id,...body};
    const result={batch_id:m.batch_id,candidate_id:claim.candidate_id,claim_id,claim_revision_id,status:reasons.length?'quarantined':'accepted',reasons:unique(reasons),warnings:unique(warnings),review_rationale:decision?.rationale??'No independent review decision'};
    report.push(result); if(!reasons.length) pending.push({record,result,observationIds:claim.observation_ids,coverageIds:claimCoverage.map(c=>c.coverage_id)});
  }
  // The same source row cannot acquire two independent economic identities.
  const rowOwners=new Map();
  for(const c of [...revisions.values(),...pending.map(x=>x.record)])for(const eid of c.primary_evidence_ids) {
    const e=evidence.get(eid),d=documents.get(e?.document_id);if(!e||!d)continue;
    const key=canonicalJSON([d.document_id,e.source_record_key,c.predicate]);
    rowOwners.set(key,[...(rowOwners.get(key)??[]),c]);
  }
  for(const rows of rowOwners.values())if(new Set(rows.map(economicKey)).size>1)for(const c of rows) {
    active.delete(c.claim_revision_id);
    const matches=report.filter(r=>r.claim_revision_id===c.claim_revision_id);
    if(!matches.length)report.push({batch_id:'prior_release',candidate_id:null,claim_id:c.claim_id,claim_revision_id:c.claim_revision_id,status:'quarantined',reasons:['source_row_identity_conflict'],warnings:[],review_rationale:'Conflicting source-row identity blocks every proposed mapping'});
    for(const result of matches){result.status='quarantined';result.reasons=unique([...result.reasons,'source_row_identity_conflict']);}
  }
  for(const {record:c,result,observationIds,coverageIds} of pending) {
    if(result.status==='quarantined')continue;
    const old=revisions.get(c.claim_revision_id);
    if(old) {result.status='duplicate';observationIds.forEach(id=>admittedObservations.add(id));coverageIds.forEach(id=>admittedCoverage.add(id));continue;}
    const sameFamily=[...active].map(id=>revisions.get(id)).filter(r=>r.claim_id===c.claim_id);
    const superseded=c.supersedes_claim_revision_ids;
    if(superseded.some(id=>!active.has(id)||revisions.get(id)?.claim_id!==c.claim_id)||sameFamily.some(r=>!superseded.includes(r.claim_revision_id))) {result.status='quarantined';result.reasons.push('unreviewed_or_invalid_revision_chain');continue;}
    if(superseded.length&&!c.evidence_ids.some(id=>documents.get(evidence.get(id).document_id)?.amendment_kind!=='original')) {result.status='quarantined';result.reasons.push('supersession_without_amendment_evidence');continue;}
    observationIds.forEach(id=>admittedObservations.add(id));coverageIds.forEach(id=>admittedCoverage.add(id));
    revisions.set(c.claim_revision_id,c); families.set(c.claim_id,{claim_id:c.claim_id,assertion_key:c.assertion_key,subject_id:c.subject_id,predicate:c.predicate,object_id:c.object_id,report_date:c.report_date});
    superseded.forEach(id=>active.delete(id)); if(c.correction_kind!=='withdrawal')active.add(c.claim_revision_id);
  }
  // Full source restatements retire omitted rows without manufacturing zero holdings.
  // Apply only to explicitly linked prior documents, never an entire portfolio by date.
  for(const batch of incoming)for(const doc of batch.documents.filter(d=>['restatement','withdrawal'].includes(d.amendment_kind))) {
    const source=sourceIndex.get(doc.source_id);
    const admitted=documentDecisions.get(`${batch.manifest.batch_id}/${doc.document_id}`)?.decision==='accepted_for_model'&&batch.manifest.scope.source_ids.includes(doc.source_id)&&doc.published_at<=batch.manifest.knowledge_cutoff&&source.admission.status==='scope_admitted'&&source.admitted_document_ids.includes(doc.document_id)&&doc.amendment_status==='complete'&&doc.amendment_checked_through>=batch.manifest.knowledge_cutoff&&['automated_collection','internal_extraction','identifier_database_use','derived_publication','attribution'].every(axis=>allowed(source.rights[axis]));
    requireValid(doc.supersedes_document_ids.length>0,'Restatement/withdrawal needs explicit prior document scope');
    if(!admitted||(review.publication.intended_use==='commercial'&&!allowed(source.rights.commercial_use)))continue;
    appliedAmendments.add(doc.document_id);
    for(const id of [...active]) {
      const old=revisions.get(id);
      if(!old.evidence_ids.some(eid=>doc.supersedes_document_ids.includes(evidence.get(eid).document_id)))continue;
      active.delete(id);
      report.push({batch_id:batch.manifest.batch_id,candidate_id:null,claim_id:old.claim_id,claim_revision_id:id,status:'retired',reasons:[doc.amendment_kind==='restatement'?'restated_source_row_omitted':'source_assertion_withdrawn'],warnings:['Absence from corrected report is not zero ownership or a disposal.'],review_rationale:`Explicit source amendment ${doc.document_id}`});
    }
  }
  const activeRecords=[...active].map(id=>revisions.get(id));
  for(let i=0;i<activeRecords.length;i++)for(let j=i+1;j<activeRecords.length;j++) {
    const a=activeRecords[i],b=activeRecords[j];
    if(economicKey(a)!==economicKey(b))continue;
    if(metricSignature(a)===metricSignature(b)) {
      const remove=[a,b].sort((x,y)=>x.claim_revision_id.localeCompare(y.claim_revision_id))[1];active.delete(remove.claim_revision_id);
      for(const r of report.filter(r=>r.claim_revision_id===remove.claim_revision_id)){r.status='duplicate';r.reasons.push('duplicate_economic_position');}
    } else {
      active.delete(a.claim_revision_id);active.delete(b.claim_revision_id);
      for(const id of [a.claim_revision_id,b.claim_revision_id]) {
        const matches=report.filter(r=>r.claim_revision_id===id);
        if(!matches.length) report.push({batch_id:'prior_release',candidate_id:null,claim_id:revisions.get(id).claim_id,claim_revision_id:id,status:'quarantined',reasons:['conflicting_same_scope_observation'],warnings:[],review_rationale:'Conflicting new evidence blocks prior active projection'});
        for(const r of matches){r.status='quarantined';r.reasons.push('conflicting_same_scope_observation');}
      }
    }
  }
  requireValid(active.size<=30,'Combined pilot exceeds 30 accepted active claims');
  // Only admitted/retained revisions can bring fact payloads into canonical storage.
  // Quarantined candidate evidence remains in isolated staging, never canonical output.
  const retained=[...revisions.values()],usedDenominators=new Set(retained.flatMap(c=>c.metrics.map(m=>m.denominator_id).filter(Boolean)));
  const usedEvidence=new Set([...retained.flatMap(c=>c.evidence_ids),...merged.denominators.filter(d=>usedDenominators.has(d.denominator_id)).flatMap(d=>d.evidence_ids),...merged.coverage.filter(c=>admittedCoverage.has(c.coverage_id)&&retained.some(r=>r.reporting_perimeter_id===c.reporting_perimeter_id&&r.reporting_perimeter_version===c.reporting_perimeter_version&&r.report_date===c.report_date)).flatMap(c=>c.count_evidence_ids)]);
  const usedDocuments=new Set([...usedEvidence].map(id=>evidence.get(id).document_id));
  for(const id of appliedAmendments)usedDocuments.add(id);
  const visitDocument=id=>{for(const parent of documents.get(id)?.supersedes_document_ids??[])if(!usedDocuments.has(parent)){usedDocuments.add(parent);visitDocument(parent);}};
  [...usedDocuments].forEach(visitDocument);
  const canonical={...merged,documents:merged.documents.filter(d=>usedDocuments.has(d.document_id)),evidence:merged.evidence.filter(e=>usedEvidence.has(e.evidence_id)),observations:merged.observations.filter(o=>admittedObservations.has(o.observation_id)&&o.evidence_ids.some(id=>usedEvidence.has(id))),denominators:merged.denominators.filter(d=>usedDenominators.has(d.denominator_id)),coverage:merged.coverage.filter(c=>admittedCoverage.has(c.coverage_id)&&retained.some(r=>r.reporting_perimeter_id===c.reporting_perimeter_id&&r.reporting_perimeter_version===c.reporting_perimeter_version&&r.report_date===c.report_date)),claim_families:sorted([...families.values()],'claim_id'),claim_revisions:sorted(retained,'claim_revision_id'),active_claim_revision_ids:[...active].sort(),batch_receipts:sorted([...seenBatches.values()],'batch_id')};
  const validation={schema_version:SCHEMA_VERSION,review_id:review.review_id,reviewer:review.reviewer,reviewer_role:review.reviewer_role,publication_status:review.publication.status,results:report.sort((a,b)=>`${a.batch_id}/${a.candidate_id}`.localeCompare(`${b.batch_id}/${b.candidate_id}`)),gaps:canonical.gaps,counts:{active_claims:active.size,retained_revisions:revisions.size,quarantined:report.filter(r=>r.status==='quarantined').length,duplicates:report.filter(r=>r.status==='duplicate').length},limitations:['Historical, disclosed evidence only; no current-completeness, full-AUM or control inference.','Shadow projection is not connected to the live UI.']};
  const basis={canonical,registry,sources,review,validation,generator_version:GENERATOR_VERSION,fixture_mode:fixtureMode};
  const release_id=idFor('release',basis);
  const manifest={release_id,schema_version:SCHEMA_VERSION,generator_version:GENERATOR_VERSION,registry_version:registry.registry_version,source_registry_version:sources.source_registry_version,base_release_id:base?.manifest.release_id??null,review_id:review.review_id,created_at:review.reviewed_at,publication_status:review.publication.status,fixture_mode:fixtureMode,active_claim_revision_ids:canonical.active_claim_revision_ids,canonical_sha256:hash(canonical),registry_sha256:hash(registry),sources_sha256:hash(sources)};
  const projection=projectShadow({canonical,registry,sources,validation,manifest});
  return structuredClone({manifest,canonical,registry,sources,review,validation,projection});
}
export function projectShadow({canonical,registry,sources,validation,manifest}) {
  const active=new Set(canonical.active_claim_revision_ids), used=new Set(), sourceIds=new Set();
  const docs=new Map(canonical.documents.map(d=>[d.document_id,d])), ev=new Map(canonical.evidence.map(e=>[e.evidence_id,e])), securities=new Map(registry.securities.map(s=>[s.security_id,s])), denominators=new Map(canonical.denominators.map(d=>[d.denominator_id,d]));
  const edges=canonical.claim_revisions.filter(c=>active.has(c.claim_revision_id)).map(c=>{
    used.add(c.subject_id);const security=securities.get(c.object_id);used.add(security?.issuer_id??c.object_id);
    const evidence=c.evidence_ids.map(id=>{const item=ev.get(id),doc=docs.get(item.document_id);sourceIds.add(doc.source_id);return {evidence_id:id,document_id:doc.document_id,url:doc.url,locator:item.locator,publisher:doc.publisher,published_at:doc.published_at,amendment_checked_through:doc.amendment_checked_through};});
    const metricWarnings=c.metrics.filter(m=>m.metric_type.endsWith('_percentage')||m.metric_type==='portfolio_weight').filter(m=>{const d=denominators.get(m.denominator_id);return !d||d.value===null||d.as_of_date!==c.report_date;}).map(m=>`non_comparable_percentage:${m.metric_id}`);
    const warnings=unique([...validation.results.filter(r=>r.claim_revision_id===c.claim_revision_id).flatMap(r=>r.warnings),...metricWarnings]);
    const stake=c.predicate==='direct_equity_ownership'&&c.metrics.find(m=>m.metric_type==='equity_percentage'&&m.availability==='known'&&denominators.get(m.denominator_id)?.as_of_date===c.report_date&&denominators.get(m.denominator_id)?.value!==null);
    return {id:c.claim_revision_id,claim_revision_ids:[c.claim_revision_id],claim_ids:[c.claim_id],source:c.subject_id,target:security?.issuer_id??c.object_id,security_id:security?.security_id??null,relationship:c.predicate,as_of:c.report_date,temporal_kind:c.temporal_kind,effective_from:c.effective_from,effective_to:c.effective_to,reporting_perimeter_id:c.reporting_perimeter_id,reporting_perimeter_version:c.reporting_perimeter_version,position_scope_id:c.position_scope_id,metrics:c.metrics.map(m=>({...m,denominator:m.denominator_id?denominators.get(m.denominator_id):null})),stakePercent:stake?stake.value:null,qualifiers:c.qualifiers,overlap_group_ids:c.overlap_group_ids,evidence,warnings,coverage:canonical.coverage.filter(x=>x.reporting_perimeter_id===c.reporting_perimeter_id&&x.reporting_perimeter_version===c.reporting_perimeter_version&&x.report_date===c.report_date)};
  });
  return {meta:{projection_schema_version:SCHEMA_VERSION,release_id:manifest.release_id,publication_status:manifest.publication_status,mode:'shadow_only',fixture_mode:manifest.fixture_mode,title:manifest.fixture_mode?'Synthetic validation fixtures':'Bounded disclosed-equity research pilot',coverage:'Selected historical source statements only. Not a complete shareholder register, full portfolio or whole AUM.',current_ui_compatible:false},sources:sources.sources.filter(s=>sourceIds.has(s.source_id)).map(s=>({id:s.source_id,source_family:s.source_family,cadence:s.cadence,limitations:s.limitations})),nodes:registry.entities.filter(e=>used.has(e.entity_id)).map(e=>({id:e.entity_id,label:e.legal_name,entity_type:e.entity_type})),edges:sorted(edges,'id'),gaps:canonical.gaps};
}
export function aggregateDisclosedSubset(release,claimRevisionIds,{classifications={}}={}) {
  requireValid(claimRevisionIds.length>0&&new Set(claimRevisionIds).size===claimRevisionIds.length,'Select unique claim revisions');
  const selected=claimRevisionIds.map(id=>release.canonical.claim_revisions.find(c=>c.claim_revision_id===id&&release.canonical.active_claim_revision_ids.includes(id)));
  requireValid(selected.every(Boolean),'Aggregate inputs must pin active accepted claim_revision_ids');
  const base=selected[0], groupIds=new Set(), metrics=[];
  for(const c of selected) {
    requireValid(['managed_holding','fund_holding','direct_equity_ownership'].includes(c.predicate),'Non-additive ownership role');
    requireValid(c.subject_id===base.subject_id&&c.predicate===base.predicate&&c.report_date===base.report_date&&c.reporting_perimeter_id===base.reporting_perimeter_id&&c.reporting_perimeter_version===base.reporting_perimeter_version,'Mixed roles, dates or reporting perimeters');
    requireValid(c.temporal_kind==='snapshot','Aggregate requires snapshots');
    requireValid(c.position_scope_id===base.position_scope_id,'Mixed position scopes');
    for(const id of c.overlap_group_ids) {requireValid(!groupIds.has(id),'Overlapping manager/fund or attribution positions');groupIds.add(id);}
    requireValid(!c.qualifiers.some(q=>/unknown overlap|overlap unknown/i.test(q)),'Unknown overlap blocks additive totals');
    const value=c.metrics.find(m=>m.metric_type==='reported_value'&&m.availability==='known');
    requireValid(value&&value.valuation_date===c.report_date&&value.measurement_basis==='observed_position','Missing compatible value');
    if(metrics.length) requireValid(value.currency===metrics[0].currency&&value.valuation_basis===metrics[0].valuation_basis,'Mixed currencies or valuation bases');
    metrics.push(value);
  }
  const total=decimalSum(metrics.map(m=>m.value));requireValid(rational(total)[0]>0n,'Undefined zero-value denominator');
  const denominator_id=idFor('den',{claim_revision_ids:[...claimRevisionIds].sort(),metric_ids:metrics.map(m=>m.metric_id).sort(),total});
  const denominator={denominator_id,kind:'selected_disclosed_value',label:'Sum of selected, non-overlapping disclosed long-equity values',value:total,currency:metrics[0].currency,as_of_date:base.report_date,valuation_basis:metrics[0].valuation_basis,reporting_perimeter_id:base.reporting_perimeter_id,reporting_perimeter_version:base.reporting_perimeter_version,claim_revision_ids:[...claimRevisionIds].sort(),metric_ids:metrics.map(m=>m.metric_id).sort(),whole_portfolio_coverage:null};
  const buckets=new Map(),taxonomy=new Set();
  selected.forEach((c,i)=>{
    const security=release.registry.securities.find(s=>s.security_id===c.object_id), cls=classifications[security.issuer_id];
    if(cls) {requireValid(cls.scheme&&cls.version&&cls.evidence_id&&release.canonical.evidence.some(e=>e.evidence_id===cls.evidence_id),'Classification needs taxonomy/version/evidence');taxonomy.add(`${cls.scheme}@${cls.version}`);}
    const name=cls?.label??'Unclassified';buckets.set(name,[...(buckets.get(name)??[]),metrics[i].value]);
  });
  requireValid(taxonomy.size<=1,'Mixed classification schemes');
  return {aggregate_id:idFor('agg',denominator),formula_id:'disclosed_subset_weight',formula_version:'1.0.0',rounding:'half-up to six decimals; stored inputs exact',denominator,claim_revision_ids:[...claimRevisionIds].sort(),positions:selected.map((c,i)=>({claim_revision_id:c.claim_revision_id,metric_id:metrics[i].metric_id,value:metrics[i].value,percent_of_selected_disclosed_value:percent(metrics[i].value,total)})),industry_allocation:[...buckets].sort(([a],[b])=>a.localeCompare(b)).map(([label,values])=>({label,value:decimalSum(values),percent_of_selected_disclosed_value:percent(decimalSum(values),total)})),exclusions:[],coverage_label:'Selected disclosed subset; whole portfolio coverage unknown'};
}
export function comparePerimeterSnapshots(before,after,registry) {
  requireValid(before.reporting_perimeter_id===after.reporting_perimeter_id&&before.reporting_perimeter_version===after.reporting_perimeter_version,'Reporting-perimeter change is not an economic disposal; explicit reconciliation required');
  requireValid(before.subject_id===after.subject_id&&before.object_id===after.object_id&&before.predicate===after.predicate,'Incompatible position snapshots');
  // A snapshot difference is not a trade, even with compatible reporting scope.
  return {comparable_snapshot:true,trade_inference_allowed:false,scope_transitions:registry.scope_transitions.filter(t=>t.from_perimeter_id===before.reporting_perimeter_id)};
}
export function queryIssuerDisclosures(release,issuerId,{reportDate=null}={}) {
  requireValid(release.registry.entities.some(e=>e.entity_id===issuerId),'Unknown issuer');
  const rows=release.projection.edges.filter(e=>e.target===issuerId&&(!reportDate||e.as_of===reportDate));
  const ownership=new Set(['direct_equity_ownership','record_ownership','beneficial_ownership']);
  return {issuer_id:issuerId,report_date:reportDate,ownership:rows.filter(e=>ownership.has(e.relationship)),managed_exposure:rows.filter(e=>e.relationship==='managed_holding'),fund_holdings:rows.filter(e=>e.relationship==='fund_holding'),voting_authority:rows.filter(e=>e.relationship==='voting_authority'),other:rows.filter(e=>!ownership.has(e.relationship)&&!['managed_holding','fund_holding','voting_authority'].includes(e.relationship)),total_ownership_percentage:null,coverage:'Disclosed statements only; no complete cap table or summed overlapping attribution.'};
}
export function queryReportedPortfolio(release,{entityId,perimeterId,perimeterVersion,reportDate}) {
  requireValid(entityId&&perimeterId&&perimeterVersion&&reportDate,'Choose entity, perimeter version and reporting date');
  const rows=release.projection.edges.filter(e=>e.source===entityId&&e.reporting_perimeter_id===perimeterId&&e.reporting_perimeter_version===perimeterVersion&&e.as_of===reportDate&&['direct_equity_ownership','fund_holding','managed_holding'].includes(e.relationship));
  return {entity_id:entityId,reporting_perimeter_id:perimeterId,reporting_perimeter_version:perimeterVersion,report_date:reportDate,positions:rows,whole_portfolio_value:null,coverage:'Selected disclosed positions; missing rows do not establish zero holdings.'};
}
