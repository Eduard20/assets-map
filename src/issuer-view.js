import {issuerPilot,validateIssuerPilot} from './issuer-data.js';
const TYPE={beneficial_ownership:'Disclosed beneficial ownership',voting_power_stated:'Stated share of total voting power',major_holding_notification:'Major-holding notification',attribution_chain_entry:'Controlled undertaking in the notified chain',reporting_scope_transition:'Reporting-scope change (not a sale)',disclosure_gap:'Disclosure gap'};
const REGIME={US_SEC:'United States · SEC (DEF 14A, Schedule 13G)',UK_FCA:'United Kingdom · FCA (DTR 5 TR-1 via NSM)',DE_BAFIN:'Germany · BaFin (WpHG voting-rights notifications)'};
const FRAMEWORK={SEC_13d3:'SEC Rule 13d-3 beneficial ownership',UK_DTR5:'UK DTR 5 voting rights',DE_WpHG:'German WpHG §§ 33–39 voting rights'};
const KIND={legal_entity:'legal entity',government:'government',aggregate_group:'aggregate group row'};
export function groupDecimal(s){const [i,f]=s.split('.');return i.replace(/\B(?=(\d{3})+(?!\d))/g,',')+(f?'.'+f:'');}
const power=(label,p)=>p?`${label}: sole ${p.sole===null?'not stated':groupDecimal(p.sole)}, shared ${p.shared===null?'not stated':groupDecimal(p.shared)}`:`${label}: not stated for this row`;
// Per-issuer context. Never adds holders, classes, frameworks or dates together.
export function issuerSummaries(data=issuerPilot){
  const dens=data.denominators;
  return data.issuers.map(issuer=>{
    const own=data.claims.filter(c=>c.issuerId===issuer.id);
    const classes=issuer.classes.map(c=>({...c,denominators:dens.filter(d=>d.classIds.length===1&&d.classIds[0]===c.id)}));
    const votes=dens.filter(d=>d.issuerId===issuer.id&&d.kind==='combined_votes');
    const stated=classes.map(c=>c.denominators.find(d=>d.sourceId===issuer.snapshot.anchorSourceId));
    const multi=new Set(issuer.classes.map(c=>c.votesPerShareRaw).filter(v=>v!==null)).size>1;
    const economic=multi?(stated.every(d=>d?.availability==='known')?'not_combined':'unknown'):'single_class_scope';
    return {issuer,claimCount:own.length,classes,votes,economic,overlaps:data.overlapGroups.filter(g=>g.issuerId===issuer.id),exclusions:data.exclusions.filter(x=>x.issuerId===issuer.id),gap:own.find(c=>c.type==='disclosure_gap')??null,frameworks:[...new Set(own.map(c=>c.framework).filter(Boolean))]};
  });
}
export function mountIssuerPilot({document,launcher,beforeOpen=()=>{},returnFocus=()=>launcher,data=issuerPilot}){
  validateIssuerPilot(data);
  const dialog=document.createElement('dialog');dialog.id='issuer-dialog';dialog.setAttribute('aria-labelledby','issuer-title');
  const el=(tag,text,parent=dialog)=>{const node=document.createElement(tag);if(text)node.textContent=text;parent.append(node);return node;};
  const top=el('div','');top.className='issuer-top';
  el('span','SEPARATE LAYER · PILOT',top);const close=el('button','← Back to map',top);close.type='button';
  el('h2','Who owns this issuer? · Pilot').id='issuer-title';
  el('p',`${data.coverageLabel} Each row keeps its own filing, share class, date and denominator. Rows are never added up: beneficial-ownership groups overlap, frameworks differ and dates differ.`).className='issuer-notice';
  el('p','Economic ownership and voting power are different. A class with ten votes per share can hold most of the votes with a small part of the shares. A percentage is shown only with the class and the denominator the filing states.');
  el('p','Privacy: individually named people are not recorded. Only legal entities, governments and the filing’s “directors and executive officers as a group” row are shown. Excluded rows are counted for each issuer.').className='issuer-rule';
  el('h3','Issuers side by side (not summed)');
  const compare=el('div','');compare.className='issuer-compare';
  const label=el('label','Explore one issuer');const filter=el('select','',label);filter.id='issuer-filter';
  el('option','All issuers',filter).value='all';
  for(const i of data.issuers)el('option',i.name,filter).value=i.id;
  const count=el('p','');count.setAttribute('role','status');
  const list=el('div','');list.className='issuer-claims';
  const sources=new Map(data.sources.map(s=>[s.id,s])),holders=new Map(data.holders.map(h=>[h.id,h])),issuers=new Map(data.issuers.map(i=>[i.id,i])),classes=new Map(data.issuers.flatMap(i=>i.classes).map(c=>[c.id,c])),dens=new Map(data.denominators.map(d=>[d.id,d])),summaries=issuerSummaries(data);
  const link=(source,parent)=>{const a=el('a',source.title,parent);a.href=source.url;a.target='_blank';a.rel='noopener noreferrer';};
  const denText=d=>d.availability==='known'?`${groupDecimal(d.valueRaw)} ${d.unit.replace('_',' ')} at ${d.asOf}${d.origin==='calculated'?` (calculated, ${d.formula})`:' (source-stated)'}`:`unknown (${d.reason.replaceAll('_',' ')})`;
  function renderCompare(){
    compare.replaceChildren();
    for(const s of summaries.filter(s=>filter.value==='all'||s.issuer.id===filter.value)){
      const card=el('section','',compare);card.className='issuer-card';el('h4',s.issuer.name,card);
      el('p',`${REGIME[s.issuer.regime]} · ${s.issuer.status==='private'?'private company':'listed'}`,card).className='issuer-kind';
      el('p',`Snapshot: ${s.issuer.snapshot.label}.`,card);
      for(const c of s.classes)el('p',`${c.label}: ${c.votesPerShareRaw===null?'votes per share not stated':`${c.votesPerShareRaw} vote${c.votesPerShareRaw==='1'?'':'s'} per share`} · denominator ${c.denominators.length?c.denominators.map(denText).join('; '):'not recorded'}`,card);
      for(const v of s.votes){const inputs=v.inputIds.map(id=>dens.get(id));el('p',`Vote base: ${groupDecimal(v.valueRaw)} votes at ${v.asOf} = ${inputs.map(d=>`${groupDecimal(d.valueRaw)} × ${classes.get(d.classIds[0]).votesPerShareRaw}`).join(' + ')} (calculated, ${v.formula}). It matches the stated voting percentages.`,card).className='issuer-figure';}
      if(s.economic==='unknown')el('p','Economic share across all classes: unknown. The filing does not state every class’s shares outstanding, so class percentages cannot be combined.',card).className='issuer-gap';
      if(s.economic==='not_combined')el('p','Class percentages are shown separately. They are not combined into one economic percentage.',card);
      if(s.gap)el('p',`Shareholders: unknown (${s.gap.holders.reason.replaceAll('_',' ')}). ${s.gap.note}`,card).className='issuer-gap';
      for(const g of s.overlaps)el('p',`Overlap, do not add: ${g.reason}`,card).className='issuer-conflict';
      for(const x of s.exclusions)el('p',`Not recorded (${x.category.replaceAll('_',' ')}, ${x.rowCount} rows): ${x.reason}`,card);
    }
  }
  function value(c){
    const h=holders.get(c.holderId),cls=classes.get(c.classId),d=dens.get(c.denominatorId);
    if(c.type==='beneficial_ownership')return [`${h.name} (${KIND[h.kind]}) · ${cls.label} · ${groupDecimal(c.quantityRaw)} shares · ${c.percentQualifier==='stated'?`${c.percentRaw}% of class`:'less than 1% of class (source marker)'}`,`Denominator: ${cls.label} outstanding, ${denText(d)}`,`${power('Voting authority',c.votingAuthority)} · ${power('Dispositive power',c.dispositivePower)}`,c.reliesOn?`Issuer table relies on: ${c.reliesOn}`:null,c.qualifier];
    if(c.type==='voting_power_stated')return [`${h.name} (${KIND[h.kind]}) · ${c.percentRaw}% of total voting power`,`Denominator: votes of ${c.classIds.map(id=>classes.get(id).label).join(' + ')}, ${denText(d)}`,'Voting power, not economic ownership.'];
    if(c.type==='major_holding_notification')return [`${h.name} (${KIND[h.kind]})${c.directHolderId&&c.directHolderId!==c.holderId?` · direct holder: ${holders.get(c.directHolderId).name}`:''} · total ${c.totalPercentRaw}% of voting rights (source-stated)`,
      ...c.lines.map(l=>`${classes.get(l.classId).label}: direct ${l.directPercentRaw===null?'blank':`${l.directPercentRaw}%`}${l.directRaw!==null?` (${groupDecimal(l.directRaw)})`:''} · indirect ${l.indirectPercentRaw===null?'blank':`${l.indirectPercentRaw}%`}${l.indirectRaw!==null?` (${groupDecimal(l.indirectRaw)})`:''}`),
      `Voting rights attached to shares: ${c.sharesPercentRaw}% · through instruments: ${c.instrumentsPercentRaw===null?'blank':`${c.instrumentsPercentRaw}%`}${c.instruments.length?` (${c.instruments.map(x=>`${x.kind} ${x.percentRaw}%`).join('; ')})`:''}`,
      c.previousTotalPercentRaw?`Previous notified total: ${c.previousTotalPercentRaw}%`:null,
      `Denominator: ${d.availability==='known'?`not named in the notification; the issuer’s latest total-voting-rights figure before it was ${denText(d)}. Not recomputed.`:denText(d)}`];
    if(c.type==='attribution_chain_entry')return [`${h.name} (${KIND[h.kind]}) · ${c.percentRaw}% in the chain under ${holders.get(data.claims.find(o=>o.id===c.parentClaimId).holderId).name}`,'Part of the parent’s notified total, not an additional holding.'];
    if(c.type==='reporting_scope_transition')return [`${h.name} · ${cls.label} · reported ${c.quantityRaw} shares as of ${c.eventDate} after a realignment on ${c.transitionDate}`,c.note];
    return [`Shareholders: unknown (${c.holders.reason.replaceAll('_',' ')})`,c.note];
  }
  function render(){
    renderCompare();list.replaceChildren();const claims=data.claims.filter(c=>filter.value==='all'||c.issuerId===filter.value);count.textContent=`${claims.length} of ${data.claims.length} pilot claims`;
    for(const c of claims){
      const card=el('article','',list);card.className='issuer-claim';el('h4',`${issuers.get(c.issuerId).name} · ${TYPE[c.type]}`,card);
      const [first,...rest]=value(c).filter(Boolean);el('p',first,card).className='issuer-kind';for(const line of rest)el('p',line,card);
      const source=sources.get(c.sourceId),day=c.reportDate??c.eventDate??c.publishedDate;
      el('p',`${c.type==='disclosure_gap'?'Checked':c.reportDate?'Record date':c.eventDate?'Date of event':'Published'}: ${day??source.retrievedAt}${c.framework?` · ${FRAMEWORK[c.framework]}`:''} · Retrieved: ${source.retrievedAt}`,card);
      const details=el('details','',card);el('summary','Evidence and limits',details);
      el('p',`Locator: ${c.locator}`,details);el('p',`Excerpt: ${c.excerpt}`,details);
      link(source,details);el('p',`Reuse terms: ${source.reuse}`,details);
      el('p',c.type==='disclosure_gap'?'Absence of a public filing is not evidence of any particular owner. No shareholder or percentage is estimated.':'One disclosure on one date. It is not a complete list of owners and is not added to other rows.',details);
    }
  }
  filter.addEventListener('change',render);
  const reset=el('button','Show all issuers');reset.type='button';reset.addEventListener('click',()=>{filter.value='all';render();filter.focus();});
  document.body.append(dialog);launcher.setAttribute('aria-haspopup','dialog');launcher.setAttribute('aria-controls',dialog.id);
  launcher.addEventListener('click',()=>{beforeOpen();filter.value='all';render();dialog.showModal();close.focus();});
  close.addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>returnFocus().focus());
  return {dialog};
}
