// Compare only admitted canonical instrument IDs. Never infer issuer matches.
export const COMPARISON_PAGE_SIZE=20;
const indexes=new WeakMap();
export function comparePortfolios(model,leftId,rightId,{query='',page=0}={}){
  if(!model?.network||!model.portfolioMap.has(leftId)||!model.portfolioMap.has(rightId)||leftId===rightId)throw new Error('Choose two different imported filers');
  let index=indexes.get(model);
  if(!index){index=new Map(model.portfolioRoots.map(id=>[id,new Map()]));for(const edge of model.edges)if(edge.kind==='managed_holding'&&index.has(edge.source)&&model.nodeMap.get(edge.target)?.kind==='asset')index.get(edge.source).set(edge.target,edge);indexes.set(model,index);}
  const left=index.get(leftId),right=index.get(rightId),common=[...left.keys()].filter(id=>right.has(id));
  const q=query.trim().toLocaleLowerCase();
  const rows=common.map(id=>({node:model.nodeMap.get(id),left:left.get(id),right:right.get(id)})).filter(row=>!q||[row.node.label,row.node.sector,...row.left.portfolioPositions.map(p=>p.issuerName),...row.right.portfolioPositions.map(p=>p.issuerName)].join(' ').toLocaleLowerCase().includes(q)).sort((a,b)=>a.node.label.localeCompare(b.node.label)||String(a.node.sector||'').localeCompare(String(b.node.sector||''))||a.node.id.localeCompare(b.node.id));
  const pages=Math.max(1,Math.ceil(rows.length/COMPARISON_PAGE_SIZE)),current=Math.min(pages-1,Math.max(0,Number.isFinite(page)?Math.floor(page):0));
  return {rows:rows.slice(current*COMPARISON_PAGE_SIZE,(current+1)*COMPARISON_PAGE_SIZE),total:rows.length,common:common.length,leftCount:left.size,rightCount:right.size,page:current,pages};
}
export function mountPortfolioComparison({document,launcher,getModel,beforeOpen=()=>{},returnFocus=()=>launcher,onSelect=()=>{},onEvidence=()=>{}}){
  const dialog=document.createElement('dialog');dialog.id='comparison-dialog';dialog.setAttribute('aria-labelledby','comparison-title');
  const el=(tag,text,parent=dialog)=>{const n=document.createElement(tag);n.textContent=text;parent.append(n);return n;};
  const close=el('button','← Back to map');close.type='button';close.addEventListener('click',()=>dialog.close());
  el('h2','Compare reported portfolios').id='comparison-title';
  el('p','Find instruments reported by both filers. Exact reviewed matches only, not matching company names. Values remain separate: this is not ownership, control, whole AUM or unique economic exposure.');
  const controls=el('div','');controls.className='comparison-controls';
  const left=el('select','',el('label','First filer',controls));left.id='comparison-left';
  const right=el('select','',el('label','Second filer',controls));right.id='comparison-right';
  const search=el('input','',el('label','Search shared instruments'));search.type='search';search.id='comparison-search';search.placeholder='Company or security class';
  const summary=el('p','');summary.id='comparison-summary';summary.setAttribute('role','status');
  const list=el('div','');list.className='comparison-results';
  const pager=el('div','');pager.className='comparison-pagination';const previous=el('button','← Previous',pager),position=el('span','',pager),next=el('button','Next →',pager);previous.type=next.type='button';
  let page=0,activeModel,selectionAction=false;
  const navigate=(callback,id)=>{selectionAction=true;dialog.close();callback(id);};
  function render(){
    list.replaceChildren();
    if(left.value===right.value){summary.textContent='Choose two different imported filers.';previous.disabled=next.disabled=true;position.textContent='';return;}
    const result=comparePortfolios(activeModel,left.value,right.value,{query:search.value,page});page=result.page;
    const names=[left,right].map(s=>activeModel.portfolioMap.get(s.value).filer.name);
    summary.textContent=`${result.total.toLocaleString()} search matches · ${result.common.toLocaleString()} exact shared instruments in total. ${names[0]}: ${result.leftCount.toLocaleString()} instruments; ${names[1]}: ${result.rightCount.toLocaleString()}. Snapshot ${activeModel.portfolioMap.get(left.value).reportingDate}. Unmatched descriptions and separate classes are not inferred to match.`;
    if(!result.rows.length)el('p','No exact shared instruments match. Missing matches do not establish the absence of other holdings or investors.',list);
    for(const row of result.rows){
      const card=el('article','',list);el('h3',`${row.node.label} · ${row.node.sector||'Reported security'}`,card);
      for(const [edge,name] of [[row.left,names[0]],[row.right,names[1]]]){
        const value=edge.portfolioPositions.reduce((sum,p)=>sum+BigInt(p.valueUsd),0n).toLocaleString('en-US');
        el('p',`${name}: ${value} USD reported · ${edge.portfolioPositions.length} source rows · ${edge.asOf}`,card);
        const evidence=el('button',`Evidence for ${name}`,card);evidence.type='button';evidence.addEventListener('click',()=>navigate(onEvidence,edge.id));
      }
      const focus=el('button','Explore this instrument →',card);focus.type='button';focus.dataset.comparisonSelect=row.node.id;focus.addEventListener('click',()=>navigate(onSelect,row.node.id));
    }
    previous.disabled=page===0;next.disabled=page+1>=result.pages;position.textContent=`Page ${page+1} of ${result.pages}`;
  }
  const reset=()=>{page=0;render();};left.addEventListener('change',reset);right.addEventListener('change',reset);search.addEventListener('input',reset);
  for(const [button,delta] of [[previous,-1],[next,1]])button.addEventListener('click',()=>{page+=delta;render();list.scrollIntoView?.({block:'start'});});
  document.body.append(dialog);launcher.setAttribute('aria-haspopup','dialog');launcher.setAttribute('aria-controls',dialog.id);
  launcher.addEventListener('click',()=>{
    const model=getModel();if(!model?.network)return;beforeOpen();selectionAction=false;
    if(activeModel!==model){activeModel=model;for(const select of [left,right]){select.replaceChildren();for(const id of model.portfolioRoots)el('option',model.portfolioMap.get(id).filer.name,select).value=id;}left.value=model.portfolioRoots[0];right.value=model.portfolioRoots[1];search.value='';page=0;}
    render();dialog.showModal();close.focus();
  });
  dialog.addEventListener('close',()=>{if(!selectionAction)returnFocus()?.focus();selectionAction=false;});
  return {dialog};
}
