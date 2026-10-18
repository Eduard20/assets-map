import {readFile,writeFile} from 'node:fs/promises';
import {buildRelease,pretty} from './foundation/core.mjs';
import {stageBatch,writeRelease,readCurrent,rollbackShadow} from './foundation/store.mjs';
const [command,...argv]=process.argv.slice(2),args={};
for(let i=0;i<argv.length;i++) {const key=argv[i];if(!key.startsWith('--')||!argv[i+1])throw new Error(`Invalid argument ${key}`);(args[key.slice(2)]??=[]).push(argv[++i]);}
const one=k=>args[k]?.[0],read=async file=>JSON.parse(await readFile(file,'utf8'));
try {
  if(command==='validate') {
    for(const k of ['registry','sources','review','batch'])if(!args[k])throw new Error(`Missing --${k}`);
    const store=one('store'),base=store?await readCurrent(store):null;
    const batches=await Promise.all(args.batch.map(read));
    const release=buildRelease({batches,registry:await read(one('registry')),sources:await read(one('sources')),review:await read(one('review')),base});
    if(store) {for(const batch of batches)await stageBatch(store,batch);await writeRelease(store,release,{expectedReleaseId:base?.manifest.release_id??null});}
    if(one('report'))await writeFile(one('report'),pretty(release.validation));
    console.log(pretty({release_id:release.manifest.release_id,publication_status:release.manifest.publication_status,...release.validation.counts,store:store??null}));
    if(release.validation.counts.quarantined)process.exitCode=2;
  } else if(command==='rollback-shadow') {
    if(!one('store')||!one('release')||!one('expected'))throw new Error('Supply --store, --release and --expected');
    const result=await rollbackShadow(one('store'),one('release'),{expectedReleaseId:one('expected')});console.log(`Shadow pointer restored: ${result.manifest.release_id}`);
  } else throw new Error('Usage: foundation.mjs validate --registry FILE --sources FILE --review FILE --batch FILE [--batch FILE] [--store DIR] [--report FILE]\n       foundation.mjs rollback-shadow --store DIR --release ID --expected ID');
} catch(error) {console.error(error.message);process.exitCode=1;}
