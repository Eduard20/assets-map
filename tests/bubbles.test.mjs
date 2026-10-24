import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createModel, initialState, buildVisibleGraph} from '../src/graph-model.js';
import {layoutBubbles, bubbleRadius} from '../src/bubble-layout.js';
const data = JSON.parse(await readFile(new URL('../data/graph.json', import.meta.url), 'utf8'));
const model = createModel(data);
test('Relationship cards are the default presentation', () => assert.equal(initialState(model).view, '2d'));
test('bubble size only distinguishes the focus, not assets or company values', () => {
  for (const node of model.nodes) assert.equal(bubbleRadius(node.id, 'blackrock'), node.id==='blackrock'?29:21);
});
test('bubble neighborhoods have deterministic distinct positions with real depth', () => {
  for (const root of ['blackrock','berkshire','amazon','nestle','spacex']) {
    const state = initialState(model); state.rootId=root; state.expanded=new Set([root]);
    const graph = buildVisibleGraph(model,state);
    for (const portrait of [false,true]) {
      const positions = layoutBubbles(graph,root,portrait);
      assert.deepEqual(positions,layoutBubbles(graph,root,portrait));
      assert.equal(positions.size,graph.nodes.length);
      assert.equal(new Set([...positions.values()].map(p=>`${p.x},${p.y},${p.z}`)).size,graph.nodes.length);
      assert.ok([...positions.values()].every(p=>[p.x,p.y,p.z].every(Number.isFinite)));
      if(graph.nodes.length>1)assert.ok(new Set([...positions.values()].map(p=>p.z)).size>1);
    }
  }
});
test('portrait bubble positions use less width and more vertical space', () => {
  const graph=buildVisibleGraph(model,initialState(model));
  const wide=layoutBubbles(graph,'blackrock'),portrait=layoutBubbles(graph,'blackrock',true);
  assert.ok(Math.max(...[...portrait.values()].map(p=>Math.abs(p.x)))<Math.max(...[...wide.values()].map(p=>Math.abs(p.x))));
  assert.ok(Math.max(...[...portrait.values()].map(p=>Math.abs(p.y)))>Math.max(...[...wide.values()].map(p=>Math.abs(p.y))));
});
