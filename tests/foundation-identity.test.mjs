import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fixture} from '../data-foundation/fixtures/synthetic.mjs';
import {validateRegistry} from '../scripts/foundation/core.mjs';

const validate = registry => validateRegistry(registry,{fixtureMode:true});
const intervalRows = {
  alias(registry) {
    const alias={name:'Previous legal name',valid_from:null,valid_to:null};
    registry.entities[0].aliases.push(alias);
    return alias;
  },
  listing: registry => registry.listings[0],
  perimeter: registry => registry.perimeters[0],
};
for(const [kind,rowFor] of Object.entries(intervalRows)) {
  test(`${kind} validity rejects malformed calendar dates at either boundary`,()=>{
    for(const field of ['valid_from','valid_to']) for(const invalid of ['', '2025-2-01','2025-02-29','2024-02-30','2025-13-01','2025-01-00','not-a-date','2025-01-01T00:00:00Z']) {
      const {registry}=fixture();rowFor(registry)[field]=invalid;
      assert.throws(()=>validate(registry),/invalid date/,`${field}: ${invalid}`);
    }
  });
  test(`${kind} validity rejects reversed intervals`,()=>{
    const {registry}=fixture(),row=rowFor(registry);
    row.valid_from='2025-07-01';row.valid_to='2025-06-30';
    assert.throws(()=>validate(registry),new RegExp(`Invalid ${kind} interval`));
  });
  test(`${kind} validity preserves null boundaries, same-day intervals and leap days`,()=>{
    for(const [from,to] of [[null,null],[null,'2024-02-29'],['2024-02-29',null],['2024-02-29','2024-02-29'],['2024-02-29','2025-06-30']]) {
      const {registry}=fixture(),row=rowFor(registry);
      row.valid_from=from;row.valid_to=to;
      assert.doesNotThrow(()=>validate(registry));
    }
  });
}
function transitionRegistry() {
  // Replace only fixture URL schemes to exercise production-mode URL policy.
  const registry=JSON.parse(JSON.stringify(fixture().registry).replaceAll('synthetic://','https://'));
  registry.scope_transitions.push({
    transition_id:'transition_001',from_perimeter_id:'per_001',from_version:'1',
    to_perimeter_id:'per_004',to_version:'1',effective_date:'2025-06-30',
    reconciliation_status:'unreconciled',description:'Synthetic scope transition',
    evidence_urls:['https://example.org/transition'],review:{...registry.entities[0].review},
  });
  return registry;
}
test('scope transitions validate every evidence URL and require evidence',()=>{
  for(const urls of [[],['http://example.org/transition'],['javascript:alert(1)'],['not-a-url'],['https://example.org/transition','http://example.org/other']]) {
    const registry=transitionRegistry();registry.scope_transitions[0].evidence_urls=urls;
    assert.throws(()=>validateRegistry(registry),/Invalid scope transition transition_001/);
  }
  assert.doesNotThrow(()=>validateRegistry(transitionRegistry()));
});
test('scope transition synthetic evidence is allowed only in fixture mode',()=>{
  const registry=transitionRegistry();registry.scope_transitions[0].evidence_urls=['synthetic://fixtures/transition'];
  assert.throws(()=>validateRegistry(registry),/Invalid scope transition transition_001/);
  assert.doesNotThrow(()=>validate(registry));
});
test('scope transition perimeter-version checks remain enforced',()=>{
  for(const field of ['from_perimeter_id','from_version','to_perimeter_id','to_version']) {
    const registry=transitionRegistry();registry.scope_transitions[0][field]='unknown';
    assert.throws(()=>validateRegistry(registry),/Invalid scope transition transition_001/);
  }
});
test('existing pilot and researched registries remain valid',()=>{
  for(const name of ['pilot','researched']) {
    const registry=JSON.parse(readFileSync(new URL(`../data-foundation/${name}/input/registry.json`,import.meta.url),'utf8'));
    assert.doesNotThrow(()=>validateRegistry(registry));
  }
});
