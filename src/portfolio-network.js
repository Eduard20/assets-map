import {createModel,escapeHtml as E,dateLabel,money} from './graph-model.js?v=20261018-mobile1';
import {portfolioModel,portfolioOverview} from './portfolio-view.js?v=20261018-mobile1';

export const NETWORK_PAGE_SIZE=20;
export const NETWORK_NODE_LIMIT=200;
// Manually reviewed issuer-role navigation, NOT instrument identity merging.
// Exact admitted source IDs resolve through the existing equivalence map.
export const ISSUER_ROLES=[
  {manager:'berkshire-2026-06-30',security:'sec13f-0002012383-26-003238-security-05984',securityClass:'CL A',cik:'1067983',url:'https://www.sec.gov/Archives/edgar/data/1067983/000119312526083899/R1.htm'},
  {manager:'berkshire-2026-06-30',security:'sec13f-0002012383-26-003238-security-05995',securityClass:'CL B NEW',cik:'1067983',url:'https://www.sec.gov/Archives/edgar/data/1067983/000119312526083899/R1.htm'},
  {manager:'blackrock-2026-06-30',security:'sec13f-0002012383-26-003238-security-06592',securityClass:'COM',cik:'2012383',url:'https://www.sec.gov/Archives/edgar/data/2012383/000119312526071966/R1.htm'},
  {manager:'statestreet-2026-06-30',security:'sec13f-0002012383-26-003238-security-42178',securityClass:'COM',cik:'93751',url:'https://www.sec.gov/Archives/edgar/data/93751/000009375126000124/R1.htm'}
];
// Expand the selected entity's own neighborhood, independently of overview
// top-N controls. Directional pages prevent a large portfolio hiding investors.
export function networkNeighborhood(model,id){
  const scope=new Set([id,...(model.rolePeers?.get(id)||[])]);
  return {scope,incoming:model.edges.filter(e=>scope.has(e.target)),outgoing:model.edges.filter(e=>scope.has(e.source))};
}
export function expandPortfolioNetwork(model,state,id,visible){
  const {incoming,outgoing}=networkNeighborhood(model,id);
  state.exploration ||= new Map();
  const previous=state.exploration.get(id)||{incoming:0,outgoing:0};
  const shown=new Set((visible?.edges||[]).map(e=>e.id));
  state.exploration.set(id,Object.fromEntries([['incoming',incoming],['outgoing',outgoing]].map(([direction,edges])=>[
    direction,Math.min(edges.length,Math.max(previous[direction],(edges.findIndex(e=>!shown.has(e.id))<0?edges.length:edges.findIndex(e=>!shown.has(e.id))))+NETWORK_PAGE_SIZE)
  ])));
  state.pinnedNodes.add(id);
  state.expanded.add(id);
}
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
  const rolePeers=new Map(),roleEdges=[];
  for(const role of ISSUER_ROLES){
    const security=canonical.get(role.security)||role.security,node=nodes.get(security),portfolio=portfolioMap.get(role.manager);
    if(!node||node.sector!==role.securityClass||portfolio?.filer.cik!==role.cik)throw new Error('Reviewed issuer-role mapping does not match this release');
    const sourceId=`issuer-role-${role.security}`;
    sources.push({id:sourceId,title:`SEC issuer identity and share class · ${node.label}`,url:role.url,publisher:'U.S. Securities and Exchange Commission',asOf:'2025-12-31'});
    roleEdges.push({id:sourceId,source:security,target:role.manager,kind:'issuer_reporting_entity',asOf:'2025-12-31',sourceIds:[sourceId],role});
    for(const [a,b] of [[security,role.manager],[role.manager,security]]){if(!rolePeers.has(a))rolePeers.set(a,new Set());rolePeers.get(a).add(b);}
  }
  const model=createModel({meta:{mode:'portfolios',defaultRoot:portfolios.find(p=>p.portfolioId.startsWith('blackrock'))?.portfolioId||portfolioRoots[0],updatedAt:portfolios[0].checkedThrough,coverage:`One shared network of ${portfolios.length} imported Form 13F portfolios. Investor coverage is limited to these filers; it is not all investors or legal ownership.`,notes:['Cross-filer connections match only reviewed, exact instrument identity and exact normalized security class. Differently described classes remain separate; issuer names never establish a match.','Reported values remain filer-specific; overlapping positions are never summed as an ownership total.','All original share rows remain individually searchable with dates and sources.']},sources,nodes:[...nodes.values()],edges});
  const network={...model,network:true,portfolioRoots,portfolios,portfolioMap,rolePeers,roleEdges,portfolio:portfolioMap.get(model.rootId),holdingEdges,rowEdgeMap:new Map(holdingEdges.map(e=>[e.id,e])),instrumentCount:[...nodes.values()].filter(n=>n.kind==='asset').length};
  network.buildVisibleGraph=state=>buildPortfolioNetwork(network,state);return network;
}
export function buildPortfolioNetwork(model,state){
  const ids=new Set([...model.portfolioRoots,state.rootId]),eligible=state.portfolioFilter?model.portfolioRoots.filter(id=>id===state.portfolioFilter):model.portfolioRoots;
  const add=id=>{if(model.nodeMap.has(id)&&ids.size<NETWORK_NODE_LIMIT)ids.add(id);};
  // The current neighborhood takes priority at the ceiling; earlier explored
  // neighborhoods and the overview fill the remaining space, never the reverse.
  const explored=[...(state.exploration||new Map()).keys()].reverse();
  for(const id of [state.rootId,...explored.filter(id=>id!==state.rootId)]){
    const page=state.exploration?.get(id);if(!page)continue;
    const {scope,incoming,outgoing}=networkNeighborhood(model,id);for(const peer of scope)add(peer);
    const ins=incoming.slice(Math.max(0,page.incoming-80),page.incoming),outs=outgoing.slice(Math.max(0,page.outgoing-160),page.outgoing);
    for(let i=0;i<Math.max(ins.length,outs.length);i++){if(ins[i]){add(ins[i].source);add(ins[i].target);}if(outs[i]){add(outs[i].source);add(outs[i].target);}}
  }
  for(const id of state.pinnedNodes||[])add(id);
  for(const root of eligible){const edges=model.edges.filter(e=>e.source===root).slice(0,state.limits.get(root)||NETWORK_PAGE_SIZE);for(const e of edges)if(ids.size<NETWORK_NODE_LIMIT)ids.add(e.target);}
  const holdingLinks=model.edges.filter(e=>ids.has(e.source)&&ids.has(e.target));
  const roleLinks=(model.roleEdges||[]).filter(e=>ids.has(e.source)&&ids.has(e.target)&&(state.exploration?.has(e.source)||state.exploration?.has(e.target)));
  return {network:true,portfolioRoots:model.portfolioRoots,focusScope:[...networkNeighborhood(model,state.rootId).scope],nodes:[...ids].map(id=>model.nodeMap.get(id)),edges:[...holdingLinks,...roleLinks],holdingLinkCount:holdingLinks.length,totalInstruments:model.instrumentCount};
}
export function networkInvestorCards(model,id){
  return model.edges.filter(e=>e.target===id).map(edge=>`<div class="investor-card"><button class="connection-card" data-select="${E(edge.source)}"><span><strong>${E(model.nodeMap.get(edge.source).label)}</strong><small>${E(money(edge.valueUsd))} reported · ${E(dateLabel(edge.asOf))}</small></span><span>↗</span></button><button class="quiet-button investor-evidence" data-edge="${E(edge.id)}">Evidence · ${edge.portfolioPositions.length.toLocaleString()} filing rows →</button></div>`).join('');
}
function explorationDetails(model,id,state,graph){
  const {scope,incoming,outgoing}=networkNeighborhood(model,id),shown=new Set((graph?.edges||[]).map(e=>e.id));
  const count=edges=>edges.filter(e=>shown.has(e.id)).length;
  const page=state?.exploration?.get(id);
  const hasMore=page?page.incoming<incoming.length||page.outgoing<outgoing.length:count(incoming)<incoming.length||count(outgoing)<outgoing.length;
  const peers=[...scope].filter(peer=>peer!==id);
  const card=edge=>`<button class="connection-card" data-select="${E(edge.source===id||scope.has(edge.source)?edge.target:edge.source)}"><span><strong>${E(model.nodeMap.get(scope.has(edge.source)?edge.target:edge.source).label)}</strong><small>${E(model.nodeMap.get(edge.target).sector||'')} · ${E(money(edge.valueUsd))} reported</small></span><span>↗</span></button>`;
  return `<section class="entity-network"><h3>This entity’s network</h3><p class="context-note">Incoming: ${count(incoming)} of ${incoming.length} reported holding links shown. Outgoing: ${count(outgoing)} of ${outgoing.length} shown.</p>${peers.length?`<p class="context-note">Linked issuer / reporting-manager roles remain separate from share classes. The network below includes these verified roles.</p>${peers.map(peer=>`<button class="secondary-button" data-select="${E(peer)}">Explore ${E(model.nodeMap.get(peer).label)} · ${E(model.nodeMap.get(peer).sector||'reporting manager')} →</button>`).join('')}`:''}${!incoming.length?'<p class="research-empty">No investor links are available in the imported coverage. This does not mean there are no investors.</p>':''}${!outgoing.length?'<p class="research-empty">No outgoing investment portfolio is imported for this entity. Its investors’ holdings are not its own investments.</p>':`<h3>Outgoing investments <span>${outgoing.length}</span></h3><div class="connection-list">${outgoing.slice(0,8).map(card).join('')}</div>`}${incoming.length&&model.portfolioMap.has(id)?`<h3>Incoming reported holdings <span>${incoming.length}</span></h3><div class="connection-list">${incoming.slice(0,8).map(card).join('')}</div>`:''}${hasMore?`<button class="primary-button full-width" data-expand="${E(id)}">Explore next ${NETWORK_PAGE_SIZE} connections →</button><p class="context-note">Click this bubble again to expand further. At ${NETWORK_NODE_LIMIT} visible nodes, the current neighborhood replaces older context; Back restores it. All source rows remain searchable.</p>`:count(incoming)<incoming.length||count(outgoing)<outgoing.length?'<p class="complete-note">End of this entity’s connections. Older connections are outside this bounded view; use Back, Reset or search to revisit them.</p>':'<p class="complete-note">All available connections for this entity are visible.</p>'}</section>`;
}
export function networkDetails(model,id,state,graph){
  const portfolio=model.portfolioMap.get(id);
  if(portfolio)return explorationDetails(model,id,state,graph)+portfolioOverview({...model,portfolio,edges:model.edges.filter(e=>e.source===id)});
  const node=model.nodeMap.get(id),investors=model.edges.filter(e=>e.target===id);
  return `<div class="panel-kicker"><span>COMPANY / SECURITY FOCUS</span><span class="sample-pill">${investors.length} REPORTED INVESTORS</span></div><h2>${E(node.label)}</h2><p class="entity-summary">${E(node.sector||node.position?.securityClass||'Reported security')} · Exact reported instrument</p><p class="historical-note"><strong>Historical snapshot · ${E(dateLabel(model.portfolios[0].reportingDate))}</strong><br>This does not establish a current position.</p>${explorationDetails(model,id,state,graph)}<h3>Reported investors <span>${investors.length}</span></h3><p class="context-note">${model.portfolios.length} imported filers checked: ${E(model.portfolios.map(p=>p.filer.name).join(', '))}. This is not a complete list of investors. Separate classes and unmatched source descriptions remain separate.</p><div class="connection-list">${networkInvestorCards(model,id)}</div><p class="context-note">These links show reported investment discretion, not legal ownership or control. Values are shown separately for each filer and must not be added as a company ownership total.</p><p class="context-note">The surrounding shared network stays visible. Select an investor to explore its holdings, or use Back to return to your previous focus.</p>`;
}
