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
