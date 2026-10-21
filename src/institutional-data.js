// Institutional labels are NOT security identifiers or portfolio issuer joins.
export const institutionalPilot = {
  schemaVersion: 1,
  entities: [
    {id:'institution-cfr',name:'Council on Foreign Relations',kind:'think_tank'},
    {id:'institution-chatham',name:'Chatham House',kind:'think_tank'},
    {id:'institution-microsoft',name:'Microsoft Corporation',kind:'organization'},
    {id:'institution-nvidia',name:'NVIDIA',kind:'organization'},
    {id:'institution-apple',name:'Apple',kind:'organization'}
  ],
  sources: [
    {id:'cfr-roster',title:'CFR corporate member roster',url:'https://www.cfr.org/membership/corporate-members',asOf:'2026-09-03',retrievedAt:'2026-10-21',excerpt:'Bronze; Microsoft Corporation; NVIDIA'},
    {id:'chatham-roster',title:'Chatham House corporate membership roster',url:'https://www.chathamhouse.org/members-and-partners/corporate-membership',asOf:null,retrievedAt:'2026-10-21',excerpt:'Partners; Apple; Major corporate members; NVIDIA'}
  ],
  relationships: [
    {id:'institution-edge-1',from:'institution-microsoft',to:'institution-cfr',type:'corporate_member',category:'Bronze',sourceId:'cfr-roster',validFrom:null,validTo:null},
    {id:'institution-edge-2',from:'institution-nvidia',to:'institution-cfr',type:'corporate_member',category:'Bronze',sourceId:'cfr-roster',validFrom:null,validTo:null},
    {id:'institution-edge-3',from:'institution-apple',to:'institution-chatham',type:'listed_partner',category:'Partners',sourceId:'chatham-roster',validFrom:null,validTo:null},
    {id:'institution-edge-4',from:'institution-nvidia',to:'institution-chatham',type:'corporate_member',category:'Major corporate members',sourceId:'chatham-roster',validFrom:null,validTo:null}
  ]
};
const keys=(row,allowed)=>{if(!row||Object.keys(row).sort().join('|')!==allowed.split(' ').sort().join('|'))throw new Error('Unexpected institutional fields');};
const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&new Date(v).toISOString().slice(0,10)===v;
export function validateInstitutionalPilot(data){
  keys(data,'schemaVersion entities sources relationships');
  if(data.schemaVersion!==1||!Array.isArray(data.entities)||!Array.isArray(data.sources)||!Array.isArray(data.relationships))throw new Error('Invalid institutional schema');
  const entities=new Map(),sources=new Map(),edges=new Set(),pairs=new Set();
  for(const e of data.entities){keys(e,'id name kind');if(!/^institution-[a-z]+$/.test(e.id)||entities.has(e.id)||!e.name?.trim()||!['think_tank','organization'].includes(e.kind))throw new Error('Invalid institutional entity');entities.set(e.id,e);}
  for(const s of data.sources){keys(s,'id title url asOf retrievedAt excerpt');const url=new URL(s.url);if(sources.has(s.id)||!s.id||!s.title||!s.excerpt||url.protocol!=='https:'||url.username||url.password||!['www.cfr.org','www.chathamhouse.org'].includes(url.hostname)||!date(s.retrievedAt)||(s.asOf!==null&&(!date(s.asOf)||s.asOf>s.retrievedAt)))throw new Error('Invalid institutional source');sources.set(s.id,s);}
  for(const e of data.relationships){keys(e,'id from to type category sourceId validFrom validTo');const pair=`${e.from}|${e.to}|${e.type}`;if(!/^institution-edge-\d+$/.test(e.id)||edges.has(e.id)||pairs.has(pair)||entities.get(e.from)?.kind!=='organization'||entities.get(e.to)?.kind!=='think_tank'||!['corporate_member','listed_partner'].includes(e.type)||!e.category?.trim()||!sources.has(e.sourceId)||e.validFrom!==null||e.validTo!==null)throw new Error('Invalid institutional relationship');edges.add(e.id);pairs.add(pair);}
  return data;
}
validateInstitutionalPilot(institutionalPilot);
