import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const css=await readFile(new URL('../style.css',import.meta.url),'utf8');
test('mobile shell exposes dedicated controls and selected entity sheets with safe-area and reduced motion support',()=>{
 const document=new JSDOM(html).window.document;
 for(const id of ['mobile-options','mobile-controls','mobile-details','mobile-selection-name','detail-sheet','close-mobile-details','close-mobile-controls','mobile-scrim'])assert.ok(document.getElementById(id));
 assert.equal(document.getElementById('mobile-details').getAttribute('aria-controls'),'detail-sheet');
 assert.match(css,/safe-area-inset-bottom/);assert.match(css,/prefers-reduced-motion:reduce/);assert.match(css,/min-height:44px/);
 assert.match(css,/font-size:16px/);
});
