// Normalize NBIM's published holdings JSON into the public equity layer.
//   node scripts/import-nbim.mjs --raw /outside/repo/2026-06-30.json   (write)
//   node scripts/import-nbim.mjs --check                              (verify)
// The raw file stays outside the repository; its hash is pinned in the manifest.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {validateNbimEquities,NBIM_FIELDS} from '../src/nbim-data.js';
const root=new URL('../',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('data-foundation/nbim/manifest.json',root),'utf8'));
const output=new URL(manifest.output,root);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export function normalize(raw,manifest){
  const items=JSON.parse(raw).data;if(!Array.isArray(items))throw new Error('Unexpected NBIM payload');
  const byClass={};for(const item of items)byClass[item.at]=(byClass[item.at]||0)+1;
  if(JSON.stringify(byClass)!==JSON.stringify(manifest.rawCounts.byAssetClassCode))throw new Error('Asset-class counts differ from manifest: '+JSON.stringify(byClass));
  const rows=items.filter(item=>item.at===0).map(item=>{
    if(!item.eq||!item.a)throw new Error('Equity row without equity fields: '+item.id);
    return [item.id,item.n,item.cc,item.eq.icc??null,item.eq.s,item.eq.vid||null,item.a.e,item.a.n,item.o,item.eq.v];
  }).sort((a,b)=>b[6]-a[6]||a[0].localeCompare(b[0]));
  const coverage={equityRows:rows.length,excludedRows:{fixedIncome:byClass[1]||0,unlistedRealEstate:byClass[2]||0,renewableInfrastructure:byClass[3]||0},rowsWithoutListingCode:rows.filter(row=>row[5]===null).length};
  return validateNbimEquities({schemaVersion:1,datasetId:manifest.datasetId,asOf:manifest.asOf,retrievedAt:manifest.retrievedAt,source:manifest.source,coverage,fields:[...NBIM_FIELDS],rows});
}
const args=process.argv.slice(2),cli=import.meta.url===pathToFileURL(process.argv[1]||'').href;
if(!cli){}else if(args[0]==='--raw'&&args[1]){
  const raw=await readFile(args[1]);
  if(raw.length!==manifest.source.rawBytes||sha(raw)!==manifest.source.rawSha256)throw new Error('Raw NBIM file does not match the pinned hash and size');
  const text=JSON.stringify(normalize(raw.toString('utf8'),manifest))+'\n';
  await writeFile(output,text);console.log(`Wrote ${manifest.output}: sha256 ${sha(text)}`);
}else if(args[0]==='--check'){
  const bytes=await readFile(output),data=validateNbimEquities(JSON.parse(bytes));
  if(sha(bytes)!==manifest.outputSha256)throw new Error(`${manifest.output} hash differs from manifest outputSha256`);
  for(const key of ['datasetId','asOf','retrievedAt'])if(data[key]!==manifest[key])throw new Error('Manifest mismatch: '+key);
  if(JSON.stringify(data.source)!==JSON.stringify(manifest.source))throw new Error('Manifest mismatch: source');
  if(data.coverage.equityRows!==manifest.rawCounts.byAssetClassCode['0'])throw new Error('Equity row count differs from raw count');
  console.log(`NBIM equities valid: ${data.rows.length} published holdings as of ${data.asOf}.`);
}else{console.error('Usage: import-nbim.mjs --raw <path> | --check');process.exitCode=2;}
