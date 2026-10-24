import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {Graph2D} from '../src/graph-2d.js';
import {createModel,initialState,buildVisibleGraph} from '../src/graph-model.js';
const fixture=JSON.parse(await readFile(new URL('../data/graph.json',import.meta.url),'utf8'));
function setup(){
 const dom=new JSDOM('<button id="outside">Outside</button><div id="graph"></div>');
 globalThis.document=dom.window.document;
 const model=createModel(fixture),state=initialState(model),graph=buildVisibleGraph(model,state),calls=[];
 const view=new Graph2D(document.querySelector('#graph'),{onSelect(id){calls.push(['node',id]);view.update(graph,state,model);},onEdgeSelect(id){calls.push(['edge',id]);view.update(graph,state,model);},onExpand(){}});
 view.update(graph,state,model);return{dom,model,state,graph,view,calls};
}
for(const kind of ['node','edge'])test(`2D ${kind} focus survives redraw and repeated keyboard activation`,()=>{
 const {dom,model,state,graph,view,calls}=setup();
 const old=view.layer.querySelector(`[data-${kind}]`),id=old.dataset[kind];old.focus();
 assert.equal(document.activeElement,old);
 view.update(graph,state,model);
 assert.notEqual(document.activeElement,old);
 assert.equal(document.activeElement.dataset[kind],id);
 assert.equal(old.isConnected,false);
 for(const key of ['Enter',' '])document.activeElement.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key,bubbles:true,cancelable:true}));
 assert.deepEqual(calls,[[kind,id],[kind,id]]);
 assert.equal(document.activeElement.dataset[kind],id);
 assert.equal(view.keyboardId,kind==='node'?id:undefined);
 dom.window.close();
});
test('2D redraw preserves external focus and clears stale keyboard label priority',()=>{
 const {dom,model,state,graph,view}=setup();
 view.layer.querySelector('[data-node]').focus();document.querySelector('#outside').focus();
 view.update(graph,state,model);
 assert.equal(document.activeElement.id,'outside');assert.equal(view.keyboardId,null);dom.window.close();
});
test('2D redraw does not substitute a different node when focused target disappears',()=>{
 const {dom,model,state,graph,view}=setup();
 const old=[...view.layer.querySelectorAll('[data-node]')].find(n=>n.dataset.node!==state.rootId);old.focus();
 const removed=old.dataset.node;
 view.update({nodes:graph.nodes.filter(n=>n.id!==removed),edges:graph.edges.filter(e=>e.source!==removed&&e.target!==removed)},state,model);
 assert.equal(document.activeElement,document.body);assert.equal(view.keyboardId,null);dom.window.close();
});
test('2D focus restoration handles opaque IDs without constructing a selector from them',()=>{
 const {dom,model,state,graph,view}=setup();
 const id='opaque"[]: id';const node={...graph.nodes[0],id};const opaqueModel={...model,nodes:[node],edges:[],nodeMap:new Map([[id,node]])};const opaqueGraph={nodes:[node],edges:[]};const opaqueState={...state,rootId:id,selectedId:id};
 view.update(opaqueGraph,opaqueState,opaqueModel);view.layer.querySelector('[data-node]').focus();view.update(opaqueGraph,opaqueState,opaqueModel);
 assert.equal(document.activeElement.dataset.node,id);dom.window.close();
});
test('Expansion keeps its own focus and 44px control through redraw and zoom',()=>{
 const {dom,model,state,graph,view}=setup();
 // Keep one relationship outside the visible graph so expansion is available.
 const smaller={...graph,edges:graph.edges.slice(0,1)};view.update(smaller,state,model);
 const expand=view.layer.querySelector('[data-expand]');assert.ok(expand);const id=expand.dataset.expand;
 expand.focus();view.update(smaller,state,model);assert.equal(document.activeElement.dataset.expand,id);
 const calls=[];view.onExpand=value=>{calls.push(value);view.update(smaller,state,model);};
 for(const key of ['Enter',' '])document.activeElement.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key,bubbles:true,cancelable:true}));
 assert.deepEqual(calls,[id,id]);assert.equal(document.activeElement.dataset.expand,id);
 view.setZoom(.6);const control=view.layer.querySelector('[data-expand]');assert.equal(control.querySelector('rect').getAttribute('height'),'44');assert.match(control.getAttribute('transform'),/scale\(1.666/);dom.window.close();
});

for(const width of [320,390])test(`Hidden card view reveals its new root inside a ${width}px viewport`,()=>{
 const {dom,model,state,graph,view}=setup();let visible=true;
 Object.defineProperties(view.container,{clientWidth:{get:()=>visible?width:0},clientHeight:{get:()=>visible?500:0}});
 view.update(graph,state,model);view.focus(state.rootId);
 document.querySelector('#outside').focus();visible=false;
 state.rootId=graph.nodes.find(node=>node.id!==state.rootId).id;state.selectedId=state.rootId;
 view.update(graph,state,model);
 assert.equal(view.bounds.width,width,'Hidden render retains the last measured width');
 visible=true;view.update(graph,state,model);
 const point=view.positions.get(state.rootId),x=point.x*view.zoom+view.pan.x,y=point.y*view.zoom+view.pan.y;
 assert.ok(x-112>=0&&x+112<=width,'Revealed selected card fits horizontally');
 assert.ok(y-38>=40&&y+38<=440,'Revealed selected card clears the controls');
 assert.equal(document.activeElement.id,'outside','Revealing the graph does not steal external focus');
 // Keeping a visible root in view must not unnecessarily erase a user's pan.
 view.pan.x+=8;view.applyTransform();const pan={...view.pan};
 visible=false;view.update(graph,state,model);visible=true;view.update(graph,state,model);
 assert.deepEqual(view.pan,pan);dom.window.close();
});
test('A desktop-to-phone resize reveals an unfocused card without resetting zoom',()=>{
 const {dom,model,state,graph,view}=setup();let width=900;
 Object.defineProperties(view.container,{clientWidth:{get:()=>width},clientHeight:{get:()=>500}});
 view.update(graph,state,model);view.focus(state.rootId);document.querySelector('#outside').focus();
 width=320;view.update(graph,state,model);
 const point=view.positions.get(state.rootId),x=point.x*view.zoom+view.pan.x;
 assert.ok(x-112>=0&&x+112<=width);assert.equal(view.zoom,1);assert.equal(document.activeElement.id,'outside');dom.window.close();
});
