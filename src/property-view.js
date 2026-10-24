import {propertyPilot,validatePropertyPilot,physicalAssetTotal,lookThrough,ROLE_LABELS,METRIC_LABELS} from './property-data.js';
const CASES={property:'Property · one REIT Schedule III',infrastructure:'Infrastructure · one UK PFI project'};
const amount=m=>`${m.currency} ${m.amount.toLocaleString('en-US')}`;
const scopeText=m=>`${m.scope.replace(/_/g,' ')} · ${m.shareBasis.replace(/_/g,' ')} · ${m.grossOrNet.replace(/_/g,' ')} · as of ${m.date}`;
const stakeText=s=>s.status==='known'?`${s.percentage}% · ${s.denominator}`:s.status==='not_applicable'?'No stake: this role carries no ownership percentage':`Percentage unknown (${s.reason.replace(/_/g,' ')}) — not set to 0% or 100%`;
export function mountPropertyPilot({document,launcher,beforeOpen=()=>{},returnFocus=()=>launcher,data=propertyPilot}){
  validatePropertyPilot(data);
  const dialog=document.createElement('dialog');dialog.id='property-dialog';dialog.setAttribute('aria-labelledby','property-title');
  const el=(tag,text,parent=dialog)=>{const node=document.createElement(tag);if(text)node.textContent=text;parent.append(node);return node;};
  const top=el('div','');top.className='property-top';
  el('span','SEPARATE LAYER · PILOT',top);const close=el('button','← Back to map',top);close.type='button';
  el('h2','Property and infrastructure · Pilot').id='property-title';
  el('p','Physical-asset lane only: 14 buildings from one REIT\'s SEC Schedule III and one UK PFI road project. Owner, authority, SPV and equity roles are separate claims. A small bounded sample, not an asset registry.').className='property-notice';
  el('p','Holding shares of a REIT or infrastructure company is a separate security-lane fact. It is never added to these building or project values, and no one here "owns part of" a building or road unless a source states it. Locations stop at city or region; no addresses, postcodes, parcels or coordinates are published.');
  const label=el('label','Explore a bounded case');const filter=el('select','',label);filter.id='property-filter';
  el('option','Both cases',filter).value='all';for(const [k,v] of Object.entries(CASES))el('option',v,filter).value=k;
  const count=el('p','');count.setAttribute('role','status');
  const summary=el('div','');summary.className='property-summary';
  const list=el('div','');list.className='property-cards';
  const records=new Map([...data.entities,...data.assets,...data.projects].map(r=>[r.id,r])),sources=new Map(data.sources.map(s=>[s.id,s]));
  const name=id=>records.get(id)?.name??records.get(id)?.label;
  const evidence=(card,source,locator,excerpt)=>{
    const details=el('details','',card);el('summary','Evidence and limits',details);
    el('p',`Locator: ${locator}`,details);el('p',`Excerpt: ${excerpt}`,details);
    el('p',`Source as of ${source.asOf} · published ${source.publishedAt} · retrieved ${source.retrievedAt}. Retrieval is an observation date, not a current-ownership guarantee.`,details);
    const a=el('a',source.title,details);a.href=source.url;a.target='_blank';a.rel='noopener noreferrer';
    el('p',`Reuse: ${source.reuse}`,details);return details;
  };
  const metricRow=(parent,m)=>{
    const row=el('p','',parent);row.className='property-metric';
    const what=m.type==='asset_value'&&m.basis==='cost'?'Asset value — cost-basis carrying amount, not market value':m.type==='project_cost'?'Project cost (source "Capital Value") — not anyone\'s owned value':m.type==='encumbrance'&&m.amount===0?'Encumbrance — source reports none (a real zero)':METRIC_LABELS[m.type];
    el('strong',`${what}: `,row);row.append(`${amount(m)} · ${scopeText(m)} · reported ${m.reported}`);
  };
  const gapList=(parent,subjects)=>{const gaps=data.gaps.filter(g=>subjects.includes(g.subject));if(!gaps.length)return;const ul=el('ul','',parent);ul.className='property-gaps';for(const g of gaps)el('li',`${g.field}: ${g.status} (${g.reason.replace(/_/g,' ')}). ${g.note}`,ul);};
  function propertyCard(asset){
    const card=el('article','',list);card.className='property-card';card.dataset.case='property';el('h3',asset.label,card);
    const l=asset.location;el('p',`Commercial building · ${l.sourceText}, ${l.country} · location precision: ${l.precision}`,card).className='property-kind';
    for(const c of data.claims.filter(c=>c.to===asset.id))el('p',`${ROLE_LABELS[c.type]}: ${name(c.from)} · ${stakeText(c.stake)} · snapshot ${c.asOf}`,card);
    for(const m of asset.metrics)metricRow(card,m);
    el('p',`Built ${asset.yearBuilt} · acquired ${asset.yearAcquired} (source: original date of acquisition by sponsored entity)`,card);
    evidence(card,sources.get(asset.sourceId),asset.locator,asset.excerpt);
  }
  function projectCard(project){
    const card=el('article','',list);card.className='property-card property-project';card.dataset.case='infrastructure';el('h3',project.label,card);
    el('p',`PFI project · ${project.sector} · ${project.status} · source region: ${project.location.sourceText} (${project.location.subdivision}, precision: ${project.location.precision})`,card).className='property-kind';
    const roles=el('ul','',card);roles.className='property-roles';
    const claims=data.claims.filter(c=>c.to===project.id||c.scope===project.id);
    for(const c of claims){const term=c.temporalKind==='interval'?` · ${c.effectiveFrom} to ${c.effectiveTo} (${c.endSemantics.replace(/_/g,' ')})`:` · snapshot ${c.asOf}`;el('li',`${ROLE_LABELS[c.type]}: ${name(c.from)} → ${name(c.to)}${records.get(c.to)?.kind==='spv'?' (SPV)':''} · ${stakeText(c.stake)}${term}`,roles);}
    for(const m of project.metrics)metricRow(card,m);
    const equity=claims.filter(c=>c.type==='direct_equity_ownership'),gap=data.gaps.find(g=>g.subject===project.id&&g.field==='asset_title');
    for(const c of equity){const derived=lookThrough([c,{stake:{status:gap?gap.status:'known'}}]);el('p',`${name(c.from)} share of the physical road: ${derived.status} (${derived.reason.replace(/_/g,' ')}). ${c.stake.percentage}% of SPV equity is not ${c.stake.percentage}% of the ${amount(project.metrics[0])} project cost.`,card).className='property-derived';}
    gapList(card,[project.id,...new Set(claims.map(c=>c.to))]);
    const d=project.dates;el('p',`Dates: OJEU ${d.ojeu} · preferred bidder ${d.preferredBidder} · financial close ${d.financialClose} · first operations ${d.firstOperations} · construction completion ${d.constructionCompletion} · contract expiry ${d.contractExpiry}`,card);
    const source=sources.get(project.sourceId);evidence(card,source,project.locator,source.excerpt);
  }
  function render(){
    list.replaceChildren();summary.replaceChildren();const show=k=>filter.value==='all'||filter.value===k;
    if(show('property')){
      const total=physicalAssetTotal(data,{metricType:'asset_value',assetIds:data.assets.map(a=>a.id)});
      el('p',`Schedule III check: ${total.count} cost-basis rows sum to ${total.currency} ${total.amount.toLocaleString('en-US')} as of ${total.date}, matching the filing's reported balance. This is the issuer's carrying amount on its own node — not market value and not any shareholder's exposure.`,summary);
      gapList(summary,['property-entity-fsp']);for(const asset of data.assets)propertyCard(asset);
    }
    if(show('infrastructure'))for(const project of data.projects)projectCard(project);
    count.textContent=`${list.children.length} of ${data.assets.length+data.projects.length} pilot records · ${data.claims.length} role claims in total`;
  }
  filter.addEventListener('change',render);
  const reset=el('button','Show both cases');reset.type='button';reset.addEventListener('click',()=>{filter.value='all';render();filter.focus();});
  document.body.append(dialog);launcher.setAttribute('aria-haspopup','dialog');launcher.setAttribute('aria-controls',dialog.id);
  launcher.addEventListener('click',()=>{beforeOpen();filter.value='all';render();dialog.showModal();close.focus();});
  close.addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>returnFocus().focus());
  return {dialog};
}
