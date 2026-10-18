import {fixture} from '../data-foundation/fixtures/synthetic.mjs';
import {buildRelease} from './foundation/core.mjs';
import {stageBatch,writeRelease,readCurrent} from './foundation/store.mjs';
const f=fixture(),root='data-foundation/.local/synthetic-demo';
const release=buildRelease({batches:[f.batch],registry:f.registry,sources:f.sources,review:f.review,fixtureMode:true});
await stageBatch(root,f.batch);const current=await readCurrent(root);await writeRelease(root,release,{expectedReleaseId:current?.manifest.release_id??null});
console.log(`Synthetic demo only: ${release.manifest.release_id}; ${release.validation.counts.active_claims} accepted fictional claim; publication held.\nInspect ${root}/releases/${release.manifest.release_id}/shadow-graph.json`);
