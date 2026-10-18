import {escapeHtml, RELATIONSHIPS, KIND_LABELS, layoutGraph, relatedEdges} from './graph-model.js?v=20261018-data2';
import {layoutSharedNetwork, networkManagerIds, prioritizeNetworkLabels} from './shared-network-layout.js?v=20261018-data2';
const NS = 'http://www.w3.org/2000/svg';
export class Graph2D {
  constructor(container, { onSelect, onEdgeSelect, onExpand }) {
    this.container=container; this.onSelect=onSelect; this.onEdgeSelect=onEdgeSelect; this.onExpand=onExpand; this.zoom=1; this.pan={x:0,y:0};
    this.svg=document.createElementNS(NS,'svg'); this.svg.setAttribute('role','group'); this.svg.setAttribute('aria-label','Relationship graph. Select an entity to see its details.'); this.svg.innerHTML='<defs><marker id="edge-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#9aaea1"/></marker><filter id="node-shadow" x="-30%" y="-40%" width="160%" height="190%"><feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#18352b" flood-opacity=".055"/></filter></defs><g class="viewport"></g>';
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
      if(e.target.closest('[data-node],[data-edge]')){e.preventDefault();this.activate(e.target);}
    });
    this.svg.addEventListener('pointerdown',e=>this.pointerDown(e));
    this.svg.addEventListener('pointermove',e=>this.pointerMove(e));
    this.svg.addEventListener('pointerup',e=>this.pointerEnd(e));
    this.svg.addEventListener('pointercancel',e=>this.pointerEnd(e,true));
    this.svg.addEventListener('lostpointercapture',e=>{if(this.pointers.has(e.pointerId))this.pointerEnd(e,true);});
    this.svg.addEventListener('pointerover',e=>{this.hoveredId=e.target.closest('[data-node]')?.dataset.node;this.updateNodePresentation();});
    this.svg.addEventListener('pointerout',e=>{this.hoveredId=e.relatedTarget?.closest?.('[data-node]')?.dataset.node;this.updateNodePresentation();});
    this.svg.addEventListener('focusin',e=>{this.keyboardId=e.target.closest('[data-node]')?.dataset.node;this.updateNodePresentation();});
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
  pickNodeAt(clientX,clientY,radius=22){
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
    this.graph=graph;this.state=state;const compact=this.container.clientWidth>0&&this.container.clientWidth<560;
    this.positions=graph.network?layoutSharedNetwork(graph,{portrait:compact,mode:'2d'}):layoutGraph(graph,state.rootId);
    if(compact&&!graph.network){let i=0;for(const [id,p] of this.positions){if(id===state.rootId)continue;const count=graph.nodes.length-1;if(count<=3){p.x*=.46;p.y*=.72;}else{p.x=i%2===0?-105:105;p.y=105+Math.floor(i/2)*95;i++;}}} const items=[]; const E=escapeHtml;
    for(const edge of graph.edges){const a=this.positions.get(edge.source),b=this.positions.get(edge.target);const style=RELATIONSHIPS[edge.kind];const len=Math.hypot(b.x-a.x,b.y-a.y)||1;const cut=8;const x2=b.x-(b.x-a.x)/len*cut,y2=b.y-(b.y-a.y)/len*cut;items.push(`<g class="edge ${state.selectedEdgeId===edge.id?'selected':''}" data-edge="${E(edge.id)}" role="button" tabindex="0" aria-label="${E(model.nodeMap.get(edge.source).label)} to ${E(model.nodeMap.get(edge.target).label)}: ${E(style.label)}"><title>${E(style.label)} · as of ${E(edge.asOf)}</title><line class="edge-hit" x1="${a.x}" y1="${a.y}" x2="${x2}" y2="${y2}"/><line class="edge-visible" x1="${a.x}" y1="${a.y}" x2="${x2}" y2="${y2}" stroke="${style.color}" ${style.dash?`stroke-dasharray="${style.dash}"`:''} vector-effect="non-scaling-stroke"/></g>`);}
    const managers=new Set(networkManagerIds(graph));
    for(const node of graph.nodes){
      const p=this.positions.get(node.id),isRoot=node.id===state.rootId,selected=node.id===state.selectedId&&!state.selectedEdgeId;
      const count=model.edges.filter(e=>e.source===node.id||e.target===node.id).length;
      const canExpand=relatedEdges(model,node.id,state).some(e=>!graph.edges.some(v=>v.id===e.id));
      const label=node.label.length>23?node.label.slice(0,22)+'…':node.label;
      items.push(`<g class="graph-node ${isRoot?'root-node':''} ${managers.has(node.id)?'manager-node':''} ${selected?'selected':''}" transform="translate(${p.x},${p.y})" data-node="${E(node.id)}" role="button" tabindex="0" aria-label="${E(node.label)}, ${E(KIND_LABELS[node.kind])}, ${count} connections"><title>${E(node.label)} · ${E(KIND_LABELS[node.kind])}</title><g class="node-glyph"><circle class="node-hit" r="22" fill="transparent"/><circle class="selection-ring" r="11"/><circle class="node-symbol" r="9"/><circle class="node-core" r="${isRoot?5:managers.has(node.id)?4:3}"/><g class="node-label"><text class="node-name" x="13" y="-2">${E(label)}</text><text class="node-kind" x="13" y="12">${E(KIND_LABELS[node.kind])}</text>${canExpand?`<g class="expand-node" data-expand="${E(node.id)}"><circle cx="-20" cy="0" r="11"/><text x="-20" y="4" text-anchor="middle">+</text></g>`:''}</g></g></g>`);
    }
    this.layer.innerHTML=items.join(''); const xs=[...this.positions.values()].map(p=>p.x),ys=[...this.positions.values()].map(p=>p.y);this.bounds=compact?{x:Math.min(...xs,-90)-100,y:Math.min(...ys,-80)-65,width:Math.max(...xs,90)-Math.min(...xs,-90)+200,height:Math.max(...ys,100)-Math.min(...ys,-80)+130}:{x:Math.min(...xs,-200)-120,y:Math.min(...ys,-160)-80,width:Math.max(...xs,200)-Math.min(...xs,-200)+240,height:Math.max(...ys,160)-Math.min(...ys,-160)+160};this.svg.setAttribute('viewBox',`${this.bounds.x} ${this.bounds.y} ${this.bounds.width} ${this.bounds.height}`);this.applyTransform();
    if(graph.network){
      this.overviewBounds={...this.bounds};
      const managers=new Set(networkManagerIds(graph));
      for(const node of this.layer.querySelectorAll('[data-node]')){
        if(managers.has(node.dataset.node))node.classList.add('manager-node');
      }
      for(const edge of this.layer.querySelectorAll('[data-edge]')){
        const data=graph.edges.find(item=>item.id===edge.dataset.edge);
        const related=(graph.focusScope||[state.rootId]).includes(data.source)||(graph.focusScope||[state.rootId]).includes(data.target);
        edge.querySelector('.edge-visible').style.opacity=state.selectedEdgeId===data.id?1:related?.9:.22;
      }
    }else this.overviewBounds=null;
    if(this.focusedId===state.rootId)this.focus(this.focusedId);else this.focusedId=null;
  }
  applyTransform(){this.layer.setAttribute('transform',`translate(${this.pan.x},${this.pan.y}) scale(${this.zoom})`);this.updateNodePresentation();}
  clampZoom(value){return Math.max(.45,Math.min(this.graph?.network?10:3.5,value));}
  setZoom(value,anchor){
    const next=this.clampZoom(value);
    anchor??={x:this.bounds?.x+this.bounds?.width/2||0,y:this.bounds?.y+this.bounds?.height/2||0};
    this.pan={x:anchor.x-(anchor.x-this.pan.x)*next/this.zoom,y:anchor.y-(anchor.y-this.pan.y)*next/this.zoom};
    this.zoom=next;this.applyTransform();
  }
  updateNodePresentation(){
    if(!this.bounds||!this.graph)return;
    const rect=this.svg.getBoundingClientRect();
    const scale=Math.min(rect.width/this.bounds.width,rect.height/this.bounds.height)||1;
    const glyphScale=1/(scale*this.zoom);
    const elements=new Map([...this.layer.querySelectorAll('[data-node]')].map(node=>[node.dataset.node,node]));
    const priority=prioritizeNetworkLabels(this.graph,{...this.state,hoveredId:this.hoveredId,keyboardId:this.keyboardId});
    const boxes=[],compact=rect.width>0&&rect.width<600,maxLabels=compact?6:12;
    const offsetX=(rect.width-this.bounds.width*scale)/2,offsetY=(rect.height-this.bounds.height*scale)/2;
    for(const id of priority){
      const node=elements.get(id);if(!node)continue;
      node.querySelector('.node-glyph').setAttribute('transform',`scale(${glyphScale})`);
      const p=this.positions.get(id),x=(p.x*this.zoom+this.pan.x-this.bounds.x)*scale+offsetX,y=(p.y*this.zoom+this.pan.y-this.bounds.y)*scale+offsetY;
      const important=id===this.state.rootId||id===this.state.selectedId||id===this.keyboardId||id===this.hoveredId;
      const label=node.querySelector('.node-label');
      const width=Math.min(164,Math.max(86,(label.querySelector('.node-name').textContent.length)*6.1));
      const leftLabel=rect.width&&x+width+16>rect.width;
      const box={left:leftLabel?x-width-13:x+13,right:leftLabel?x-13:x+width+13,top:y-13,bottom:y+17};
      const onScreen=!rect.width||(x>=4&&x<=rect.width-4&&y>=25&&y<=rect.height-32);
      const visible=onScreen&&(important||(boxes.length<maxLabels&&!boxes.some(other=>box.left<other.right+8&&box.right>other.left-8&&box.top<other.bottom+5&&box.bottom>other.top-5)));
      label.style.visibility=visible?'visible':'hidden';node.dataset.labelVisible=String(visible);
      for(const text of label.querySelectorAll('.node-name,.node-kind')){text.setAttribute('x',leftLabel?'-13':'13');text.setAttribute('text-anchor',leftLabel?'end':'start');}
      if(visible)boxes.push(box);
    }
  }
  fit(){this.focusedId=null;this.zoom=1;this.pan={x:0,y:0};if(this.overviewBounds){this.bounds={...this.overviewBounds};this.svg.setAttribute('viewBox',`${this.bounds.x} ${this.bounds.y} ${this.bounds.width} ${this.bounds.height}`);}this.applyTransform();}
  focus(id){
    if(!this.graph?.network||!this.positions.has(id))return;
    this.focusedId=id;
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

// SVG defaults to xMidYMid meet: the narrow dimension may be letterboxed.
export function clientToViewBox(x,y,bounds,rect){
  if(!bounds)return{x:0,y:0};
  const scale=Math.min(rect.width/bounds.width,rect.height/bounds.height)||1;
  return{x:bounds.x+(x-rect.left-(rect.width-bounds.width*scale)/2)/scale,y:bounds.y+(y-rect.top-(rect.height-bounds.height*scale)/2)/scale};
}
