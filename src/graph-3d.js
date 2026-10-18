import * as THREE from '../vendor/three.module.min.js';
import { OrbitControls } from '../vendor/OrbitControls.js';
import { KIND_LABELS } from './graph-model.js?v=20261018-mobile1';
import { layoutBubbles, bubbleRadius } from './bubble-layout.js?v=20261018-mobile1';
import { networkManagerIds, prioritizeNetworkLabels } from './shared-network-layout.js?v=20261018-mobile1';

const vector = p => new THREE.Vector3(p.x, p.y, p.z);
const COLORS = {issuer_reporting_entity:'#d7b580',beneficial_ownership:'#ba9cdb', voting_authority:'#d7b580',managed_holding:'#8eb8e4', corporate_ownership:'#82ceb0', investment:'#d7b580', subsidiary:'#82ceb0'};
export class Graph3D {
  constructor(container, {onSelect, onEdgeSelect, onUnavailable}) {
    this.container = container;
    this.onSelect = onSelect;
    this.onEdgeSelect = onEdgeSelect;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, 1, .1, 3000);
    this.camera.position.set(0, 12, 440);
    this.renderer = new THREE.WebGLRenderer({antialias:true, alpha:true});
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    const canvas = this.renderer.domElement;
    canvas.setAttribute('aria-label', '3D network. Drag to orbit, pinch to zoom, or move two fingers to pan. Tap a point or name to explore.');
    canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); this.setActive(false); onUnavailable?.(); });
    this.labels = document.createElement('div');
    this.labels.className = 'bubble-labels';
    container.replaceChildren(canvas, this.labels);
    // A single gesture surface includes the native label buttons. Dragging a
    // label must orbit the graph, not become a dead touch area.
    this.controls = new OrbitControls(this.camera, container);
    this.controls.enableDamping = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    this.controls.dampingFactor = .1;
    this.controls.enablePan = true;
    this.controls.screenSpacePanning = true;
    this.controls.minDistance = 100;
    this.controls.maxDistance = 1500;
    this.controls.rotateSpeed = .65;
    this.controls.touches.ONE = THREE.TOUCH.ROTATE;
    this.controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
    this.controls.addEventListener('change', () => this.render());
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.scene.add(new THREE.HemisphereLight('#d7f5f1', '#10272c', 2));
    const key = new THREE.DirectionalLight('#f4fff9', 3.2);
    key.position.set(-100, 160, 180);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight('#8faaff', 2.8);
    rim.position.set(160, 50, -80);
    this.scene.add(rim);
    const fill = new THREE.DirectionalLight('#65dcb2', .8);
    fill.position.set(20, -120, 100);
    this.scene.add(fill);
    this.raycaster = new THREE.Raycaster();
    this.raycaster.params.Line.threshold = 4;
    this.pointer = new THREE.Vector2();
    this.targets = [];
    this.nodeEntries = [];
    this.active = false;
    this.pointers = new Set();
    container.addEventListener('pointerdown', e => {
      this.pointers.add(e.pointerId);
      if (this.pointers.size > 1 || (e.pointerType==='mouse'&&e.button!==0)) { this.start = null; return; }
      this.start = {x:e.clientX, y:e.clientY, id:e.pointerId, moved:false, labelId:e.target.closest('[data-node-id]')?.dataset.nodeId};
    });
    container.addEventListener('pointermove', e => {
      if (this.start && Math.hypot(e.clientX-this.start.x, e.clientY-this.start.y) > 7) this.start.moved = true;
      if (this.graph?.network && !this.start && e.pointerType !== 'touch') {
        this.hoveredId=this.pickNodeAt(e.clientX,e.clientY,14)?.node.id;
        canvas.style.cursor=this.hoveredId?'pointer':'grab';
      }
    });
    container.addEventListener('pointerleave',()=>{this.hoveredId=null;});
    const cancel = e => { this.pointers.delete(e.pointerId); this.start = null; };
    container.addEventListener('pointercancel',cancel);
    container.addEventListener('lostpointercapture',cancel);
    container.addEventListener('pointerup', e => {
      const start = this.start;
      this.pointers.delete(e.pointerId);
      this.start = null;
      if (!start || start.moved || start.id !== e.pointerId || this.pointers.size || Math.hypot(e.clientX-start.x,e.clientY-start.y)>7) return;
      if(start.labelId){this.onSelect(start.labelId);return;}
      // Screen-pixel targets stay finger-sized even at the overview distance.
      // Choose the closest point before lines, so an edge cannot steal its tap.
      const node=this.pickNodeAt(e.clientX,e.clientY,22);
      if(node){this.onSelect(node.node.id);return;}
      const rect = canvas.getBoundingClientRect();
      this.pointer.set((e.clientX-rect.left)/rect.width*2-1, -(e.clientY-rect.top)/rect.height*2+1);
      this.raycaster.setFromCamera(this.pointer, this.camera);
      const hit = this.raycaster.intersectObjects(this.edgeEntries, false)[0]?.object;
      if (hit?.userData.edgeId) this.onEdgeSelect(hit.userData.edgeId);
    });
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(container);
    this.animate = this.animate.bind(this);
    this.resize();
  }

  pickNodeAt(clientX,clientY,radius=22){
    const rect=this.renderer.domElement.getBoundingClientRect();
    if(!rect.width||!rect.height)return null;
    this.camera.updateMatrixWorld();
    const x=clientX-rect.left,y=clientY-rect.top;
    let closest=null,distance=radius*radius;
    for(const entry of this.nodeEntries){
      const point=entry.sphere.position.clone().project(this.camera);
      if(point.z < -1 || point.z > 1)continue;
      const dx=(point.x*.5+.5)*rect.width-x,dy=(-point.y*.5+.5)*rect.height-y;
      const candidate=dx*dx+dy*dy;
      if(candidate<=distance){closest=entry;distance=candidate;}
    }
    return closest;
  }

  update(graph, state) {
    this.graph = graph;
    this.state = state;
    if(!graph.network||this.focusedId!==state.rootId)this.focusedId=null;
    const portrait = this.container.clientWidth < 600;
    const key = JSON.stringify([portrait, Boolean(graph.network), graph.network ? null : state.rootId, graph.nodes.map(n=>n.id), graph.edges.map(e=>e.id)]);
    if (key !== this.graphKey) {
      this.graphKey = key;
      this.portrait = portrait;
      this.build();
      if (this.active) this.fit();
    }
    for (const entry of this.nodeEntries) {
      const selected = entry.node.id === state.selectedId;
      const root = entry.node.id === state.rootId;
      entry.button.classList.toggle('selected', selected);
      entry.button.classList.toggle('root',root);
      entry.button.setAttribute('aria-pressed', String(selected));
      entry.ring.visible = selected;
      if(graph.network){
        entry.pixelRadius=root?4.6:entry.manager?3.8:2.8;
        entry.sphere.material.color.set(root?'#6fe2b5':entry.manager?'#75d5ca':'#afbddc');
        entry.button.lastElementChild.textContent=root?'CURRENT FOCUS':entry.manager?'REPORTING MANAGER':KIND_LABELS[entry.node.kind];
      }
    }
    for (const edge of this.edgeEntries) {
      const selected=edge.userData.edgeId===state.selectedEdgeId;
      const related=(this.graph.focusScope||[state.rootId]).includes(edge.userData.source)||(this.graph.focusScope||[state.rootId]).includes(edge.userData.target);
      edge.material.opacity=selected?1:graph.network?(related?.8:.14):.65;
      if(edge.userData.arrow)edge.userData.arrow.visible=!graph.network||selected||related;
    }
    this.render();
  }

  build() {
    this.clear();
    const positions = layoutBubbles(this.graph, this.state.rootId, this.portrait);
    this.positions = positions;
    const managers = new Set(networkManagerIds(this.graph));
    for (const edge of this.graph.edges) {
      const start = vector(positions.get(edge.source));
      const end = vector(positions.get(edge.target));
      const direction = end.clone().sub(start).normalize();
      start.addScaledVector(direction, 4);
      end.addScaledVector(direction, -6);
      const material = edge.kind === 'managed_holding'
        ? new THREE.LineDashedMaterial({color:COLORS[edge.kind], dashSize:3, gapSize:2, transparent:true, opacity:.5})
        : new THREE.LineBasicMaterial({color:COLORS[edge.kind], transparent:true, opacity:.65});
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([start, end]), material);
      line.computeLineDistances();
      line.userData.edgeId = edge.id;
      line.userData.source=edge.source;line.userData.target=edge.target;
      this.group.add(line);
      this.targets.push(line);
      this.edgeEntries.push(line);
      const arrow = new THREE.Mesh(new THREE.ConeGeometry(.7, 2.8, 6), new THREE.MeshBasicMaterial({color:COLORS[edge.kind]}));
      arrow.position.copy(end);
      arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), direction);
      line.userData.arrow=arrow;
      this.group.add(arrow);
    }
    for (const node of this.graph.nodes) {
      const root = node.id === this.state.rootId;
      const radius = 3;
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(radius, 16, 12), new THREE.MeshBasicMaterial({
        color:root ? '#a8ffe4' : managers.has(node.id) ? '#87e9f4' : '#c8d5ff', toneMapped:false
      }));
      sphere.position.copy(vector(positions.get(node.id)));
      sphere.userData.nodeId = node.id;
      const halo = new THREE.Mesh(new THREE.SphereGeometry(radius*2.5,12,8),new THREE.MeshBasicMaterial({color:root?'#67ffd4':'#75c9ff',transparent:true,opacity:.09,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false}));
      halo.position.copy(sphere.position);
      const ring = new THREE.Mesh(new THREE.RingGeometry(radius*2.65, radius*2.85, 48), new THREE.MeshBasicMaterial({color:'#a5ffe5', transparent:true, opacity:.65, side:THREE.DoubleSide, depthWrite:false,toneMapped:false}));
      ring.position.copy(sphere.position);
      // Separate, invisible picking geometry never makes a point look chunky.
      const hit = new THREE.Mesh(new THREE.SphereGeometry(1,8,6),new THREE.MeshBasicMaterial());
      hit.visible=false;hit.position.copy(sphere.position);hit.userData.nodeId=node.id;
      this.group.add(sphere, halo, ring, hit);
      this.targets.push(hit);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `bubble-label${root ? ' root' : ''}`;
      button.dataset.nodeId = node.id;
      button.setAttribute('aria-label', `Explore ${node.label}`);
      button.title=node.label;
      const name = document.createElement('strong');
      name.textContent = node.label;
      if(this.graph.network){
        button.style.width=this.portrait?'110px':'144px';
        name.style.fontSize=this.portrait?'11px':'12px';
        name.style.display='-webkit-box';name.style.webkitLineClamp='2';name.style.webkitBoxOrient='vertical';name.style.overflow='hidden';
      }
      const kind = document.createElement('span');
      kind.textContent = root ? 'CURRENT FOCUS' : KIND_LABELS[node.kind];
      button.append(name, kind);
      button.addEventListener('click', event => {
        // Pointer selection is gated by the shared surface's drag tracker.
        // Enter, Space and assistive-tech activation retain native semantics.
        if (event.detail === 0) this.onSelect(node.id);
      });
      button.addEventListener('focus',()=>{this.keyboardId=node.id;this.render();});
      button.addEventListener('blur',()=>{if(this.keyboardId===node.id)this.keyboardId=null;this.render();});
      button.addEventListener('pointerenter',()=>{this.hoveredId=node.id;});
      button.addEventListener('pointerleave',()=>{if(this.hoveredId===node.id)this.hoveredId=null;});
      const leader=document.createElement('span');
      leader.className='node-label-leader';
      leader.setAttribute('aria-hidden','true');
      Object.assign(leader.style,{position:'absolute',left:'0',top:'0',height:'1px',background:'rgba(133,219,223,.3)',transformOrigin:'0 50%',pointerEvents:'none'});
      leader.hidden=true;
      this.labels.append(leader,button);
      this.nodeEntries.push({node, sphere, halo, ring, hit, button, leader, radius,baseRadius:radius,pixelRadius:root?4.6:managers.has(node.id)?3.8:2.8,manager:managers.has(node.id)});
    }
    // A quiet reference orbit makes the perspective legible as the map is rotated.
    if (this.graph.nodes.length > 1 && !this.graph.network) {
      const points = Array.from({length:97}, (_,i) => {
        const angle = i/96*Math.PI*2;
        return new THREE.Vector3(Math.cos(angle)*(this.portrait?115:185), Math.sin(angle)*40-18, Math.sin(angle)*85-35);
      });
      this.group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineDashedMaterial({color:'#426a70', transparent:true, opacity:.32, dashSize:2, gapSize:5})).computeLineDistances());
    }
  }

  clear() {
    this.group.traverse(child => {
      child.geometry?.dispose();
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const material of materials) { material?.map?.dispose(); material?.dispose(); }
    });
    this.group.clear();
    this.labels.replaceChildren();
    this.targets = [];
    this.nodeEntries = [];
    this.edgeEntries = [];
  }

  resize() {
    const width = this.container.clientWidth, height = this.container.clientHeight;
    if (!width || !height) return;
    const firstSize=!this.width;
    const widthChanged=this.width&&Math.abs(width-this.width)>40;
    const wasPortrait=this.portrait;
    this.width = width;
    this.height = height;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width/height;
    this.camera.updateProjectionMatrix();
    if (this.graph && (width < 600) !== this.portrait) this.update(this.graph, this.state);
    // Mobile browser chrome changes height as it expands/collapses. Preserve
    // the user's orbit, pan and zoom instead of unexpectedly fitting again.
    if (this.graph && (firstSize || (widthChanged && wasPortrait===this.portrait))) this.fit();
    this.render();
  }

  render() {
    if (this.container.hidden || !this.width) return;
    this.camera.updateMatrixWorld();
    const cameraUp = new THREE.Vector3(0,1,0).applyQuaternion(this.camera.quaternion);
    const projected = new Map();
    for (const entry of this.nodeEntries) {
      const depth=-entry.sphere.position.clone().applyMatrix4(this.camera.matrixWorldInverse).z;
      const worldPerPixel=2*Math.max(.1,depth)*Math.tan(THREE.MathUtils.degToRad(this.camera.fov/2))/this.height;
      entry.radius=worldPerPixel*entry.pixelRadius;
      const scale=entry.radius/entry.baseRadius;
      entry.sphere.scale.setScalar(scale);entry.halo.scale.setScalar(scale);entry.ring.scale.setScalar(scale);
      entry.hit.scale.setScalar(worldPerPixel*22);
      entry.ring.quaternion.copy(this.camera.quaternion);
      const point = entry.sphere.position.clone().addScaledVector(cameraUp, -worldPerPixel*14).project(this.camera);
      const x = (point.x*.5+.5)*this.width;
      const y = (-point.y*.5+.5)*this.height;
      if(this.graph?.network){projected.set(entry.node.id,{x,y,z:point.z});continue;}
      entry.button.hidden = point.z > 1 || point.z < -1 || x < 0 || x > this.width || y < 0 || y > this.height-25;
      entry.button.style.transform = `translate(-50%, 0) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      entry.button.style.zIndex = String(Math.round((1-point.z)*10000));
    }
    if(this.graph?.network)this.renderNetworkLabels(projected);
    this.renderer.render(this.scene, this.camera);
  }

  renderNetworkLabels(projected) {
    const entries=new Map(this.nodeEntries.map(entry=>[entry.node.id,entry]));
    const priority=prioritizeNetworkLabels(this.graph,{...this.state,hoveredId:this.hoveredId,keyboardId:this.keyboardId});
    const boxes=[];
    const maxLabels=this.portrait?6:12;
    const labelWidth=this.portrait?110:144,labelHeight=this.portrait?58:64;
    const margin=8,top=45,bottom=85;
    const intersects=box=>boxes.some(other=>box.left<other.right+5&&box.right>other.left-5&&box.top<other.bottom+5&&box.bottom>other.top-5);
    for(const id of priority){
      const entry=entries.get(id),point=projected.get(id);
      // Focus/blur can fire while a changed graph is rebuilding its buttons.
      if(!entry)continue;
      const button=entry.button;
      const important=entry.manager||id===this.state.rootId||id===this.keyboardId||id===this.hoveredId;
      let box;
      const onScreen=point&&point.x>=0&&point.x<=this.width&&point.y>=0&&point.y<=this.height;
      if(point&&point.z>=-1&&point.z<=1&&(onScreen||id===this.keyboardId)&&(boxes.length<maxLabels||important)){
        const shifts=[[0,0],[0,-labelHeight-30],[0,labelHeight+10],[-labelWidth*.55,0],[labelWidth*.55,0],[-labelWidth,0],[labelWidth,0]];
        if(important)shifts.push([0,-labelHeight*2],[0,labelHeight*2]);
        for(const [dx,dy] of shifts){
          const left=Math.max(margin,Math.min(this.width-labelWidth-margin,point.x-labelWidth/2+dx));
          const y=Math.max(top,Math.min(this.height-bottom-labelHeight,point.y+dy));
          const candidate={left,right:left+labelWidth,top:y,bottom:y+labelHeight};
          if(!intersects(candidate)){box=candidate;break;}
        }
      }
      // Clipping, rather than display:none or aria-hidden, retains a native
      // keyboard path to every instrument. Focus reveals that instrument.
      button.hidden=false;
      button.classList.toggle('sr-only',!box);
      button.dataset.labelVisible=String(Boolean(box));
      if(box){
        boxes.push(box);
        button.style.transform=`translate(${box.left.toFixed(1)}px, ${box.top.toFixed(1)}px)`;
        button.style.zIndex=String(important?20:10);
        // A fine tether keeps a collision-shifted label attached to its point.
        if(entry.leader){
          const origin={x:point.x,y:point.y-14};
          const end={x:Math.max(box.left,Math.min(box.right,origin.x)),y:Math.max(box.top,Math.min(box.bottom,origin.y))};
          const dx=end.x-origin.x,dy=end.y-origin.y,length=Math.hypot(dx,dy);
          entry.leader.hidden=length<17||!onScreen;
          entry.leader.style.width=`${Math.max(0,length-5)}px`;
          entry.leader.style.transform=`translate(${origin.x.toFixed(1)}px,${origin.y.toFixed(1)}px) rotate(${Math.atan2(dy,dx)}rad)`;
        }
      }else{
        if(entry.leader)entry.leader.hidden=true;
        button.style.transform='translate(1px, 1px)';
        button.style.zIndex='0';
      }
    }
  }

  setActive(value) {
    if (this.active === value) return;
    this.active = value;
    cancelAnimationFrame(this.frame);
    if (value) { this.resize(); this.animate(); }
  }
  animate() {
    if (!this.active) return;
    this.controls.update();
    this.render();
    this.frame = requestAnimationFrame(this.animate);
  }
  fit() {
    if (!this.positions || !this.width) return;
    if(this.graph?.network){this.fitNetwork(this.positions.has(this.focusedId)?vector(this.positions.get(this.focusedId)):new THREE.Vector3(0,0,0),true);return;}
    const damping=this.controls.enableDamping;
    this.controls.enableDamping = false;
    this.controls.update();
    this.controls.enableDamping = damping;
    const tan = Math.tan(THREE.MathUtils.degToRad(this.camera.fov/2));
    // Reserve screen space for full names, controls and the canvas heading.
    let distance = 240;
    for (const [id, p] of this.positions) {
      const radius = bubbleRadius(id, this.state.rootId);
      distance = Math.max(distance, p.z + (Math.abs(p.x)+radius+25)/(tan*this.camera.aspect*.83), p.z + (Math.abs(p.y)+radius+35)/(tan*.76));
    }
    this.controls.target.set(0, -10, 0);
    this.camera.position.set(0, -10, distance);
    this.controls.update();
    this.render();
  }
  fitNetwork(target,resetOrientation=false) {
    if(!this.positions||!this.width)return;
    const damping=this.controls.enableDamping;this.controls.enableDamping=false;this.controls.update();this.controls.enableDamping=damping;
    const direction=resetOrientation?new THREE.Vector3(0,0,1):this.camera.position.clone().sub(this.controls.target).normalize();
    this.controls.target.copy(target);
    this.camera.position.copy(target).add(direction);
    this.camera.lookAt(target);this.camera.updateMatrixWorld();
    const inverse=this.camera.quaternion.clone().invert();
    const tan=Math.tan(THREE.MathUtils.degToRad(this.camera.fov/2));
    const horizontal=Math.max(.35,1-(this.portrait?100:160)/this.width);
    const vertical=Math.max(.3,1-160/this.height);
    let distance=280;
    for(const [id,position] of this.positions){
      const point=vector(position).sub(target).applyQuaternion(inverse);
      const radius=bubbleRadius(id,this.state.rootId)+10;
      distance=Math.max(distance,point.z+(Math.abs(point.x)+radius)/(tan*this.camera.aspect*horizontal),point.z+(Math.abs(point.y)+radius)/(tan*vertical));
    }
    // Bounds grow with the retained graph, including the 200-node ceiling.
    // Update the orbit limit so fit never gets silently clamped at 1,500.
    this.controls.maxDistance=Math.max(1500,distance*1.8);
    this.camera.far=Math.max(3000,this.controls.maxDistance*2);this.camera.updateProjectionMatrix();
    this.camera.position.copy(target).addScaledVector(direction,distance);
    this.controls.update();this.render();
  }
  focus(id) {
    if(!this.graph?.network||!this.positions?.has(id))return;
    this.focusedId=id;
    this.fitNetwork(vector(this.positions.get(id)));
  }
  zoomBy(factor) {
    const offset = this.camera.position.clone().sub(this.controls.target);
    offset.setLength(THREE.MathUtils.clamp(offset.length()/factor, this.controls.minDistance, this.controls.maxDistance));
    this.camera.position.copy(this.controls.target).add(offset);
    this.controls.update();
    this.render();
  }
  dispose() {
    this.setActive(false);
    this.observer.disconnect();
    this.controls.dispose();
    this.clear();
    this.renderer.dispose();
    this.container.replaceChildren();
  }
}
