import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {buildRelease,pretty} from './foundation/core.mjs';
import {validateGraph} from '../src/graph-model.js';
export async function loadReviewedInput(root=new URL('../data-foundation/researched/input/',import.meta.url)){
  const read=async name=>JSON.parse(await readFile(new URL(`${name}.json`,root),'utf8'));
  const manifest=await read('bundle-manifest');
  for(const [name,expected] of Object.entries(manifest.files)){
    if(!/^[a-z-]+\.json$/.test(name))throw new Error('Invalid reviewed bundle path');
    const contents=await readFile(new URL(name,root));
    if(createHash('sha256').update(contents).digest('hex')!==expected)throw new Error(`Reviewed bundle hash mismatch: ${name}`);
  }
  const independent=await read('independent-review'),review=await read('review'),decision=await read('release-decision');
  if(independent.reviewer_role!=='agent_review'||independent.decisions.some(d=>d.decision!=='accepted_for_model')||decision.authorization_url!==review.publication.authorization_url)throw new Error('Independent review or release authorization mismatch');
  return {batches:[await read('batch')],registry:await read('registry'),sources:await read('sources'),review};
}
// Exact bounded display scope. Adding a claim requires a new independently reviewed increment.
export const APPROVED_SCOPE=['cand_apple_proxy_cook','cand_apple_proxy_management_group','cand_vga_managed_apple2026q2','cand_vga_voting_apple2026q2'];
const descriptions={
  cand_apple_proxy_cook:['Shares are beneficially attributed to Tim Cook and held in an unnamed trust; direct individual legal title is not established.','This disclosure is included in the management-group row. Do not add the two rows.'],
  cand_apple_proxy_management_group:['A reported group of 12 directors and executive officers as of 2 January 2026; it is not a separate legal owner.','The group includes Tim Cook and 8,643 shares subject to near-term restricted-stock-unit vesting. Do not add its row to his.'],
  cand_vga_managed_apple2026q2:['Vanguard Global Advisers, LLC is the reporting affiliate. This is not the whole Vanguard group.','Form 13F reports shared-defined investment discretion (DFND). It does not establish the split between client assets and proprietary assets.','The voting disclosure describes another role on this same position. Do not add it as another holding.'],
  cand_vga_voting_apple2026q2:['Form 13F reports sole voting authority under its non-routine-matter convention; shared-defined relationships may be reported as sole.','Legal ownership of votes and corporate control are not established.','This is the same position as the managed-discretion disclosure, not an additional holding.']
};
export function projectResearched(input){
  const r=buildRelease(input);
  if(r.manifest.fixture_mode||r.manifest.publication_status!=='approved')throw new Error('Only independently reviewed, publication-approved real claims can enter the app');
  const active=new Set(r.canonical.active_claim_revision_ids);
  const claims=r.canonical.claim_revisions.filter(c=>active.has(c.claim_revision_id));
  if(claims.length!==4||claims.some(c=>!APPROVED_SCOPE.includes(c.assertion_key)))throw new Error('Researched export must match the exact four-claim approved scope');
  const docs=new Map(r.canonical.documents.map(d=>[d.document_id,d]));
  const sourceMap=new Map(input.sources.sources.map(s=>[s.source_id,s]));
  const sources=[...docs.values()].map(d=>({id:d.document_id,title:sourceMap.get(d.source_id).source_family.replaceAll('_',' '),url:d.url,publisher:d.publisher,publishedAt:d.published_at}));
  const nodes=r.projection.nodes.map(n=>({id:n.id,label:n.label,kind:n.entity_type==='person'?'person':n.entity_type==='reported_group'?'reported_group':n.id==='ent_vanguard_global_advisers'?'manager':'company',sourceIds:[...new Set(r.projection.edges.filter(e=>e.source===n.id||e.target===n.id).flatMap(e=>e.evidence.map(x=>x.document_id)))],summary:n.id==='ent_apple'?'Selected historical disclosures about Apple common stock. Four role-specific claims from two reporting snapshots; this is not a current shareholder register.':n.id==='ent_vanguard_global_advisers'?'The specific reporting affiliate in a June 2026 Form 13F snapshot. The whole Vanguard group and its AUM are not represented.':n.entity_type==='reported_group'?'The proxy’s 12-person management group as of January 2026. Includes Tim Cook; the two disclosures overlap.':'A named individual in Apple’s January 2026 proxy beneficial ownership disclosure.'}));
  const edges=r.projection.edges.map(e=>{
    const c=claims.find(c=>c.claim_revision_id===e.id),security=input.registry.securities.find(s=>s.security_id===e.security_id);
    const perimeter=input.registry.perimeters.find(p=>p.reporting_perimeter_id===e.reporting_perimeter_id&&p.version===e.reporting_perimeter_version);
    if(e.temporal_kind!=='snapshot'||!e.coverage.length)throw new Error('Public disclosure needs historical snapshot and coverage');
    return {id:e.id,source:e.source,target:e.target,kind:e.relationship,asOf:e.as_of,sourceIds:[...new Set(e.evidence.map(x=>x.document_id))],stakePercent:null,valueUsd:null,disclosure:{claimId:c.claim_id,claimRevisionId:c.claim_revision_id,securityLabel:security.label,metrics:e.metrics.map(m=>({metric_type:m.metric_type,value:m.value,unit:m.unit,reason:m.reason,valuation_date:m.valuation_date,denominator:m.denominator?{value:m.denominator.value,unit:m.denominator.unit,as_of_date:m.denominator.as_of_date,definition:m.denominator.label}:null})),perimeter:{basis:perimeter.basis,definition:perimeter.definition},coverage:e.coverage.map(c=>({status:c.status,description:c.description,expected_source_rows:c.expected_source_rows,captured_source_rows:c.captured_source_rows,whole_portfolio_coverage:c.whole_portfolio_coverage})),caveats:descriptions[c.assertion_key],checkedThrough:e.evidence.map(x=>x.amendment_checked_through).sort()[0],evidence:e.evidence.map(x=>({url:x.url,title:sourceMap.get(docs.get(x.document_id).source_id).source_family.replaceAll('_',' '),publisher:x.publisher,published_at:x.published_at,locator:x.locator}))}};
  });
  const data={meta:{mode:'researched',defaultRoot:'ent_apple',updatedAt:input.review.reviewed_at.slice(0,10),releaseId:r.manifest.release_id,reviewId:input.review.review_id,publicationStatus:'approved',coverage:'Four independently reviewed historical disclosures about Apple common stock: two overlapping beneficial-attribution rows dated 2 January 2026 and two roles on one Vanguard Global Advisers position dated 30 June 2026. Three other pilot candidates remain excluded.',notes:['This is not a current ownership map, complete shareholder register, whole portfolio or AUM.','Do not sum overlapping rows or different roles, dates and reporting perimeters.','No exact beneficial percentage or equity stake is inferred from a less-than-one-percent bound.']},sources,nodes,edges};
  const errors=validateGraph(data);if(errors.length)throw new Error(errors.join('\n'));return data;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const output=new URL('../data/researched.json',import.meta.url);
  const generated=pretty(projectResearched(await loadReviewedInput()));
  if(process.argv.includes('--check')){if(await readFile(output,'utf8')!==generated)throw new Error('Researched projection does not match approved inputs');console.log('Researched projection matches the reviewed four-claim release.');}
  else{await writeFile(output,generated);console.log('Generated four reviewed historical disclosures.');}
}
