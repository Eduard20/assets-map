import {escapeHtml, RELATIONSHIPS, KIND_LABELS, layoutGraph, relatedEdges} from './graph-model.js?v=20261018-network1';
import {layoutSharedNetwork, networkManagerIds} from './shared-network-layout.js?v=20261018-network1';
const NS = 'http://www.w3.org/2000/svg';
export class Graph2D {
  constructor(container, { onSelect, onEdgeSelect, onExpand }) {
    this.container=container; this.onSelect=onSelect; this.onEdgeSelect=onEdgeSelect; this.onExpand=onExpand; this.zoom=1; this.pan={x:0,y:0};
    this.svg=document.createElementNS(NS,'svg'); this.svg.setAttribute('role','group'); this.svg.setAttribute('aria-label','Relationship graph. Select an entity to see its details.'); this.svg.innerHTML='<defs><marker id="edge-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#9aaea1"/></marker><filter id="node-shadow" x="-30%" y="-40%" width="160%" height="190%"><feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#18352b" flood-opacity=".055"/></filter></defs><g class="viewport"></g>';
    this.layer=this.svg.querySelector('.viewport'); container.append(this.svg);
    this.svg.addEventListener('click', e => { if (this.dragged) return; const expand=e.target.closest('[data-expand]'); if(expand){this.onExpand(expand.dataset.expand);return;} const node=e.target.closest('[data-node]'); if(node){this.onSelect(node.dataset.node);return;} const edge=e.target.closest('[data-edge]'); if(edge)this.onEdgeSelect(edge.dataset.edge); });
    this.svg.addEventListener('keydown',e=>{if(e.key!=='Enter'&&e.key!==' ')return;const node=e.target.closest('[data-node]');const edge=e.target.closest('[data-edge]');if(node){e.preventDefault();this.onSelect(node.dataset.node);}else if(edge){e.preventDefault();this.onEdgeSelect(edge.dataset.edge);}});
    this.svg.addEventListener('pointerdown',e=>{if(e.target.closest('[data-node],[data-edge]'))return;this.dragged=false;this.drag={x:e.clientX,y:e.clientY,pan:{...this.pan}};this.svg.setPointerCapture(e.pointerId);});
    this.svg.addEventListener('pointermove',e=>{if(!this.drag)return;const factor=this.bounds.width/(this.svg.clientWidth||1)/this.zoom;const dx=e.clientX-this.drag.x,dy=e.clientY-this.drag.y;if(Math.abs(dx)+Math.abs(dy)>5)this.dragged=true;this.pan={x:this.drag.pan.x+dx*factor,y:this.drag.pan.y+dy*factor};this.applyTransform();});
    this.svg.addEventListener('pointerup',()=>{this.drag=null;setTimeout(()=>this.dragged=false,0);});this.svg.addEventListener('pointercancel',()=>this.drag=null);
    this.svg.addEventListener('wheel',e=>{e.preventDefault();this.setZoom(this.zoom*(e.deltaY>0?.9:1.1));},{passive:false});
  }
  update(graph,state,model) {
    this.graph=graph;this.state=state;const compact=this.container.clientWidth>0&&this.container.clientWidth<560;
    this.positions=graph.network?layoutSharedNetwork(graph,{portrait:compact,mode:'2d'}):layoutGraph(graph,state.rootId);
    if(compact&&!graph.network){let i=0;for(const [id,p] of this.positions){if(id===state.rootId)continue;const count=graph.nodes.length-1;if(count<=3){p.x*=.46;p.y*=.72;}else{p.x=i%2===0?-105:105;p.y=105+Math.floor(i/2)*95;i++;}}} const items=[]; const E=escapeHtml;
    for(const edge of graph.edges){const a=this.positions.get(edge.source),b=this.positions.get(edge.target);const style=RELATIONSHIPS[edge.kind];const len=Math.hypot(b.x-a.x,b.y-a.y)||1;const cut=52;const x2=b.x-(b.x-a.x)/len*cut,y2=b.y-(b.y-a.y)/len*cut;items.push(`<g class="edge ${state.selectedEdgeId===edge.id?'selected':''}" data-edge="${E(edge.id)}" role="button" tabindex="0" aria-label="${E(model.nodeMap.get(edge.source).label)} to ${E(model.nodeMap.get(edge.target).label)}: ${E(style.label)}"><title>${E(style.label)} · as of ${E(edge.asOf)}</title><line class="edge-hit" x1="${a.x}" y1="${a.y}" x2="${x2}" y2="${y2}"/><line class="edge-visible" x1="${a.x}" y1="${a.y}" x2="${x2}" y2="${y2}" stroke="${style.color}" ${style.dash?`stroke-dasharray="${style.dash}"`:''} marker-end="url(#edge-arrow)"/></g>`);}
    for(const node of graph.nodes){const p=this.positions.get(node.id),isRoot=node.id===state.rootId,selected=node.id===state.selectedId&&!state.selectedEdgeId;const label=node.label.length>19?node.label.slice(0,18)+'…':node.label;const short=(node.ticker||node.label.split(/\s+/).map(x=>x[0]).slice(0,2).join('')).slice(0,4);const count=model.edges.filter(e=>e.source===node.id||e.target===node.id).length;const canExpand=relatedEdges(model,node.id,state).some(e=>!graph.edges.some(v=>v.id===e.id));items.push(`<g class="graph-node ${isRoot?'root-node':''} ${selected?'selected':''}" transform="translate(${p.x},${p.y})" data-node="${E(node.id)}" role="button" tabindex="0" aria-label="${E(node.label)}, ${E(KIND_LABELS[node.kind])}, ${count} connections"><title>${E(node.label)} · ${E(KIND_LABELS[node.kind])}</title><rect class="selection-ring" x="-91" y="-37" width="182" height="74" rx="18"/><rect class="node-card" x="-86" y="-32" width="172" height="64" rx="13" filter="url(#node-shadow)"/><circle class="node-symbol" cx="-60" cy="0" r="17"/><text class="node-short" x="-60" y="4" text-anchor="middle">${E(short)}</text><text class="node-name" x="-34" y="-3">${E(label.length>15?label.slice(0,14)+'…':label)}</text><text class="node-kind" x="-34" y="14">${E(KIND_LABELS[node.kind])}</text>${canExpand?`<g class="expand-node" data-expand="${E(node.id)}"><circle cx="83" cy="-28" r="11"/><text x="83" y="-24" text-anchor="middle">+</text></g>`:''}</g>`);}
    this.layer.innerHTML=items.join(''); const xs=[...this.positions.values()].map(p=>p.x),ys=[...this.positions.values()].map(p=>p.y);this.bounds=compact?{x:Math.min(...xs,-90)-100,y:Math.min(...ys,-80)-65,width:Math.max(...xs,90)-Math.min(...xs,-90)+200,height:Math.max(...ys,100)-Math.min(...ys,-80)+130}:{x:Math.min(...xs,-200)-120,y:Math.min(...ys,-160)-80,width:Math.max(...xs,200)-Math.min(...xs,-200)+240,height:Math.max(...ys,160)-Math.min(...ys,-160)+160};this.svg.setAttribute('viewBox',`${this.bounds.x} ${this.bounds.y} ${this.bounds.width} ${this.bounds.height}`);this.applyTransform();
    if(graph.network){
      this.overviewBounds={...this.bounds};
      const managers=new Set(networkManagerIds(graph));
      for(const node of this.layer.querySelectorAll('[data-node]')){
        if(managers.has(node.dataset.node))node.classList.add('manager-node');
      }
      for(const edge of this.layer.querySelectorAll('[data-edge]')){
        const data=graph.edges.find(item=>item.id===edge.dataset.edge);
        const related=data.source===state.rootId||data.target===state.rootId;
        edge.querySelector('.edge-visible').style.opacity=state.selectedEdgeId===data.id?1:related?.9:.22;
      }
    }else this.overviewBounds=null;
  }
  applyTransform(){this.layer.setAttribute('transform',`translate(${this.pan.x},${this.pan.y}) scale(${this.zoom})`);}
  setZoom(value){this.zoom=Math.max(.45,Math.min(this.graph?.network?10:3.5,value));this.applyTransform();}
  fit(){this.zoom=1;this.pan={x:0,y:0};if(this.overviewBounds){this.bounds={...this.overviewBounds};this.svg.setAttribute('viewBox',`${this.bounds.x} ${this.bounds.y} ${this.bounds.width} ${this.bounds.height}`);}this.applyTransform();}
  focus(id){
    if(!this.graph?.network||!this.positions.has(id))return;
    const point=this.positions.get(id);
    if(this.zoom>1.05){this.pan={x:this.bounds.x+this.bounds.width/2-point.x*this.zoom,y:this.bounds.y+this.bounds.height/2-point.y*this.zoom};}
    else{
      const halfWidth=Math.max(...[...this.positions.values()].map(p=>Math.abs(p.x-point.x)+120));
      const halfHeight=Math.max(...[...this.positions.values()].map(p=>Math.abs(p.y-point.y)+90));
      this.bounds={x:point.x-halfWidth,y:point.y-halfHeight,width:halfWidth*2,height:halfHeight*2};
      this.svg.setAttribute('viewBox',`${this.bounds.x} ${this.bounds.y} ${this.bounds.width} ${this.bounds.height}`);
      this.pan={x:0,y:0};this.zoom=1;
    }
    this.applyTransform();
  }
}
