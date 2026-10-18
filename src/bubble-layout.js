import {layoutSharedNetwork} from './shared-network-layout.js?v=20261018-mobile1';
// Presentation-only geometry. Bubble size encodes focus, never monetary value.
export function bubbleRadius(nodeId, rootId) { return nodeId === rootId ? 29 : 21; }
export function layoutBubbles(graph, rootId, portrait = false) {
  if (graph.network) return layoutSharedNetwork(graph, {portrait});
  const positions = new Map([[rootId, {x:0, y:0, z:16}]]);
  const others = graph.nodes.filter(node => node.id !== rootId);
  let offset = 0;
  for (let ring = 1; offset < others.length; ring++) {
    const count = Math.min(others.length - offset, ring === 1 ? 8 : 12);
    for (let i = 0; i < count; i++) {
      const angle = Math.PI / 2 - i * Math.PI * 2 / count + (count === 2 ? Math.PI / 2 : 0);
      positions.set(others[offset + i].id, {
        x: Math.cos(angle) * (portrait ? 87 : 142) * ring,
        y: Math.sin(angle) * (portrait ? 110 : 92) * ring,
        z: Math.sin(i * 2.4 + ring) * 39 - 14
      });
    }
    offset += count;
  }
  return positions;
}
