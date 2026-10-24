import {mountPortfolioComparison} from './portfolio-comparison.js';
import {mountInstitutionalPilot} from './institutional-view.js';
import {mountGoldPilot} from './gold-view.js';
import {createModel,initialState,buildVisibleGraph,relatedEdges,searchNodes,searchResultsHtml,escapeHtml as E,safeUrl,dateLabel,money,RELATIONSHIPS,KIND_LABELS,DEFAULT_PAGE_SIZE,MAX_VISIBLE_NODES} from './graph-model.js?v=20261023-uae1';
import {researchDetails,researchRowsPage,researchInventoryHtml} from './research-view.js?v=20261023-uae1';
import {portfolioModel,decodePortfolio,holdingsPage,portfolioPositionDetails,portfolioInstrumentDetails,portfolioOverview,HOLDINGS_PAGE_SIZE} from './portfolio-view.js?v=20261018-data2';
import {createPortfolioNetwork,networkDetails,expandPortfolioNetwork,sharedInstrumentsPage,NETWORK_PAGE_SIZE,NETWORK_NODE_LIMIT} from './portfolio-network.js?v=20261018-shared1';
import {Graph2D} from './graph-2d.js?v=20261023-uae1';
const $=selector=>document.querySelector(selector);
let model,state,graph,renderer3D,renderer3DPromise,toastTimer,viewRequest=0,datasetRequest=0;
const datasets=new Map();
let portfolioBundle,failedDataset=null,holdingsQuery='',holdingsPageIndex=0;
let focusHistory=[];
const phoneQuery=()=>window.matchMedia?.('(max-width: 800px), (max-width: 1000px) and (max-height: 500px)').matches||false;
let mobilePanel=null,mobileReturnFocus=null;
function closeMobilePanel(){
  if(!mobilePanel)return;
  mobilePanel.removeAttribute('role');mobilePanel.removeAttribute('aria-modal');
  mobilePanel=null;document.body.classList.remove('mobile-controls-open','mobile-details-open');
  $('#mobile-scrim').hidden=true;$('#mobile-options').setAttribute('aria-expanded','false');$('#mobile-details').setAttribute('aria-expanded','false');
  const returnTarget=typeof mobileReturnFocus==='function'?mobileReturnFocus():mobileReturnFocus;
  (returnTarget?.isConnected?returnTarget:$('#mobile-details')).focus();
}
function openMobilePanel(type,returnFocus){
  if(!phoneQuery())return;
  const panel=$(type==='controls'?'#mobile-controls':'#detail-sheet');
  const origin=returnFocus||(mobilePanel===panel?mobileReturnFocus:document.activeElement);
  closeMobilePanel();mobileReturnFocus=origin;
  mobilePanel=panel;
  document.body.classList.add(`mobile-${type}-open`);mobilePanel.setAttribute('role','dialog');mobilePanel.setAttribute('aria-modal','true');mobilePanel.setAttribute('aria-label',type==='controls'?'Explore the network':'Selected entity details');
  $('#mobile-scrim').hidden=false;$(type==='controls'?'#mobile-options':'#mobile-details').setAttribute('aria-expanded','true');
  $(type==='controls'?'#close-mobile-controls':'#close-mobile-details').focus();
}
function updateMobileSelection(){
  $('#mobile-selection-name').textContent=model.nodeMap.get(state.selectedId)?.label||'Explore network';
  $('#mobile-details').setAttribute('aria-label',`Details for ${model.nodeMap.get(state.selectedId)?.label||'selected entity'}`);
}
const isPortfolio=()=>model?.meta?.mode==='portfolios';
const findEdge=id=>model.rowEdgeMap?.get(id)||model.edges.find(e=>e.id===id)||model.roleEdges?.find(e=>e.id===id);
const isUae=()=>model?.meta?.datasetId==='uae';
const isResearch=()=>model?.meta?.mode==='researched';
const renderer2D=new Graph2D($('#graph-2d'),{onSelect:selectNode,onEdgeSelect:selectEdge,onExpand:expandNode});
function toast(message){clearTimeout(toastTimer);$('#status').textContent=message;$('#status').hidden=false;toastTimer=setTimeout(()=>$('#status').hidden=true,4200);}
function sourceLinks(ids){const unique=[...new Set(ids||[])];return unique.map(id=>{const source=model.sourceMap.get(id);if(!source)return '';return `<a class="source-link" href="${E(safeUrl(source.url))}" target="_blank" rel="noopener noreferrer"><span>${E(source.title)}<small>${E(source.publisher||'Public source')}${source.asOf?' · '+E(dateLabel(source.asOf)):''}</small></span><span aria-hidden="true">↗</span></a>`;}).join('')||'<p class="muted">No source attached yet.</p>';}
function rememberFocus(){focusHistory.push({model,state:structuredClone(state),holdingsQuery,holdingsPageIndex});if(focusHistory.length>40)focusHistory.shift();}
function selectNode(id){if(!model.nodeMap.has(id))return;exploreRoot(id);}
function selectEdge(id,returnFocus){const edge=findEdge(id);if(!edge)return;const returnTarget=returnFocus||(document.activeElement?.closest('#graph-list')?()=>[...$('#graph-list').querySelectorAll('[data-edge]')].find(row=>row.dataset.edge===id):undefined);if(isUae()&&state.selectedEdgeId!==id)rememberFocus();state.selectedEdgeId=id;state.selectedId=edge.target;render();if(phoneQuery())openMobilePanel('details',returnTarget);}
function exploreRoot(id){
  if(!model.nodeMap.has(id))return;
  if(id!==state.rootId||model.network)rememberFocus();
  state.rootId=id;state.selectedId=id;state.selectedEdgeId=null;
  if(model.network){expandPortfolioNetwork(model,state,id,graph);}else{state.expanded=new Set([id]);state.limits=new Map();renderer2D.fit();}
  render();if(model.network){renderer2D.focus?.(id);renderer3D?.focus?.(id);}else renderer3D?.fit();closeSearch();closeMobilePanel();
}
function goBack(){const previous=focusHistory.pop();if(!previous)return;const view=isUae()?previous.state.view:state.view;({model,state,holdingsQuery,holdingsPageIndex}=previous);state.view=view;$('#holdings-search').value=holdingsQuery;$('#uae-search').value=holdingsQuery;$('#direction').value=state.direction;$('#portfolio').value=state.portfolioFilter||'all';render();renderer2D.focus?.(state.rootId);renderer3D?.focus?.(state.rootId);applyView(view);}
function changePortfolio(id){rememberFocus();state.portfolioFilter=id==='all'?null:id;holdingsPageIndex=0;if(state.portfolioFilter){state.rootId=id;state.selectedId=id;state.selectedEdgeId=null;}render();renderer2D.fit();renderer3D?.fit();}
function showMoreNetwork(){for(const id of state.portfolioFilter?[state.portfolioFilter]:model.portfolioRoots)state.limits.set(id,Math.min(60,(state.limits.get(id)||NETWORK_PAGE_SIZE)+NETWORK_PAGE_SIZE));render();renderer2D.fit();renderer3D?.fit();}
function changeUaeGroup(id){
  if(!isUae()||(id!=='all'&&!model.meta.investorIds.includes(id)))return;
  if((state.uaeGroupFilter||'all')===id)return;
  rememberFocus();state.uaeGroupFilter=id==='all'?null:id;holdingsPageIndex=0;
  const root=state.uaeGroupFilter||model.rootId;
  state.rootId=root;state.selectedId=root;state.selectedEdgeId=null;state.expanded=new Set([root]);state.limits=new Map();
  render();renderer2D.fit();renderer3D?.fit();
}
function renderUaeControls(){
  if(!isUae())return;
  $('#uae-group').value=state.uaeGroupFilter||'all';$('#uae-snapshot').value=state.snapshotDate||'all';
  const result=researchRowsPage(model,{query:holdingsQuery,groupId:state.uaeGroupFilter,snapshotDate:state.snapshotDate});
  $('#uae-summary').textContent=`${result.total.toLocaleString()} matching disclosures of ${model.edges.length.toLocaleString()} admitted rows · ${model.meta.investorIds.length} reporting groups. Historical and partial, not a current or complete portfolio. The map shows the focused neighborhood; List searches all matching rows.`;
}
function renderNetworkControls(){
  $('#comparison-launcher').hidden=!model.network;$('#focus-back').hidden=!focusHistory.length;$('#network-summary').hidden=!model.network;
  if(!model.network)return;
  const securities=graph.nodes.filter(n=>n.kind==='asset').length,roots=state.portfolioFilter?[state.portfolioFilter]:model.portfolioRoots,limit=Math.max(...roots.map(id=>state.limits.get(id)||NETWORK_PAGE_SIZE));
  $('#holdings-mode').value=state.listMode||'rows';$('#top-n').value=String(Math.min(60,limit));$('#portfolio').value=state.portfolioFilter||'all';
  $('#network-count').textContent=`Showing ${securities.toLocaleString()} of ${model.instrumentCount.toLocaleString()} securities · ${model.portfolios.length} imported filers · ${graph.holdingLinkCount??graph.edges.length} reported holdings`;
  $('#network-more').disabled=limit>=60||graph.nodes.length>=NETWORK_NODE_LIMIT;$('#network-more').textContent=limit>=60?'Map limit reached · search all below':'Show more securities +';
  const totalRows=model.holdingEdges.length;
  $('#portfolio-summary').innerHTML=`<strong>One shared network · ${model.portfolios.length} imported filers</strong><span>${totalRows.toLocaleString()} searchable share rows</span><span>As of ${E(dateLabel(model.portfolios[0].reportingDate))}</span><span>Exact instrument matches only · Investor coverage is incomplete</span>`;
}
function expandNode(id){if(model.network){exploreRoot(id);return;}const alreadyExpanded=state.expanded.has(id);state.expanded.add(id);state.limits.set(id,(state.limits.get(id)||DEFAULT_PAGE_SIZE)+(alreadyExpanded?DEFAULT_PAGE_SIZE:0));state.selectedId=id;state.selectedEdgeId=null;render();if(graph.nodes.length>=MAX_VISIBLE_NODES)toast('Map limited to 45 entities for clarity. Make an entity the focus to explore further.');}
function render(){graph=buildVisibleGraph(model,state);renderer2D.update(graph,state,model);if(renderer3D)renderer3D.update(graph,state);renderList();renderDetails();renderNetworkControls();renderUaeControls();updateMobileSelection();$('#root-button').innerHTML=`${E(model.nodeMap.get(state.rootId).label)} <span>⌄</span>`;$('#visible-count').textContent=model.network?`${graph.nodes.length} nodes · ${graph.holdingLinkCount??graph.edges.length} reported holdings`:`${graph.nodes.length} ${graph.nodes.length===1?'entity':'entities'} · ${graph.edges.length} ${graph.edges.length===1?'connection':'connections'}`;$('#empty-state').hidden=graph.edges.length>0;$('#empty-state').innerHTML=graph.edges.length? '':`<strong>${model.edges.some(e=>e.source===state.rootId||e.target===state.rootId)?'No connections match this view.':'This part of the map is still open.'}</strong><span>${model.edges.some(e=>e.source===state.rootId||e.target===state.rootId)?'Try both directions or all connection types.':'We have not added verified connections for this entity yet. Try another company in search.'}</span>`;document.querySelectorAll('[data-filter]').forEach(b=>{b.classList.toggle('active',b.dataset.filter===state.filter);b.setAttribute('aria-pressed',String(b.dataset.filter===state.filter));});}
function renderList(){if(isUae()){const options={query:holdingsQuery,groupId:state.uaeGroupFilter,snapshotDate:state.snapshotDate,page:holdingsPageIndex};const result=researchRowsPage(model,options);holdingsPageIndex=result.page;$('#graph-list').innerHTML=researchInventoryHtml(model,result,options);return;}if(isPortfolio()){
  if(state.listMode==='shared'){
    const result=sharedInstrumentsPage(model,{query:holdingsQuery,portfolioId:state.portfolioFilter,page:holdingsPageIndex});holdingsPageIndex=result.page;
    $('#graph-list').innerHTML=`<div class="list-root"><span class="eyebrow">EXACT INSTRUMENT CONNECTIONS</span><h2>Shared securities${state.portfolioFilter?' · '+E(model.nodeMap.get(state.portfolioFilter).label):''}</h2><p class="muted">${result.total.toLocaleString()} matching securities · ${E(dateLabel(model.portfolios[0].reportingDate))} · Ranked by distinct imported filers, not position value.</p><p class="context-note">Reported by at least two of the ${model.portfolios.length} imported filers. This is not ownership, control or complete investor coverage. Separate share classes stay separate; overlapping values are never added. Select a security for each filer’s evidence.</p></div><div class="holdings-table"><div class="holdings-table-head"><span>Issuer / security class</span><span>Imported filers</span></div>${result.rows.map(item=>`<button class="list-connection holding-row shared-instrument-row" data-select="${E(item.node.id)}"><span><strong>${E(item.node.label)}</strong><small>${E(item.node.sector)} · ${E(item.filerIds.map(id=>model.nodeMap.get(id).label).join(', '))}</small></span><span class="holding-value">${item.filerIds.length}<small>reported investors</small></span></button>`).join('')||'<p class="muted">No shared securities match this search and filer filter. Unmatched instruments remain available in All filing rows; absence of a match does not mean no other investors.</p>'}</div><div class="holdings-pagination"><button class="secondary-button" data-holdings-page="${result.page-1}" ${result.page===0?'disabled':''}>← Previous</button><span>Page ${result.page+1} of ${result.pages}</span><button class="secondary-button" data-holdings-page="${result.page+1}" ${result.page+1>=result.pages?'disabled':''}>Next →</button></div>`;return;
  }
  const filteredModel=state.portfolioFilter?{...model,holdingEdges:model.holdingEdges.filter(e=>e.source===state.portfolioFilter)}:model;
  const result=holdingsPage(filteredModel,holdingsQuery,holdingsPageIndex);holdingsPageIndex=result.page;
  $('#graph-list').innerHTML=`<div class="list-root"><span class="eyebrow">ALL REPORTED SHARE POSITIONS</span><h2>${E(state.portfolioFilter?model.nodeMap.get(state.portfolioFilter).label:'Shared portfolio network')}</h2><p class="muted">${result.total.toLocaleString()} matching filing rows · ${E(dateLabel(model.portfolios[0].reportingDate))} · Select a row to focus its security and see reported investors.</p></div><div class="holdings-table"><div class="holdings-table-head"><span>Issuer / security class</span><span>Reported value</span></div>${result.rows.map(edge=>`<button class="list-connection holding-row" data-select="${E(edge.target)}"><span><strong>${E(edge.portfolioPosition.issuerName)}</strong><small>${E(edge.portfolioPosition.securityClass)} · ${E(model.nodeMap.get(edge.source).label)} · Row ${edge.portfolioPosition.rowOrdinal}</small></span><span class="holding-value">${E(money(edge.valueUsd))}<small>${E(Number(edge.portfolioPosition.quantity).toLocaleString())} shares</small></span></button>`).join('')||'<p class="muted">No share positions match this search.</p>'}</div><div class="holdings-pagination"><button class="secondary-button" data-holdings-page="${result.page-1}" ${result.page===0?'disabled':''}>← Previous</button><span>Page ${result.page+1} of ${result.pages}</span><button class="secondary-button" data-holdings-page="${result.page+1}" ${result.page+1>=result.pages?'disabled':''}>Next →</button></div>`;return;
}const root=model.nodeMap.get(state.rootId);$('#graph-list').innerHTML=`<div class="list-root"><span class="eyebrow">CURRENT FOCUS</span><h2>${E(root.label)}</h2></div>${graph.edges.length?graph.edges.map(edge=>{const from=model.nodeMap.get(edge.source),to=model.nodeMap.get(edge.target);return `<button class="list-connection" data-edge="${E(edge.id)}"><div><strong>${E(from.label)} <span>→</span> ${E(to.label)}</strong><small>${E(RELATIONSHIPS[edge.kind].label)} · as of ${E(dateLabel(edge.asOf))}</small></div><span>↗</span></button>`;}).join(''):'<p class="muted">No connections in this view.</p>'}`;}
function metricHtml(metric){return `<div class="metric"><span>${E(metric.label)}</span><strong>${E(metric.unit==='USD'?money(metric.value):String(metric.value)+(metric.unit?' '+metric.unit:''))}</strong><small>As of ${E(dateLabel(metric.asOf))}</small></div>`;}
function renderDetails(){const panel=$('#detail-panel');if(isPortfolio()){const edge=state.selectedEdgeId?findEdge(state.selectedEdgeId):null;if(edge?.kind==='issuer_reporting_entity'){panel.innerHTML=`<h2>Issuer / reporting-manager role</h2><p class="context-note">This connects a separately identified share class to its issuer’s reported portfolio. It is not a holding, ownership percentage or combination of share classes. BlackRock reports for operating subsidiaries and disclaims parent-level discretion.</p>${sourceLinks(edge.sourceIds)}<button class="primary-button" data-select="${E(edge.target)}">Explore reported portfolio →</button><button class="secondary-button" data-select="${E(edge.source)}">Explore this share class →</button>`;return;}panel.innerHTML=edge?(edge.portfolioPositions?portfolioInstrumentDetails(edge,edge.portfolio):portfolioPositionDetails(edge.portfolioPosition,edge.portfolio)):networkDetails(model,state.selectedId,state,graph);return;}if(state.selectedEdgeId){const edge=model.edges.find(e=>e.id===state.selectedEdgeId),from=model.nodeMap.get(edge.source),to=model.nodeMap.get(edge.target),type=RELATIONSHIPS[edge.kind];if(edge.disclosure){panel.innerHTML=researchDetails(edge,from,to);return;}panel.innerHTML=`<div class="panel-kicker"><span>CONNECTION DETAILS</span><button class="icon-button" data-select="${E(to.id)}" aria-label="Back to entity">←</button></div><div class="relationship-path"><button data-select="${E(from.id)}">${E(from.label)}</button><span>↓</span><button data-select="${E(to.id)}">${E(to.label)}</button></div><span class="type-badge ${edge.kind==='managed_holding'?'managed':'owned'}">${E(type.label)}</span><p class="entity-summary">${E(edge.label||type.explanation)}</p><div class="claim-grid"><div><span>Stake</span><strong>${edge.stakePercent==null?'Not disclosed in sample':E(edge.stakePercent)+'%'}</strong></div><div><span>Source as of</span><strong>${E(dateLabel(edge.asOf))}</strong></div>${edge.valueUsd!=null?`<div><span>${edge.kind==='managed_holding'?'Reported holding value':'Reported value'}</span><strong>${money(edge.valueUsd)}</strong></div>`:''}</div>${edge.notes?`<p class="context-note">${E(edge.notes)}</p>`:''}<div class="context-note"><strong>What this means</strong><p>${E(type.explanation)}</p></div><h3>Evidence <span>${edge.sourceIds.length}</span></h3>${sourceLinks(edge.sourceIds)}<button class="secondary-button full-width" data-focus="${E(to.id)}">Explore ${E(to.label)} →</button>`;return;}
  const node=model.nodeMap.get(state.selectedId);const edges=relatedEdges(model,node.id,isUae()?{snapshotDate:state.snapshotDate}:{});const filtered=relatedEdges(model,node.id,state);const shown=graph.edges.filter(e=>e.source===node.id||e.target===node.id).length;const remaining=Math.max(0,filtered.length-shown);const initials=(node.ticker||node.label.split(/\s+/).map(p=>p[0]).slice(0,2).join('')).slice(0,4);
  panel.innerHTML=`<div class="panel-kicker"><span>ENTITY OVERVIEW</span><span class="sample-pill">${isResearch()?'HISTORICAL':'SAMPLE'}</span></div><div class="entity-avatar ${node.kind}">${E(initials)}</div><h2>${E(node.label)}</h2><div class="entity-meta"><span>${E(KIND_LABELS[node.kind])}</span>${node.ticker?`<span>${E(node.ticker)}</span>`:''}${node.country?`<span>${E(node.country)}</span>`:''}</div><p class="entity-summary">${E(node.summary||'A sourced entity in this limited starter map. Its relationships have not yet been comprehensively researched.')}</p>${node.metrics?.length?`<div class="metrics">${node.metrics.map(metricHtml).join('')}</div>`:''}<div class="entity-actions">${node.id!==state.rootId?`<button class="primary-button" data-focus="${E(node.id)}">Make this the focus <span>↗</span></button>`:''}${remaining?`<button class="${node.id===state.rootId?'primary':'secondary'}-button" data-expand="${E(node.id)}">Show ${Math.min(DEFAULT_PAGE_SIZE,remaining)} more connections <span>+</span></button>`:edges.length?`<span class="complete-note">All ${isResearch()?'loaded disclosures':'sample connections'} shown or available below</span>`:''}</div><h3>Connections <span>${edges.length}</span></h3><div class="connection-list">${edges.length?edges.map(edge=>{const outgoing=edge.source===node.id,other=model.nodeMap.get(outgoing?edge.target:edge.source);return `<button class="connection-card" data-edge="${E(edge.id)}"><span class="connection-direction ${outgoing?'':'incoming'}">${outgoing?'↗':'↙'}</span><span><strong>${E(other.label)}</strong><small>${outgoing?'To':'From'} · ${E(RELATIONSHIPS[edge.kind].label)}${isUae()?' · '+E(dateLabel(edge.asOf)):''}</small></span><span class="connection-arrow">›</span></button>`;}).join(''):'<div class="research-empty">No verified connections added yet.<small>Missing data does not mean no relationship exists.</small></div>'}</div><details class="evidence-details"><summary>Entity sources <span>${(node.sourceIds||[]).length}</span></summary>${sourceLinks(node.sourceIds)}</details><div class="sample-note"><span aria-hidden="true">◌</span><p>${isResearch()?'Historical source snapshots<br><small>Selected disclosures only. Dates differ; do not add positions or infer current ownership.</small>':'UI prototype · Limited sample<br><small>Illustrative relationships for exploring the interface.</small>'}</p></div>`;
}
function closeSearch(){$('#search-results').hidden=true;$('#search').setAttribute('aria-expanded','false');}
function renderSearch(){const q=$('#search').value;const matches=searchNodes(model,q);const box=$('#search-results');box.hidden=!q.trim();$('#search').setAttribute('aria-expanded',String(!box.hidden));box.innerHTML=matches.length?searchResultsHtml(model,matches):`<div class="no-results">No match in this ${isPortfolio()?'imported portfolio network':isResearch()?'researched subset':'sample'}.<small>Coverage is limited; missing data does not mean no relationship.</small></div>`;}
function applyView(view) {
  state.view=view;
  for(const name of ['2d','3d','list'])$(`#graph-${name}`).hidden=view!==name;
  $('#graph-stage').classList.toggle('is-3d',view==='3d');
  $('#bubble-caption').hidden=view!=='3d';
  $('#empty-state').classList.toggle('list-empty',view==='list');
  $('#map-hint').textContent=view==='3d'?'Drag to rotate · Two fingers zoom / pan · Tap a node':view==='list'?(isUae()?'Select a row for its dated evidence':'Select a security to see its investors'):'Swipe to pan · Pinch to zoom · Select a card';
  document.querySelectorAll('[data-view]').forEach(button=>{button.classList.toggle('active',button.dataset.view===view);button.setAttribute('aria-pressed',String(button.dataset.view===view));});
  if(view==='2d'&&graph)renderer2D.update(graph,state,model);
  renderer3D?.setActive(view==='3d');
  $('.zoom-tools').hidden=view==='list';
}
function show3DFallback() {
  applyView('2d');
  $('#view-notice').hidden=false;
  $('#view-notice').textContent='3D is unavailable on this device. Showing the 2D map; List view also works.';
  toast('3D is unavailable on this device. Showing the 2D map.');
}
async function setView(view) {
  if(!state)return;
  const request=++viewRequest;
  const previous=state.view;
  if(view==='3d'&&!renderer3D){
    toast('Opening 3D network…');
    try {
      if(typeof window.WebGL2RenderingContext==='undefined')throw new Error('WebGL 2 unavailable');
      renderer3DPromise ||= import('./graph-3d.js?v=20261023-uae1');
      const {Graph3D}=await renderer3DPromise;
      if(request!==viewRequest)return;
      if(!renderer3D)renderer3D=new Graph3D($('#graph-3d'),{onSelect:selectNode,onEdgeSelect:selectEdge,onUnavailable:()=>{
        ++viewRequest;
        show3DFallback();
        renderer3D?.dispose();renderer3D=undefined;
      }});
      renderer3D.update(graph,state);
    } catch(error) {
      if(request!==viewRequest)return;
      console.warn('3D unavailable:',error.message);
      renderer3D?.dispose();renderer3D=undefined;
      $('#graph-3d').replaceChildren();
      show3DFallback();
      return;
    }
  }
  if(request!==viewRequest)return;
  clearTimeout(toastTimer);$('#status').hidden=true;
  if(view==='3d')$('#view-notice').hidden=true;
  applyView(view);
  if(view==='3d'&&(previous!=='3d'||!renderer3D.width))renderer3D.fit();
}
function showInfo(){const meta=model.meta||{};$('#dialog-content').innerHTML=`<p class="dialog-lead">${isPortfolio()?'Full reported Form 13F share-position rows from SEC filings. Each row is independently preserved, while source identity, amendment discovery and totals are reviewed at the filing batch level. This is a dated disclosed-securities snapshot, not current holdings, legal ownership or whole AUM.':isResearch()?'Independently reviewed historical disclosures from cited official sources. This is a bounded researched subset, not a complete ownership database or a statement of current holdings.':'A small, clickable prototype to explore how the map should work. This is a limited sample, not a complete ownership database.'}</p><div class="method-block"><i class="line-key managed"></i><div><h3>Managed holdings</h3><p>Reported investment discretion does not establish whether the position is proprietary or client-owned. It does not mean the manager owns the underlying business on its own balance sheet. A 13F filing covers certain disclosed securities, not all assets or control.</p></div></div><div class="method-block"><i class="line-key owned"></i><div><h3>Corporate ownership & investments</h3><p>Reported stakes, investments or subsidiaries. Ownership, voting rights and control are different. Unknown percentages are left unknown.</p></div></div><h3>Reading the network</h3><p>The bright card border marks the current focus; blue curves show directed relationships. Columns group entity roles, not ownership depth or control. Card size and distance are for navigation, not asset value or valuation. Swipe to pan the 2D map and select a card to explore. The optional 3D map supports rotation and two-finger zoom/pan.</p><h3>Coverage</h3><p>${E(meta.coverage||'Selected publicly sourced relationships only.')}</p>${Array.isArray(meta.coverageLanes)?`<ul>${meta.coverageLanes.map(l=>`<li><strong>${E(l.label)}</strong>: ${E(l.status)}</li>`).join('')}</ul>`:''}${(meta.notes||[]).length?`<ul>${meta.notes.map(n=>`<li>${E(n)}</li>`).join('')}</ul>`:''}<p class="context-note">AUM measures assets managed for clients. It is not a company valuation or the total value of its corporate subsidiaries. Different dates and disclosure scopes should not be combined as one total.</p><p class="muted">Dataset updated ${E(dateLabel(meta.updatedAt))}. Source dates on each connection describe the evidence, not a live guarantee that a stake is unchanged.</p>`;$('#info-dialog').showModal();}
function bind(){
  for(const selector of ['.dataset-row','#portfolio-controls','#uae-controls','#network-summary','.filter-row','#institutional-launcher','#gold-launcher','#comparison-launcher'])$('#mobile-controls-content').insertBefore($(selector),$('#mobile-apply-controls'));
  $('.workspace-heading').after($('#mobile-controls'));
  $('#mobile-apply-controls').addEventListener('click',closeMobilePanel);
  $('#mobile-help').addEventListener('click',()=>{closeMobilePanel();showInfo();});
  $('#mobile-options').addEventListener('click',()=>openMobilePanel('controls'));
  $('#mobile-details').addEventListener('click',()=>openMobilePanel('details'));
  for(const selector of ['#close-mobile-controls','#close-mobile-details','#mobile-scrim'])$(selector).addEventListener('click',closeMobilePanel);
  document.addEventListener('keydown',event=>{
    if(!mobilePanel)return;
    if(event.key==='Escape'){event.preventDefault();closeMobilePanel();return;}
    if(event.key==='Tab'){
      const items=[...mobilePanel.querySelectorAll('button,a,input,select,summary,[tabindex="0"]')].filter(el=>!el.disabled&&el.getClientRects().length);
      const first=items[0],last=items.at(-1);
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
      if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
    }
  });
  window.addEventListener('resize',()=>{if(!phoneQuery())closeMobilePanel();});
  $('#uae-group').addEventListener('change',e=>changeUaeGroup(e.target.value));
  $('#uae-snapshot').addEventListener('change',e=>{if(!isUae())return;rememberFocus();state.snapshotDate=e.target.value==='all'?null:e.target.value;state.selectedEdgeId=null;holdingsPageIndex=0;render();renderer2D.fit();renderer3D?.fit();});
  $('#uae-search').addEventListener('input',e=>{if(!isUae())return;holdingsQuery=e.target.value;holdingsPageIndex=0;renderList();renderUaeControls();setView('list');});
  $('#uae-browse').addEventListener('click',()=>{if(!isUae())return;setView('list');closeMobilePanel();});
  document.addEventListener('click',e=>{const target=e.target.closest('[data-research-explore]');if(!target||!isUae())return;exploreRoot(target.dataset.researchExplore);setView('2d');});
  $('#portfolio').addEventListener('change',e=>changePortfolio(e.target.value));
  $('#holdings-mode').addEventListener('change',e=>{rememberFocus();state.listMode=e.target.value;holdingsPageIndex=0;render();setView('list');});
  $('#focus-back').addEventListener('click',goBack);$('#network-more').addEventListener('click',showMoreNetwork);
  $('#top-n').addEventListener('change',e=>{if(!isPortfolio())return;for(const id of state.portfolioFilter?[state.portfolioFilter]:model.portfolioRoots)state.limits.set(id,Number(e.target.value));render();renderer2D.fit();renderer3D?.fit();});
  $('#holdings-search').addEventListener('input',e=>{holdingsQuery=e.target.value;holdingsPageIndex=0;renderList();setView('list');});
  document.addEventListener('click',e=>{const openHoldings=e.target.closest('[data-open-holdings]');if(openHoldings){if(openHoldings.dataset.openHoldings)changePortfolio(openHoldings.dataset.openHoldings);else rememberFocus();state.listMode='rows';holdingsPageIndex=0;render();setView('list');if(phoneQuery())openMobilePanel('controls');$('#holdings-search').focus();}const page=e.target.closest('[data-holdings-page]');if(page&&!page.disabled){holdingsPageIndex=Number(page.dataset.holdingsPage);renderList();$('#graph-list').scrollTop=0;}});

  $('#dataset').addEventListener('change',e=>setDataset(e.target.value));
  $('#retry-dataset').addEventListener('click',()=>{if(failedDataset)setDataset(failedDataset);});
  document.addEventListener('click',e=>{const search=e.target.closest('[data-search-node]');if(search){exploreRoot(search.dataset.searchNode);$('#search').value='';if(phoneQuery())$('#search').blur();return;}const focus=e.target.closest('[data-focus]');if(focus){exploreRoot(focus.dataset.focus);return;}if(e.target.closest('#detail-panel,#graph-list')){const node=e.target.closest('[data-select]'),edge=e.target.closest('[data-edge]'),expand=e.target.closest('[data-expand]');if(node){
    const fromList=Boolean(node.closest('#graph-list')),id=node.dataset.select;
    const rowIndex=fromList?[...$('#graph-list').querySelectorAll('[data-select]')].indexOf(node):-1;
    selectNode(id);
    if(fromList&&phoneQuery())openMobilePanel('details',()=>{
      const rows=[...$('#graph-list').querySelectorAll('[data-select]')];
      return rows[rowIndex]?.dataset.select===id?rows[rowIndex]:rows.find(row=>row.dataset.select===id);
    });
  }else if(edge)selectEdge(edge.dataset.edge,edge.closest('#graph-list')?()=>[...$('#graph-list').querySelectorAll('[data-edge]')].find(row=>row.dataset.edge===edge.dataset.edge):undefined);else if(expand)expandNode(expand.dataset.expand);}if(!e.target.closest('.search-box'))closeSearch();});
  $('#search').addEventListener('input',renderSearch);$('#search').addEventListener('focus',renderSearch);$('#search-form').addEventListener('submit',e=>{e.preventDefault();const first=searchNodes(model,$('#search').value)[0];if(first){exploreRoot(first.id);if(phoneQuery())$('#search').blur();}});$('#search').addEventListener('keydown',e=>{if(e.key==='Escape')closeSearch();if(e.key==='ArrowDown'){e.preventDefault();$('#search-results button')?.focus();}});
  $('#search-results').addEventListener('keydown',e=>{const buttons=[...$('#search-results').querySelectorAll('button')];const index=buttons.indexOf(document.activeElement);if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();buttons[(index+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus();}if(e.key==='Escape'){$('#search').focus();closeSearch();}});
  window.addEventListener('resize',()=>{if(graph)renderer2D.update(graph,state,model);});
  document.addEventListener('keydown',e=>{if(e.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)){e.preventDefault();$('#search').focus();}});
  document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{state.filter=b.dataset.filter;render();}));$('#direction').addEventListener('change',e=>{state.direction=e.target.value;render();});document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
  $('#zoom-in').addEventListener('click',()=>state.view==='3d'?renderer3D?.zoomBy(1.2):renderer2D.setZoom(renderer2D.zoom*1.2));$('#zoom-out').addEventListener('click',()=>state.view==='3d'?renderer3D?.zoomBy(.8):renderer2D.setZoom(renderer2D.zoom*.8));$('#fit-map').addEventListener('click',()=>state.view==='3d'?renderer3D?.fit():renderer2D.fit());$('#reset-map').addEventListener('click',()=>{state=initialState(model);focusHistory=[];$('#direction').value='both';$('#top-n').value='20';holdingsQuery='';holdingsPageIndex=0;$('#holdings-search').value='';$('#uae-search').value='';renderer2D.fit();render();setView(isUae()?'list':'2d');renderer3D?.fit();});$('#root-button').addEventListener('click',()=>{closeMobilePanel();$('#search').focus();$('#search').value='';$('#search-results').hidden=false;$('#search').setAttribute('aria-expanded','true');$('#search-results').innerHTML=model.nodes.filter(n=>['manager','sovereign'].includes(n.kind)||model.outgoingIds.has(n.id)).slice(0,30).map(n=>`<button type="button" data-search-node="${E(n.id)}"><span><strong>${E(n.label)}</strong><small>${E(KIND_LABELS[n.kind])}</small></span><span>↗</span></button>`).join('');});
  for(const id of ['about-button','coverage-button','methodology-button'])$(`#${id}`).addEventListener('click',showInfo);for(const id of ['close-dialog','dialog-done'])$(`#${id}`).addEventListener('click',()=>$('#info-dialog').close());$('#info-dialog').addEventListener('click',e=>{if(e.target===$('#info-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
}
async function setDataset(name,portfolioId){
  if(!['portfolios','researched','uae','sample'].includes(name))throw new Error('Unknown data view');
  closeMobilePanel();
  const request=++datasetRequest;
  failedDataset=null;$('#load-feedback').hidden=true;$('#retry-dataset').disabled=true;
  $('#graph-stage').setAttribute('aria-busy','true');
  let next=datasets.get(name),bundle=portfolioBundle;
  try{
    const json=async path=>{const response=await fetch(new URL(path,import.meta.url),{cache:'no-cache'});if(!response.ok)throw new Error(`Dataset request failed (${response.status})`);return response.json();};
    if(name==='portfolios'&&!next){
      // A manifest belongs to a complete validated bundle, never a failed attempt.
      bundle=await json('../data/portfolios.json?v=20261018-vga1');
      if(bundle.schemaVersion!==1||!Array.isArray(bundle.portfolios)||!bundle.portfolios.length||new Set(bundle.portfolios.map(p=>p.portfolioId)).size!==bundle.portfolios.length)throw new Error('Invalid portfolio manifest');
      const [portfolios,identity]=await Promise.all([Promise.all(bundle.portfolios.map(async summary=>{
        if(typeof summary.filer?.name!=='string'||!Number.isSafeInteger(summary.reconciliation?.shareRowCount)||summary.reconciliation.shareRowCount<0||!Array.isArray(summary.sources)||
          (summary.dataQuality?.warnings!==undefined&&!Array.isArray(summary.dataQuality.warnings)))throw new Error('Invalid portfolio summary');
        if(!/^[a-z0-9_-]+\.json$/.test(summary.dataFile))throw new Error('Invalid portfolio path');
        return decodePortfolio(summary,await json('../data/'+summary.dataFile+'?v=20261018-vga1'));
      })),json('../data/instrument-equivalence.json?v=20261018-vga1')]);
      next=createPortfolioNetwork(portfolios,identity);
    }
    if(!next){next=createModel(await json(name==='uae'?'../data/uae.json':name==='researched'?'../data/researched.json':'../data/graph.json'));}
    if(name==='uae'&&(!Array.isArray(next.meta?.investorIds)||!next.meta.investorIds.length||new Set(next.meta.investorIds).size!==next.meta.investorIds.length||next.meta.investorIds.some(id=>!next.nodeMap.has(id))||next.edges.some(edge=>!next.meta.investorIds.includes(edge.source)||!edge.disclosure||!Array.isArray(edge.disclosure.evidence)||!Array.isArray(edge.disclosure.metrics))))throw new Error('Invalid UAE admission metadata');
    if(!next.nodeMap.has(next.rootId))throw new Error('Dataset has no valid root');
    if(!next.meta||typeof next.meta.updatedAt!=='string'||(next.meta.notes!==undefined&&!Array.isArray(next.meta.notes))||
      (name==='uae'&&(next.meta.mode!=='researched'||next.meta.datasetId!=='uae'||next.meta.publicationStatus!=='approved'))||(name==='researched'&&next.meta.mode!=='researched')||(name==='sample'&&next.meta.mode!==undefined&&next.meta.mode!=='sample'))throw new Error('Invalid dataset metadata');
  }catch(error){
    if(request!==datasetRequest)return;
    $('#graph-stage').setAttribute('aria-busy','false');
    failedDataset=name;$('#retry-dataset').disabled=false;
    $('#load-feedback-text').textContent=`${name==='portfolios'?'The portfolio map':name==='uae'?'UAE disclosures':name==='researched'?'Historical disclosures':'The illustrative sample'} could not load. ${model?'Your current map is unchanged.':'Try again or choose another data view in Options.'}`;
    $('#load-feedback').hidden=false;
    if(model)$('#dataset').value=isPortfolio()?'portfolios':isResearch()?(model.meta.datasetId==='uae'?'uae':'researched'):'sample';
    else {$('#visible-count').textContent='Map unavailable';$('#mobile-selection-name').textContent='Map unavailable';}
    return;
  }
  if(request!==datasetRequest)return;
  // Only the newest successful request can publish or cache a complete model.
  datasets.set(name,next);if(name==='portfolios')portfolioBundle=bundle;
  $('#graph-stage').setAttribute('aria-busy','false');$('#load-feedback').hidden=true;
  ++viewRequest;model=next;state=initialState(model);focusHistory=[];$('#dataset').value=name;$('#direction').value='both';$('#search').value='';closeSearch();$('#info-dialog').close();
  $('#portfolio-controls').hidden=!isPortfolio();$('#uae-controls').hidden=!isUae();$('.filter-row').hidden=isPortfolio()||isUae();
  holdingsQuery='';holdingsPageIndex=0;$('#holdings-search').value='';$('#uae-search').value='';$('#top-n').value='20';
  if(isUae()){
    $('#uae-group').innerHTML=`<option value="all">All ${model.meta.investorIds.length} admitted groups</option>`+model.meta.investorIds.map(id=>`<option value="${E(id)}">${E(model.nodeMap.get(id).label)} · ${model.edges.filter(e=>e.source===id).length} rows</option>`).join('');
    $('#uae-snapshot').innerHTML='<option value="all">All disclosed dates (do not combine)</option>'+[...new Set(model.edges.map(e=>e.asOf))].sort().reverse().map(date=>`<option value="${E(date)}">${E(dateLabel(date))}</option>`).join('');
    $('#uae-coverage-content').innerHTML=`<p>${E(model.meta.coverage||'Selected dated disclosures only, not all UAE holdings.')}</p><ul>${(model.meta.coverageLanes||[]).map(l=>`<li><strong>${E(l.label)}</strong>: ${E(l.status)}</li>`).join('')}</ul><p>Group interest percentages may include intermediate subsidiaries and are not direct parent stakes. Direct equity ownership is labelled separately. Unknown or unadmitted holdings are not zero. No aggregate UAE value, AUM or ownership total is calculated.</p>`;
    $('#uae-coverage').open=false;
  }
  if(isPortfolio()){
    $('#portfolio').innerHTML=`<option value="all">All ${portfolioBundle.portfolios.length} imported filers</option>`+portfolioBundle.portfolios.map(p=>`<option value="${E(p.portfolioId)}">${E(p.filer.name)} · ${p.reconciliation.shareRowCount.toLocaleString()} rows</option>`).join('');$('#portfolio').value='all';
    if(portfolioId&&model.portfolioMap.has(portfolioId)){state.portfolioFilter=portfolioId;state.rootId=portfolioId;state.selectedId=portfolioId;}
  }
  $('#dataset-label').textContent=isPortfolio()?'Shared portfolio network':isResearch()?(model.meta.datasetId==='uae'?'UAE · Holdings disclosures':'Historical disclosures'):'UI prototype · Sample';
  $('#dataset-context').textContent=isPortfolio()?`${portfolioBundle.portfolios.length} filers · ${portfolioBundle.portfolios.reduce((n,p)=>n+p.reconciliation.shareRowCount,0).toLocaleString()} reported share rows · Historical snapshots`:isResearch()&&model.meta.datasetId==='uae'?`${model.edges.length} admitted disclosure rows · ${model.meta.investorIds.length} reporting groups · Partial historical coverage`:isResearch()?`${model.edges.length} reviewed disclosures · Not current holdings · Evidence views may repeat portfolio rows; never add them as extra holdings`:'17 entities · 12 illustrative connections';
  $('#updated-at').textContent=`${isResearch()?'Reviewed':'Updated'} ${dateLabel(model.meta.updatedAt)}`;
  $('#map-disclaimer').textContent=isPortfolio()?`One network of ${portfolioBundle.portfolios.length} imported filers. Links show reported investment discretion, not legal ownership or control. Exact instruments connect across filers; unmatched classes stay separate.`:isUae()?'Partial historical UAE disclosures, not current portfolios. Reported group interests may be indirect; direct equity ownership is labelled separately.':isResearch()?'Historical source snapshots. Managed discretion, beneficial attribution and voting are different roles.':'Connections show reported relationships. Managed holdings are distinct from corporate ownership.';
  document.querySelectorAll('button,input,select').forEach(el=>el.disabled=false);renderer2D.fit();render();await setView(isUae()?'list':'2d');if(request===datasetRequest)renderer3D?.fit();
}
export async function start(){
  mountPortfolioComparison({document,launcher:$('#comparison-launcher'),getModel:()=>model,beforeOpen:closeMobilePanel,returnFocus:()=>phoneQuery()?$('#mobile-options'):$('#comparison-launcher'),onSelect:id=>{selectNode(id);if(phoneQuery())openMobilePanel('details');},onEvidence:selectEdge});
  mountInstitutionalPilot({document,launcher:$('#institutional-launcher'),beforeOpen:closeMobilePanel,returnFocus:()=>phoneQuery()?$('#mobile-options'):$('#institutional-launcher')});
  mountGoldPilot({document,launcher:$('#gold-launcher'),beforeOpen:closeMobilePanel,returnFocus:()=>phoneQuery()?$('#mobile-options'):$('#gold-launcher')});
  document.querySelectorAll('button,input,select').forEach(el=>el.disabled=!['dataset','mobile-options','close-mobile-controls','mobile-apply-controls','mobile-scrim','mobile-details','close-mobile-details'].includes(el.id));
  bind();window.__assetsMap={getState:()=>state,getModel:()=>model,getGraph:()=>graph,selectNode,selectEdge,exploreRoot,goBack,setView,setDataset,getCameraState:()=>renderer3D?{position:renderer3D.camera.position.toArray(),target:renderer3D.controls.target.toArray()}:null};
  const requestedDataset=new URLSearchParams(window.location.search).get('dataset');
  await setDataset(['uae','researched','sample','portfolios'].includes(requestedDataset)?requestedDataset:'portfolios');
}
start();
