export const RELATIONSHIPS = {
  reported_portfolio_affiliation: {label: 'Reported asset / brand affiliation', color: '#ab8356', explanation: 'A source-named property, asset or brand affiliation. This is not a company equity interest; ownership, operation and management must be read from the cited qualifier, not inferred from this link.'},
  reported_group_interest: {label: 'Reported group interest', color: '#879c6d', dash: '7 3', explanation: 'An interest reported for a consolidated group. It may be held through subsidiaries and does not identify an immediate legal shareholder or establish direct parent ownership, voting rights or control.'},
  direct_equity_ownership: {label: 'Direct equity ownership', color: '#4b8c6c', explanation: 'A named direct shareholder in the cited issuer disclosure. Capital ownership does not by itself establish voting authority or control.'},
  issuer_reporting_entity: {label: 'Issuer / reporting-manager role', color:'#ab8a59', explanation:'Navigation between an issued share class and the same company as a reporting manager. Not a holding, ownership percentage, or merger of share classes.'},
  beneficial_ownership: { label: 'Beneficial attribution', color: '#9b82b6', explanation: 'A source-defined beneficial ownership disclosure, which can include trusts and exercisable rights. It does not establish direct legal title or control.' },
  voting_authority: { label: 'Voting authority', color: '#b18a61', dash: '2 4', explanation: 'Form-defined voting authority over reported shares. This is a separate role on a position, not an additional holding or proof of corporate control.' },
  managed_holding: { label: 'Managed holding', color: '#6f8faa', dash: '5 5', explanation: 'An investment held or managed on behalf of clients. This does not imply that the asset manager owns or controls the company.' },
  corporate_ownership: { label: 'Corporate stake', color: '#4b8c6c', explanation: 'A reported equity ownership interest. A stake does not by itself establish control.' },
  investment: { label: 'Investment', color: '#aa885b', explanation: 'A reported investment. Its current size, structure or ownership percentage may be undisclosed.' },
  subsidiary: { label: 'Subsidiary', color: '#4b8c6c', explanation: 'A reported corporate subsidiary. Check the source for the ownership structure and effective date.' }
};
export const KIND_LABELS = { manager: 'Asset manager', company: 'Company', fund: 'Fund', asset: 'Asset', brand: 'Brand', sovereign: 'Sovereign fund', person: 'Disclosed individual', reported_group: 'Disclosed group' };
export const DEFAULT_PAGE_SIZE = 8;
export const MAX_VISIBLE_NODES = 45;
export function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
export function safeUrl(value) { try { const u = new URL(value); return ['http:', 'https:'].includes(u.protocol) ? u.href : null; } catch { return null; } }
export function dateLabel(value) { if (!value) return 'Date not provided'; const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value); if (!match) return value; return new Date(`${value}T12:00:00Z`).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric', timeZone:'UTC' }); }
export function money(value) { if (!Number.isFinite(value)) return 'Not disclosed'; const abs = Math.abs(value); const unit = abs >= 1e12 ? 1e12 : abs >= 1e9 ? 1e9 : abs >= 1e6 ? 1e6 : 1; const suffix = unit === 1e12 ? 'T' : unit === 1e9 ? 'B' : unit === 1e6 ? 'M' : ''; return `$${(value/unit).toLocaleString('en-US', { maximumFractionDigits:2 })}${suffix}`; }
export function validateGraph(data) {
  const errors = [];
  if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.edges) || !Array.isArray(data.sources)) return ['Dataset must have nodes, edges and sources arrays.'];
  const ids = new Set(), sourceIds = new Set(), edgeIds = new Set();
  for (const source of data.sources) { if (!source.id || sourceIds.has(source.id)) errors.push(`Invalid or duplicate source ID: ${source.id}`); sourceIds.add(source.id); if (!source.title || !safeUrl(source.url)) errors.push(`Invalid source: ${source.id}`); }
  for (const node of data.nodes) { if (!node.id || ids.has(node.id)) errors.push(`Invalid or duplicate node ID: ${node.id}`); ids.add(node.id); if (!node.label || !KIND_LABELS[node.kind]) errors.push(`Invalid node: ${node.id}`); for (const id of node.sourceIds || []) if (!sourceIds.has(id)) errors.push(`Missing node source ${id}`); for (const metric of node.metrics || []) { if (!metric.label || metric.value == null || !metric.asOf || !sourceIds.has(metric.sourceId)) errors.push(`Invalid metric on ${node.id}`); } }
  for (const edge of data.edges) { if (!edge.id || edgeIds.has(edge.id)) errors.push(`Invalid or duplicate edge ID: ${edge.id}`); edgeIds.add(edge.id); if (!ids.has(edge.source) || !ids.has(edge.target)) errors.push(`Dangling edge ${edge.id}`); if (!RELATIONSHIPS[edge.kind]) errors.push(`Unknown relationship ${edge.kind}`); if (!edge.asOf) errors.push(`Missing as-of date: ${edge.id}`); if (!edge.sourceIds?.length || edge.sourceIds.some(id => !sourceIds.has(id))) errors.push(`Missing edge sources: ${edge.id}`); if (edge.stakePercent != null && (!Number.isFinite(edge.stakePercent) || edge.stakePercent < 0 || edge.stakePercent > 100)) errors.push(`Invalid stake: ${edge.id}`); if (edge.valueUsd != null && (!Number.isFinite(edge.valueUsd) || edge.valueUsd < 0)) errors.push(`Invalid value: ${edge.id}`); }
  return errors;
}
export function createModel(data) {
  const errors = validateGraph(data); if (errors.length) throw new Error(errors.join('\n'));
  const nodes = new Map(data.nodes.map(n => [n.id, n]));
  const sources = new Map(data.sources.map(s => [s.id, s]));
  return { ...data, nodeMap:nodes, sourceMap:sources, outgoingIds:new Set(data.edges.map(e=>e.source)), rootId:data.meta?.defaultRoot || data.nodes[0]?.id };
}
export function relatedEdges(model, id, { filter = 'all', direction = 'both', snapshotDate = null } = {}) {
  return model.edges.filter(edge => {
    const relation = filter === 'all' || (filter === 'ownership' ? ['corporate_ownership','direct_equity_ownership','reported_group_interest','investment','subsidiary','beneficial_ownership'].includes(edge.kind) : edge.kind === filter);
    return relation && (!snapshotDate || edge.asOf === snapshotDate) && (direction === 'outgoing' ? edge.source === id : direction === 'incoming' ? edge.target === id : edge.source === id || edge.target === id);
  });
}
export function buildVisibleGraph(model, state) {
  if(model.network)return model.buildVisibleGraph(state);
  const nodeIds = new Set([state.rootId]); const edgeIds = new Set(); const queue = [state.rootId]; const visited = new Set();
  while (queue.length) {
    const id = queue.shift(); if (visited.has(id)) continue; visited.add(id);
    if (!state.expanded.has(id)) continue;
    const candidates = relatedEdges(model, id, state).slice(0, state.limits.get(id) || DEFAULT_PAGE_SIZE);
    for (const edge of candidates) { const other = edge.source === id ? edge.target : edge.source; if (!nodeIds.has(other) && nodeIds.size >= MAX_VISIBLE_NODES) continue; nodeIds.add(other); edgeIds.add(edge.id); if (!visited.has(other)) queue.push(other); }
  }
  return { nodes: [...nodeIds].map(id => model.nodeMap.get(id)).filter(Boolean), edges: model.edges.filter(e => edgeIds.has(e.id)) };
}
// Search is navigation, not issuer resolution. Keep exact instrument IDs intact
// while exposing the source-qualified differences that identical labels hide.
export function searchResultDetails(model,node) {
  if (!model.network || node.kind !== 'asset') return [KIND_LABELS[node.kind]+(node.ticker?' · '+node.ticker:'')];
  const holdings=model.edges.filter(edge=>edge.target===node.id && edge.kind==='managed_holding');
  const filers=[...new Set(holdings.map(edge=>edge.source))];
  const dates=[...new Set(holdings.map(edge=>edge.asOf).filter(Boolean))].sort();
  const scope=filers.length===1?(model.nodeMap.get(filers[0])?.label||'1 imported filer'):`${filers.length} imported filers`;
  return [`Reported class: ${node.sector||'Not provided'}`,scope+' · '+(dates.length?dates.map(dateLabel).join(', '):'Date not provided')];
}
export function searchResultsHtml(model,matches) {
  const sameName=matches.some((node,index)=>matches.slice(0,index).some(other=>other.label.toLocaleLowerCase()===node.label.toLocaleLowerCase()));
  const note=model.network&&sameName?'<p class="search-context">Same name, separate reported records. Class descriptions may differ; choose a result to inspect its filers and evidence.</p>':'';
  return note+matches.map(node=>`<button type="button" data-search-node="${escapeHtml(node.id)}"><span><strong>${escapeHtml(node.label)}</strong>${searchResultDetails(model,node).map(line=>`<small>${escapeHtml(line)}</small>`).join('')}</span><span aria-hidden="true">↗</span></button>`).join('');
}
export function searchNodes(model, query) { const q = query.trim().toLocaleLowerCase(); if (!q) return []; return model.nodes.filter(n => [n.label,n.ticker,n.country,n.sector,n.kind].some(v => String(v || '').toLocaleLowerCase().includes(q))).sort((a,b) => Number(b.label.toLowerCase().startsWith(q)) - Number(a.label.toLowerCase().startsWith(q)) || a.label.localeCompare(b.label)).slice(0, 12); }
export function layoutGraph(graph, rootId) {
  const positions = new Map(); positions.set(rootId, {x:0,y:0,z:0});
  const others = graph.nodes.filter(n => n.id !== rootId); let offset = 0, ring = 1;
  while (offset < others.length) { const count = Math.min(others.length - offset, ring === 1 ? 8 : 12); const radiusX = ring === 1 ? 300 : 300 + (ring-1)*245; const radiusY = ring === 1 ? 205 : 205 + (ring-1)*195;
    for (let i=0;i<count;i++) { const angle = (i / count) * Math.PI*2 - Math.PI/2 + (count === 2 ? Math.PI/2 : 0); const node = others[offset+i]; positions.set(node.id,{x:Math.cos(angle)*radiusX,y:Math.sin(angle)*radiusY,z:Math.sin(i*2.4+ring)*50}); } offset += count; ring++;
  }
  return positions;
}
export function initialState(model) { return {rootId:model.rootId, selectedId:model.rootId, selectedEdgeId:null, filter:'all',direction:'both',expanded:new Set(model.portfolioRoots||[model.rootId]),limits:new Map(model.network?model.portfolioRoots.map(id=>[id,20]):[]),pinnedNodes:new Set(),portfolioFilter:null,isolated:false,view:'2d'}; }
