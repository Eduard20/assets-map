import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {decodePortfolio,portfolioModel,portfolioPositionDetails,portfolioInstrumentDetails,portfolioOverview} from '../src/portfolio-view.js';
import {createPortfolioNetwork,networkDetails,networkNeighborhood,sharedInstrumentsPage} from '../src/portfolio-network.js';

// Deliberately synthetic: a manager reports fund shares and direct issuer shares.
// No underlying fund holdings, client allocations or beneficial owners are known.
function fixture(refs=['7','7','12','0']){
 const summary={portfolioId:'synthetic-manager',filer:{name:'Example Capital',cik:'123'},reportingDate:'2026-06-30',checkedThrough:'2026-10-18',coverage:'Synthetic disclosed subset; not whole AUM.',sources:[{id:'synthetic-source',title:'Synthetic information table',url:'https://example.com/fixture',publishedAt:'2026-08-14'}],reconciliation:{shareRowCount:3,shareReportedSecurityCount:2,reportedRowCount:3,excludedRowCount:0,shareValueUsd:'1900',totalValueUsd:'1900',excludedValueUsd:'0'}};
 const compact={schemaVersion:1,portfolioId:summary.portfolioId,groups:[['synthetic-fund-shares',0,'Example Capital','FUND SHARES'],['synthetic-direct-shares',0,'Example Issuer','COM']],rows:[
  [1,0,'1000','100','DFND',refs,'40','35','25'],
  [2,0,'300','30','SHARED',refs,'0','30','0'],
  [3,1,'600','60','SOLE',[], '60','0','0']
 ]};
 const portfolio=decodePortfolio(summary,compact);return {portfolio,model:portfolioModel(portfolio)};
}

test('repeated, multiple and unresolved manager references never multiply a source row',()=>{
 const {portfolio,model}=fixture(),withoutRefs=fixture([]).model;
 assert.equal(portfolio.positions.length,3);assert.equal(model.holdingEdges.length,3);assert.equal(model.edges.length,2);
 assert.deepEqual(model.edges.map(e=>[e.target,e.portfolioPosition.valueUsd,e.portfolioPosition.quantity]),withoutRefs.edges.map(e=>[e.target,e.portfolioPosition.valueUsd,e.portfolioPosition.quantity]));
 const fund=model.edges.find(e=>e.target==='synthetic-fund-shares');
 assert.equal(fund.portfolioPosition.valueUsd,'1300');assert.equal(fund.portfolioPosition.quantity,'130');
 assert.deepEqual(fund.portfolioPositions.map(p=>p.rowOrdinal),[1,2]);
 assert.equal(new Set(model.holdingEdges.map(e=>e.id)).size,3);
 assert.deepEqual(portfolio.positions[0].otherManagerRefs,['7','7','12','0']);
 const html=portfolioPositionDetails(portfolio.positions[0],portfolio);
 assert.match(html,/7, 7, 12, 0/);assert.match(html,/not resolved to owners/);
 assert.match(portfolioInstrumentDetails(fund,portfolio),/Totals sum the source rows once/);
});

test('voting partitions remain attributes, not extra shares or holding edges',()=>{
 const {portfolio,model}=fixture(),fund=model.edges.find(e=>e.target==='synthetic-fund-shares');
 assert.deepEqual(['votingSole','votingShared','votingNone'].map(k=>fund.portfolioPosition[k]),['40','65','25']);
 assert.equal(fund.portfolioPosition.quantity,'130');assert.equal(fund.valueUsd,1300);
 const changed=structuredClone(portfolio);for(const p of changed.positions){p.votingSole='0';p.votingShared='0';p.votingNone=p.quantity;}
 const changedModel=portfolioModel(changed);
 assert.deepEqual(changedModel.holdingEdges.map(e=>[e.id,e.valueUsd,e.portfolioPosition.quantity]),model.holdingEdges.map(e=>[e.id,e.valueUsd,e.portfolioPosition.quantity]));
 assert.ok(model.edges.every(e=>e.kind==='managed_holding'&&e.stakePercent===null));
 assert.match(portfolioPositionDetails(portfolio.positions[0],portfolio),/separate role on these shares, not additional holdings/);
});

test('same-name manager and fund-share instrument stay separate; fund look-through is not inferred',()=>{
 const {model,portfolio}=fixture(),manager=model.nodeMap.get(portfolio.portfolioId),fund=model.nodeMap.get('synthetic-fund-shares');
 assert.equal(manager.label,fund.label);assert.notEqual(manager.id,fund.id);
 assert.equal(manager.kind,'manager');assert.equal(fund.kind,'asset');assert.equal(fund.sector,'FUND SHARES');
 assert.equal(model.nodes.length,3);assert.equal(model.edges.filter(e=>e.source===fund.id).length,0);
 assert.deepEqual(model.edges.map(e=>e.source),[manager.id,manager.id]);
 // A manager's direct issuer position is not an investment made by the fund.
 assert.equal(model.edges.find(e=>e.target==='synthetic-direct-shares').valueUsd,600);
 assert.equal(model.edges.reduce((n,e)=>n+BigInt(e.portfolioPosition.valueUsd),0n),1900n);
 assert.match(portfolioOverview(model),/not whole AUM/);
 assert.match(portfolioPositionDetails(portfolio.positions[0],portfolio),/does not establish proprietary ownership, client allocation or control/);
});

test('overlap evidence retains reporting date, filing date, source row and unknown ownership denominator',()=>{
 const {portfolio,model}=fixture();
 for(const edge of model.holdingEdges){assert.equal(edge.asOf,'2026-06-30');assert.deepEqual(edge.sourceIds,['synthetic-source']);assert.equal(edge.stakePercent,null);}
 const html=portfolioPositionDetails(portfolio.positions[0],portfolio);
 assert.match(html,/1,000 USD/);assert.match(html,/Information-table row 1/);assert.match(html,/2026/);
 assert.match(html,/https:\/\/example.com\/fixture/);assert.match(html,/Ownership percentage<\/span><strong>Not calculated/);
 assert.equal(portfolio.sources[0].publishedAt,'2026-08-14');assert.notEqual(portfolio.reportingDate,portfolio.sources[0].publishedAt);
});

const manifest=JSON.parse(await readFile(new URL('../data/portfolios.json',import.meta.url)));
const portfolios=await Promise.all(manifest.portfolios.map(async p=>decodePortfolio(p,JSON.parse(await readFile(new URL('../data/'+p.dataFile,import.meta.url))))));
const identity=JSON.parse(await readFile(new URL('../data/instrument-equivalence.json',import.meta.url)));
const network=createPortfolioNetwork(portfolios,identity);

test('real shared instruments preserve each filer boundary and every contributing row exactly once',()=>{
 for(const edge of network.edges){
  assert.equal(edge.kind,'managed_holding');assert.equal(edge.stakePercent,null);assert.equal(edge.source,edge.portfolioId);
  assert.equal(new Set(edge.portfolioPositions.map(p=>p.positionId)).size,edge.portfolioPositions.length);
  for(const field of ['valueUsd','quantity','votingSole','votingShared','votingNone'])assert.equal(edge.portfolioPosition[field],edge.portfolioPositions.reduce((n,p)=>n+BigInt(p[field]),0n).toString());
 }
 for(const p of portfolios){
  const rows=network.holdingEdges.filter(e=>e.portfolioId===p.portfolioId);
  assert.equal(rows.length,p.positions.length);
  assert.deepEqual(new Set(rows.map(e=>e.portfolioPosition.positionId)),new Set(p.positions.map(row=>row.positionId)));
 }
 const shared=sharedInstrumentsPage(network,{query:'APPLE INC'}).rows.find(r=>r.node.sector==='COM');assert.ok(shared);
 const incoming=networkNeighborhood(network,shared.node.id).incoming;
 assert.equal(incoming.length,shared.filerIds.length);assert.ok(incoming.length>1);
 assert.equal(new Set(incoming.map(e=>e.source)).size,incoming.length);
 const html=networkDetails(network,shared.node.id);
 assert.equal((html.match(/class="investor-card"/g)||[]).length,incoming.length);
 assert.match(html,/must not be added as a company ownership total/);
 assert.match(network.meta.notes.join(' '),/overlapping positions are never summed as an ownership total/);
});
