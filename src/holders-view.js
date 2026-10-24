import {holdersPilot,validateHoldersPilot,ROLE_LABELS,EQUITY,equityRelationships} from './holders-data.js';
const CATEGORY={bank:'Bank',pension:'Pension fund',insurer:'Insurer',corporate_investor:'Corporate investor',pe_sponsor:'Private-equity sponsor',individual:'Publicly disclosed individual'};
const KIND={bank:'bank',insurer:'insurer',corporate:'company',pension_fund:'pension fund (holds the assets)',governing_body:'governing organization',beneficiary_class:'beneficiaries (class)',asset_manager:'asset manager',custodian:'custodian',fund_account:'fund account',pe_sponsor:'sponsor',pe_manager:'manager',pe_general_partner:'general partner / managing member',pe_fund:'fund',holding_vehicle:'holding vehicle',issuer:'portfolio company / issuer',individual:'individual (public capacity only)'};
const CAPACITY={own_account:'own account',general_account:'general account',beneficial_attribution:'beneficial attribution (voting or investment power)',record_title:'record title',fund_portfolio:'fund portfolio'};
const human=s=>s.replaceAll('_',' ');
export function groupDecimal(s){const [i,f]=s.split('.');return i.replace(/\B(?=(\d{3})+(?!\d))/g,',')+(f?'.'+f:'');}
// Per-case context only. Nothing is added across claims, cases, dates or currencies.
export function caseSummaries(data=holdersPilot){
  return data.cases.map(c=>({case:c,claimCount:data.claims.filter(x=>x.caseId===c.id).length,relationships:equityRelationships(data,c.id).length,roles:data.entities.filter(e=>e.caseId===c.id),gaps:data.gaps.filter(g=>g.caseId===c.id),paths:data.paths.filter(p=>p.caseId===c.id),overlaps:data.overlaps.filter(o=>o.caseId===c.id),exclusions:data.exclusions.filter(x=>x.caseId===c.id)}));
}
export function measureLines(c){
  const x=c.measure,lines=[];
  if(!EQUITY.includes(c.type)){if(x?.quantityRaw)lines.push(`${groupDecimal(x.quantityRaw)} shares under management · no ownership stake`);else lines.push('Role only · carries no ownership stake');return lines;}
  if(x?.quantityRaw)lines.push(`${groupDecimal(x.quantityRaw)} shares`);
  if(x?.percentRaw)lines.push(`${x.percentQualifier==='approximately'?'approximately ':''}${x.percentRaw}% of ${x.percentOf}${x.denominatorRaw?` · denominator ${groupDecimal(x.denominatorRaw)} at ${x.denominatorDate} (source-stated)`:' · denominator not stated'}`);
  else lines.push(`Percentage unknown (${human(c.stake.reason)}) · not set to 0% or 100%`);
  if(x?.votingPowerRaw)lines.push(`${x.votingPowerRaw}% of total voting power (voting, not economic ownership)`);
  if(x?.valueRaw)lines.push(`${groupDecimal(x.valueRaw)} ${x.valueUnit} · ${x.valueBasis} · never converted or added`);
  lines.push(`Capacity: ${CAPACITY[c.capacity]} · form: ${human(c.form)}`);
  if(c.powers){const p=c.powers,v=s=>s===null?'not stated':groupDecimal(s);lines.push(`Voting power: sole ${v(p.votingSole)}, shared ${v(p.votingShared)} · dispositive power: sole ${v(p.dispositiveSole)}, shared ${v(p.dispositiveShared)}`);}
  return lines;
}
export function mountHoldersPilot({document,launcher,beforeOpen=()=>{},returnFocus=()=>launcher,data=holdersPilot}){
  validateHoldersPilot(data);
  const dialog=document.createElement('dialog');dialog.id='holders-dialog';dialog.setAttribute('aria-labelledby','holders-title');
  const el=(tag,text,parent=dialog)=>{const node=document.createElement(tag);if(text)node.textContent=text;parent.append(node);return node;};
  const top=el('div','');top.className='holders-top';
  el('span','SEPARATE LAYER · PILOT',top);const close=el('button','← Back to map',top);close.type='button';
  el('h2','Bank, pension, insurer and private holders · Pilot').id='holders-title';
  el('p',`${data.coverageLabel} Each claim keeps its own role, filing, date and denominator. Claims are never added up across roles, dates, frameworks or currencies.`).className='holders-notice';
  el('p','Roles are separate claims: owning shares on a balance sheet, managing them for clients, holding them as custodian or record holder, controlling a fund as sponsor or general partner, governing a pension fund and being its beneficiary are different things. A role carries no ownership percentage. An indirect path keeps every intermediate and never implies an undisclosed percentage.');
  el('p','Privacy: the one individual is a widely known public figure, recorded only with the public capacity and holdings stated in SEC filings. No address, family, profile or other personal data is kept; other named people are excluded.').className='holders-rule';
  const legend=el('details','');el('summary','Role types and whether they carry a stake',legend);const ul=el('ul','',legend);ul.className='holders-roles';
  for(const [k,v] of Object.entries(ROLE_LABELS))el('li',`${v}: ${EQUITY.includes(k)?'equity claim — percentage only if the source states it':'role only — no ownership stake'}`,ul);
  const label=el('label','Explore one holder category');const filter=el('select','',label);filter.id='holders-filter';
  el('option','All six categories',filter).value='all';
  for(const c of data.cases)el('option',CATEGORY[c.category],filter).value=c.id;
  const count=el('p','');count.setAttribute('role','status');
  const list=el('div','');list.className='holders-cases';
  const sources=new Map(data.sources.map(s=>[s.id,s])),entities=new Map(data.entities.map(e=>[e.id,e])),claims=new Map(data.claims.map(c=>[c.id,c])),summaries=caseSummaries(data);
  const name=id=>entities.get(id).name;
  function claimCard(c,parent){
    const card=el('article','',parent);card.className='holders-claim';el('h4',`${ROLE_LABELS[c.type]}${c.sourceRole?` (${human(c.sourceRole)})`:''}`,card);
    el('p',`${name(c.from)} → ${name(c.to)}`,card).className='holders-kind';
    for(const line of measureLines(c))el('p',line,card);
    if(c.note)el('p',c.note,card);
    const source=sources.get(c.sourceId);el('p',`As of ${c.asOf} · Retrieved ${source.retrievedAt}`,card);
    const details=el('details','',card);el('summary','Evidence and limits',details);
    el('p',`Locator: ${c.locator}`,details);el('p',`Excerpt: ${c.excerpt}`,details);
    el('p',`Source as of ${source.asOf??'not stated'} · published ${source.publishedAt??'not stated'} · retrieved ${source.retrievedAt}`,details);
    const a=el('a',source.title,details);a.href=source.url;a.target='_blank';a.rel='noopener noreferrer';
    el('p',`Reuse: ${source.reuse}`,details);
    el('p','One disclosure on one date. It is not a complete list of this holder’s investments and is not added to other rows.',details);
  }
  function render(){
    list.replaceChildren();const shown=summaries.filter(s=>filter.value==='all'||s.case.id===filter.value);
    for(const s of shown){
      const sec=el('section','',list);sec.className='holders-case';
      el('h3',s.case.label,sec);
      el('p',`${CATEGORY[s.case.category]} · ${s.relationships} equity relationship${s.relationships===1?'':'s'} · ${s.claimCount} claims · ${s.case.status==='documented'?'documented':'source unavailable'}`,sec).className='holders-kind';
      el('p',`Snapshot ${s.case.snapshot.date}: ${s.case.snapshot.label}.`,sec);
      el('p',`Boundary: ${s.case.boundary}`,sec);
      const roles=el('ul','',sec);roles.className='holders-roles';
      for(const e of s.roles)el('li',`${e.name} — ${KIND[e.kind]}${e.publicCapacity?` (${e.publicCapacity})`:''}`,roles);
      for(const c of data.claims.filter(c=>c.caseId===s.case.id))claimCard(c,sec);
      for(const p of s.paths){const chain=p.claimIds.map(id=>claims.get(id));el('p',`Path: ${[chain[0].from,...chain.map(c=>c.to)].map(name).join(' → ')} · derived share: unknown (${human(p.derived.reason)}). ${p.note}`,sec).className='holders-path';}
      for(const o of s.overlaps)el('p',`Overlap, do not add: ${o.reason}`,sec).className='holders-conflict';
      for(const g of s.gaps)el('p',`${human(g.field)}: ${human(g.status)} (${human(g.reason)}). ${g.note}`,sec).className='holders-gap';
      for(const x of s.exclusions)el('p',`Not recorded: ${x.reason}`,sec);
    }
    const n=data.claims.filter(c=>filter.value==='all'||c.caseId===filter.value).length;
    count.textContent=`${shown.length} of ${data.cases.length} categories · ${n} of ${data.claims.length} pilot claims`;
  }
  filter.addEventListener('change',render);
  const reset=el('button','Show all categories');reset.type='button';reset.addEventListener('click',()=>{filter.value='all';render();filter.focus();});
  document.body.append(dialog);launcher.setAttribute('aria-haspopup','dialog');launcher.setAttribute('aria-controls',dialog.id);
  launcher.addEventListener('click',()=>{beforeOpen();filter.value='all';render();dialog.showModal();close.focus();});
  close.addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>returnFocus().focus());
  return {dialog};
}
