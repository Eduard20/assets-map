import {readFile,writeFile,realpath} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import {buildRelease,pretty,hash,canonicalJSON,idFor} from './foundation/core.mjs';
import {loadReviewedInput} from './export-researched.mjs';
import {validateGraph} from '../src/graph-model.js';

// Exact increment only. A broader inventory is not permission to publish more claims.
export const UAE_CANDIDATE_SCOPE=Object.freeze([
  "cand_uae_abu_dhabi_developmental_holding_company_pjsc_adq_taqa",
  "cand_uae_abu_dhabi_developmental_holding_company_pjsc_adq_etihad_airways",
  "cand_uae_abu_dhabi_developmental_holding_company_pjsc_adq_etihad_rail",
  "cand_uae_abu_dhabi_developmental_holding_company_pjsc_adq_silal",
  "cand_uae_abu_dhabi_developmental_holding_company_pjsc_adq_agthia",
  "cand_uae_abu_dhabi_developmental_holding_company_pjsc_adq_purehealth",
  "cand_uae_abu_dhabi_developmental_holding_company_pjsc_adq_emsteel",
  "cand_uae_abu_dhabi_developmental_holding_company_pjsc_adq_tadweer_group",
  "cand_uae_abu_dhabi_developmental_holding_company_pjsc_adq_abu_dhabi_airports",
  "cand_uae_mubadala_investment_company_pjsc_pci_pharma_services",
  "cand_uae_mubadala_investment_company_pjsc_endeavor_group",
  "cand_uae_mubadala_investment_company_pjsc_nord_anglia_education",
  "cand_uae_mubadala_investment_company_pjsc_techem",
  "cand_uae_mubadala_investment_company_pjsc_loscam",
  "cand_uae_mubadala_investment_company_pjsc_mgx",
  "cand_uae_mubadala_investment_company_pjsc_mubadala_bio",
  "cand_uae_mubadala_bio_al_ittihad_drug_store",
  "cand_uae_mubadala_bio_global_medical_supply_chain",
  "cand_uae_mubadala_bio_bioventure_healthcare",
  "cand_uae_mubadala_investment_company_pjsc_greenlink",
  "cand_uae_l_imad_holding_company_pjsc_abu_dhabi_developmental_holding_company_pjsc_adq",
  "cand_uae_emirates_investment_authority_emirates_telecommunications_group_company_pjsc"
]);
export const UAE_COVERAGE=Object.freeze([
  {label:'Federal investors',status:'Selected EIA ownership snapshots only; other strategic assets and externally managed investments are not covered.'},
  {label:'Abu Dhabi',status:'Selected dated disclosures from major groups. ADIA and other companies remain incomplete; no complete portfolios claimed.'},
  {label:'Dubai',status:'Selected source-qualified businesses and assets; legal chains and subsequent transfers remain incomplete.'},
  {label:'Northern emirates',status:'Selected Sharjah disclosures; Ras Al Khaimah, Ajman, Fujairah, Umm Al Quwain and other holdings remain incomplete.'},
  {label:'Listed and private groups',status:'Selected dated conglomerate interests; family groups and unpublished subsidiaries remain incomplete.'},
  {label:'Managers, funds and other assets',status:'Source-qualified asset and brand affiliations are distinct from company equity. Ownership, operation and management are not interchangeable; fund interests, managed assets and undisclosed holdings remain incomplete.'}
]);
const uaeNodeKind=type=>type==='real_asset'?'asset':type==='brand'?'brand':type==='reported_group'?'reported_group':'company';
export function projectUae(input,approvedScope){return projectUaeRelease(input,approvedScope,UAE_CANDIDATE_SCOPE);}
function projectUaeRelease(input,approvedScope,allowedScope,release=null){
  assertScope(approvedScope);
  if(approvedScope.some(id=>!allowedScope.includes(id)))throw new Error('UAE exact independently approved scope required');
  const r=release??buildRelease(input);
  if(r.manifest.fixture_mode||r.manifest.publication_status!=='approved')throw new Error('UAE publication is held pending independent review and release authorization');
  const active=new Set(r.canonical.active_claim_revision_ids),claims=r.canonical.claim_revisions.filter(c=>active.has(c.claim_revision_id));
  if(!exactSet(claims.map(c=>c.assertion_key),approvedScope))throw new Error('UAE projection does not match the exact approved claim set');
  const docs=new Map(r.canonical.documents.map(d=>[d.document_id,d])),sourcesById=new Map(input.sources.sources.map(s=>[s.source_id,s]));
  const usedDocs=new Set(r.projection.edges.flatMap(e=>e.evidence.map(x=>x.document_id)));
  const sources=[...usedDocs].sort().map(id=>{const d=docs.get(id);return{id,title:sourcesById.get(d.source_id).source_family.replaceAll('_',' '),url:d.url,publisher:d.publisher,publishedAt:d.published_at,observedBy:d.observed_by??null,...(d.amendment_status==='source_snapshot_only'?{amendmentStatus:d.amendment_status,correctionScope:d.correction_scope,correctionCompleteness:'not_established'}:{})};});
  const investorIds=[...new Set(r.projection.edges.map(e=>e.source))];
  const nodes=r.projection.nodes.map(n=>({id:n.id,label:n.label,kind:uaeNodeKind(n.entity_type,investorIds.includes(n.id)),sourceIds:[...new Set(r.projection.edges.filter(e=>e.source===n.id||e.target===n.id).flatMap(e=>e.evidence.map(x=>x.document_id)))],summary:n.entity_type==='real_asset'?'One selected dated disclosure about a real asset, not equity in an inferred holding company. See the source-specific ownership or management qualifications.':n.entity_type==='brand'?'One selected dated brand or portfolio-business affiliation, not independently established corporate equity or legal title.':investorIds.includes(n.id)?'Selected dated disclosures for this reporting entity. This is not its complete portfolio. Consolidated group interests do not identify an immediate legal shareholder.':'One selected source snapshot. Other shareholders, subsidiaries and subsequent changes are not comprehensively covered.'}));
  const edges=r.projection.edges.map(e=>{
    const c=claims.find(c=>c.claim_revision_id===e.id),security=input.registry.securities.find(s=>s.security_id===e.security_id),perimeter=input.registry.perimeters.find(p=>p.reporting_perimeter_id===e.reporting_perimeter_id&&p.version===e.reporting_perimeter_version);
    if(!['direct_equity_ownership','reported_group_interest','reported_portfolio_affiliation'].includes(c.predicate)||e.temporal_kind!=='snapshot'||!e.coverage.length)throw new Error('Unsupported UAE first-batch semantics');
    const correction=e.warnings.some(x=>x.startsWith('correction_completeness_not_established:'))?{correctionStatus:'source_snapshot_only',correctionScope:'nonexhaustive',correctionCompleteness:'not_established'}:{};
    return{id:e.id,source:e.source,target:e.target,kind:e.relationship,asOf:e.as_of,sourceIds:[...new Set(e.evidence.map(x=>x.document_id))],stakePercent:null,valueUsd:null,disclosure:{...correction,claimId:c.claim_id,claimRevisionId:c.claim_revision_id,status:'Dated source snapshot, not verified current',securityLabel:security?.label??(c.predicate==='reported_portfolio_affiliation'?'Reported portfolio affiliation; not a security or corporate equity claim':'Reported consolidated group interest; immediate legal holder not established'),metrics:e.metrics.map(m=>({metric_type:m.metric_type,value:m.value,unit:m.unit,reason:m.reason,valuation_date:m.valuation_date,denominator:m.denominator?{value:m.denominator.value,unit:m.denominator.unit,as_of_date:m.denominator.as_of_date,definition:m.denominator.label}:null})),perimeter:{basis:perimeter.basis,definition:perimeter.definition},coverage:e.coverage.map(c=>({status:c.status,description:c.description,expected_source_rows:c.expected_source_rows,captured_source_rows:c.captured_source_rows,whole_portfolio_coverage:c.whole_portfolio_coverage})),caveats:[...c.qualifiers.map(q=>q.replace('WAM full article text retrieved from indexed official-domain result; direct page open timed out. ','')),c.predicate==='reported_portfolio_affiliation'?'This source-reported asset or brand affiliation is not a corporate equity percentage. The cited qualifiers distinguish acquisition, ownership and management.':'Do not sum percentages across different issuers or interpret capital ownership as voting authority.'],checkedThrough:e.evidence.map(x=>x.amendment_checked_through).sort()[0],evidence:e.evidence.map(x=>({url:x.url,title:sourcesById.get(docs.get(x.document_id).source_id).source_family.replaceAll('_',' '),publisher:x.publisher,published_at:x.published_at,observed_by:docs.get(x.document_id).observed_by??null,...(x.amendment_status?{amendment_status:x.amendment_status,correction_scope:x.correction_scope}:{}),locator:x.locator}))}};
  });
  const data={meta:{mode:'researched',datasetId:'uae',defaultRoot:investorIds[0],investorIds,updatedAt:input.review.reviewed_at.slice(0,10),releaseId:r.manifest.release_id,reviewId:input.review.review_id,publicationStatus:'approved',coverage:`${edges.length} selected independently reviewed disclosures across ${investorIds.length} UAE reporting entities. Partial historical coverage, not all holdings or all UAE entities.`,coverageLanes:UAE_COVERAGE,notes:['Issuer report dates may differ. A dated disclosure does not establish a current holding.','Unpublished, unreviewed and missing holdings are unknown, not zero.','No aggregate UAE ownership percentage, whole portfolio, AUM or control claim.']},sources,nodes,edges};
  const errors=validateGraph(data);if(errors.length)throw new Error(errors.join('\n'));return data;
}
const INPUT_FILES=['batch.json','registry.json','sources.json','review.json','independent-review.json','release-decision.json'];
const exactSet=(left,right)=>Array.isArray(left)&&Array.isArray(right)&&canonicalJSON([...left].sort())===canonicalJSON([...right].sort());
function assertScope(scope){
  if(!Array.isArray(scope)||!scope.length||scope.length>30||scope.some(id=>typeof id!=='string'||!id)||new Set(scope).size!==scope.length)throw new Error('UAE exact independently approved scope required; each release is bounded to 30 claims');
}
function assertKeys(value,keys,label){
  if(!value||typeof value!=='object'||Array.isArray(value)||!exactSet(Object.keys(value),keys))throw new Error(`Invalid UAE ${label} fields`);
}
export async function loadUaeInput(root=new URL('../data-foundation/uae/input/',import.meta.url),expectedScope=UAE_CANDIDATE_SCOPE){
  assertScope(expectedScope);
  const read=async name=>JSON.parse(await readFile(new URL(name,root),'utf8'));
  const manifest=await read('bundle-manifest.json');
  if(!exactSet(Object.keys(manifest.files??{}),INPUT_FILES))throw new Error('UAE bundle must pin all exact reviewed inputs');
  const input=await loadReviewedInput(root),decision=await read('release-decision.json'),independent=await read('independent-review.json');
  const approvedScope=decision.authorized_candidate_ids;assertScope(approvedScope);
  if(decision.authorization_readback_verified!==true||!exactSet(approvedScope,expectedScope))throw new Error('UAE release decision must match exact reviewed scope');
  if(!exactSet(independent.decisions.map(d=>d.candidate_id),approvedScope))throw new Error('UAE independent review does not match release decision');
  const candidates=input.batches.flatMap(b=>b.claims.map(c=>({batch_id:b.manifest.batch_id,candidate_id:c.candidate_id,assertion_key:c.assertion_key})));
  if(!exactSet(candidates.map(c=>c.candidate_id),approvedScope)||candidates.some(c=>c.assertion_key!==c.candidate_id))throw new Error('UAE batch does not match exact authorized candidates');
  const expectedPairs=candidates.map(c=>`${c.batch_id}/${c.candidate_id}`);
  if(!exactSet(independent.decisions.map(d=>`${d.batch_id}/${d.candidate_id}`),expectedPairs))throw new Error('UAE independent review batch scope mismatch');
  if(typeof independent.reviewer!=='string'||!independent.reviewer.trim()||independent.reviewer===input.review.reviewer||input.batches.some(b=>b.manifest.agent_id===independent.reviewer))throw new Error('UAE acceptance requires an independent reviewer');
  for(const batch of input.batches)for(const doc of batch.documents.filter(d=>d.amendment_status==='source_snapshot_only'||d.published_at===null)){
    if(!(independent.document_decisions??[]).some(d=>d.batch_id===batch.manifest.batch_id&&d.document_id===doc.document_id&&d.decision==='accepted_for_model'))throw new Error('UAE source observation requires exact independent document acceptance: '+doc.document_id);
  }
  for(const file of ['batch.json','registry.json','sources.json','review.json']){
    const digest=createHash('sha256').update(await readFile(new URL(file,root))).digest('hex');
    if(decision.reviewed_input_sha256?.[file]!==digest||(file!=='review.json'&&independent.reviewed_input_sha256?.[file.replace('.json','')]!==digest))throw new Error('UAE release input differs from independent acceptance: '+file);
  }
  return{input,approvedScope};
}

// Each entry is a separate independently reviewed foundation release. Never pass
// their batches together to buildRelease or raise the foundation's 30-claim cap.
export async function loadUaeReleases(manifestUrl=new URL('../data-foundation/uae/releases.json',import.meta.url)){
  const url=manifestUrl instanceof URL?manifestUrl:pathToFileURL(path.resolve(manifestUrl));
  const manifest=JSON.parse(await readFile(url,'utf8'));
  assertKeys(manifest,['schema_version','releases'],'release manifest');
  if(manifest.schema_version!=='1.0.0'||!Array.isArray(manifest.releases)||!manifest.releases.length)throw new Error('UAE release manifest requires a nonempty versioned release list');
  const root=new URL('./',url),rootPath=await realpath(fileURLToPath(root)),keys=new Set(),paths=new Set(),entries=[];
  for(const item of manifest.releases){
    assertKeys(item,['release_key','input_path','approved_candidate_ids','bundle_manifest_sha256','release_id','review_id'],'release entry');
    assertScope(item.approved_candidate_ids);
    if(typeof item.release_key!=='string'||!item.release_key||keys.has(item.release_key))throw new Error('Duplicate or invalid UAE release key');
    if(typeof item.input_path!=='string'||!(/^(?:[a-z0-9_-]+\/)*input\/$/).test(item.input_path)||paths.has(item.input_path))throw new Error('Invalid or duplicate UAE release input path');
    if(!/^[a-f0-9]{64}$/.test(item.bundle_manifest_sha256)||!/^release_[a-f0-9]{24}$/.test(item.release_id)||typeof item.review_id!=='string'||!item.review_id)throw new Error('UAE release entry requires exact manifest, release and review pins');
    keys.add(item.release_key);paths.add(item.input_path);
    const inputRoot=new URL(item.input_path,root),actualPath=await realpath(fileURLToPath(inputRoot));
    if(actualPath!==path.resolve(rootPath,item.input_path)||!actualPath.startsWith(rootPath+path.sep))throw new Error('UAE release input must remain within its manifest directory without symlink aliases');
    for(const file of ['bundle-manifest.json',...INPUT_FILES])if(await realpath(fileURLToPath(new URL(file,inputRoot)))!==path.join(actualPath,file))throw new Error('UAE release input files must not use symlink aliases: '+file);
    if(hash(await readFile(new URL('bundle-manifest.json',inputRoot),'utf8'))!==item.bundle_manifest_sha256)throw new Error('UAE pinned bundle manifest hash mismatch: '+item.release_key);
    const {input,approvedScope}=await loadUaeInput(inputRoot,item.approved_candidate_ids);
    const release=buildRelease(input);
    if(release.manifest.release_id!==item.release_id||release.manifest.review_id!==item.review_id)throw new Error('UAE exact release/review pin mismatch: '+item.release_key);
    // This also checks publication approval, exact active scope and supported roles.
    projectUaeRelease(input,approvedScope,item.approved_candidate_ids,release);
    entries.push({releaseKey:item.release_key,input,approvedScope,expectedReleaseId:item.release_id,expectedReviewId:item.review_id,bundleManifestSha256:item.bundle_manifest_sha256});
  }
  return entries.sort((a,b)=>a.releaseKey.localeCompare(b.releaseKey,'en'));
}
const intervalOverlap=(a,b)=>(a.valid_from??'0000')<=(b.valid_to??'9999')&&(b.valid_from??'0000')<=(a.valid_to??'9999');
function putExact(map,id,value,label){
  if(map.has(id)&&canonicalJSON(map.get(id))!==canonicalJSON(value))throw new Error(`Conflicting UAE ${label} ID: ${id}`);
  if(!map.has(id))map.set(id,structuredClone(value));
}
const decimalKey=value=>value===null?null:value.includes('.')?value.replace(/0+$/,'').replace(/\.$/,''):value;
const economicClaimKey=claim=>canonicalJSON([claim.subject_id,claim.predicate,claim.object_id,claim.report_date,claim.reporting_perimeter_id,claim.reporting_perimeter_version,claim.position_scope_id]);
function economicMetricsKey(claim,denominators){
  return canonicalJSON(claim.metrics.map(({metric_id,denominator_id,reason,...metric})=>{
    const d=denominators.get(denominator_id);
    return {...metric,value:decimalKey(metric.value),denominator:d?{kind:d.kind,value:decimalKey(d.value),availability:d.availability,unit:d.unit,currency:d.currency,as_of_date:d.as_of_date,security_ids:[...d.security_ids].sort(),reporting_perimeter_id:d.reporting_perimeter_id,reporting_perimeter_version:d.reporting_perimeter_version}:null};
  }).sort((a,b)=>a.metric_type.localeCompare(b.metric_type,'en')));
}
const uniqueObjects=items=>[...new Map(items.map(item=>[canonicalJSON(item),item])).entries()].sort(([a],[b])=>a.localeCompare(b,'en')).map(([,item])=>item);
export function projectUaeReleases(entries){
  if(!Array.isArray(entries)||!entries.length)throw new Error('UAE inventory requires independently pinned release entries');
  if(entries.some(entry=>!entry||typeof entry.releaseKey!=='string'||!entry.releaseKey))throw new Error('Duplicate or invalid UAE release key');
  const releases=[],keys=new Set(),nodes=new Map(),identities=new Map(),identifierOwners=[],sources=new Map(),documents=new Map(),evidenceRows=new Map(),denominators=new Map(),perimeters=new Map(),securities=new Map(),claims=new Map(),families=new Map(),edges=new Map(),investors=new Set();
  for(const entry of [...entries].sort((a,b)=>a.releaseKey.localeCompare(b.releaseKey,'en'))){
    const {releaseKey,input,approvedScope,expectedReleaseId,expectedReviewId,bundleManifestSha256}=entry;
    if(typeof releaseKey!=='string'||!releaseKey||keys.has(releaseKey))throw new Error('Duplicate or invalid UAE release key');
    keys.add(releaseKey);assertScope(approvedScope);
    if(!/^[a-f0-9]{64}$/.test(bundleManifestSha256))throw new Error('UAE inventory entry requires exact bundle manifest pin');
    const release=buildRelease(input);
    if(release.manifest.release_id!==expectedReleaseId||release.manifest.review_id!==expectedReviewId)throw new Error('UAE exact release/review pin mismatch: '+releaseKey);
    const graph=projectUaeRelease(input,approvedScope,approvedScope,release);
    const lineage={releaseKey,releaseId:expectedReleaseId,reviewId:expectedReviewId,bundleManifestSha256};
    releases.push({...lineage,candidateIds:[...approvedScope].sort(),claimRevisionIds:[...release.canonical.active_claim_revision_ids].sort(),reviewedAt:input.review.reviewed_at});
    graph.meta.investorIds.forEach(id=>investors.add(id));
    const entities=new Map(input.registry.entities.map(e=>[e.entity_id,e]));
    for(const node of graph.nodes){
      const entity=entities.get(node.id),identity={label:entity.legal_name,entity_type:entity.entity_type};
      putExact(identities,node.id,identity,'entity identity');
      for(const identifier of entity.identifiers){
        for(const prior of identifierOwners){
          if(identifier.namespace!==prior.identifier.namespace||identifier.scope!==prior.identifier.scope||!intervalOverlap(identifier,prior.identifier))continue;
          if((node.id===prior.entityId)!==(identifier.value===prior.identifier.value))throw new Error(`Conflicting UAE scoped entity identifier: ${node.id}`);
        }
        identifierOwners.push({entityId:node.id,identifier});
      }
      const previous=nodes.get(node.id),summaries=[...new Set([...(previous?.summaries??[]),node.summary])].sort();
      nodes.set(node.id,{...structuredClone(node),sourceIds:[...new Set([...(previous?.sourceIds??[]),...node.sourceIds])].sort(),summary:summaries.join(' '),summaries});
    }
    for(const document of release.canonical.documents)putExact(documents,document.document_id,document,'document');
    for(const evidence of release.canonical.evidence)putExact(evidenceRows,evidence.evidence_id,evidence,'evidence');
    for(const denominator of release.canonical.denominators)putExact(denominators,denominator.denominator_id,denominator,'denominator');
    for(const security of input.registry.securities)putExact(securities,security.security_id,{issuer_id:security.issuer_id,instrument_kind:security.instrument_kind,share_class:security.share_class,label:security.label,identifiers:security.identifiers},'security');
    for(const perimeter of input.registry.perimeters)putExact(perimeters,`${perimeter.reporting_perimeter_id}@${perimeter.version}`,perimeter,'perimeter');
    for(const source of graph.sources){
      const doc=documents.get(source.id),value={...source,...(doc.publication_date_basis?{publicationDateBasis:doc.publication_date_basis}:{})};
      putExact(sources,source.id,value,'source');
    }
    const active=new Set(release.canonical.active_claim_revision_ids),activeClaims=release.canonical.claim_revisions.filter(c=>active.has(c.claim_revision_id));
    for(const claim of activeClaims){
      putExact(claims,claim.claim_revision_id,claim,'claim revision');
      putExact(families,claim.claim_id,claim.claim_revision_id,'claim family');
    }
    for(const edge of graph.edges){
      const claim=claims.get(edge.disclosure.claimRevisionId),projected=release.projection.edges.find(e=>e.id===edge.id);
      const evidence=edge.disclosure.evidence.map((e,index)=>{const item=projected.evidence[index],doc=documents.get(item.document_id);return {...e,document_id:item.document_id,evidence_id:item.evidence_id,...(doc.publication_date_basis?{publication_date_basis:doc.publication_date_basis}:{})};});
      const value={...structuredClone(edge),disclosure:{...structuredClone(edge.disclosure),assertionKey:claim.assertion_key,reportingPerimeterId:claim.reporting_perimeter_id,reportingPerimeterVersion:claim.reporting_perimeter_version,positionScopeId:claim.position_scope_id,temporalKind:claim.temporal_kind,effectiveFrom:claim.effective_from,effectiveTo:claim.effective_to,effectiveDateBasis:claim.effective_date_basis,endSemantics:claim.end_semantics,overlapGroupIds:[...claim.overlap_group_ids],evidence}};
      const previous=edges.get(edge.id);
      if(previous){
        const {releaseProvenance,...disclosure}=previous.disclosure;
        if(canonicalJSON({...previous,disclosure})!==canonicalJSON(value))throw new Error('Conflicting UAE projected claim ID: '+edge.id);
        previous.disclosure.releaseProvenance.push(lineage);
      }else edges.set(edge.id,{...value,disclosure:{...value.disclosure,releaseProvenance:[lineage]}});
    }
  }
  // Independent release validation cannot detect conflicts with a different
  // release. Apply the same source-row and economic boundaries to their union.
  const rowOwners=new Map(),economicGroups=new Map();
  for(const edge of [...edges.values()].sort((a,b)=>a.id.localeCompare(b.id,'en'))){
    const claim=claims.get(edge.disclosure.claimRevisionId),economicKey=economicClaimKey(claim),metricsKey=economicMetricsKey(claim,denominators);
    for(const id of claim.primary_evidence_ids){
      const evidence=evidenceRows.get(id),rowKey=canonicalJSON([evidence.document_id,evidence.source_record_key,claim.predicate]),previous=rowOwners.get(rowKey);
      if(previous&&(previous.economicKey!==economicKey||previous.metricsKey!==metricsKey))throw new Error('Conflicting UAE source-row economic assertion: '+evidence.document_id+'/'+evidence.source_record_key);
      rowOwners.set(rowKey,{economicKey,metricsKey});
    }
    const group=economicGroups.get(economicKey);
    if(group&&group.metricsKey!==metricsKey)throw new Error('Conflicting UAE same-scope economic assertion: '+claim.subject_id+'/'+claim.object_id);
    if(group)group.edges.push(edge);else economicGroups.set(economicKey,{metricsKey,edges:[edge]});
  }
  const mergedEdges=[];
  for(const {edges:equivalent}of economicGroups.values()){
    const primary=structuredClone(equivalent[0]),assertions=equivalent.map(edge=>({...structuredClone(edge.disclosure),reportDate:edge.asOf,sourceIds:[...edge.sourceIds]}));
    primary.sourceIds=[...new Set(equivalent.flatMap(edge=>edge.sourceIds))].sort();
    primary.disclosure={...primary.disclosure,...(equivalent.some(edge=>edge.disclosure.correctionStatus==='source_snapshot_only')?{correctionStatus:'source_snapshot_only',correctionScope:'nonexhaustive',correctionCompleteness:'not_established'}:{}),claimIds:[...new Set(assertions.map(a=>a.claimId))].sort(),claimRevisionIds:assertions.map(a=>a.claimRevisionId).sort(),sourceAssertions:assertions,releaseProvenance:uniqueObjects(equivalent.flatMap(edge=>edge.disclosure.releaseProvenance)),evidence:uniqueObjects(equivalent.flatMap(edge=>edge.disclosure.evidence)),caveats:[...new Set(equivalent.flatMap(edge=>edge.disclosure.caveats))].sort(),checkedThrough:equivalent.map(edge=>edge.disclosure.checkedThrough).sort()[0]};
    mergedEdges.push(primary);
  }
  const investorIds=[...investors].sort();
  for(const node of nodes.values())node.kind=uaeNodeKind(identities.get(node.id).entity_type,investors.has(node.id));
  const releaseIds=[...new Set(releases.map(r=>r.releaseId))].sort(),reviewIds=[...new Set(releases.map(r=>r.reviewId))].sort();
  const inputClaimCount=releases.reduce((sum,release)=>sum+release.claimRevisionIds.length,0);
  const graph={meta:{mode:'researched',datasetId:'uae',defaultRoot:investorIds[0],investorIds,updatedAt:releases.map(r=>r.reviewedAt.slice(0,10)).sort().at(-1),releaseId:idFor('uae_inventory',releases),releaseIds,reviewIds,releases,publicationStatus:'approved',inputClaimCount,uniqueClaimRevisionCount:claims.size,displayedDisclosureCount:mergedEdges.length,duplicateAssertionCount:inputClaimCount-mergedEdges.length,coverage:`${mergedEdges.length} selected independently reviewed disclosures across ${investorIds.length} UAE reporting entities from ${releases.length} bounded releases (${inputClaimCount} accepted source assertions). Partial historical coverage, not all holdings or all UAE entities.`,coverageLanes:UAE_COVERAGE,notes:['Every source release is separately reviewed and bounded to 30 claims; the inventory union is not an additive portfolio.','Identical economic assertions share one display row with all source assertions and release provenance retained. Conflicts never choose a winner.','Issuer report dates may differ. A dated disclosure does not establish a current holding.','Unpublished, unreviewed and missing holdings are unknown, not zero.','No aggregate UAE ownership percentage, whole portfolio, AUM or control claim.']},sources:[...sources.values()].sort((a,b)=>a.id.localeCompare(b.id,'en')),nodes:[...nodes.values()].sort((a,b)=>a.id.localeCompare(b.id,'en')),edges:mergedEdges.sort((a,b)=>a.id.localeCompare(b.id,'en'))};
  const errors=validateGraph(graph);if(errors.length)throw new Error(errors.join('\n'));return graph;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const flag=process.argv.indexOf('--releases');
  let manifestUrl=flag===-1?new URL('../data-foundation/uae/releases.json',import.meta.url):pathToFileURL(path.resolve(process.argv[flag+1]??''));
  if(flag!==-1&&(!process.argv[flag+1]||process.argv[flag+1].startsWith('--')))throw new Error('--releases requires a manifest path');
  if(flag===-1){try{await readFile(manifestUrl);}catch(error){if(error.code==='ENOENT')manifestUrl=null;else throw error;}}
  const data=manifestUrl?projectUaeReleases(await loadUaeReleases(manifestUrl)):await (async()=>{const {input,approvedScope}=await loadUaeInput();return projectUae(input,approvedScope);})();
  const generated=pretty(data),output=new URL('../data/uae.json',import.meta.url);
  if(process.argv.includes('--check')){if(await readFile(output,'utf8')!==generated)throw new Error('UAE projection does not match reviewed inputs');console.log('UAE projection matches exact reviewed release inventory.');}
  else{await writeFile(output,generated);console.log('Generated selected reviewed UAE disclosures.');}
}
