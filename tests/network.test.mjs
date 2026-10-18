import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {decodePortfolio} from '../src/portfolio-view.js';
import {createPortfolioNetwork,networkDetails} from '../src/portfolio-network.js';
import {buildVisibleGraph,initialState} from '../src/graph-model.js';
const manifest=JSON.parse(await readFile(new URL('../data/portfolios.json',import.meta.url)));
const portfolios=await Promise.all(manifest.portfolios.map(async p=>decodePortfolio(p,JSON.parse(await readFile(new URL('../data/'+p.dataFile,import.meta.url))))));
const identity=JSON.parse(await readFile(new URL('../data/instrument-equivalence.json',import.meta.url)));
const model=createPortfolioNetwork(portfolios,identity);
test('shared network joins exact instruments and preserves all filer rows and totals',()=>{
  assert.equal(model.instrumentCount,5542);assert.equal(model.holdingEdges.length,53460);assert.equal(model.edges.length,9556);
  for(const p of portfolios){const edges=model.edges.filter(e=>e.source===p.portfolioId);assert.equal(edges.reduce((sum,e)=>sum+BigInt(e.portfolioPosition.valueUsd),0n).toString(),p.reconciliation.shareValueUsd);assert.equal(edges.flatMap(e=>e.portfolioPositions).length,p.reconciliation.shareRowCount);}
  assert.equal(new Set(model.holdingEdges.map(e=>e.portfolioPosition.positionId)).size,53460);
  const apple=model.nodes.find(n=>n.label==='APPLE INC'),investors=model.edges.filter(e=>e.target===apple.id);
  assert.equal(investors.length,3);assert.equal(investors.reduce((sum,e)=>sum+e.portfolioPositions.length,0),37);
  assert.match(networkDetails(model,apple.id),/not a complete list of investors/);assert.match(networkDetails(model,apple.id),/not legal ownership or control/);
});
test('one shared graph retains all managers and context when focusing a company',()=>{
  const state=initialState(model),before=buildVisibleGraph(model,state);assert.equal(before.nodes.length,42);assert.equal(before.edges.length,98);assert.equal(before.nodes.filter(n=>n.kind==='manager').length,3);
  const apple=model.nodes.find(n=>n.label==='APPLE INC');state.rootId=apple.id;state.pinnedNodes.add(apple.id);const after=buildVisibleGraph(model,state);
  assert.deepEqual(new Set(after.nodes.map(n=>n.id)),new Set(before.nodes.map(n=>n.id)));assert.deepEqual(after.edges,before.edges);
  for(const root of model.portfolioRoots)state.limits.set(root,60);assert.ok(buildVisibleGraph(model,state).nodes.length>before.nodes.length);assert.ok(buildVisibleGraph(model,state).nodes.length<=200);
  state.portfolioFilter=model.portfolioRoots[0];const filtered=buildVisibleGraph(model,state);assert.equal(filtered.nodes.filter(n=>n.kind==='manager').length,3);assert.ok(filtered.edges.some(e=>e.source!==state.portfolioFilter),'Other known investors remain connected through shared securities');
});
test('unknown, duplicate or malformed equivalence memberships fail closed',()=>{
  assert.throws(()=>createPortfolioNetwork(portfolios,{...identity,groups:[['unknown','also-unknown']]}),/Unknown/);
  assert.throws(()=>createPortfolioNetwork(portfolios,{...identity,groups:[identity.groups[0],identity.groups[0]]}),/repeated/);
});

test('public identity map is byte-bound to independently approved exact-match release',async()=>{const bytes=await readFile(new URL('../data/instrument-equivalence.json',import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),'36712784e2d53c44f7ef89a7719c8d8240f5caefffb2399b5a16fda08b3704bf');assert.equal(identity.admission.status,'approved');assert.throws(()=>createPortfolioNetwork(portfolios,{...identity,admission:{status:'pending'}}),/independent review/);});
