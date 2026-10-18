// Presentation geometry for the retained, shared investment network. One node
// represents one verified instrument even when several managers report it.
// Positions encode connectivity, never position value, ownership or control.
const compareIds = (a, b) => String(a).localeCompare(String(b));
const hash = value => {
  let result = 2166136261;
  for (const char of String(value)) result = Math.imul(result ^ char.charCodeAt(0), 16777619);
  return result >>> 0;
};

export function networkManagerIds(graph) {
  const ids = new Set(graph.nodes.map(node => node.id));
  const roots = (graph.portfolioRoots || []).map(root => typeof root === 'string' ? root : root.id).filter(id => ids.has(id));
  return [...new Set(roots.length ? roots : graph.nodes.filter(node => node.kind === 'manager').map(node => node.id))].sort(compareIds);
}

export function networkConnections(graph) {
  const managers = new Set(networkManagerIds(graph));
  const connections = new Map(graph.nodes.map(node => [node.id, new Set()]));
  for (const edge of graph.edges) {
    if (managers.has(edge.source)) connections.get(edge.target)?.add(edge.source);
    if (managers.has(edge.target)) connections.get(edge.source)?.add(edge.target);
  }
  return connections;
}

export function layoutSharedNetwork(graph, {portrait = false, mode = '3d'} = {}) {
  if (!graph.nodes.length) return new Map();
  const managerIds = networkManagerIds(graph);
  const managers = new Set(managerIds);
  const connections = networkConnections(graph);
  const positions = new Map();
  const radius = Math.max(2.6, Math.sqrt(graph.nodes.length) * .57);
  for (let i = 0; i < managerIds.length; i++) {
    const angle = -Math.PI / 2 + i * Math.PI * 2 / managerIds.length;
    positions.set(managerIds[i], {x:Math.cos(angle) * radius, y:Math.sin(angle) * radius});
  }

  // A deterministic hexagonal packing keeps adjacent names/spheres apart.
  // Multi-manager instruments claim positions around their managers' centroid
  // first, so overlap is a visible bridge rather than duplicated filer islands.
  const extent = Math.ceil(Math.sqrt(graph.nodes.length)) + 3;
  const candidates = [];
  for (let row = -extent; row <= extent; row++) {
    for (let col = -extent; col <= extent; col++) candidates.push({x:col + (Math.abs(row) % 2) * .5, y:row * .8660254});
  }
  const nodes = graph.nodes.filter(node => !managers.has(node.id)).sort((a, b) =>
    (connections.get(b.id)?.size || 0) - (connections.get(a.id)?.size || 0) || compareIds(a.id, b.id));
  const occupied = [...positions.values()];
  for (const node of nodes) {
    const anchors = [...(connections.get(node.id) || [])].map(id => positions.get(id));
    const anchor = anchors.length ? {
      x:anchors.reduce((sum, point) => sum + point.x, 0) / anchors.length * .82,
      y:anchors.reduce((sum, point) => sum + point.y, 0) / anchors.length * .82
    } : {x:0, y:0};
    // ID-based rotation breaks ties without depending on source row order.
    const angle = hash(node.id) / 0xffffffff * Math.PI * 2;
    const jitter = {x:Math.cos(angle) * .22, y:Math.sin(angle) * .22};
    let best, bestScore = Infinity;
    for (const point of candidates) {
      const score = (point.x - anchor.x - jitter.x) ** 2 + (point.y - anchor.y - jitter.y) ** 2;
      if (score >= bestScore || occupied.some(other => mode === '2d'
        ? Math.abs(point.x-other.x)<.98 && Math.abs(point.y-other.y)<.85
        : (point.x-other.x) ** 2 + (point.y-other.y) ** 2 < .96)) continue;
      best = point;
      bestScore = score;
    }
    const point = best || {x:occupied.length + radius, y:0};
    positions.set(node.id, point);
    occupied.push(point);
  }

  const scaleX = mode === '2d' ? 206 : portrait ? 52 : 68;
  const scaleY = mode === '2d' ? (portrait ? 133 : 100) : portrait ? 87 : 65;
  return new Map([...positions].map(([id, point]) => [id, {
    x:point.x * scaleX,
    y:point.y * scaleY,
    z:mode === '2d' ? 0 : managers.has(id) ? 8 : ((hash(id) % 71) - 35) * .7
  }]));
}

// All buttons remain accessible. This only selects the visual labels; keyboard
// focus and pointer hover may temporarily promote any other network instrument.
export function prioritizeNetworkLabels(graph, {rootId, selectedId, hoveredId, keyboardId} = {}) {
  const managers = new Set(networkManagerIds(graph));
  const connections = networkConnections(graph);
  const score = id => (id === keyboardId ? 100000 : 0) + (id === hoveredId ? 50000 : 0)
    + (id === rootId ? 20000 : 0) + (id === selectedId ? 10000 : 0)
    + (managers.has(id) ? 5000 : 0) + (connections.get(id)?.size || 0) * 100;
  return graph.nodes.map(node => node.id).sort((a, b) => score(b) - score(a) || compareIds(a, b));
}
