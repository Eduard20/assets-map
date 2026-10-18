import test from 'node:test';
import assert from 'node:assert/strict';
import {layoutSharedNetwork,networkManagerIds,networkConnections,prioritizeNetworkLabels} from '../src/shared-network-layout.js';
import {layoutBubbles} from '../src/bubble-layout.js';
import {Graph3D} from '../src/graph-3d.js';
import * as THREE from '../vendor/three.module.min.js';
import {JSDOM} from 'jsdom';

function network(size=53) {
  const portfolioRoots=['manager-c','manager-a','manager-b'];
  const nodes=portfolioRoots.map(id=>({id,label:id,kind:'manager'}));
  const edges=[];
  for(let i=0;i<size-portfolioRoots.length;i++){
    const id=`instrument-${String(i).padStart(3,'0')}`;
    nodes.push({id,label:`Instrument ${i}`,kind:'company'});
    const count=i<8?3:i<24?2:1;
    for(let j=0;j<count;j++)edges.push({id:`${id}-${j}`,source:portfolioRoots[(i+j)%3],target:id,kind:'managed_holding'});
  }
  return {network:true,portfolioRoots,nodes,edges};
}

test('shared layout keeps one position per instrument and fixed manager anchors',()=>{
  const graph=network();
  assert.deepEqual(networkManagerIds(graph),['manager-a','manager-b','manager-c']);
  assert.equal(networkConnections(graph).get('instrument-000').size,3);
  for(const portrait of [false,true])for(const mode of ['2d','3d']){
    const positions=layoutSharedNetwork(graph,{portrait,mode});
    assert.equal(positions.size,graph.nodes.length);
    assert.ok([...positions.values()].every(p=>[p.x,p.y,p.z].every(Number.isFinite)));
    assert.equal(new Set([...positions.values()].map(p=>`${p.x},${p.y},${p.z}`)).size,positions.size);
    assert.deepEqual(positions,layoutSharedNetwork({...graph,nodes:[...graph.nodes].reverse(),edges:[...graph.edges].reverse()},{portrait,mode}));
  }
});

test('selecting a company never rearranges the retained investment network',()=>{
  const graph=network();
  for(const portrait of [false,true]){
    const overview=layoutBubbles(graph,'manager-a',portrait);
    assert.deepEqual(overview,layoutBubbles(graph,'instrument-000',portrait));
    assert.deepEqual(overview,layoutBubbles(graph,'manager-c',portrait));
  }
});

test('shared instruments bridge the manager triangle instead of becoming separate islands',()=>{
  const graph=network(33);
  const positions=layoutSharedNetwork(graph);
  const managerDistance=Math.min(...graph.portfolioRoots.map(id=>Math.hypot(positions.get(id).x,positions.get(id).y)));
  const shared=graph.nodes.filter(n=>networkConnections(graph).get(n.id).size===3);
  assert.ok(shared.every(node=>Math.hypot(positions.get(node.id).x,positions.get(node.id).y)<managerDistance));
});

test('network geometry remains finite and collision-free at the explicit 200-node ceiling',()=>{
  const graph=network(200);
  for(const portrait of [false,true])for(const mode of ['2d','3d']){
    const positions=[...layoutSharedNetwork(graph,{portrait,mode}).values()];
    for(let i=0;i<positions.length;i++){
      const a=positions[i];
      assert.ok([a.x,a.y,a.z].every(Number.isFinite));
      for(let j=i+1;j<positions.length;j++){
        const b=positions[j];
        if(mode==='2d')assert.ok(Math.abs(a.x-b.x)>=182||Math.abs(a.y-b.y)>=74,'2D node cards must not overlap');
        else assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>48,'3D bubbles have enough space for focus highlighting');
      }
    }
  }
});

test('keyboard, hovered, focused and manager labels are prioritized without dropping other buttons',()=>{
  const graph=network();
  const ids=prioritizeNetworkLabels(graph,{rootId:'instrument-040',selectedId:'instrument-040',hoveredId:'instrument-039',keyboardId:'instrument-038'});
  assert.equal(ids.length,graph.nodes.length);
  assert.deepEqual(ids.slice(0,3),['instrument-038','instrument-039','instrument-040']);
  assert.ok(graph.portfolioRoots.every(id=>ids.indexOf(id)<6));
});

test('empty network and manager inference are safe',()=>{
  assert.equal(layoutSharedNetwork({nodes:[],edges:[]}).size,0);
  const graph=network(8);delete graph.portfolioRoots;
  assert.equal(networkManagerIds(graph).length,3);
  assert.equal(layoutSharedNetwork(graph).size,8);
});

test('3D camera fits the retained network and phone labels stay bounded with every button accessible',()=>{
  const previousDocument=globalThis.document;
  globalThis.document=new JSDOM('<div id="labels"></div>').window.document;
  try{
    for(const [width,height,size] of [[900,600,53],[288,600,53],[288,600,200]]){
      const renderer=Object.create(Graph3D.prototype);
      Object.assign(renderer,{
        graph:network(size),state:{rootId:'manager-a',selectedId:'manager-a'},
        portrait:width<600,width,height,group:new THREE.Group(),
        labels:document.createElement('div'),container:{hidden:false},
        camera:new THREE.PerspectiveCamera(42,width/height,.1,3000),
        controls:{target:new THREE.Vector3(),update(){},enableDamping:true},
        renderer:{render(){}},onSelect(){},onEdgeSelect(){}
      });
      renderer.camera.position.set(0,12,440);
      renderer.build();renderer.fit();
      const positions=new Map([...renderer.positions].map(([id,point])=>[id,{...point}]));
      const assertVisible=()=>{
        const visible=renderer.nodeEntries.filter(entry=>entry.button.dataset.labelVisible==='true');
        assert.ok(visible.length>0&&visible.length<=(renderer.portrait?6:12));
        assert.equal(renderer.labels.querySelectorAll('button').length,size);
        assert.ok(renderer.nodeEntries.every(entry=>!entry.button.hidden&&entry.button.tabIndex>=0&&entry.button.getAttribute('aria-label')));
        assert.ok(renderer.nodeEntries.filter(entry=>entry.manager).every(entry=>entry.button.dataset.labelVisible==='true'),'every reporting manager keeps its visual label');
        for(const entry of visible){
          const [x,y]=entry.button.style.transform.match(/-?\d+(?:\.\d+)?/g).map(Number);
          assert.ok(x>=0&&x+(renderer.portrait?110:144)<=width);
          assert.ok(y>=0&&y+64<=height);
        }
      };
      assertVisible();
      renderer.state.rootId='instrument-005';renderer.state.selectedId='instrument-005';
      renderer.focus('instrument-005');assertVisible();
      assert.deepEqual(renderer.positions,positions,'focusing changes the camera, never the world geometry');
      assert.deepEqual(renderer.controls.target.toArray(),Object.values(positions.get('instrument-005')));
      renderer.fit();assert.deepEqual(renderer.controls.target.toArray(),Object.values(positions.get('instrument-005')),'refit and resize keep an established security focus');
      for(const position of positions.values()){
        const projected=new THREE.Vector3(position.x,position.y,position.z).project(renderer.camera);
        assert.ok(Math.abs(projected.x)<1&&Math.abs(projected.y)<1&&Math.abs(projected.z)<1,'all retained nodes stay inside the camera frustum');
      }
      const clipped=renderer.nodeEntries.find(entry=>entry.button.dataset.labelVisible==='false');
      renderer.keyboardId=clipped.node.id;renderer.render();
      assert.equal(clipped.button.dataset.labelVisible,'true','keyboard focus reveals any clipped label');
      renderer.clear();
    }
  }finally{globalThis.document=previousDocument;}
});

test('3D label render tolerates focus events during graph button rebuild',()=>{
  const renderer=Object.create(Graph3D.prototype);
  Object.assign(renderer,{graph:network(42),state:{rootId:'manager-a'},nodeEntries:[],portrait:false,width:900,height:600});
  assert.doesNotThrow(()=>renderer.renderNetworkLabels(new Map()));
});
