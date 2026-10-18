import {readFile,writeFile,readdir,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
export const INPUT_DIRECTORY=path.join(root,'data-foundation/portfolios/input');
export const sha256=text=>createHash('sha256').update(text).digest('hex');
const integer=value=>/^(0|[1-9]\d*)$/.test(String(value));
const date=value=>/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value||'');
const sum=(rows,key)=>rows.reduce((n,p)=>n+BigInt(p[key]),0n).toString();
const permittedUrl=value=>{try{const u=new URL(value);return u.protocol==='https:'&&['www.sec.gov','sec.gov','data.sec.gov'].includes(u.hostname)&&!u.username&&!u.password;}catch{return false;}};
export function validatePortfolio(input){
  const errors=[],quarantine=[],ids=new Set();
  if(!input||!Array.isArray(input.positions)||!Array.isArray(input.sources))return {errors:['Missing positions/sources'],quarantine};
  if(!/^[a-z0-9][a-z0-9_-]+$/.test(input.portfolioId||''))errors.push('Invalid portfolio ID');
  if(!input.filer?.name||!date(input.reportingDate)||!date(input.checkedThrough))errors.push('Missing filer or reporting/check dates');
  const sources=new Set();for(const s of input.sources){if(!s.sourceId||sources.has(s.sourceId)||![s.informationTableUrl,s.coverUrl,s.filingIndexUrl].every(permittedUrl)||!date(s.filingDate))errors.push(`Invalid source ${s.sourceId}`);sources.add(s.sourceId);if(s.reconciliation?.rowCountMatches!==true||s.reconciliation?.valueTotalMatches!==true)errors.push(`Unreconciled source ${s.sourceId}`);}
  const groupMetadata=new Map();
  for(const p of input.positions){const reasons=[];
    if(!p.positionId||ids.has(p.positionId))reasons.push('Missing/duplicate position ID');ids.add(p.positionId);
    if(!p.issuerName||!p.securityClass||!p.reportedSecurityId||!sources.has(p.sourceId)||!Number.isSafeInteger(p.rowOrdinal)||p.rowOrdinal<1)reasons.push('Invalid identity/source row');
    if(p.positionId!==`${p.sourceId}-row-${String(p.rowOrdinal).padStart(5,'0')}`)reasons.push('Unexpected row identity format');
    if(!integer(p.valueUsd)||!integer(p.quantity)||!['SH','PRN'].includes(p.quantityType)||![null,'','PUT','CALL','Put','Call'].includes(p.putCall??null))reasons.push('Invalid amount, quantity or unit');
    for(const k of ['votingSole','votingShared','votingNone'])if(!integer(p[k]))reasons.push(`Invalid ${k}`);
    if(Number(p.valueUsd)>Number.MAX_SAFE_INTEGER)reasons.push('Value exceeds rendering precision');
    const eligible=p.quantityType==='SH'&&!p.putCall&&!/\b(WARRANTS?|RIGHTS?)\b|^\*?W(?:T|TS)?\s+EXP|^(WT|WTS|RTS)$/i.test(p.securityClass)&&!/^(NOTE|NOTES|DEB|DEBENTURE)\b/i.test(p.securityClass);if(p.shareViewEligible!==eligible)reasons.push('Incorrect share eligibility');
    const signature=JSON.stringify([p.sourceId,p.issuerName,p.securityClass]);if(groupMetadata.has(p.reportedSecurityId)&&groupMetadata.get(p.reportedSecurityId)!==signature)reasons.push('Conflicting source-scoped instrument group');groupMetadata.set(p.reportedSecurityId,signature);
    if(reasons.length)quarantine.push({positionId:p.positionId,rowOrdinal:p.rowOrdinal,reasons});
  }
  if(quarantine.length)errors.push(`${quarantine.length} invalid rows quarantined; complete batch withheld`);
  if(!quarantine.length){const r=input.reconciliation||{},included=input.positions.filter(p=>p.shareViewEligible),excluded=input.positions.filter(p=>!p.shareViewEligible);
    for(const [key,actual] of Object.entries({reportedRowCount:input.positions.length,recomputedValueTotalUsd:sum(input.positions,'valueUsd'),shareRowCount:included.length,shareValueUsd:sum(included,'valueUsd'),excludedRowCount:excluded.length,shareReportedSecurityCount:new Set(included.map(p=>p.reportedSecurityId)).size}))if(String(r[key])!==String(actual))errors.push(`Reconciliation mismatch: ${key}`);
    if(r.allActiveSourceTotalsReconciled!==true)errors.push('Active source totals unresolved');
    // Recompute each filing against its own cover totals instead of trusting stored reconciliation flags.
    const active=new Set(Array.isArray(r.activeSourceIds)?r.activeSourceIds:[]);if(!active.size||[...active].some(id=>!sources.has(id)))errors.push('Invalid active source set');
    const foreign=input.positions.filter(p=>!active.has(p.sourceId)).length;if(foreign)errors.push(`${foreign} rows belong to superseded or inactive sources`);
    for(const s of input.sources.filter(s=>active.has(s.sourceId))){const rows=input.positions.filter(p=>p.sourceId===s.sourceId);
      if(!integer(s.cover?.tableEntryTotal)||!integer(s.cover?.tableValueTotal))errors.push(`Missing cover totals ${s.sourceId}`);
      else{if(Number(s.cover.tableEntryTotal)!==rows.length)errors.push(`Cover row count mismatch ${s.sourceId}`);if(s.cover.tableValueTotal!==sum(rows,'valueUsd'))errors.push(`Cover value total mismatch ${s.sourceId}`);}}
  }
  if(!input.amendmentDiscovery?.scope||!input.amendmentLedger?.length)errors.push('Missing amendment discovery');
  return {errors,quarantine};
}
export function projectPortfolio(input,review,inputText=JSON.stringify(input)){
  const validation=validatePortfolio(input);if(validation.errors.length)throw new Error(validation.errors.join('; '));
  if(!review||review.decision!=='approved'||review.inputSha256!==sha256(inputText)||!review.reviewer||review.reviewer===input.importedBy||!date(review.reviewedAt)||!['sourceIdentity','amendmentDiscovery','rowCount','valueTotal','sharePartition','spotChecks','publicRights'].every(k=>review.checks?.[k]===true))throw new Error('Independent complete-batch review is missing, stale or incomplete');
  const r=input.reconciliation,active=new Set(r.activeSourceIds),activeSources=input.sources.filter(s=>active.has(s.sourceId));
  const summary={portfolioId:input.portfolioId,filer:{name:input.filer.name,cik:input.filer.cik},reportingDate:input.reportingDate,checkedThrough:input.checkedThrough.slice(0,10),coverage:[input.coverage.scope,input.coverage.reportType+'.',input.coverage.filerQualification||'',input.coverage.meaning,input.coverage.shareViewRule,input.coverage.overlapPolicy,`Not included: ${input.coverage.excludedFromUniverse.join('; ')}.`].join(' '),reconciliation:{reportedRowCount:r.reportedRowCount,totalValueUsd:String(r.recomputedValueTotalUsd),shareRowCount:r.shareRowCount,shareValueUsd:String(r.shareValueUsd),excludedRowCount:r.excludedRowCount,excludedValueUsd:(BigInt(r.recomputedValueTotalUsd)-BigInt(r.shareValueUsd)).toString(),shareReportedSecurityCount:r.shareReportedSecurityCount},dataQuality:{warnings:(input.dataQuality?.warnings||[]).map(w=>({type:w.type,detail:w.detail,rowCount:w.rowCount})),preservationPolicy:input.dataQuality?.preservationPolicy||''},amendmentSummary:input.amendmentLedger.some(a=>a.amendmentType==='RESTATEMENT')?'A restated filing replaces the superseded original.':'Uses the effective observed filing family.',sources:activeSources.flatMap(s=>[{id:s.sourceId,title:`${input.filer.name} · ${s.form} information table`,url:s.informationTableUrl,publisher:s.publisher,publishedAt:s.filingDate,asOf:input.reportingDate},{id:s.sourceId+'-cover',title:`${s.form} filing cover and totals`,url:s.renderedCoverUrl||s.coverUrl,publisher:s.publisher,publishedAt:s.filingDate,asOf:input.reportingDate}]),dataFile:`${input.portfolioId}.json`};
  const groups=[],groupIndexes=new Map(),rows=[];
  for(const p of input.positions.filter(p=>p.shareViewEligible)){let index=groupIndexes.get(p.reportedSecurityId);if(index===undefined){index=groups.length;groupIndexes.set(p.reportedSecurityId,index);groups.push([p.reportedSecurityId,summary.sources.findIndex(s=>s.id===p.sourceId),p.issuerName,p.securityClass]);}rows.push([p.rowOrdinal,index,String(p.valueUsd),String(p.quantity),p.investmentDiscretion,p.otherManagerRefs??[],String(p.votingSole),String(p.votingShared),String(p.votingNone)]);}
  return {summary,data:{schemaVersion:1,portfolioId:input.portfolioId,groups,rows}};
}
// Instrument IDs are positional per source, so the identity map is only valid for the exact inputs it was audited against.
export function validateEquivalence(identity,inputs){
  const errors=[],c=identity?.coverage;if(identity?.schemaVersion!==1||!Array.isArray(identity.groups)||!c)return ['Invalid instrument identity map'];
  const byId=new Map(inputs.map(i=>[i.input.portfolioId,i]));
  if([...byId.keys()].sort().join('|')!==[...(c.portfolioIds||[])].sort().join('|'))errors.push('Identity map portfolio set differs from admitted inputs');
  for(const f of c.inputFiles||[]){const i=byId.get(f.portfolioId);if(!i||f.sha256!==sha256(i.raw)||f.reportingDate!==i.input.reportingDate)errors.push(`Identity map is stale for ${f.portfolioId}; rebuild and re-review it`);}
  if((c.inputFiles||[]).length!==byId.size)errors.push('Identity map input hashes incomplete');
  const active=inputs.flatMap(i=>i.input.sources.filter(s=>i.input.reconciliation.activeSourceIds.includes(s.sourceId)));
  if(JSON.stringify((identity.sourceChecks||[]).map(s=>[s.sourceId,s.informationTableSha256,s.rowCount,s.informationTableUrl]).sort())!==JSON.stringify(active.map(s=>[s.sourceId,s.informationTableSha256,s.cover?.tableEntryTotal===undefined?null:Number(s.cover.tableEntryTotal),s.informationTableUrl]).sort()))errors.push('Identity map source checks differ from active filings');
  const instruments=new Map();let rows=0;
  for(const {input} of inputs)for(const p of input.positions.filter(p=>p.shareViewEligible)){rows++;if(!instruments.has(p.reportedSecurityId))instruments.set(p.reportedSecurityId,{portfolioId:input.portfolioId,key:JSON.stringify([p.securityClass.trim(),p.quantityType,p.putCall??null])});}
  const seen=new Set(),sizes={},pairs=new Map();
  identity.groups.forEach((group,index)=>{const members=Array.isArray(group)?group:group?.members;
    if(!Array.isArray(members)||members.length<2){errors.push(`Invalid identity group ${index+1}`);return;}
    const info=members.map(id=>instruments.get(id));if(info.includes(undefined)||members.some(id=>seen.has(id))){errors.push(`Unknown or repeated instrument in group ${index+1}`);return;}members.forEach(id=>seen.add(id));
    if(new Set(info.map(i=>i.key)).size!==1)errors.push(`Class/type/option mismatch in group ${index+1}`);
    const ids=info.map(i=>i.portfolioId).sort();if(new Set(ids).size!==ids.length)errors.push(`Same-filer merge in group ${index+1}`);
    sizes[members.length]=(sizes[members.length]||0)+1;for(let a=0;a<ids.length;a++)for(let b=a+1;b<ids.length;b++){const k=ids[a]+'|'+ids[b];pairs.set(k,(pairs.get(k)||0)+1);}});
  for(const [key,actual] of Object.entries({eligibleSourceRows:rows,eligibleSourceScopedInstruments:instruments.size,matchedGroups:identity.groups.length,matchedSourceScopedInstruments:seen.size,unmatchedSourceScopedInstruments:instruments.size-seen.size}))if(c[key]!==actual)errors.push(`Identity coverage mismatch: ${key}`);
  if(JSON.stringify(Object.entries(c.groupsByMemberCount||{}).sort())!==JSON.stringify(Object.entries(sizes).sort()))errors.push('Identity coverage mismatch: groupsByMemberCount');
  for(const pc of c.pairCounts||[])if((pairs.get([...pc.portfolioIds].sort().join('|'))||0)!==pc.matchedGroups)errors.push(`Identity coverage mismatch: pair ${pc.portfolioIds.join('/')}`);
  return errors;
}
export async function exportPortfolios({directory=INPUT_DIRECTORY,check=false}={}){
  const files=(await readdir(directory)).filter(f=>f.endsWith('.normalized.json.gz')).sort(),portfolios=[],inputs=[];let bytes=0;
  const save=async(file,output)=>{bytes+=output.length;const target=path.join(root,'data',file);if(check){if(await readFile(target,'utf8')!==output)throw new Error(`Public ${file} is stale; run data:export-portfolios`);}else await writeFile(target,output);};
  for(const file of files){const raw=gunzipSync(await readFile(path.join(directory,file))).toString('utf8'),input=JSON.parse(raw),validation=validatePortfolio(input);if(validation.quarantine.length){await mkdir(path.join(root,'data-foundation/portfolios/quarantine'),{recursive:true});await writeFile(path.join(root,'data-foundation/portfolios/quarantine',file+'.json'),JSON.stringify(validation,null,2)+'\n');}const review=JSON.parse(await readFile(path.join(directory,file.replace('.normalized.json.gz','.review.json')),'utf8'));const projected=projectPortfolio(input,review,raw);inputs.push({raw,input});portfolios.push(projected.summary);await save(projected.summary.dataFile,JSON.stringify(projected.data)+'\n');}
  if(!portfolios.length)throw new Error('No reviewed portfolios');
  const identityErrors=validateEquivalence(JSON.parse(await readFile(path.join(root,'data/instrument-equivalence.json'),'utf8')),inputs);if(identityErrors.length)throw new Error(identityErrors.join('; '));
  const defaultPortfolio=(portfolios.find(p=>/blackrock/i.test(p.filer.name))||portfolios[0]).portfolioId;
  await save('portfolios.json',JSON.stringify({schemaVersion:1,defaultPortfolio,portfolios})+'\n');
  return {portfolios:portfolios.length,positions:portfolios.reduce((n,p)=>n+p.reconciliation.shareRowCount,0),bytes};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))exportPortfolios({check:process.argv.includes('--check')}).then(result=>console.log(`Full portfolios: ${JSON.stringify(result)}`)).catch(error=>{console.error(error.message);process.exitCode=1;});
