import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {createModel,initialState,buildVisibleGraph,relatedEdges,RELATIONSHIPS} from '../src/graph-model.js';
import {researchRowsPage,researchInventoryHtml,researchDetails,correctionReviewNote,RESEARCH_PAGE_SIZE} from '../src/research-view.js';

function fixture(){
  const groups=[{id:'eia',label:'Federal group',kind:'sovereign'},{id:'icd',label:'Dubai consolidated group',kind:'reported_group'},{id:'historic',label:'Historical investor',kind:'sovereign'}];
  const nodes=[...groups],edges=[];
  for(let i=0;i<72;i++){
    const id=`company-${String(i).padStart(2,'0')}`,source=i<35?'eia':i<70?'icd':'historic',kind=source==='icd'?'reported_group_interest':'direct_equity_ownership';
    nodes.push({id,label:`Holding ${String(i).padStart(2,'0')}`,kind:'company'});
    edges.push({id:`claim-${i}`,source,target:id,kind,asOf:i%2?'2025-12-31':'2024-12-31',sourceIds:['official'],stakePercent:null,valueUsd:null,disclosure:{status:source==='historic'?'Historical pre-sale snapshot':'Dated source snapshot, not verified current',securityLabel:'Reported interest',metrics:[{metric_type:kind==='reported_group_interest'?'group_interest_percentage':'equity_percentage',value:i===71?null:'50.1',unit:'percent'}],caveats:['Do not infer control or current ownership.'],perimeter:{definition:'Named reporting entity only, not a complete portfolio.'},coverage:[{description:'Partial historical coverage.',expected_source_rows:null}],checkedThrough:'2026-10-22',evidence:[{url:'https://example.com/report',title:'Official group annual report',publisher:'Reporting entity',published_at:source==='icd'?null:'2026-03-01',observed_by:source==='icd'?'2026-10-22':null,locator:'Note 4, interests'}]}});
  }
  return {meta:{datasetId:'uae',mode:'researched',defaultRoot:'eia',investorIds:groups.map(x=>x.id),publicationStatus:'approved',updatedAt:'2026-10-22',coverage:'Selected independently admitted disclosures, not all UAE holdings.',coverageLanes:[{label:'Other groups',status:'Not yet admitted.'}]},nodes,edges,sources:[{id:'official',title:'Official report',url:'https://example.com/report'}]};
}
const uae=fixture();
test('UAE inventory includes every admitted row, not graph truncation or invented root links',()=>{
  const model=createModel(uae),state=initialState(model),graph=buildVisibleGraph(model,state);
  assert.equal(graph.edges.length,8);assert.equal(graph.nodes.some(n=>n.id==='icd'),false);
  const pages=[0,1,2].map(page=>researchRowsPage(model,{page}));
  assert.equal(pages[0].rows.length,RESEARCH_PAGE_SIZE);assert.equal(new Set(pages.flatMap(p=>p.rows.map(e=>e.id))).size,72);
  assert.equal(researchRowsPage(model,{groupId:'icd'}).total,35);
  assert.equal(researchRowsPage(model,{groupId:'icd',snapshotDate:'2024-12-31'}).total,17);
  assert.equal(researchRowsPage(model,{query:'Holding 71'}).total,1);
  assert.equal(researchRowsPage(model,{query:'pre-sale'}).total,2);
  assert.equal(researchRowsPage(model,{query:'missing',page:90}).page,0);
  assert.equal(relatedEdges(model,'icd',{filter:'ownership'}).length,35);
  assert.equal(relatedEdges(model,'icd',{filter:'managed_holding'}).length,0);
  assert.equal(buildVisibleGraph(model,{...state,snapshotDate:'2024-12-31'}).edges.every(e=>e.asOf==='2024-12-31'),true);
  assert.match(RELATIONSHIPS.reported_group_interest.explanation,/does not identify an immediate legal shareholder/);
});
test('UAE row and evidence text distinguish group interest, status and publication uncertainty',()=>{
  const model=createModel(uae),edge=model.edges[35];
  const detail=researchDetails(edge,model.nodeMap.get(edge.source),model.nodeMap.get(edge.target));
  assert.match(detail,/Reported consolidated group interest/);assert.match(detail,/50.1%/);
  assert.match(detail,/Publication date unknown/);assert.match(detail,/Observed by 22 Oct 2026 \(not a publication date\)/);
  assert.doesNotMatch(detail,/Published 22 Oct 2026/);assert.match(detail,/does not establish a current position/);
  const html=researchInventoryHtml(model,researchRowsPage(model,{query:'Holding 71'}));
  assert.match(html,/Historical pre-sale snapshot/);assert.match(html,/Not reported/);assert.doesNotMatch(html,/>0%/);
});

test('snapshot-only source reviews never imply exhaustive corrections or a publication/observation date',()=>{
  const edge=structuredClone(uae.edges[0]);
  Object.assign(edge.disclosure,{correctionStatus:'source_snapshot_only',correctionScope:'nonexhaustive',correctionCompleteness:'not_established'});
  const note=correctionReviewNote(edge.disclosure);
  assert.match(note,/Source snapshot only/);assert.match(note,/Bounded source review through 22 Oct 2026/);
  assert.match(note,/Correction coverage is nonexhaustive; correction completeness is not established/);
  assert.doesNotMatch(note,/observed|published|corrections checked on|correction discovery checked on/i);
  const detail=researchDetails(edge,{id:edge.source,label:'Source entity'},{id:edge.target,label:'Asset'});
  assert.match(detail,/Bounded source review through 22 Oct 2026/);
  assert.match(detail,/Published 1 Mar 2026/);assert.doesNotMatch(detail,/Published 22 Oct 2026|Observed by 22 Oct 2026/);
  const evidenceOnly=structuredClone(edge.disclosure);
  delete evidenceOnly.correctionStatus;delete evidenceOnly.correctionScope;delete evidenceOnly.correctionCompleteness;
  evidenceOnly.evidence[0].amendment_status='source_snapshot_only';evidenceOnly.evidence[0].correction_scope='nonexhaustive';
  assert.equal(correctionReviewNote(evidenceOnly),note,'Evidence metadata alone retains nonexhaustive limits');
  delete evidenceOnly.checkedThrough;
  assert.match(correctionReviewNote(evidenceOnly),/Bounded source review date not provided/);
  assert.doesNotMatch(correctionReviewNote(evidenceOnly),/1 Mar 2026|22 Oct 2026/,'Publication and observation dates never fill a missing review date');
  const strict={checkedThrough:'2026-10-22',evidence:[{url:'https://www.sec.gov/Archives/edgar/filing.xml',amendment_status:'complete'}]};
  assert.match(correctionReviewNote(strict),/Filing-family correction discovery checked on 22 Oct 2026/);
  assert.doesNotMatch(correctionReviewNote(strict),/Source snapshot only|nonexhaustive/);
});
test('asset and brand affiliations show Not equity and cannot become ownership links',()=>{
  for(const kind of ['asset','brand']){
    const data=structuredClone(uae),edge=data.edges[0];
    edge.kind='reported_portfolio_affiliation';edge.disclosure.metrics=[];
    edge.disclosure.securityLabel='Source-reported asset / brand affiliation, not a security';
    edge.disclosure.caveats=['The source names a management affiliation. Do not infer legal ownership.'];
    data.nodes.find(n=>n.id===edge.target).kind=kind;
    const model=createModel(data),html=researchInventoryHtml(model,{rows:[edge],total:1,page:0,pages:1});
    const document=new JSDOM(html).window.document,row=document.querySelector('.research-row');
    assert.match(row.textContent,/Not equity/);assert.match(row.textContent,/Asset \/ brand affiliation/);
    assert.doesNotMatch(row.querySelector('.holding-value').textContent,/%|equity percentage|Group interest|Not reported/);
    assert.equal(relatedEdges(model,edge.source,{filter:'ownership'}).some(e=>e.id===edge.id),false);
    assert.equal(relatedEdges(model,edge.source,{filter:'reported_portfolio_affiliation'}).some(e=>e.id===edge.id),true);
    const detail=researchDetails(edge,model.nodeMap.get(edge.source),model.nodeMap.get(edge.target));
    assert.match(detail,/This is not a company equity interest/);assert.match(detail,/not inferred from this link/);
    assert.match(detail,/Do not infer legal ownership/);assert.doesNotMatch(detail,/50.1%|100%|Source equity percentage/);
  }
});

test('UAE controls survive interrupted loads, repeated selection, evidence, graph exploration and Back',async()=>{
  const html=await readFile(new URL('../index.html',import.meta.url),'utf8'),sample=JSON.parse(await readFile(new URL('../data/graph.json',import.meta.url),'utf8')),historical=JSON.parse(await readFile(new URL('../data/researched.json',import.meta.url),'utf8'));
  const dom=new JSDOM(html,{url:'http://localhost/?dataset=uae'});
  dom.window.HTMLCanvasElement.prototype.getContext=()=>null;
  dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;};
  dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
  let release,mode='delayed',calls=0;
  Object.assign(globalThis,{window:dom.window,document:dom.window.document,fetch:async url=>{
    const path=new URL(url).pathname.split('/').pop();
    if(path==='uae.json'){calls++;if(mode==='delayed')await new Promise(resolve=>{release=resolve;});return {ok:true,json:async()=>mode==='invalid'?{...structuredClone(uae),meta:{...uae.meta,publicationStatus:'held'}}:structuredClone(uae)};}
    return {ok:true,json:async()=>structuredClone(path==='researched.json'?historical:sample)};
  }});
  const $=s=>document.querySelector(s),tick=()=>new Promise(r=>setTimeout(r,10));
  const change=(id,value)=>{$(id).value=value;$(id).dispatchEvent(new dom.window.Event('change',{bubbles:true}));};
  await import('../src/app.js?uae-ui');const api=window.__assetsMap;
  await tick();assert.equal($('#graph-stage').getAttribute('aria-busy'),'true');
  await api.setDataset('sample');const old=api.getModel();release();await tick();
  assert.equal(api.getModel(),old);assert.equal($('#dataset').value,'sample');assert.equal($('#uae-controls').hidden,true);
  mode='invalid';await api.setDataset('uae');assert.equal(calls,2,'obsolete load did not seed cache');assert.equal(api.getModel(),old);assert.equal($('#load-feedback').hidden,false);
  mode='ok';$('#retry-dataset').click();
  for(let n=0;n<100&&api.getModel()===old;n++)await tick();
  assert.equal(calls,3);assert.equal(api.getModel().meta.datasetId,'uae');assert.equal(api.getState().view,'list');assert.equal($('#uae-controls').hidden,false);assert.equal($('#portfolio-controls').hidden,true);assert.equal($('#load-feedback').hidden,true);
  assert.equal($('#dataset option[value="uae"]').disabled,false);assert.equal(document.querySelectorAll('.research-row').length,30);
  const found=new Set();for(let p=0;p<3;p++){for(const row of document.querySelectorAll('.research-row'))found.add(row.dataset.edge);if(p<2)$('#graph-list [data-holdings-page]:last-child').click();}
  assert.equal(found.size,72,'every admitted row can be reached through the portal');
  change('#uae-group','icd');assert.equal(api.getState().rootId,'icd');assert.equal(document.querySelectorAll('.research-row').length,30);
  change('#uae-snapshot','2024-12-31');assert.equal(document.querySelectorAll('.research-row').length,17);assert.ok(api.getGraph().edges.every(e=>e.asOf==='2024-12-31'));
  change('#uae-group','icd');assert.equal(document.querySelectorAll('.research-row').length,17,'repeated group action is idempotent');
  $('#uae-search').value='Holding 36';$('#uae-search').dispatchEvent(new dom.window.Event('input'));assert.equal(document.querySelectorAll('.research-row').length,1);
  $('.research-row').click();assert.match($('#detail-panel').textContent,/Publication date unknown/);assert.match($('#detail-panel').textContent,/Reported consolidated group interest/);
  api.goBack();assert.equal(api.getState().selectedEdgeId,null);assert.equal($('#uae-search').value,'Holding 36');
  $('.research-explore').click();assert.equal(api.getState().view,'2d');assert.equal(api.getState().rootId,'company-36');
  api.goBack();assert.equal(api.getState().view,'list');assert.equal(api.getState().rootId,'icd');assert.equal($('#uae-group').value,'icd');assert.equal($('#uae-snapshot').value,'2024-12-31');assert.equal($('#uae-search').value,'Holding 36');
  $('#reset-map').click();assert.equal(api.getState().view,'list');assert.equal($('#uae-group').value,'all');assert.equal($('#uae-snapshot').value,'all');assert.equal($('#uae-search').value,'');assert.equal(document.querySelectorAll('.research-row').length,30);
  await api.setDataset('researched');assert.equal(api.getModel().edges.length,4);assert.equal($('#uae-controls').hidden,true);assert.match($('#dataset-context').textContent,/4 reviewed disclosures/);
  await api.setDataset('uae');assert.equal(calls,3,'valid model is reused');assert.equal(api.getState().view,'list');assert.equal(document.querySelectorAll('.research-row').length,30);
  dom.window.matchMedia=()=>({matches:true,addEventListener(){}});
  const firstEdge=$('.research-row').dataset.edge;
  $('.research-row').focus();$('.research-row').click();
  assert.equal(document.body.classList.contains('mobile-details-open'),true);
  $('#close-mobile-details').click();
  assert.equal(document.body.classList.contains('mobile-details-open'),false);
  assert.equal(document.activeElement.dataset.edge,firstEdge,'Close restores the rerendered evidence row');
  document.activeElement.click();document.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
  assert.equal(document.body.classList.contains('mobile-details-open'),false);
  assert.equal(document.activeElement.dataset.edge,firstEdge,'Escape restores the rerendered evidence row after reopening');
  dom.window.close();
});
