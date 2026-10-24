import test from 'node:test';
import assert from 'node:assert/strict';
import {layoutRelationshipCards,relationshipCurve,CARD_WIDTH,CARD_HEIGHT} from '../src/relationship-card-layout.js';
const graph={nodes:[{id:'fund',label:'Fund',kind:'sovereign'},{id:'a',label:'Company A',kind:'company'},{id:'b',label:'Company B',kind:'company'},{id:'asset',label:'Property',kind:'asset'}],edges:[{source:'fund',target:'a',kind:'investment'},{source:'a',target:'b',kind:'subsidiary'},{source:'b',target:'a',kind:'investment'},{source:'b',target:'asset',kind:'reported_portfolio_affiliation'}]};
test('Role columns retain cycles and do not turn investments into subsidiaries',()=>{
 const layout=layoutRelationshipCards(graph);assert.equal(layout.positions.size,4);
 assert.equal(layout.positions.get('a').column,'companies');assert.equal(layout.positions.get('b').column,'subsidiaries');
 assert.equal(layout.positions.get('fund').column,'capital');assert.equal(layout.positions.get('asset').column,'assets');
 assert.deepEqual(layout,layoutRelationshipCards(graph));assert.equal(graph.edges.length,4);
 for(const edge of graph.edges)assert.match(relationshipCurve(layout.positions.get(edge.source),layout.positions.get(edge.target)),/^M .* C /);
});
test('Cards never overlap within a role and preserve readable targets at minimum zoom',()=>{
 const nodes=Array.from({length:105},(_,i)=>({id:String(i),label:`Entity ${i}`,kind:'company',sector:i%2?'Finance':'Industry'}));const {positions}=layoutRelationshipCards({nodes,edges:[]});
 assert.equal(positions.size,105);const ys=[...positions.values()].map(p=>p.y).sort((a,b)=>a-b);for(let i=1;i<ys.length;i++)assert.ok(ys[i]-ys[i-1]>CARD_HEIGHT);
 assert.ok(CARD_HEIGHT*.6>=44);assert.ok(CARD_WIDTH*.6>=44);
});
test('Same-column cross-links remain curves rather than false hierarchy',()=>{assert.match(relationshipCurve({x:136,y:154},{x:136,y:242}),/C 280 /);});
