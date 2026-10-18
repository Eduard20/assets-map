import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import * as THREE from '../vendor/three.module.min.js';
import {Graph2D,clientToViewBox} from '../src/graph-2d.js';
import {Graph3D} from '../src/graph-3d.js';

function graph2d(){
  const dom=new JSDOM('<div id="map"></div>');
  globalThis.document=dom.window.document;
  const selected=[],edges=[];
  const graph=new Graph2D(document.querySelector('#map'),{onSelect:id=>selected.push(id),onEdgeSelect:id=>edges.push(id),onExpand(){}});
  graph.bounds={x:-200,y:-100,width:400,height:200};
  graph.svg.getBoundingClientRect=()=>({left:0,top:0,width:400,height:600});
  const captured=new Set();
  graph.svg.setPointerCapture=id=>captured.add(id);
  graph.svg.hasPointerCapture=id=>captured.has(id);
  graph.svg.releasePointerCapture=id=>captured.delete(id);
  graph.layer.innerHTML='<g data-node="alpha" role="button" tabindex="0"><circle r="22"/></g><g data-edge="edge"><line/></g>';
  function pointer(type,x,y,id=1,target=graph.svg){
    const event=new dom.window.MouseEvent(type,{bubbles:true,clientX:x,clientY:y,button:0});
    Object.defineProperties(event,{pointerId:{value:id},pointerType:{value:'touch'}});
    target.dispatchEvent(event);
  }
  return{graph,dom,selected,edges,pointer,node:graph.layer.querySelector('[data-node]'),captured};
}

test('2D coordinate mapping accounts for viewBox offsets and vertical/horizontal letterboxing',()=>{
  const bounds={x:-200,y:-100,width:400,height:200};
  assert.deepEqual(clientToViewBox(210,320,bounds,{left:10,top:20,width:400,height:600}),{x:0,y:0});
  assert.deepEqual(clientToViewBox(110,270,bounds,{left:10,top:20,width:400,height:600}),{x:-100,y:-50});
  assert.deepEqual(clientToViewBox(310,120,bounds,{left:10,top:20,width:600,height:200}),{x:0,y:0});
});

test('2D drag starts on nodes, tracks screen distance correctly at zoom, and never selects',()=>{
  const{graph,pointer,node,selected,captured}=graph2d();
  graph.bounds={x:-400,y:-200,width:800,height:400};graph.zoom=2;
  pointer('pointerdown',150,300,1,node);
  pointer('pointermove',190,320);
  assert.deepEqual(graph.pan,{x:80,y:40});
  pointer('pointerup',190,320);
  assert.equal(selected.length,0);assert.equal(captured.size,0);
});

test('2D pinch anchors the content under a moving midpoint and remains smooth when one finger lifts',()=>{
  const{graph,pointer,selected}=graph2d();
  graph.pan={x:40,y:-20};
  pointer('pointerdown',160,300,1);
  pointer('pointerdown',260,300,2);
  const anchor={...graph.gesture.world};
  pointer('pointermove',140,320,1);
  pointer('pointermove',340,320,2);
  assert.equal(graph.zoom,2);
  const midpoint=graph.clientPoint(240,320);
  assert.equal(anchor.x*graph.zoom+graph.pan.x,midpoint.x);
  assert.equal(anchor.y*graph.zoom+graph.pan.y,midpoint.y);
  const before={...graph.pan};
  pointer('pointerup',340,320,2);
  pointer('pointermove',150,330,1);
  assert.deepEqual(graph.pan,{x:before.x+10,y:before.y+10});
  pointer('pointerup',150,330,1);
  assert.equal(selected.length,0);
});

test('2D taps select once, pointer cancellation does not select, and keyboard activation survives',()=>{
  const{graph,dom,pointer,node,selected}=graph2d();
  pointer('pointerdown',150,300,1,node);pointer('pointerup',153,302,1);
  node.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true,detail:1}));
  assert.deepEqual(selected,['alpha']);
  pointer('pointerdown',150,300,1,node);pointer('pointercancel',150,300,1);
  assert.deepEqual(selected,['alpha']);assert.equal(graph.pointers.size,0);
  pointer('pointerdown',150,300,1,node);pointer('pointerup',150,300,1);
  node.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
  assert.deepEqual(selected,['alpha','alpha','alpha']);
});

test('2D zoom button and wheel anchors preserve the expected world point',()=>{
  const{graph}=graph2d();graph.pan={x:30,y:20};
  const anchor={x:80,y:25},world={x:anchor.x-graph.pan.x,y:anchor.y-graph.pan.y};
  graph.setZoom(2,anchor);
  assert.equal(world.x*graph.zoom+graph.pan.x,anchor.x);
  assert.equal(world.y*graph.zoom+graph.pan.y,anchor.y);
  graph.setZoom(999,anchor);assert.equal(graph.zoom,3.5);
});

test('3D nearest-point picking stays a 44px target regardless of visual dot size or camera distance',()=>{
  const graph=Object.create(Graph3D.prototype);
  graph.camera=new THREE.PerspectiveCamera(42,1,.1,3000);graph.camera.position.set(0,0,500);graph.camera.lookAt(0,0,0);
  graph.renderer={domElement:{getBoundingClientRect:()=>({left:10,top:20,width:400,height:400})}};
  graph.nodeEntries=[{node:{id:'center'},sphere:{position:new THREE.Vector3(0,0,0)}},{node:{id:'right'},sphere:{position:new THREE.Vector3(20,0,0)}}];
  assert.equal(graph.pickNodeAt(210,240)?.node.id,'center');
  assert.equal(graph.pickNodeAt(230,220)?.node.id,'right');
  assert.equal(graph.pickNodeAt(210,243),null);
  graph.camera.position.z=1000;
  assert.equal(graph.pickNodeAt(210,240)?.node.id,'center');
});

test('3D height-only resizing preserves the camera instead of resetting mobile zoom',()=>{
  const graph=Object.create(Graph3D.prototype);let fits=0;
  Object.assign(graph,{container:{clientWidth:390,clientHeight:640},width:390,height:600,portrait:true,graph:{},camera:new THREE.PerspectiveCamera(),renderer:{setSize(){}},fit(){fits++},render(){},update(){}});
  graph.resize();assert.equal(fits,0);assert.equal(graph.height,640);
  graph.container.clientWidth=480;graph.resize();assert.equal(fits,1);
});


test('2D overlapping touch targets select the nearest dot, not the topmost node',()=>{
  const{graph,dom,pointer,selected}=graph2d();
  graph.positions=new Map([['alpha',{x:0,y:0}],['beta',{x:19.5,y:0}]]);
  const beta=document.createElementNS('http://www.w3.org/2000/svg','g');
  beta.dataset.node='beta';beta.innerHTML='<circle class="node-hit" r="22"/>';
  graph.layer.append(beta);
  // Beta is painted on top and its 22px hit circle covers Alpha's center.
  pointer('pointerdown',200,300,1,beta);pointer('pointerup',200,300,1);
  assert.deepEqual(selected,['alpha']);
  pointer('pointerdown',218,300,1,beta);pointer('pointerup',218,300,1);
  assert.deepEqual(selected,['alpha','beta']);
  graph.pan={x:30,y:-20};graph.zoom=2;
  assert.equal(graph.pickNodeAt(230,280),'alpha');
  assert.equal(graph.pickNodeAt(269,280),'beta');
  assert.equal(graph.pickNodeAt(230,305),null);
  // Keyboard activation intentionally uses the focused node, not geometry.
  beta.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
  assert.equal(selected.at(-1),'beta');
});

test('2D nearest-point picking preserves the explicit expansion action',()=>{
  const{graph,pointer,node,selected}=graph2d();
  const expanded=[];graph.onExpand=id=>expanded.push(id);
  graph.positions=new Map([['alpha',{x:0,y:0}],['beta',{x:19.5,y:0}]]);
  node.innerHTML='<g data-expand="alpha"><circle r="11"/></g>';
  pointer('pointerdown',218,300,1,node.firstElementChild);pointer('pointerup',218,300,1);
  assert.deepEqual(expanded,['alpha']);assert.deepEqual(selected,[]);
});

test('3D landscape browser-chrome height changes preserve the chosen camera and geometry',()=>{
  const graph=Object.create(Graph3D.prototype);let fits=0,builds=0;
  Object.assign(graph,{container:{clientWidth:828,clientHeight:280},width:828,height:223,portrait:false,landscape:true,graph:{},camera:new THREE.PerspectiveCamera(),renderer:{setSize(){}},fit(){fits++},render(){},update(){builds++}});
  graph.resize();assert.equal(fits,0);assert.equal(builds,0);assert.equal(graph.height,280);
});
