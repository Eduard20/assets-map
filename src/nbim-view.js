import {validateNbimEquities,nbimRows,NBIM_SECTORS,NBIM_DATA_PATH} from './nbim-data.js';
export const NBIM_PAGE=25;
const group=n=>String(n).replace(/\B(?=(\d{3})+(?!\d))/g,',');
const pct=v=>`${v.toFixed(2)}%`;
// Filtering and ordering only. Values are shown per holding and never summed.
export function filterNbim(rows,{query='',country='all',sector='all',sort='value'}={}){
  const q=query.trim().toLocaleLowerCase();
  const out=rows.filter(r=>(country==='all'||r.country===country)&&(sector==='all'||r.sector===sector)&&(!q||r.name.toLocaleLowerCase().includes(q)||String(r.code||'').toLocaleLowerCase()===q));
  if(sort==='ownership')out.sort((a,b)=>b.ownershipPct-a.ownershipPct||b.usd-a.usd||a.id.localeCompare(b.id));
  return out;
}
export function holdingLines(r,countryName=c=>c){
  return [
    `${countryName(r.country)}${r.incorporation?` · incorporated in ${countryName(r.incorporation)}`:''} · ${r.sector}${r.code?` · listing code ${r.code}`:' · no listing code published'}`,
    `Market value US$${group(r.usd)} · NOK ${group(r.nok)} (both as published by NBIM)`,
    `Ownership ${pct(r.ownershipPct)} · voting ${pct(r.votingPct)}${r.ownershipPct===0?' · published as 0, not evidence of no holding':''}${r.ownershipPct!==r.votingPct?' · voting differs from ownership (share classes)':''}`
  ];
}
export function mountNbimLayer({document,launcher,beforeOpen=()=>{},returnFocus=()=>launcher,load}){
  const dialog=document.createElement('dialog');dialog.id='nbim-dialog';dialog.setAttribute('aria-labelledby','nbim-title');
  const el=(tag,text,parent=dialog)=>{const node=document.createElement(tag);if(text)node.textContent=text;parent.append(node);return node;};
  const top=el('div','');top.className='nbim-top';el('span','SEPARATE LAYER · OFFICIAL LIST',top);const close=el('button','← Back to map',top);close.type='button';
  el('h2','Norway’s oil fund (NBIM) · every listed company it owns').id='nbim-title';
  el('p','The Government Pension Fund Global, managed by Norges Bank Investment Management, publishes all of its equity holdings worldwide. The share map only has its US-listed Form 13F slice; this list is the global picture on the same date, 30 June 2026.').className='nbim-notice';
  el('p','Each row is one holding as NBIM publishes it: market value, and NBIM’s ownership and voting share of the company. Rows are not matched to the 13F securities, not merged with other investors and never added up. NBIM is the source; this is not investment advice.').className='nbim-rule';
  const status=el('p','');status.setAttribute('role','status');
  const controls=el('div','');controls.className='nbim-controls';controls.hidden=true;
  const field=(text,node)=>{const label=el('label',text,controls);label.append(node);return node;};
  const search=field('Search company or exact listing code',document.createElement('input'));search.id='nbim-search';search.type='search';search.autocomplete='off';
  const country=field('Country',document.createElement('select'));country.id='nbim-country';
  const sector=field('Sector',document.createElement('select'));sector.id='nbim-sector';
  const sort=field('Order',document.createElement('select'));sort.id='nbim-sort';
  for(const [v,t] of [['value','Largest market value first'],['ownership','Largest ownership share first']])el('option',t,sort).value=v;
  const list=el('div','');list.className='nbim-list';
  const more=el('button','Show more');more.type='button';more.hidden=true;
  const evidence=el('details','');evidence.hidden=true;el('summary','Source, retrieval and reuse',evidence);
  let rows=null,data=null,shown=NBIM_PAGE,pending=null;
  const names=typeof Intl!=='undefined'&&Intl.DisplayNames?new Intl.DisplayNames(['en'],{type:'region'}):null;
  const countryName=c=>{try{return names?.of(c)||c;}catch{return c;}};
  function setup(){
    el('option','All countries',country).value='all';
    for(const c of [...new Set(rows.map(r=>r.country))].sort((a,b)=>countryName(a).localeCompare(countryName(b))))el('option',`${countryName(c)} (${rows.filter(r=>r.country===c).length})`,country).value=c;
    el('option','All sectors',sector).value='all';for(const s of NBIM_SECTORS)el('option',s,sector).value=s;
    const s=data.source;
    el('p',`${s.publisher}: ${s.title}. As of ${data.asOf}; retrieved ${data.retrievedAt}.`,evidence);
    const a=el('a','Official NBIM investments page',evidence);a.href=s.pageUrl;a.target='_blank';a.rel='noopener noreferrer';
    el('p',`Data file ${s.dataUrl} · ${group(s.rawBytes)} bytes · SHA-256 ${s.rawSha256}`,evidence);
    el('p',`Coverage: ${group(data.coverage.equityRows)} equity holdings. Not included here: ${group(data.coverage.excludedRows.fixedIncome)} bond issuers, ${data.coverage.excludedRows.unlistedRealEstate} unlisted real-estate and ${data.coverage.excludedRows.renewableInfrastructure} renewable-infrastructure entries. ${data.coverage.rowsWithoutListingCode} holdings have no published listing code.`,evidence);
    el('p',`Reuse: ${s.reuse}`,evidence);
    el('p','NBIM notes that individual holdings can differ from its official aggregate figures (for example because of cash), so no total is shown.',evidence);
    controls.hidden=false;evidence.hidden=false;
  }
  function render(){
    const matches=filterNbim(rows,{query:search.value,country:country.value,sector:sector.value,sort:sort.value});
    list.replaceChildren();
    for(const r of matches.slice(0,shown)){
      const card=el('article','',list);card.className='nbim-holding';el('h3',r.name,card);
      for(const line of holdingLines(r,countryName))el('p',line,card);
    }
    if(!matches.length)el('p','No holding in NBIM’s published list matches. Names follow NBIM’s spelling; absence here is not evidence about other investors.',list).className='nbim-empty';
    more.hidden=shown>=matches.length;more.textContent=`Show ${Math.min(NBIM_PAGE,matches.length-shown)} more`;
    status.textContent=`${group(Math.min(shown,matches.length))} of ${group(matches.length)} matching holdings shown · ${group(rows.length)} in NBIM’s list · 30 June 2026`;
  }
  const reset=()=>{shown=NBIM_PAGE;render();};
  for(const node of [country,sector,sort])node.addEventListener('change',reset);search.addEventListener('input',reset);
  more.addEventListener('click',()=>{shown+=NBIM_PAGE;render();});
  async function ensure(){
    if(rows)return;
    pending||=Promise.resolve().then(()=>load()).then(json=>{data=validateNbimEquities(json);rows=nbimRows(data);setup();});
    status.textContent='Loading NBIM’s published list…';
    try{await pending;}catch(error){pending=null;status.textContent='NBIM’s list could not load. The share map is unchanged; close and try again.';throw error;}
  }
  async function open({query=''}={}){
    beforeOpen();if(!dialog.open)dialog.showModal();close.focus();
    try{await ensure();}catch{return;}
    search.value=query;country.value='all';sector.value='all';sort.value='value';reset();
  }
  document.body.append(dialog);launcher.setAttribute('aria-haspopup','dialog');launcher.setAttribute('aria-controls',dialog.id);
  launcher.addEventListener('click',()=>open());
  close.addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>returnFocus().focus());
  return {dialog,open};
}
export const fetchNbim=async()=>{const response=await fetch(new URL(NBIM_DATA_PATH,import.meta.url),{cache:'no-cache'});if(!response.ok)throw new Error(`NBIM request failed (${response.status})`);return response.json();};
