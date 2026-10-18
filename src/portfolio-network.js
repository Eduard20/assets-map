import {createModel,escapeHtml as E,dateLabel,money} from './graph-model.js?v=20261018-network1';
import {portfolioModel,portfolioOverview} from './portfolio-view.js?v=20261018-network1';

export const NETWORK_PAGE_SIZE=20;
export const NETWORK_NODE_LIMIT=200;
export function createPortfolioNetwork(portfolios,identity){
  if(identity.schemaVersion!==1||!Array.isArray(identity.groups))throw new Error('Invalid instrument identity map');
  if(identity.admission?.status!=='approved'||identity.admission?.reviewer!=='independent-source-audit'||!identity.admission.checks?.independentGroupRebuild||!identity.admission.checks?.noNameBasedMerges)throw new Error('Instrument identities require independent review');
  if(portfolios.some(p=>p.reportingDate!==identity.coverage?.reportingDate)||portfolios.map(p=>p.portfolioId).sort().join('|')!==[...(identity.coverage?.portfolioIds||[])].sort().join('|')||portfolios.reduce((n,p)=>n+p.positions.length,0)!==identity.coverage?.eligibleSourceRows)throw new Error('Instrument identity coverage mismatch');
  const models=portfolios.map(portfolioModel),knownIds=new Set(models.flatMap(m=>m.nodes.slice(1).map(n=>n.id))),canonical=new Map();
  const descriptions=new Map(models.flatMap(m=>m.nodes.slice(1).map(n=>[n.id,{class:n.sector,portfolioId:m.rootId}])));
  if(knownIds.size!==identity.coverage.eligibleSourceScopedInstruments)throw new Error('Instrument identity count mismatch');
  identity.groups.forEach((group,index)=>{
    const members=Array.isArray(group)?group:group.members;
    if(!Array.isArray(members)||members.length<2)throw new Error('Invalid identity group');
    for(const id of members){if(!knownIds.has(id)||canonical.has(id))throw new Error('Unknown or repeated instrument identity');canonical.set(id,`shared-instrument-${index+1}`);}
    if(new Set(members.map(id=>descriptions.get(id).class)).size!==1||new Set(members.map(id=>descriptions.get(id).portfolioId)).size!==members.length)throw new Error('Invalid cross-filer class match');
  });
  const nodes=new Map(),edges=[],holdingEdges=[],sources=[];
  for(const model of models){
    sources.push(...model.sources);
    for(const node of model.nodes){const id=canonical.get(node.id)||node.id;if(!nodes.has(id))nodes.set(id,{...node,id,reportedSecurityIds:[]});if(node.kind==='asset'){nodes.get(id).reportedSecurityIds.push(node.id);nodes.get(id).sourceIds=[...new Set([...nodes.get(id).sourceIds,...node.sourceIds])];}}
    const aggregates=new Map();
    for(const edge of model.edges){const target=canonical.get(edge.target)||edge.target,key=`holding-${model.rootId}-${target}`;if(!aggregates.has(key))aggregates.set(key,{...edge,id:key,target,portfolioId:model.rootId,portfolio:model.portfolio,portfolioPositions:[],sourceIds:[]});const aggregate=aggregates.get(key);aggregate.portfolioPositions.push(...edge.portfolioPositions);aggregate.sourceIds.push(...edge.sourceIds);}
    for(const edge of aggregates.values()){edge.sourceIds=[...new Set(edge.sourceIds)];edge.portfolioPosition={...edge.portfolioPositions[0],...Object.fromEntries(['valueUsd','quantity','votingSole','votingShared','votingNone'].map(key=>[key,edge.portfolioPositions.reduce((n,p)=>n+BigInt(p[key]),0n).toString()]))};edge.valueUsd=Number(edge.portfolioPosition.valueUsd);edges.push(edge);}
    holdingEdges.push(...model.holdingEdges.map(edge=>({...edge,target:canonical.get(edge.target)||edge.target,portfolioId:model.rootId,portfolio:model.portfolio})));
  }
  edges.sort((a,b)=>b.valueUsd-a.valueUsd||a.id.localeCompare(b.id));holdingEdges.sort((a,b)=>b.valueUsd-a.valueUsd||a.id.localeCompare(b.id));
  const portfolioRoots=models.map(m=>m.rootId),portfolioMap=new Map(portfolios.map(p=>[p.portfolioId,p]));
  const model=createModel({meta:{mode:'portfolios',defaultRoot:portfolios.find(p=>p.portfolioId.startsWith('blackrock'))?.portfolioId||portfolioRoots[0],updatedAt:portfolios[0].checkedThrough,coverage:`One shared network of ${portfolios.length} imported Form 13F portfolios. Investor coverage is limited to these filers; it is not all investors or legal ownership.`,notes:['Cross-filer connections match only reviewed, exact instrument identity and exact normalized security class. Differently described classes remain separate; issuer names never establish a match.','Reported values remain filer-specific; overlapping positions are never summed as an ownership total.','All original share rows remain individually searchable with dates and sources.']},sources,nodes:[...nodes.values()],edges});
  const network={...model,network:true,portfolioRoots,portfolios,portfolioMap,portfolio:portfolioMap.get(model.rootId),holdingEdges,rowEdgeMap:new Map(holdingEdges.map(e=>[e.id,e])),instrumentCount:[...nodes.values()].filter(n=>n.kind==='asset').length};
  network.buildVisibleGraph=state=>buildPortfolioNetwork(network,state);return network;
}
export function buildPortfolioNetwork(model,state){
  const ids=new Set(model.portfolioRoots),eligible=state.portfolioFilter?model.portfolioRoots.filter(id=>id===state.portfolioFilter):model.portfolioRoots;
  for(const id of state.pinnedNodes||[])if(model.nodeMap.has(id)&&ids.size<NETWORK_NODE_LIMIT)ids.add(id);
  ids.add(state.rootId);
  for(const root of eligible){const edges=model.edges.filter(e=>e.source===root).slice(0,state.limits.get(root)||NETWORK_PAGE_SIZE);for(const e of edges)if(ids.size<NETWORK_NODE_LIMIT)ids.add(e.target);}
  return {network:true,portfolioRoots:model.portfolioRoots,nodes:[...ids].map(id=>model.nodeMap.get(id)),edges:model.edges.filter(e=>ids.has(e.source)&&ids.has(e.target)),totalInstruments:model.instrumentCount};
}
export function networkInvestorCards(model,id){
  return model.edges.filter(e=>e.target===id).map(edge=>`<div class="investor-card"><button class="connection-card" data-select="${E(edge.source)}"><span><strong>${E(model.nodeMap.get(edge.source).label)}</strong><small>${E(money(edge.valueUsd))} reported · ${E(dateLabel(edge.asOf))}</small></span><span>↗</span></button><button class="quiet-button investor-evidence" data-edge="${E(edge.id)}">Evidence · ${edge.portfolioPositions.length.toLocaleString()} filing rows →</button></div>`).join('');
}
export function networkDetails(model,id){
  const portfolio=model.portfolioMap.get(id);
  if(portfolio)return portfolioOverview({...model,portfolio,edges:model.edges.filter(e=>e.source===id)});
  const node=model.nodeMap.get(id),investors=model.edges.filter(e=>e.target===id);
  return `<div class="panel-kicker"><span>COMPANY / SECURITY FOCUS</span><span class="sample-pill">${investors.length} REPORTED INVESTORS</span></div><h2>${E(node.label)}</h2><p class="entity-summary">${E(node.sector||node.position?.securityClass||'Reported security')} · Exact reported instrument</p><p class="historical-note"><strong>Historical snapshot · ${E(dateLabel(model.portfolios[0].reportingDate))}</strong><br>This does not establish a current position.</p><h3>Reported investors <span>${investors.length}</span></h3><p class="context-note">${model.portfolios.length} imported filers checked: ${E(model.portfolios.map(p=>p.filer.name).join(', '))}. This is not a complete list of investors. Separate classes and unmatched source descriptions remain separate.</p><div class="connection-list">${networkInvestorCards(model,id)}</div><p class="context-note">These links show reported investment discretion, not legal ownership or control. Values are shown separately for each filer and must not be added as a company ownership total.</p><p class="context-note">The surrounding shared network stays visible. Select an investor to explore its holdings, or use Back to return to your previous focus.</p>`;
}
