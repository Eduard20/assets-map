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

test('large navigation history cannot exceed the node ceiling or drop current focus',()=>{const state=initialState(model);const securities=model.nodes.filter(n=>n.kind==='asset');state.pinnedNodes=new Set(securities.slice(0,198).map(n=>n.id));state.rootId=securities[250].id;const graph=buildVisibleGraph(model,state);assert.equal(graph.nodes.length,200);assert.ok(graph.nodes.some(n=>n.id===state.rootId));});

test('clicking a manager expands its actual holdings beyond overview and repeated clicks progress',async()=>{
  const {expandPortfolioNetwork}=await import('../src/portfolio-network.js');
  const state=initialState(model),initial=buildVisibleGraph(model,state),root=model.portfolioRoots.find(id=>id.startsWith('blackrock'));
  expandPortfolioNetwork(model,state,root,initial);let graph=buildVisibleGraph(model,state);
  assert.ok(graph.nodes.length>initial.nodes.length);
  assert.ok(graph.edges.filter(e=>e.source===root).length>=40);
  for(let i=0;i<12;i++){expandPortfolioNetwork(model,state,root,graph);graph=buildVisibleGraph(model,state);}
  assert.ok(graph.nodes.length<=200);
  const late=model.edges.filter(e=>e.source===root)[230];
  assert.ok(graph.nodes.some(n=>n.id===late.target),'later pages replace older context instead of freezing at the node cap');
});
test('company focus reveals all available investors outside filtered overview without invented investments',async()=>{
  const {expandPortfolioNetwork}=await import('../src/portfolio-network.js');
  const state=initialState(model);state.portfolioFilter=model.portfolioRoots[0];
  const before=buildVisibleGraph(model,state),node=model.nodes.find(n=>n.kind==='asset'&&!before.nodes.some(v=>v.id===n.id));
  state.rootId=node.id;expandPortfolioNetwork(model,state,node.id,before);const graph=buildVisibleGraph(model,state);
  assert.ok(graph.nodes.some(n=>n.id===node.id));
  assert.equal(graph.edges.filter(e=>e.target===node.id).length,model.edges.filter(e=>e.target===node.id).length);
  assert.match(networkDetails(model,node.id,state,graph),/No outgoing investment portfolio is imported/);
  assert.ok(before.nodes.every(n=>graph.nodes.some(v=>v.id===n.id)));
});

test('issuer role links open company investments while retaining distinct share classes and values',async()=>{
  const {expandPortfolioNetwork}=await import('../src/portfolio-network.js');
  const state=initialState(model),baseline=buildVisibleGraph(model,state);
  const role=model.roleEdges.find(e=>e.role.manager==='berkshire-2026-06-30'&&e.role.securityClass==='CL B NEW');
  state.rootId=role.source;expandPortfolioNetwork(model,state,role.source,baseline);const graph=buildVisibleGraph(model,state);
  assert.ok(graph.edges.some(e=>e.id===role.id));
  assert.ok(graph.edges.filter(e=>e.source==='berkshire-2026-06-30').length>=20);
  assert.equal(graph.edges.filter(e=>e.target===role.source&&e.kind==='managed_holding').length,2);
  assert.ok(model.roleEdges.every(e=>e.valueUsd===undefined&&e.stakePercent===undefined));
  assert.equal(model.rolePeers.get('berkshire-2026-06-30').size,2);
  assert.notEqual(...[...model.rolePeers.get('berkshire-2026-06-30')]);
  assert.equal(model.holdingEdges.length,53460);
});

test('exhausted exploration does not advertise a no-op next page',()=>{
  const state=initialState(model),root=state.rootId;
  state.exploration=new Map([[root,{incoming:99999,outgoing:99999}]]);
  const graph=buildVisibleGraph(model,state),details=networkDetails(model,root,state,graph);
  assert.doesNotMatch(details,/Explore next 20/);
  assert.match(details,/End of this entity/);
});

test('switching managers cannot skip unseen holdings by counting incidental neighbors as a prefix',async()=>{
  const {expandPortfolioNetwork}=await import('../src/portfolio-network.js');
  const state=initialState(model);let graph=buildVisibleGraph(model,state);
  state.rootId='statestreet-2026-06-30';
  for(let i=0;i<10;i++){expandPortfolioNetwork(model,state,state.rootId,graph);graph=buildVisibleGraph(model,state);}
  const previouslySeen=new Set(graph.edges.map(e=>e.id));
  state.rootId='blackrock-2026-06-30';expandPortfolioNetwork(model,state,state.rootId,graph);graph=buildVisibleGraph(model,state);
  const cursor=state.exploration.get(state.rootId).outgoing;
  const nowShown=new Set(graph.edges.map(e=>e.id));
  for(const edge of model.edges.filter(e=>e.source===state.rootId).slice(0,cursor))assert.ok(previouslySeen.has(edge.id)||nowShown.has(edge.id),'a cursor cannot jump over unseen connections');
});
