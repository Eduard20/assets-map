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
  assert.equal(model.instrumentCount,20492);assert.equal(model.holdingEdges.length,162145);assert.equal(model.edges.length,43427);
  for(const p of portfolios){const edges=model.edges.filter(e=>e.source===p.portfolioId);assert.equal(edges.reduce((sum,e)=>sum+BigInt(e.portfolioPosition.valueUsd),0n).toString(),p.reconciliation.shareValueUsd);assert.equal(edges.flatMap(e=>e.portfolioPositions).length,p.reconciliation.shareRowCount);}
  assert.equal(new Set(model.holdingEdges.map(e=>e.portfolioPosition.positionId)).size,162145);
  const apple=model.nodes.find(n=>n.label==='APPLE INC'),investors=model.edges.filter(e=>e.target===apple.id);
  assert.equal(investors.length,9);assert.equal(investors.reduce((sum,e)=>sum+e.portfolioPositions.length,0),67);
  assert.match(networkDetails(model,apple.id),/not a complete list of investors/);assert.match(networkDetails(model,apple.id),/not legal ownership or control/);
});
test('one shared graph retains all managers and context when focusing a company',()=>{
  const state=initialState(model),before=buildVisibleGraph(model,state);assert.equal(before.nodes.length,108);assert.equal(before.edges.length,454);assert.equal(before.nodes.filter(n=>n.kind==='manager').length,12);
  const apple=model.nodes.find(n=>n.label==='APPLE INC');state.rootId=apple.id;state.pinnedNodes.add(apple.id);const after=buildVisibleGraph(model,state);
  assert.deepEqual(new Set(after.nodes.map(n=>n.id)),new Set(before.nodes.map(n=>n.id)));assert.deepEqual(after.edges,before.edges);
  for(const root of model.portfolioRoots)state.limits.set(root,60);assert.ok(buildVisibleGraph(model,state).nodes.length>before.nodes.length);assert.ok(buildVisibleGraph(model,state).nodes.length<=200);
  state.portfolioFilter=model.portfolioRoots[0];const filtered=buildVisibleGraph(model,state);assert.equal(filtered.nodes.filter(n=>n.kind==='manager').length,12);assert.ok(filtered.edges.some(e=>e.source!==state.portfolioFilter),'Other known investors remain connected through shared securities');
});
test('unknown, duplicate or malformed equivalence memberships fail closed',()=>{
  assert.throws(()=>createPortfolioNetwork(portfolios,{...identity,groups:[['unknown','also-unknown']]}),/Unknown/);
  assert.throws(()=>createPortfolioNetwork(portfolios,{...identity,groups:[identity.groups[0],identity.groups[0]]}),/repeated/);
});

test('public identity map is byte-bound to independently approved exact-match release',async()=>{const bytes=await readFile(new URL('../data/instrument-equivalence.json',import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),'16cb5baf9abfae50f6dce62d1778f339d6b9e1c270b47df66fa03c4b3dca9346');assert.equal(identity.admission.status,'approved');assert.throws(()=>createPortfolioNetwork(portfolios,{...identity,admission:{status:'pending'}}),/independent review/);});

test('large navigation history cannot exceed the node ceiling or drop current focus',()=>{const state=initialState(model);const securities=model.nodes.filter(n=>n.kind==='asset');state.pinnedNodes=new Set(securities.slice(0,198).map(n=>n.id));state.rootId=securities[250].id;const graph=buildVisibleGraph(model,state);assert.equal(graph.nodes.length,200);assert.ok(graph.nodes.some(n=>n.id===state.rootId));});

test('manager expansion at top 40 reveals new holdings without exceeding the node ceiling',async()=>{
  const {expandPortfolioNetwork}=await import('../src/portfolio-network.js');
  const state=initialState(model);for(const root of model.portfolioRoots)state.limits.set(root,40);
  const before=buildVisibleGraph(model,state),shown=new Set(before.edges.map(edge=>edge.id));
  assert.equal(before.nodes.length,200);
  expandPortfolioNetwork(model,state,state.rootId,before);const after=buildVisibleGraph(model,state);
  assert.equal(after.nodes.length,200);
  assert.ok(after.edges.some(edge=>edge.source===state.rootId&&!shown.has(edge.id)));
});

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
  assert.equal(graph.edges.filter(e=>e.target===role.source&&e.kind==='managed_holding').length,8);
  assert.ok(model.roleEdges.every(e=>e.valueUsd===undefined&&e.stakePercent===undefined));
  assert.equal(model.rolePeers.get('berkshire-2026-06-30').size,2);
  assert.notEqual(...[...model.rolePeers.get('berkshire-2026-06-30')]);
  assert.equal(model.holdingEdges.length,162145);
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

test('new bank issuer roles open both incoming investors and outgoing portfolios',async()=>{const {networkNeighborhood}=await import('../src/portfolio-network.js');for(const name of ['jpmorgan','morganstanley','goldmansachs']){const id=name+'-2026-06-30',role=model.roleEdges.find(e=>e.target===id),neighborhood=networkNeighborhood(model,id);assert.ok(role);assert.ok(neighborhood.incoming.length>0);assert.ok(neighborhood.outgoing.length>1000);assert.equal(role.valueUsd,undefined);}});
test('overview at the node ceiling gives all twelve filers an initial neighborhood',()=>{const state=initialState(model);for(const root of model.portfolioRoots)state.limits.set(root,200);const graph=buildVisibleGraph(model,state);assert.equal(graph.nodes.length,200);for(const root of model.portfolioRoots)assert.ok(graph.edges.filter(e=>e.source===root).length>=Math.min(20,model.edges.filter(e=>e.source===root).length));});

test('independent admission binds the exact pre-admission proposal bytes',()=>{const proposal={...identity,admission:{status:'pending'}};const bytes=JSON.stringify(proposal)+'\n';assert.equal(createHash('sha256').update(bytes).digest('hex'),identity.admission.reviewedInputSha256);});

test('shared securities browse the entire exact-match network without summing values',async()=>{
 const {sharedInstrumentsPage}=await import('../src/portfolio-network.js');
 const result=sharedInstrumentsPage(model),expected=new Map();
 for(const edge of model.edges){if(!expected.has(edge.target))expected.set(edge.target,new Set());expected.get(edge.target).add(edge.source);}
 assert.equal(result.total,[...expected.values()].filter(ids=>ids.size>1).length);
 assert.equal(result.rows.length,50);
 assert.ok(result.total>buildVisibleGraph(model,initialState(model)).nodes.length);
 assert.ok(result.rows.every(row=>row.filerIds.length>=2&&!('valueUsd' in row)));
 assert.deepEqual(result.rows.map(row=>row.filerIds.length),result.rows.map(row=>row.filerIds.length).sort((a,b)=>b-a));
 const apple=sharedInstrumentsPage(model,{query:' APPLE INC '}).rows.find(row=>row.node.label==='APPLE INC');
 assert.equal(apple.filerIds.length,9,'67 filing rows still represent nine imported filers');
 const filtered=sharedInstrumentsPage(model,{portfolioId:apple.filerIds[0],query:'APPLE INC'});
 assert.equal(filtered.rows.find(row=>row.node.id===apple.node.id).filerIds.length,9,'filter limits instruments, not the displayed investor coverage');
 assert.equal(sharedInstrumentsPage(model,{portfolioId:'unknown'}).total,0);
 assert.equal(sharedInstrumentsPage(model,{query:'no such security xyz'}).pages,1);
 assert.equal(sharedInstrumentsPage(model,{page:1e9}).page,result.pages-1);
 assert.equal(sharedInstrumentsPage(model,{page:-1}).page,0);
 assert.equal(sharedInstrumentsPage(model,{page:NaN}).page,0);
});

test('shared discovery never merges names/classes or counts rows and issuer roles as investors',async()=>{
 const {sharedInstrumentsPage}=await import('../src/portfolio-network.js');
 const nodes=[{id:'a',label:'SAME NAME',sector:'CL A',kind:'asset'},{id:'b',label:'SAME NAME',sector:'CL B',kind:'asset'},{id:'c',label:'Unmatched',kind:'asset'}];
 const holding=(source,target,name='Alias from filing')=>({kind:'managed_holding',source,target,portfolioPositions:[{issuerName:name},{issuerName:name}]});
 const fixture={nodeMap:new Map(nodes.map(n=>[n.id,n])),portfolioMap:new Map([['one',{}],['two',{}],['three',{}]]),edges:[holding('one','a'),holding('one','a'),holding('two','a'),holding('one','b'),holding('two','b'),holding('three','c'),{kind:'issuer_reporting_entity',source:'three',target:'a'}]};
 const result=sharedInstrumentsPage(fixture);assert.equal(result.total,2);assert.deepEqual(result.rows.map(row=>row.node.id),['a','b']);assert.ok(result.rows.every(row=>row.filerIds.length===2));
 assert.equal(sharedInstrumentsPage(fixture,{query:'alias from filing'}).total,2);
 assert.equal(sharedInstrumentsPage(fixture,{query:'cl b'}).rows[0].node.id,'b');
});

test('every admitted PIF instrument connects to other filers without ownership aggregation',()=>{
 const edges=model.edges.filter(e=>e.source==='pif-2026-06-30');assert.equal(edges.length,5);
 for(const edge of edges){
  assert.ok(model.edges.some(other=>other.target===edge.target&&other.source!==edge.source));
  assert.equal(edge.portfolioPositions.length,1);
  assert.match(networkDetails(model,edge.target),/not legal ownership or control/);
 }
});
