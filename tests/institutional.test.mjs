import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {institutionalPilot,validateInstitutionalPilot} from '../src/institutional-data.js';
import {mountInstitutionalPilot} from '../src/institutional-view.js';
const copy=()=>structuredClone(institutionalPilot);
test('pilot remains bounded to four official roster relationships with independent identities',()=>{
  const d=validateInstitutionalPilot(copy());assert.equal(d.relationships.length,4);assert.equal(d.entities.length,5);assert.equal(d.sources.length,2);
  assert.equal(d.sources[0].asOf,'2026-09-03');assert.equal(d.sources[1].asOf,null);
  assert.ok(d.relationships.every(e=>e.validFrom===null&&e.validTo===null));
});
test('rejects invented joins, people, money, ownership and dates',()=>{
  for(const [field,value] of Object.entries({securityId:'037833100',issuerId:'apple',amount:50000,ownershipPercentage:1,control:true})){const d=copy();d.relationships[0][field]=value;assert.throws(()=>validateInstitutionalPilot(d));}
  for(const change of [d=>d.entities[0].kind='person',d=>d.relationships[0].validFrom='2026-10-21',d=>d.relationships[0].sourceId='missing',d=>d.relationships.push(d.relationships[0]),d=>d.sources[0].url='https://example.com',d=>d.sources[0].asOf='2027-01-01']){const d=copy();change(d);assert.throws(()=>validateInstitutionalPilot(d));}
});
test('off by default, scoped filter and source evidence; close restores focus',()=>{
  const dom=new JSDOM('<button id="launch">Pilot</button>');const {document}=dom.window;const launcher=document.querySelector('button');let opens=0;
  const {dialog}=mountInstitutionalPilot({document,launcher,beforeOpen:()=>opens++});
  dialog.showModal=()=>dialog.setAttribute('open','');dialog.close=()=>{dialog.removeAttribute('open');dialog.dispatchEvent(new dom.window.Event('close'));};
  assert.equal(dialog.open,false);assert.equal(dialog.querySelectorAll('article').length,0);
  launcher.click();assert.equal(opens,1);assert.equal(dialog.open,true);assert.equal(dialog.querySelectorAll('article').length,4);
  const select=dialog.querySelector('select');select.value='institution-nvidia';select.dispatchEvent(new dom.window.Event('change'));assert.equal(dialog.querySelectorAll('article').length,2);
  assert.match(dialog.textContent,/Not stated \(undated roster\)/);assert.match(dialog.textContent,/2026-09-03/);assert.match(dialog.textContent,/not a membership start date/);
  assert.equal(dialog.querySelectorAll('a').length,2);dialog.querySelector('button').click();assert.equal(document.activeElement,launcher);
});
