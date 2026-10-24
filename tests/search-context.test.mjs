import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {decodePortfolio} from '../src/portfolio-view.js';
import {createPortfolioNetwork} from '../src/portfolio-network.js';
import {searchNodes,searchResultDetails,searchResultsHtml} from '../src/graph-model.js';
const manifest=JSON.parse(await readFile(new URL('../data/portfolios.json',import.meta.url)));
const portfolios=await Promise.all(manifest.portfolios.map(async p=>decodePortfolio(p,JSON.parse(await readFile(new URL('../data/'+p.dataFile,import.meta.url))))));
const model=createPortfolioNetwork(portfolios,JSON.parse(await readFile(new URL('../data/instrument-equivalence.json',import.meta.url))));
test('actual Atlassian results explain all three records without merging evidence',()=>{
 const matches=searchNodes(model,'atlassian'),before=JSON.stringify(matches);
 assert.equal(matches.length,3);
 assert.deepEqual(matches.map(n=>n.sector).sort(),['CL A','CMN','COMMON']);
 const doc=new JSDOM(searchResultsHtml(model,matches)).window.document;
 assert.equal(doc.querySelectorAll('button').length,3);
 assert.match(doc.querySelector('.search-context').textContent,/separate reported records/);
 for(const n of matches){
   const button=[...doc.querySelectorAll('button')].find(b=>b.dataset.searchNode===n.id);
   assert.match(button.textContent,new RegExp('Reported class: '+n.sector));
   assert.match(button.textContent,/30 Jun 2026/);
   assert.match(button.textContent,n.sector==='CL A'?/8 imported filers/:n.sector==='CMN'?/Goldman Sachs/i:/JPMorgan/i);
 }
 assert.equal(JSON.stringify(matches),before);
 assert.equal(model.holdingEdges.length,162145);
});
test('same label and class never collapse distinct source identities or dates',()=>{
 const nodes=[{id:'a',label:'Example',sector:'CL A',kind:'asset'},{id:'b',label:'Example',sector:'CL A',kind:'asset'},{id:'c',label:'Example',sector:'CL B',kind:'asset'}];
 const m={network:true,nodes,nodeMap:new Map([['f',{label:'Filer'}]]),edges:nodes.map((n,i)=>({target:n.id,source:'f',kind:'managed_holding',asOf:i===0?'2025-12-31':'2026-06-30'}))};
 const html=searchResultsHtml(m,searchNodes(m,'example')),doc=new JSDOM(html).window.document;
 assert.equal(doc.querySelectorAll('button').length,3);
 assert.match(doc.querySelector('[data-search-node="a"]').textContent,/31 Dec 2025/);
 assert.match(doc.querySelector('[data-search-node="b"]').textContent,/30 Jun 2026/);
 assert.match(doc.querySelector('[data-search-node="c"]').textContent,/CL B/);
});
test('search context escapes source text and leaves non-network modes unchanged',()=>{
 const n={id:'<id>',label:'<script>bad()</script>',sector:'<b>CL A</b>',kind:'asset'};
 const m={network:true,nodes:[n],nodeMap:new Map(),edges:[]};
 const d=new JSDOM(searchResultsHtml(m,[n])).window.document;
 assert.equal(d.querySelector('script'),null);assert.equal(d.querySelector('b'),null);assert.equal(d.querySelector('button').dataset.searchNode,n.id);
 assert.deepEqual(searchResultDetails({network:false}, {kind:'company',ticker:'ABC'}),['Company · ABC']);
});
