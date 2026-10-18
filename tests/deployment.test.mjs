import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('legacy Jekyll fallback excludes all data foundation and source-only paths',async()=>{
  const config=await readFile(new URL('../_config.yml',import.meta.url),'utf8');
  const excluded=config.split('\n').filter(line=>/^  - /.test(line)).map(line=>line.slice(4));
  for(const entry of ['data-foundation','docs','scripts','tests','node_modules','artifacts','raw','staging','canonical','package.json','package-lock.json','README.md'])assert.ok(excluded.includes(entry),`${entry} must never enter a branch-based Pages build`);
  assert.ok(!/^include:/m.test(config),'Do not override exclusions with broad Jekyll includes');
  for(const entry of ['index.html','style.css','icon.svg','data','src','vendor'])assert.ok(!excluded.includes(entry),`${entry} remains available to the unchanged app`);
});
