import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {comparePortfolios,mountPortfolioComparison} from '../src/portfolio-comparison.js';
function fixture(count=24){
  const nodes=Array.from({length:count},(_,i)=>({id:`s${i}`,label:`Issuer ${String(i).padStart(2,'0')}`,sector:'COM',kind:'asset'}));
  nodes.push({id:'unmatched',label:'Issuer 00',sector:'COM',kind:'asset'},{id:'class-b',label:'Issuer 00',sector:'CL B',kind:'asset'});
  const edge=(source,target)=>({id:`${source}-${target}`,source,target,kind:'managed_holding',asOf:'2026-06-30',portfolioPositions:[{issuerName:'Alias',valueUsd:'9007199254740993'},{issuerName:'Alias',valueUsd:'2'}]});
  return {network:true,nodeMap:new Map(nodes.map(n=>[n.id,n])),portfolioRoots:['a','b','c'],portfolioMap:new Map(['a','b','c'].map(id=>[id,{filer:{name:`Filer ${id}`},reportingDate:'2026-06-30'}])),edges:[...nodes.slice(0,count).flatMap(n=>[edge('a',n.id),edge('b',n.id)]),edge('a','unmatched'),edge('b','class-b'),{source:'a',target:'b',kind:'issuer_reporting_entity'}]};
}
test('comparison uses exact canonical IDs, separate classes and distinct instruments, never source-row or role counts',()=>{
  const model=fixture();const r=comparePortfolios(model,'a','b');assert.equal(r.common,24);assert.equal(r.leftCount,25);assert.equal(r.rightCount,25);assert.equal(r.rows.length,20);assert.equal(r.pages,2);assert.equal(r.rows[0].left.portfolioPositions.length,2);
  assert.equal(comparePortfolios(model,'a','b',{page:999}).rows.length,4);assert.equal(comparePortfolios(model,'a','b',{page:NaN}).page,0);assert.equal(comparePortfolios(model,'a','b',{page:-1}).page,0);
  assert.equal(comparePortfolios(model,'a','b',{query:'Issuer 00'}).total,1);assert.equal(comparePortfolios(model,'a','b',{query:'alias'}).total,24);
  assert.equal(comparePortfolios(model,'a','c').common,0);assert.throws(()=>comparePortfolios(model,'a','a'));assert.throws(()=>comparePortfolios(model,'a','missing'));
  assert.deepEqual(comparePortfolios(model,'b','a').rows.map(r=>r.node.id),r.rows.map(r=>r.node.id));
});
test('comparison dialog preserves exact per-filer values and pagination, search, focus and evidence navigation',()=>{
  const dom=new JSDOM('<button id="launch">Compare</button>');const {document,Event}=dom.window;const launcher=document.querySelector('button');let selected,evidence,opens=0;
  const {dialog}=mountPortfolioComparison({document,launcher,getModel:()=>fixture(),beforeOpen:()=>opens++,onSelect:id=>selected=id,onEvidence:id=>evidence=id});
  dialog.showModal=()=>{dialog.open=true;};dialog.close=()=>{dialog.open=false;dialog.dispatchEvent(new Event('close'));};
  launcher.click();assert.equal(opens,1);assert.equal(dialog.querySelectorAll('article').length,20);assert.match(dialog.textContent,/9,007,199,254,740,995 USD/);assert.doesNotMatch(dialog.textContent,/18,014,398/);
  const buttons=()=>[...dialog.querySelectorAll('button')];buttons().find(b=>b.textContent==='Next →').click();assert.equal(dialog.querySelectorAll('article').length,4);
  const search=dialog.querySelector('input');search.value='Issuer 00';search.dispatchEvent(new Event('input'));assert.equal(dialog.querySelectorAll('article').length,1);assert.match(dialog.textContent,/Page 1 of 1/);
  dialog.querySelector('[data-comparison-select]').click();assert.equal(selected,'s0');assert.equal(dialog.open,false);
  launcher.click();buttons().find(b=>b.textContent==='Evidence for Filer a').click();assert.equal(evidence,'a-s0');
  launcher.click();const right=dialog.querySelector('#comparison-right');right.value='a';right.dispatchEvent(new Event('change'));assert.match(dialog.textContent,/Choose two different/);assert.equal(dialog.querySelectorAll('article').length,0);
  dialog.querySelector('button').click();assert.equal(document.activeElement,launcher);
});
