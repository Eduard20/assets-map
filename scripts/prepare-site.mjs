import {copyFile,mkdir,readFile,readdir,rm,writeFile,stat,lstat,realpath} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export const PUBLIC_FILES=Object.freeze([
  'index.html','style.css','icon.svg','data/graph.json','data/researched.json','data/portfolios.json','data/instrument-equivalence.json','data/berkshire-2026-06-30.json','data/blackrock-2026-06-30.json','data/statestreet-2026-06-30.json','data/vanguardglobaladvisers-2026-06-30.json','data/geode-2026-06-30.json','data/jpmorgan-2026-06-30.json','data/morganstanley-2026-06-30.json','data/goldmansachs-2026-06-30.json','data/norgesbank-2026-06-30.json',
  'src/institutional.css','src/institutional-data.js','src/institutional-view.js','src/app.js','src/research-view.js','src/portfolio-view.js','src/portfolio-network.js','src/shared-network-layout.js','src/graph-model.js','src/graph-2d.js','src/graph-3d.js','src/bubble-layout.js',
  'vendor/three.module.min.js','vendor/three.core.min.js','vendor/OrbitControls.js','vendor/THREE-LICENSE.txt'
]);
export async function prepareSite(destination,root=fileURLToPath(new URL('../',import.meta.url))) {
  destination=path.resolve(destination);root=path.resolve(root);
  if(destination===root||root.startsWith(destination+path.sep))throw new Error('Unsafe site destination');
  await mkdir(destination,{recursive:true});
  // Refuse a nonempty output instead of recursively erasing an arbitrary user path.
  if((await readdir(destination)).length)throw new Error('Site output must be empty');
  for(const file of PUBLIC_FILES) {const source=path.join(root,file);let part=root;for(const segment of file.split('/')){part=path.join(part,segment);if((await lstat(part)).isSymbolicLink())throw new Error(`Public input cannot traverse symlink: ${file}`);}if(!(await lstat(source)).isFile())throw new Error(`Public input is not a file: ${file}`);await mkdir(path.dirname(path.join(destination,file)),{recursive:true});await copyFile(source,path.join(destination,file));}
  await writeFile(path.join(destination,'.nojekyll'),'');
  return [...PUBLIC_FILES,'.nojekyll'].sort();
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  prepareSite(process.argv[2]??'_site').then(files=>console.log(`Prepared ${files.length} explicitly allowed public files.`)).catch(error=>{console.error(error.message);process.exitCode=1;});
}
