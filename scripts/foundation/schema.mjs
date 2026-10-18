import {readFileSync} from 'node:fs';
const cache = new Map();
export function schema(name) {
  if (!cache.has(name)) {const definition=JSON.parse(readFileSync(new URL(`../../data-foundation/schemas/${name}-v1.schema.json`, import.meta.url), 'utf8'));validateDefinition(definition);cache.set(name,definition);}
  return cache.get(name);
}
const isType = (v,t) => t === 'null' ? v === null : t === 'array' ? Array.isArray(v) : t === 'object' ? v !== null && typeof v === 'object' && !Array.isArray(v) : t === 'integer' ? Number.isSafeInteger(v) : typeof v === t;
// Deliberately small, fail-closed JSON Schema evaluator for the checked-in vocabulary.
// Unknown keywords fail at schema-load time instead of silently weakening validation.
const keywords = new Set(['$schema','$id','title','type','const','enum','minLength','pattern','format','minimum','maximum','items','properties','required','additionalProperties']);
function validateDefinition(definition) {
  for(const k of Object.keys(definition))if(!keywords.has(k))throw new Error(`Unsupported schema keyword: ${k}`);
  for(const child of Object.values(definition.properties??{}))validateDefinition(child);
  if(definition.items)validateDefinition(definition.items);
}
export function validateSchema(value, definition, path = '$', errors = []) {
  for (const k of Object.keys(definition)) if (!keywords.has(k)) throw new Error(`Unsupported schema keyword: ${k}`);
  const types = Array.isArray(definition.type) ? definition.type : [definition.type];
  if (definition.type && !types.some(t => isType(value,t))) { errors.push(`${path}: expected ${types.join('|')}`); return errors; }
  if ('const' in definition && value !== definition.const) errors.push(`${path}: invalid constant`);
  if (definition.enum && !definition.enum.includes(value)) errors.push(`${path}: invalid enum value`);
  if (typeof value === 'string') {
    if (definition.minLength && value.length < definition.minLength) errors.push(`${path}: empty string`);
    if (definition.pattern && !new RegExp(definition.pattern).test(value)) errors.push(`${path}: invalid pattern`);
    if (definition.format === 'date' && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0,10) !== value)) errors.push(`${path}: invalid date`);
    if (definition.format === 'date-time' && (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(value) || !Number.isFinite(Date.parse(value)))) errors.push(`${path}: expected UTC timestamp`);
  }
  if (typeof value === 'number') {
    if (definition.minimum !== undefined && value < definition.minimum) errors.push(`${path}: below minimum`);
    if (definition.maximum !== undefined && value > definition.maximum) errors.push(`${path}: above maximum`);
  }
  if (Array.isArray(value) && definition.items) value.forEach((v,i) => validateSchema(v,definition.items,`${path}[${i}]`,errors));
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const k of definition.required ?? []) if (!Object.hasOwn(value,k)) errors.push(`${path}.${k}: required`);
    for (const [k,v] of Object.entries(value)) {
      if (definition.properties && Object.hasOwn(definition.properties,k)) validateSchema(v,definition.properties[k],`${path}.${k}`,errors);
      else if (definition.additionalProperties === false) errors.push(`${path}.${k}: additional property`);
    }
  }
  return errors;
}
export function assertSchema(value,name) {
  const errors = validateSchema(value,schema(name));
  if (errors.length) throw new Error(`Invalid ${name}:\n${errors.join('\n')}`);
}
