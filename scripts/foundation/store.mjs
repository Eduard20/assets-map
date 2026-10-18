import {mkdir,readFile,writeFile,rename,rm,access,mkdtemp} from 'node:fs/promises';
import {realpathSync,existsSync,lstatSync} from 'node:fs';
import path from 'node:path';
import {hash,pretty,canonicalJSON,idFor,GENERATOR_VERSION} from './core.mjs';
const repoRoot=realpathSync(new URL('../../',import.meta.url).pathname);
function safeStore(root) {
  root=path.resolve(root);
  // Resolve the nearest existing ancestor before applying the public-path ban.
  let ancestor=root;while(!existsSync(ancestor))ancestor=path.dirname(ancestor);
  root=path.join(realpathSync(ancestor),path.relative(ancestor,root));
  for(const publicDir of ['data','src','vendor','_site']) {
    const p=path.join(repoRoot,publicDir);if(root===p||root.startsWith(p+path.sep))throw new Error('Canonical/staging store cannot be a public application path');
  }
  return root;
}
const exists=async p=>{try{await access(p);return true;}catch{return false;}};
async function locked(root,fn) {
  root=safeStore(root);await mkdir(root,{recursive:true});const lock=path.join(root,'.validator.lock');
  try{await mkdir(lock);}catch{throw new Error('Another validator holds the store lock; inspect before retrying');}
  try{return await fn(root);}finally{await rm(lock,{recursive:true,force:true});}
}
const collections=['documents','evidence','observations','denominators','coverage','claim_families','claim_revisions','active_claim_revision_ids','batch_receipts','gaps'];
function artifacts(release) {
  if(canonicalJSON(Object.keys(release.canonical).sort())!==canonicalJSON([...collections].sort()))throw new Error('Invalid canonical collection set');
  const contents={'release.json':pretty(release),'manifest.json':pretty(release.manifest),'validation.json':pretty(release.validation),'shadow-graph.json':pretty(release.projection),'registry.json':pretty(release.registry),'sources.json':pretty(release.sources),'review.json':pretty(release.review)};
  for(const name of collections){const rows=release.canonical[name];if(!Array.isArray(rows))throw new Error('Invalid canonical collection');contents[`${name}.jsonl`]=rows.map(r=>canonicalJSON(r)).join('\n')+(rows.length?'\n':'');}
  return contents;
}
export async function stageBatch(root,batch) {
  return locked(root,async root=>{
    if(!/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(batch.manifest.batch_id))throw new Error('Unsafe batch ID');
    const dir=path.join(root,'staging',batch.manifest.batch_id),file=path.join(dir,'batch.json');
    if(await exists(file)) {if(hash(JSON.parse(await readFile(file,'utf8')))!==hash(batch))throw new Error('Staged batch ID already has different content');return {file,replayed:true};}
    await mkdir(dir,{recursive:true});await writeFile(file,pretty(batch),{flag:'wx'});return {file,replayed:false};
  });
}
export async function readCurrent(root) {
  root=safeStore(root);const pointer=path.join(root,'shadow-current.json');if(!await exists(pointer))return null;
  const current=JSON.parse(await readFile(pointer,'utf8'));return readRelease(root,current.release_id);
}
export async function readRelease(root,releaseId) {
  root=safeStore(root);if(!/^release_[a-f0-9]{24}$/.test(releaseId))throw new Error('Invalid release ID');
  const dir=path.join(root,'releases',releaseId),integrity=JSON.parse(await readFile(path.join(dir,'integrity.json'),'utf8'));
  const release=JSON.parse(await readFile(path.join(dir,'release.json'),'utf8')),expectedFiles=artifacts(release);
  if(canonicalJSON(Object.keys(integrity.files??{}).sort())!==canonicalJSON(Object.keys(expectedFiles).sort()))throw new Error('Release integrity failure: incomplete artifact set');
  for(const [file,expectedContent] of Object.entries(expectedFiles)) {
    if(lstatSync(path.join(dir,file)).isSymbolicLink())throw new Error('Release artifact must not be a symlink');
    const content=await readFile(path.join(dir,file),'utf8');
    if(hash(content)!==integrity.files[file]||content!==expectedContent)throw new Error(`Release integrity failure: ${file}`);
  }
  const basis={canonical:release.canonical,registry:release.registry,sources:release.sources,review:release.review,validation:release.validation,generator_version:release.manifest.generator_version,fixture_mode:release.manifest.fixture_mode};
  if(release.manifest.release_id!==releaseId||idFor('release',basis)!==releaseId||hash(release.canonical)!==release.manifest.canonical_sha256||hash(release.registry)!==release.manifest.registry_sha256||hash(release.sources)!==release.manifest.sources_sha256)throw new Error('Release identity/hash mismatch');
  return release;
}
async function replacePointer(root,value) {
  const temp=await mkdtemp(path.join(root,'.pointer-'));
  try{const file=path.join(temp,'current.json');await writeFile(file,pretty(value),{flag:'wx'});await rename(file,path.join(root,'shadow-current.json'));}
  finally{await rm(temp,{recursive:true,force:true});}
}
export async function writeRelease(root,release,{expectedReleaseId=null,failAt=null}={}) {
  return locked(root,async root=>{
    const current=await readCurrent(root),id=release.manifest.release_id;
    if(current?.manifest.release_id===id)return {release_id:id,replayed:true};
    if((current?.manifest.release_id??null)!==expectedReleaseId)throw new Error('Store changed: stale expected release');
    const releaseRoot=path.join(root,'releases');await mkdir(releaseRoot,{recursive:true});
    const final=path.join(releaseRoot,id),temp=await mkdtemp(path.join(releaseRoot,`.tmp-${id}-`));
    const contents=artifacts(release);
    try {
      if(await exists(final)) {const old=await readRelease(root,id);if(canonicalJSON(old)!==canonicalJSON(release))throw new Error('Immutable release collision');}
      else {
        for(const [file,content] of Object.entries(contents))await writeFile(path.join(temp,file),content,{flag:'wx'});
        await writeFile(path.join(temp,'integrity.json'),pretty({files:Object.fromEntries(Object.entries(contents).map(([file,text])=>[file,hash(text)]))}),{flag:'wx'});
        if(failAt==='after_files')throw new Error('Injected failure after files');
        await rename(temp,final);
      }
      await readRelease(root,id);
      if(failAt==='before_pointer')throw new Error('Injected failure before pointer');
      await replacePointer(root,{release_id:id,publication_status:release.manifest.publication_status});
      return {release_id:id,replayed:false};
    } finally {await rm(temp,{recursive:true,force:true});}
  });
}
export async function rollbackShadow(root,releaseId,{expectedReleaseId}={}) {
  return locked(root,async root=>{
    const current=await readCurrent(root);if(current?.manifest.release_id!==expectedReleaseId)throw new Error('Stale rollback base');
    const target=await readRelease(root,releaseId);
    await replacePointer(root,{release_id:releaseId,publication_status:target.manifest.publication_status,rollback_from:expectedReleaseId});
    return target;
  });
}
