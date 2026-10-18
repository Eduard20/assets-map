import * as THREE from '../vendor/three.module.min.js';
import { OrbitControls } from '../vendor/OrbitControls.js';
import { KIND_LABELS } from './graph-model.js';
import { layoutBubbles, bubbleRadius } from './bubble-layout.js';

const vector = p => new THREE.Vector3(p.x, p.y, p.z);
const COLORS = {beneficial_ownership:'#ba9cdb', voting_authority:'#d7b580',managed_holding:'#8eb8e4', corporate_ownership:'#82ceb0', investment:'#d7b580', subsidiary:'#82ceb0'};
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
    canvas.setAttribute('aria-label', '3D bubbles. Drag to orbit, pinch or scroll to zoom. Select a named bubble to explore.');
    canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); this.setActive(false); onUnavailable?.(); });
    this.labels = document.createElement('div');
    this.labels.className = 'bubble-labels';
    container.replaceChildren(canvas, this.labels);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = .1;
    this.controls.enablePan = false;
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
    canvas.addEventListener('pointerdown', e => {
      this.pointers.add(e.pointerId);
      if (this.pointers.size > 1) { this.start = null; return; }
      this.start = {x:e.clientX, y:e.clientY, id:e.pointerId, moved:false};
    });
    canvas.addEventListener('pointermove', e => {
      if (this.start && Math.hypot(e.clientX-this.start.x, e.clientY-this.start.y) > 7) this.start.moved = true;
    });
    canvas.addEventListener('pointercancel', e => { this.pointers.delete(e.pointerId); this.start = null; });
    canvas.addEventListener('pointerup', e => {
      const start = this.start;
      this.pointers.delete(e.pointerId);
      this.start = null;
      if (!start || start.moved || start.id !== e.pointerId || this.pointers.size) return;
      const rect = canvas.getBoundingClientRect();
      this.pointer.set((e.clientX-rect.left)/rect.width*2-1, -(e.clientY-rect.top)/rect.height*2+1);
      this.raycaster.setFromCamera(this.pointer, this.camera);
      const hit = this.raycaster.intersectObjects(this.targets, false)[0]?.object;
      if (hit?.userData.nodeId) this.onSelect(hit.userData.nodeId);
      else if (hit?.userData.edgeId) this.onEdgeSelect(hit.userData.edgeId);
    });
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(container);
    this.animate = this.animate.bind(this);
    this.resize();
  }

  update(graph, state) {
    this.graph = graph;
    this.state = state;
    const portrait = this.container.clientWidth < 600;
    const key = JSON.stringify([portrait, state.rootId, graph.nodes.map(n=>n.id), graph.edges.map(e=>e.id)]);
    if (key !== this.graphKey) {
      this.graphKey = key;
      this.portrait = portrait;
      this.build();
      if (this.active) this.fit();
    }
    for (const entry of this.nodeEntries) {
      const selected = entry.node.id === state.selectedId;
      entry.button.classList.toggle('selected', selected);
      entry.button.setAttribute('aria-pressed', String(selected));
      entry.ring.visible = selected;
    }
    for (const edge of this.edgeEntries) edge.material.opacity = edge.userData.edgeId === state.selectedEdgeId ? 1 : .65;
    this.render();
  }

  build() {
    this.clear();
    const positions = layoutBubbles(this.graph, this.state.rootId, this.portrait);
    this.positions = positions;
    for (const edge of this.graph.edges) {
      const start = vector(positions.get(edge.source));
      const end = vector(positions.get(edge.target));
      const direction = end.clone().sub(start).normalize();
      start.addScaledVector(direction, bubbleRadius(edge.source, this.state.rootId));
      end.addScaledVector(direction, -bubbleRadius(edge.target, this.state.rootId)-3);
      const material = edge.kind === 'managed_holding'
        ? new THREE.LineDashedMaterial({color:COLORS[edge.kind], dashSize:4, gapSize:3, transparent:true, opacity:.65})
        : new THREE.LineBasicMaterial({color:COLORS[edge.kind], transparent:true, opacity:.65});
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([start, end]), material);
      line.computeLineDistances();
      line.userData.edgeId = edge.id;
      this.group.add(line);
      this.targets.push(line);
      this.edgeEntries.push(line);
      const arrow = new THREE.Mesh(new THREE.ConeGeometry(1.8, 5, 8), new THREE.MeshBasicMaterial({color:COLORS[edge.kind]}));
      arrow.position.copy(end);
      arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), direction);
      this.group.add(arrow);
    }
    for (const node of this.graph.nodes) {
      const root = node.id === this.state.rootId;
      const radius = bubbleRadius(node.id, this.state.rootId);
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 32), new THREE.MeshPhysicalMaterial({
        color:root ? '#6fe2b5' : node.kind === 'company' ? '#afbddc' : '#74b9c7',
        roughness:.21, metalness:.18, clearcoat:1, clearcoatRoughness:.12
      }));
      sphere.position.copy(vector(positions.get(node.id)));
      sphere.userData.nodeId = node.id;
      const ring = new THREE.Mesh(new THREE.RingGeometry(radius*1.13, radius*1.16, 64), new THREE.MeshBasicMaterial({color:'#c1f7df', transparent:true, opacity:.7, side:THREE.DoubleSide, depthWrite:false}));
      ring.position.copy(sphere.position);
      this.group.add(sphere, ring);
      this.targets.push(sphere);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `bubble-label${root ? ' root' : ''}`;
      button.dataset.nodeId = node.id;
      button.setAttribute('aria-label', `Explore ${node.label}`);
      const name = document.createElement('strong');
      name.textContent = node.label;
      const kind = document.createElement('span');
      kind.textContent = root ? 'CURRENT FOCUS' : KIND_LABELS[node.kind];
      button.append(name, kind);
      let labelStart;
      button.addEventListener('pointerdown', event => {
        labelStart = {x:event.clientX, y:event.clientY, moved:false};
        button.setPointerCapture(event.pointerId);
      });
      button.addEventListener('pointermove', event => {
        if (labelStart && Math.hypot(event.clientX-labelStart.x, event.clientY-labelStart.y)>7) labelStart.moved=true;
      });
      button.addEventListener('pointercancel', () => { labelStart = {moved:true}; });
      button.addEventListener('click', event => {
        if (event.detail === 0 || !labelStart?.moved) this.onSelect(node.id);
        labelStart = null;
      });
      this.labels.append(button);
      this.nodeEntries.push({node, sphere, ring, button, radius});
    }
    // A quiet reference orbit makes the perspective legible as the map is rotated.
    if (this.graph.nodes.length > 1) {
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
    const changed = width !== this.width || height !== this.height;
    this.width = width;
    this.height = height;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width/height;
    this.camera.updateProjectionMatrix();
    if (this.graph && (width < 600) !== this.portrait) this.update(this.graph, this.state);
    if (changed && this.graph) this.fit();
    this.render();
  }

  render() {
    if (this.container.hidden || !this.width) return;
    this.camera.updateMatrixWorld();
    const cameraUp = new THREE.Vector3(0,1,0).applyQuaternion(this.camera.quaternion);
    for (const entry of this.nodeEntries) {
      entry.ring.quaternion.copy(this.camera.quaternion);
      const point = entry.sphere.position.clone().addScaledVector(cameraUp, -entry.radius-5).project(this.camera);
      const x = (point.x*.5+.5)*this.width;
      const y = (-point.y*.5+.5)*this.height;
      entry.button.hidden = point.z > 1 || point.z < -1 || x < 0 || x > this.width || y < 0 || y > this.height-25;
      entry.button.style.transform = `translate(-50%, 0) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      entry.button.style.zIndex = String(Math.round((1-point.z)*10000));
    }
    this.renderer.render(this.scene, this.camera);
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
    this.controls.enableDamping = false;
    this.controls.update();
    this.controls.enableDamping = true;
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
