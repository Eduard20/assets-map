import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,readdir,rename,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fixture} from '../data-foundation/fixtures/synthetic.mjs';
import {buildRelease} from '../scripts/foundation/core.mjs';
import {stageBatch,writeRelease,readRelease,readCurrent,rollbackShadow} from '../scripts/foundation/store.mjs';
const build=()=>{const f=fixture();return buildRelease({batches:[f.batch],registry:f.registry,sources:f.sources,review:f.review,fixtureMode:true});};
async function setup(t){const base=await mkdtemp(path.join(tmpdir(),'assets-store-'));t.after(()=>rm(base,{recursive:true,force:true}));const root=path.join(base,'store'),outside=path.join(base,'outside');await mkdir(root);await mkdir(outside);return {base,root,outside};}
const symlinkError=/must not be a symlink/;

for(const component of ['staging','batch','artifact'])for(const dangling of [false,true])test(`staging rejects ${dangling?'dangling ':''}${component} symlink without external changes`,async t=>{
  const {root,outside}=await setup(t),batch=fixture().batch,id=batch.manifest.batch_id;
  const relative=component==='staging'?'staging':component==='batch'?`staging/${id}`:`staging/${id}/batch.json`;
  const link=path.join(root,relative),target=path.join(outside,'target');
  await mkdir(path.dirname(link),{recursive:true});
  if(!dangling){if(component==='artifact')await writeFile(target,JSON.stringify(batch));else await mkdir(target);}
  await symlink(target,link);
  const before=await readdir(outside);await assert.rejects(stageBatch(root,batch),symlinkError);assert.deepEqual(await readdir(outside),before);
  if(!dangling&&component!=='artifact')assert.deepEqual(await readdir(target),[]);
  if(!dangling&&component==='artifact')assert.equal(await readFile(target,'utf8'),JSON.stringify(batch));
});

for(const component of ['releases','release'])for(const dangling of [false,true])test(`release writes reject ${dangling?'dangling ':''}${component} directory symlink`,async t=>{
  const {root,outside}=await setup(t),release=build(),id=release.manifest.release_id;
  const link=path.join(root,component==='releases'?'releases':`releases/${id}`),target=path.join(outside,'target');
  await mkdir(path.dirname(link),{recursive:true});if(!dangling)await mkdir(target);await symlink(target,link);
  await assert.rejects(writeRelease(root,release),symlinkError);assert.deepEqual(await readdir(outside),dangling?[]:['target']);if(!dangling)assert.deepEqual(await readdir(target),[]);
});

for(const component of ['releases','release','integrity.json','release.json','manifest.json','documents.jsonl'])test(`release reads reject linked ${component}`,async t=>{
  const {root,outside}=await setup(t),release=build(),id=release.manifest.release_id;await writeRelease(root,release);
  const link=path.join(root,component==='releases'?'releases':component==='release'?`releases/${id}`:`releases/${id}/${component}`),target=path.join(outside,'target');
  await rename(link,target);await symlink(target,link);
  await assert.rejects(readRelease(root,id),symlinkError);await assert.rejects(readCurrent(root),symlinkError);
  await assert.rejects(rollbackShadow(root,id,{expectedReleaseId:id}),symlinkError);
});

for(const dangling of [false,true])test(`current pointer rejects ${dangling?'dangling ':''}symlink`,async t=>{
  const {root,outside}=await setup(t),release=build(),target=path.join(outside,'pointer.json');if(!dangling)await writeFile(target,JSON.stringify({release_id:release.manifest.release_id}));
  await symlink(target,path.join(root,'shadow-current.json'));await assert.rejects(readCurrent(root),symlinkError);await assert.rejects(writeRelease(root,release),symlinkError);
  assert.deepEqual(await readdir(outside),dangling?[]:['pointer.json']);
});

test('release ID is rejected before creating release paths',async t=>{
  const {root,outside}=await setup(t),release=build();release.manifest.release_id='../../outside/escape';await assert.rejects(writeRelease(root,release),/Invalid release ID/);assert.deepEqual(await readdir(root),[]);assert.deepEqual(await readdir(outside),[]);
});

test('real paths preserve staging replay, release replay, failure atomicity and rollback',async t=>{
  const {root}=await setup(t),batch=fixture().batch,first=build();assert.equal((await stageBatch(root,batch)).replayed,false);assert.equal((await stageBatch(root,batch)).replayed,true);
  await writeRelease(root,first);assert.equal((await writeRelease(root,first)).replayed,true);
  const f=fixture();f.registry.entities[0].legal_name='Renamed fixture';const second=buildRelease({batches:[f.batch],registry:f.registry,sources:f.sources,review:f.review,fixtureMode:true});
  const expectedReleaseId=first.manifest.release_id;
  for(const failAt of ['after_files','before_pointer']){await assert.rejects(writeRelease(root,second,{expectedReleaseId,failAt}),/Injected failure/);assert.equal((await readCurrent(root)).manifest.release_id,expectedReleaseId);assert.ok((await readdir(path.join(root,'releases'))).every(name=>!name.startsWith('.tmp-')));}
  await writeRelease(root,second,{expectedReleaseId});await rollbackShadow(root,expectedReleaseId,{expectedReleaseId:second.manifest.release_id});assert.equal((await readCurrent(root)).manifest.release_id,expectedReleaseId);
});
