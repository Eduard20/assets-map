import {escapeHtml, RELATIONSHIPS, KIND_LABELS, relatedEdges} from './graph-model.js?v=20261023-uae1';
import {layoutRelationshipCards, relationshipCurve, CARD_WIDTH, CARD_HEIGHT} from './relationship-card-layout.js';
const NS = 'http://www.w3.org/2000/svg';
export class Graph2D {
  constructor(container, { onSelect, onEdgeSelect, onExpand }) {
    this.container=container; this.onSelect=onSelect; this.onEdgeSelect=onEdgeSelect; this.onExpand=onExpand; this.zoom=1; this.pan={x:0,y:0};
    this.svg=document.createElementNS(NS,'svg'); this.svg.setAttribute('role','group'); this.svg.setAttribute('aria-label','Relationship graph. Select an entity to see its details.'); this.svg.innerHTML='<defs><marker id="edge-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#93b2ff"/></marker><filter id="node-shadow" x="-30%" y="-40%" width="160%" height="190%"><feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#18352b" flood-opacity=".055"/></filter></defs><g class="viewport"></g>';
    this.layer=this.svg.querySelector('.viewport'); container.append(this.svg);
    this.svg.setAttribute('preserveAspectRatio','xMidYMid meet');
    this.svg.style.touchAction='none';
    this.pointers=new Map();
    this.svg.addEventListener('click',e=>{
      // Pointer taps are handled on release because capture retargets clicks.
      // Native/synthetic keyboard activation still has its independent path.
      if(e.detail===0)this.activate(e.target);
    });
    this.svg.addEventListener('keydown',e=>{
      if(e.key!=='Enter'&&e.key!==' ')return;
      if(e.target.closest('[data-expand],[data-node],[data-edge]')){e.preventDefault();this.activate(e.target);}
    });
    this.svg.addEventListener('pointerdown',e=>this.pointerDown(e));
    this.svg.addEventListener('pointermove',e=>this.pointerMove(e));
    this.svg.addEventListener('pointerup',e=>this.pointerEnd(e));
    this.svg.addEventListener('pointercancel',e=>this.pointerEnd(e,true));
    this.svg.addEventListener('lostpointercapture',e=>{if(this.pointers.has(e.pointerId))this.pointerEnd(e,true);});
    this.svg.addEventListener('pointerover',e=>{this.hoveredId=e.target.closest('[data-node]')?.dataset.node;this.updateNodePresentation();});
    this.svg.addEventListener('pointerout',e=>{this.hoveredId=e.relatedTarget?.closest?.('[data-node]')?.dataset.node;this.updateNodePresentation();});
    this.svg.addEventListener('focusin',e=>{this.keyboardId=e.target.closest('[data-node]')?.dataset.node;this.revealTarget(e.target);this.updateNodePresentation();});
    this.svg.addEventListener('focusout',()=>{this.keyboardId=null;this.updateNodePresentation();});
    this.svg.addEventListener('wheel',e=>{e.preventDefault();this.setZoom(this.zoom*(e.deltaY>0?.9:1.1),this.clientPoint(e.clientX,e.clientY));},{passive:false});
  }
  activate(target){
    const expand=target.closest('[data-expand]');if(expand){this.onExpand(expand.dataset.expand);return;}
    const node=target.closest('[data-node]');if(node){this.onSelect(node.dataset.node);return;}
    const edge=target.closest('[data-edge]');if(edge)this.onEdgeSelect(edge.dataset.edge);
  }
  clientPoint(x,y){
    const matrix=this.svg.getScreenCTM?.();
    if(matrix){
      const determinant=matrix.a*matrix.d-matrix.b*matrix.c;
      if(determinant)return{x:(matrix.d*(x-matrix.e)-matrix.c*(y-matrix.f))/determinant,y:(matrix.a*(y-matrix.f)-matrix.b*(x-matrix.e))/determinant};
    }
    return clientToViewBox(x,y,this.bounds,this.svg.getBoundingClientRect());
  }
  resetGesture(){
    const points=[...this.pointers.values()];
    if(!points.length){this.gesture=null;return;}
    const midpoint=points.length>1?{x:(points[0].x+points[1].x)/2,y:(points[0].y+points[1].y)/2}:points[0];
    const anchor=this.clientPoint(midpoint.x,midpoint.y);
    this.gesture={anchor,pan:{...this.pan},zoom:this.zoom,distance:points.length>1?Math.hypot(points[1].x-points[0].x,points[1].y-points[0].y):0,world:{x:(anchor.x-this.pan.x)/this.zoom,y:(anchor.y-this.pan.y)/this.zoom}};
  }
  pointerDown(e){
    if((e.pointerType==='mouse'&&e.button!==0)||!this.bounds)return;
    if(!this.pointers.size){this.dragged=false;this.tap={target:e.target,id:e.pointerId,x:e.clientX,y:e.clientY};}
    this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(this.pointers.size>1){this.dragged=true;this.tap=null;}
    this.svg.setPointerCapture?.(e.pointerId);
    this.resetGesture();
  }
  pointerMove(e){
    if(!this.pointers.has(e.pointerId)||!this.gesture)return;
    this.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(this.tap&&Math.hypot(e.clientX-this.tap.x,e.clientY-this.tap.y)>7)this.dragged=true;
    const points=[...this.pointers.values()];
    if(points.length>1){
      const midpoint=this.clientPoint((points[0].x+points[1].x)/2,(points[0].y+points[1].y)/2);
      const distance=Math.hypot(points[1].x-points[0].x,points[1].y-points[0].y);
      this.zoom=this.clampZoom(this.gesture.zoom*distance/(this.gesture.distance||1));
      this.pan={x:midpoint.x-this.gesture.world.x*this.zoom,y:midpoint.y-this.gesture.world.y*this.zoom};
    }else if(this.dragged){
      const point=this.clientPoint(e.clientX,e.clientY);
      this.pan={x:this.gesture.pan.x+point.x-this.gesture.anchor.x,y:this.gesture.pan.y+point.y-this.gesture.anchor.y};
    }else return;
    this.applyTransform();
  }
  pointerEnd(e,cancelled=false){
    if(!this.pointers.has(e.pointerId))return;
    const tap=this.tap;
    if(cancelled)this.dragged=true;
    const select=!cancelled&&!this.dragged&&this.pointers.size===1&&tap?.id===e.pointerId&&Math.hypot(e.clientX-tap.x,e.clientY-tap.y)<=7;
    this.pointers.delete(e.pointerId);
    if(this.svg.hasPointerCapture?.(e.pointerId))this.svg.releasePointerCapture(e.pointerId);
    this.tap=null;
    this.resetGesture();
    if(select){
      // Larger invisible touch targets can overlap in dense overviews. Pick
      // the nearest actual point, not whichever node was painted last.
      // An explicit expansion control keeps its distinct action.
      const expand=tap.target.closest('[data-expand]');
      const nodeId=expand?null:this.pickNodeAt(e.clientX,e.clientY);
      if(nodeId)this.onSelect(nodeId);else this.activate(tap.target);
    }
  }
  revealTarget(target){
    const edgeId=target.closest('[data-edge]')?.dataset.edge;const edge=this.graph?.edges.find(e=>e.id===edgeId);const id=target.closest('[data-node]')?.dataset.node||edge?.source,point=this.positions?.get(id);if(!point||!this.bounds)return;
    const x=point.x*this.zoom+this.pan.x,y=point.y*this.zoom+this.pan.y;
    if(x-CARD_WIDTH/2<0||x+CARD_WIDTH/2>this.bounds.width||y-CARD_HEIGHT/2<40||y+CARD_HEIGHT/2>this.bounds.height-60)this.focus(id);
  }
  pickNodeAt(clientX,clientY,radius=22){
    if(this.cardLayout){const point=this.clientPoint(clientX,clientY);const x=(point.x-this.pan.x)/this.zoom,y=(point.y-this.pan.y)/this.zoom;for(const [id,p] of this.positions)if(Math.abs(x-p.x)<=CARD_WIDTH/2&&Math.abs(y-p.y)<=CARD_HEIGHT/2)return id;return null;}

    if(!this.positions||!this.bounds)return null;
    const matrix=this.svg.getScreenCTM?.();
    const rect=this.svg.getBoundingClientRect();
    const scale=Math.min(rect.width/this.bounds.width,rect.height/this.bounds.height)||1;
    let closest=null,distance=radius*radius;
    for(const [id,point] of this.positions){
      const x=point.x*this.zoom+this.pan.x,y=point.y*this.zoom+this.pan.y;
      const screen=matrix?{x:matrix.a*x+matrix.c*y+matrix.e,y:matrix.b*x+matrix.d*y+matrix.f}:{
        x:rect.left+(rect.width-this.bounds.width*scale)/2+(x-this.bounds.x)*scale,
        y:rect.top+(rect.height-this.bounds.height*scale)/2+(y-this.bounds.y)*scale
      };
      const candidate=(screen.x-clientX)**2+(screen.y-clientY)**2;
      if(candidate<=distance){closest=id;distance=candidate;}
    }
    return closest;
  }

  update(graph,state,model) {
    // Redraw replaces the SVG buttons. Retain only focus actually owned by
    // this graph; selection state alone must never steal focus from controls.
    const active=this.layer.ownerDocument.activeElement;
    const focused=this.layer.contains(active)?active?.closest('[data-expand],[data-node],[data-edge]'):null;
    const focusKind=focused?.hasAttribute('data-expand')?'expand':focused?.hasAttribute('data-node')?'node':focused?.hasAttribute('data-edge')?'edge':null;
    const focusId=focusKind?focused.dataset[focusKind]:null;
    this.keyboardId=null;
    this.graph=graph;this.state=state;
    this.cardLayout=layoutRelationshipCards(graph);this.positions=this.cardLayout.positions;
    const E=escapeHtml,items=[];
    for(const column of this.cardLayout.columns){
      items.push(`<g class="relationship-column" aria-hidden="true"><text x="${column.x}" y="64" class="column-title">${E(column.title)}</text><text x="${column.x}" y="83" class="column-description">${E(column.description)}</text><line x1="${column.x}" y1="92" x2="${column.x+CARD_WIDTH}" y2="92"/>${column.groups.map(group=>`<text class="column-group" x="${column.x}" y="${group.y}">${E(group.label.replaceAll('_',' ').toUpperCase())}</text>`).join('')}</g>`);
    }
    graph.edges.forEach((edge,index)=>{
      const a=this.positions.get(edge.source),b=this.positions.get(edge.target),style=RELATIONSHIPS[edge.kind];if(!a||!b)return;
      const path=relationshipCurve(a,b,index);
      items.push(`<g class="edge ${state.selectedEdgeId===edge.id?'selected':''}" data-edge="${E(edge.id)}" role="button" tabindex="0" aria-label="${E(model.nodeMap.get(edge.source).label)} to ${E(model.nodeMap.get(edge.target).label)}: ${E(style.label)}, as of ${E(edge.asOf)}"><title>${E(style.label)} · as of ${E(edge.asOf)}</title><path class="edge-hit" d="${path}"/><path class="edge-visible" marker-end="url(#edge-arrow)" d="${path}" ${style.dash?`stroke-dasharray="${style.dash}"`:''}/></g>`);
    });
    for(const node of graph.nodes){
      const p=this.positions.get(node.id),selected=node.id===state.selectedId&&!state.selectedEdgeId;
      const edges=graph.edges.filter(e=>e.source===node.id||e.target===node.id);
      const canExpand=relatedEdges(model,node.id,state).some(e=>!graph.edges.some(v=>v.id===e.id));
      const label=node.label.length>27?node.label.slice(0,26)+'…':node.label;
      items.push(`<g class="graph-node relationship-card ${node.id===state.rootId?'root-node':''} ${selected?'selected':''}" transform="translate(${p.x},${p.y})" data-node="${E(node.id)}" role="button" tabindex="0" aria-label="${E(node.label)}, ${E(KIND_LABELS[node.kind])}, ${edges.length} visible connections"><title>${E(node.label)} · ${E(KIND_LABELS[node.kind])}</title><g class="node-glyph"><rect class="node-card" x="-112" y="-38" width="224" height="76" rx="7"/><circle class="card-indicator" cx="-98" cy="-13" r="4"/><g class="node-label"><text class="node-name" x="-86" y="-10">${E(label)}</text><text class="node-kind" x="-86" y="9">${E(KIND_LABELS[node.kind])}${node.ticker?' · '+E(node.ticker):''}</text><text class="card-meta" x="-86" y="27">${edges.length} visible ${edges.length===1?'link':'links'} · select to explore</text></g>${canExpand?`<g class="expand-node" data-expand="${E(node.id)}" role="button" tabindex="0" aria-label="Show more connections for ${E(node.label)}"><rect x="-44" y="-44" width="44" height="44" rx="5"/><text x="-22" y="-15" text-anchor="middle">+</text></g>`:''}</g></g>`);
    }
    this.layer.innerHTML=items.join('');
    // Hidden views have no measured size. Retain the last real viewport until
    // this graph is revealed instead of laying out against a phantom desktop.
    const width=this.container.clientWidth,height=this.container.clientHeight;
    const visible=width>0&&height>0;
    const viewportChanged=visible&&(!this.wasVisible||this.bounds?.width!==width||this.bounds?.height!==height);
    this.wasVisible=visible;
    this.bounds={x:0,y:0,width:width||this.bounds?.width||900,height:height||this.bounds?.height||600};
    this.svg.setAttribute('viewBox',`0 0 ${this.bounds.width} ${this.bounds.height}`);
    this.overviewBounds=null;
    this.applyTransform();
    const rootChanged=this.lastRootId!==state.rootId;this.lastRootId=state.rootId;
    if(visible&&(rootChanged||viewportChanged)){const root=[...this.layer.querySelectorAll('[data-node]')].find(el=>el.dataset.node===state.rootId);if(root)this.revealTarget(root);}
    if(focusKind){
      const replacement=[...this.layer.querySelectorAll(`[data-${focusKind}]`)].find(element=>element.dataset[focusKind]===focusId);
      replacement?.focus({preventScroll:true});
    }
  }
  applyTransform(){this.layer.setAttribute('transform',`translate(${this.pan.x},${this.pan.y}) scale(${this.zoom})`);this.updateNodePresentation();}
  clampZoom(value){return Math.max(this.cardLayout?.6:.45,Math.min(this.graph?.network?10:3.5,value));}
  setZoom(value,anchor){
    const next=this.clampZoom(value);
    anchor??={x:this.bounds?.x+this.bounds?.width/2||0,y:this.bounds?.y+this.bounds?.height/2||0};
    this.pan={x:anchor.x-(anchor.x-this.pan.x)*next/this.zoom,y:anchor.y-(anchor.y-this.pan.y)*next/this.zoom};
    this.zoom=next;this.applyTransform();
  }
  updateNodePresentation(){
    if(!this.bounds||!this.graph)return;
    const focus=this.hoveredId||this.keyboardId||this.state.selectedId;
    const neighbours=new Set([focus]);
    for(const edge of this.graph.edges)if(edge.source===focus||edge.target===focus){neighbours.add(edge.source);neighbours.add(edge.target);}
    for(const node of this.layer.querySelectorAll('[data-node]')){
      node.classList.toggle('unrelated',!neighbours.has(node.dataset.node));node.dataset.labelVisible='true';node.querySelector('[data-expand]')?.setAttribute('transform',`translate(112,38) scale(${1/this.zoom})`);
    }
    for(const element of this.layer.querySelectorAll('[data-edge]')){
      const edge=this.graph.edges.find(e=>e.id===element.dataset.edge);
      element.classList.toggle('related',edge.source===focus||edge.target===focus);
    }
  }

  fit(){this.focusedId=null;this.zoom=1;this.pan={x:0,y:0};if(this.cardLayout&&this.state?.rootId)this.focus(this.state.rootId);else this.applyTransform();}
  focus(id){
    if(!this.positions?.has(id))return;
    this.focusedId=id;const point=this.positions.get(id);
    this.pan={x:Math.max(0,(this.bounds.width-CARD_WIDTH)/2)-point.x*this.zoom+CARD_WIDTH/2,y:100-point.y*this.zoom+CARD_HEIGHT/2};
    this.applyTransform();
  }

}

// SVG defaults to xMidYMid meet: the narrow dimension may be letterboxed.
export function clientToViewBox(x,y,bounds,rect){
  if(!bounds)return{x:0,y:0};
  const scale=Math.min(rect.width/bounds.width,rect.height/bounds.height)||1;
  return{x:bounds.x+(x-rect.left-(rect.width-bounds.width*scale)/2)/scale,y:bounds.y+(y-rect.top-(rect.height-bounds.height*scale)/2)/scale};
}
