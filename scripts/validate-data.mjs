import {readFile} from 'node:fs/promises';
import {validateGraph} from '../src/graph-model.js';
const data=JSON.parse(await readFile(new URL('../data/graph.json',import.meta.url),'utf8'));
const errors=validateGraph(data);if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}else console.log(`Data valid: ${data.nodes.length} entities, ${data.edges.length} connections, ${data.sources.length} sources.`);
