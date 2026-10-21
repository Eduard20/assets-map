import {institutionalPilot,validateInstitutionalPilot} from './institutional-data.js';
export function mountInstitutionalPilot({document,launcher,beforeOpen=()=>{},returnFocus=()=>launcher,data=institutionalPilot}){
  validateInstitutionalPilot(data);
  const dialog=document.createElement('dialog');dialog.id='institutional-dialog';dialog.setAttribute('aria-labelledby','institutional-title');
  const el=(tag,text,parent=dialog)=>{const node=document.createElement(tag);if(text)node.textContent=text;parent.append(node);return node;};
  const top=el('div','');top.className='institutional-top';
  el('span','SEPARATE LAYER · PILOT',top);const close=el('button','← Back to map',top);close.type='button';
  el('h2','Institutional relationships').id='institutional-title';
  el('p','Four sourced membership / partner listings. Not ownership, funding, control or influence. This small sample is incomplete; absence of a link says nothing about a relationship.').className='institutional-notice';
  el('p','Organization labels are kept separate from securities and portfolio totals. No people, payments or inferred issuer matches are included.');
  const label=el('label','Explore an organization or institution');const filter=el('select','',label);filter.id='institutional-filter';
  el('option','All five organizations',filter).value='all';
  for(const entity of data.entities)el('option',entity.name,filter).value=entity.id;
  const count=el('p','');count.setAttribute('role','status');
  const list=el('div','');list.className='institutional-links';
  const names=new Map(data.entities.map(e=>[e.id,e.name])),sources=new Map(data.sources.map(s=>[s.id,s]));
  function render(){
    list.replaceChildren();const edges=data.relationships.filter(e=>filter.value==='all'||[e.from,e.to].includes(filter.value));count.textContent=`${edges.length} of ${data.relationships.length} pilot relationships`;
    for(const edge of edges){
      const card=el('article','',list);card.className='institutional-link';el('h3',`${names.get(edge.from)} → ${names.get(edge.to)}`,card);
      el('p',`${edge.type==='corporate_member'?'Corporate member':'Listed partner'} · Source category: ${edge.category}`,card).className='institutional-kind';
      const source=sources.get(edge.sourceId);
      el('p',`Source as of: ${source.asOf??'Not stated (undated roster)'} · Retrieved: ${source.retrievedAt}`,card);
      el('p','Relationship start / end: unknown. Retrieval is an observation date, not a membership start date or a guarantee of current status.',card);
      const details=el('details','',card);el('summary','Evidence and limits',details);
      el('p',`Roster excerpt: ${source.excerpt}`,details);
      const a=el('a',source.title,details);a.href=source.url;a.target='_blank';a.rel='noopener noreferrer';
      el('p','The official roster supports only the named listing and category. It does not establish a payment amount, ownership stake, policy influence or control.',details);
    }
  }
  filter.addEventListener('change',render);
  const reset=el('button','Show all relationships');reset.type='button';reset.addEventListener('click',()=>{filter.value='all';render();filter.focus();});
  document.body.append(dialog);launcher.setAttribute('aria-haspopup','dialog');launcher.setAttribute('aria-controls',dialog.id);
  launcher.addEventListener('click',()=>{beforeOpen();filter.value='all';render();dialog.showModal();close.focus();});
  close.addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>returnFocus().focus());
  return {dialog};
}
