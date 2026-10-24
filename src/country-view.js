import {countryPilot,validateCountryPilot,queryCountry,dimensionValues,ownershipPath,armenianEntityIds,factCount,DIMENSIONS,COUNTRY_NAMES,CURRENCY_NAMES,BASIS_LABELS,UNKNOWN_REASONS} from './country-data.js';
const label=code=>code==='unknown'?'Unknown':code==='non_resident'?'Non-resident of Armenia (country not stated)':COUNTRY_NAMES[code]?`${COUNTRY_NAMES[code]} (${code})`:`${CURRENCY_NAMES[code]} (${code})`;
const valueText=v=>v.status==='known'?`${v.codes.map(label).join(', ')} · basis: ${BASIS_LABELS[v.basis]}`:v.status==='non_resident'?'Non-resident of Armenia · country not stated':`Unknown (${UNKNOWN_REASONS[v.reason]})`;
const stakeText=s=>s.status==='known'?`${s.percentage}% · ${s.denominator}`:`Percentage unknown (${UNKNOWN_REASONS[s.reason]}) — not set to 0% or 100%`;
const PRESETS=[['operatingLocation','AM','Operating location = Armenia'],['investorDomicile','AM','Investor domicile = Armenia'],['issuerDomicile','AM','Issuer domicile = Armenia']];
export function mountCountryPilot({document,launcher,beforeOpen=()=>{},returnFocus=()=>launcher,data=countryPilot}){
  validateCountryPilot(data);
  const dialog=document.createElement('dialog');dialog.id='country-dialog';dialog.setAttribute('aria-labelledby','country-title');
  const el=(tag,text,parent=dialog)=>{const node=document.createElement(tag);if(text)node.textContent=text;parent.append(node);return node;};
  const top=el('div','');top.className='country-top';
  el('span','SEPARATE LAYER · PILOT',top);const close=el('button','← Back to map',top);close.type='button';
  el('h2','Country exploration: Armenia · Pilot').id='country-title';
  el('p',`Five separate questions about one country. ${armenianEntityIds(data).length} Armenian entities and ${factCount(data)} sourced facts: a small bounded sample, not a census. There is no country total and no "Armenian wealth" figure. Stakes and values are never added across holders, issuers or countries.`).className='country-notice';
  el('p','Each dimension is answered only by its own source. Currency is never used as geography. A name or legal-form suffix never sets a country. Unknown stays unknown. Ownership chains keep their intermediate entities, and named natural persons are excluded.');
  const dict=el('details','');dict.className='country-dictionary';el('summary','What each dimension can and cannot say',dict);
  const dl=el('dl','',dict);for(const d of data.dimensions){el('dt',d.label,dl);const dd=el('dd','',dl);el('p',d.definition,dd);el('p',`Can say: ${d.canSay}`,dd);el('p',`Cannot say: ${d.cannotSay}`,dd);}
  el('h3','Armenia under each dimension (record counts, not values)');
  const compare=el('ul','');compare.className='country-compare';
  for(const d of data.dimensions){if(d.kind==='currency'){el('li',`${d.label}: not a geography question; AMD reporting matches ${queryCountry(data,d.id,'AMD').entities.length} entity and is not "in Armenia"`,compare);continue;}
    const q=queryCountry(data,d.id,'AM'),n=q.claims.length||q.entities.length,unit=d.scope==='claim'?(n===1?'ownership claim':'ownership claims'):(n===1?'entity':'entities');
    el('li',`${d.label} = Armenia: ${n} ${unit} · ${(d.scope==='claim'?queryCountry(data,d.id,'unknown').claims:queryCountry(data,d.id,'unknown').entities).length} unknown`,compare);}
  const presets=el('div','');presets.className='country-presets';
  const controls=el('div','');controls.className='country-controls';
  const dimLabel=el('label','Country dimension',controls);const dimSelect=el('select','',dimLabel);dimSelect.id='country-dimension';
  for(const d of data.dimensions)el('option',d.label,dimSelect).value=d.id;
  const valLabel=el('label','Value',controls);const valSelect=el('select','',valLabel);valSelect.id='country-value';
  const count=el('p','');count.setAttribute('role','status');
  const explain=el('p','');explain.className='country-explain';
  const list=el('div','');list.className='country-cards';
  const entities=new Map(data.entities.map(e=>[e.id,e])),sources=new Map(data.sources.map(s=>[s.id,s]));
  const evidence=(parent,summary,{sourceId,locator,excerpt,note})=>{
    const details=el('details','',parent);el('summary',summary,details);const source=sources.get(sourceId);
    el('p',`Locator: ${locator}`,details);el('p',`Excerpt: ${excerpt}`,details);if(note)el('p',`Note: ${note}`,details);
    el('p',`Source as of ${source.asOf??'no date stated'} (${source.asOfBasis.replace(/_/g,' ')}) · retrieved ${source.retrievedAt} · language ${source.language}. Retrieval is an observation date, not a current-ownership guarantee.`,details);
    const a=el('a',source.title,details);a.href=source.url;a.target='_blank';a.rel='noopener noreferrer';el('p',`Reuse: ${source.reuse}`,details);
  };
  const dimRow=(parent,d,v,focus)=>{const row=el('p','',parent);row.className=focus?'country-dim country-focus':'country-dim';el('strong',`${d.label}: `,row);row.append(valueText(v));if(v.status==='unknown'&&v.note)row.append(` — ${v.note}`);if(v.status!=='unknown')evidence(parent,`Evidence: ${d.label.toLowerCase()}`,v);};
  function entityCard(e,focus){
    const card=el('article','',list);card.className='country-card';el('h3',e.name,card);
    el('p',`${e.kind.replace(/_/g,' ')} · ${e.role.replace(/_/g,' ')}${e.lei?` · LEI ${e.lei}`:''}`,card).className='country-kind';
    for(const d of data.dimensions.filter(d=>d.scope==='entity'))if(d.id===focus||e.role!=='counterparty')dimRow(card,d,e.dims[d.id],d.id===focus);
    const owners=data.claims.filter(c=>c.to===e.id);
    if(owners.length){el('p','Disclosed holders (not summed):',card).className='country-sub';const ul=el('ul','',card);ul.className='country-holders';
      for(const c of owners){const li=el('li',`${entities.get(c.from).name} · ${stakeText(c.stake)} · investor domicile: ${valueText(c.investorDomicile)} · as of ${c.asOf}`,ul);evidence(li,'Evidence: holding',c);}}
    for(const p of data.paths.filter(p=>ownershipPath(data,p.id).entities.at(-1)===e.id)){const path=ownershipPath(data,p.id);el('p',`Chain: ${path.entities.map(id=>entities.get(id).name).join(' → ')}. Look-through share: not computed. ${p.note}`,card).className='country-path';}
    for(const x of data.exclusions.filter(x=>[e.id,...data.claims.filter(c=>c.to===e.id).map(c=>c.from),...data.claims.filter(c=>c.to===e.id).flatMap(c=>data.claims.filter(u=>u.to===c.from).map(u=>u.from))].includes(x.subjectId)))el('p',`Excluded: ${x.reason}`,card).className='country-excluded';
    if(e.coverage)el('p',`Coverage: ${e.coverage}`,card).className='country-coverage';
  }
  function claimCard(c){
    const card=el('article','',list);card.className='country-card';const from=entities.get(c.from),to=entities.get(c.to);el('h3',`${from.name} → ${to.name}`,card);
    el('p',`${c.type.replace(/_/g,' ')} · ${stakeText(c.stake)} · as of ${c.asOf}`,card).className='country-kind';
    dimRow(card,DIMENSIONS[0],c.investorDomicile,true);
    const op=to.dims.operatingLocation;el('p',`Held entity's operating location (a separate dimension): ${valueText(op)}`,card).className='country-dim';
    evidence(card,'Evidence: holding',c);
  }
  function fillValues(code){valSelect.replaceChildren();for(const v of dimensionValues(data,dimSelect.value))el('option',label(v),valSelect).value=v;valSelect.value=[...valSelect.options].some(o=>o.value===code)?code:valSelect.options[0].value;}
  function render(){
    list.replaceChildren();const q=queryCountry(data,dimSelect.value,valSelect.value),d=q.dimension;
    if(d.scope==='claim')for(const c of q.claims)claimCard(c);else for(const e of q.entities)entityCard(e,d.id);
    count.textContent=`${d.label} = ${label(valSelect.value)}: ${list.children.length} ${d.scope==='claim'?'ownership claims':'entities'} · record counts only, no totals`;
    explain.textContent=d.kind==='currency'?'Currency answers "what currency are the figures in", never "where". An entity reporting in USD can operate in Armenia.':`This dimension cannot say: ${d.cannotSay}`;
  }
  const show=(dim,code)=>{dimSelect.value=dim;fillValues(code);render();};
  for(const [dim,code,text] of PRESETS){const b=el('button',text,presets);b.type='button';b.addEventListener('click',()=>{show(dim,code);dimSelect.focus();});}
  dimSelect.addEventListener('change',()=>{fillValues('AM');render();});valSelect.addEventListener('change',render);
  document.body.append(dialog);launcher.setAttribute('aria-haspopup','dialog');launcher.setAttribute('aria-controls',dialog.id);
  launcher.addEventListener('click',()=>{beforeOpen();show('operatingLocation','AM');dialog.showModal();close.focus();});
  close.addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>returnFocus().focus());
  return {dialog};
}
