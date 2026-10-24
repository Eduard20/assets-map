// Physical-asset lane only. Never joins securities, portfolio totals or issuer identity resolution.
const FSP='fsp-10k-2025',PFI='hmt-pfi-2025',WITHHELD='[street-address description withheld]';
// [label|null (street-address name withheld), locality, state, Schedule III Column E total ($ thousands), year built, year acquired, verbatim row figures]
const rows=[
  ['Park Ten','Houston','TX',31239,1999,2002,'$ 1,061 $ 21,303 $ 8,875 $ 565 $ 30,674 $ 31,239 $ 16,436 $ 14,803 5 - 39 1999 2002'],
  ['Addison','Addison','TX',67536,1999,2002,'4,325 48,040 15,171 4,325 63,211 67,536 33,818 33,718 5 - 39 1999 2002'],
  ['Greenwood','Englewood','CO',46845,2000,2005,'3,100 30,201 13,544 3,100 43,745 46,845 22,251 24,594 5 - 39 2000 2005'],
  ['Eldridge Green','Houston','TX',60114,1999,2004,'3,900 43,791 12,423 3,900 56,214 60,114 27,321 32,793 5 - 39 1999 2004'],
  ['Liberty Plaza','Addison','TX',39294,1985,2006,'4,374 21,146 13,774 4,280 35,014 39,294 16,923 22,371 5 - 39 1985 2006'],
  ['Park Ten II','Houston','TX',41956,2006,2006,'1,300 31,712 8,944 1,300 40,656 41,956 18,153 23,803 5 - 39 2006 2006'],
  [null,'Minneapolis','MN',49713,1974,2010,'4,444 15,214 30,055 4,444 45,269 49,713 18,456 31,257 5 - 39 1974 2010'],
  [null,'Minneapolis','MN',32502,1923,2010,'4,184 — 28,318 4,184 28,318 32,502 9,028 23,474 5 - 39 1923 2010'],
  ['Legacy Tennyson Center','Plano','TX',33258,2008,2011,'3,067 22,064 8,127 3,067 30,191 33,258 11,179 22,079 5 - 39 2008 2011'],
  ['Westchase I & II','Houston','TX',158347,2008,2012,'8,491 121,508 28,348 8,491 149,856 158,347 51,828 106,519 5 - 39 2008 2012'],
  [null,'Denver','CO',198523,1986,2013,'16,334 137,726 44,463 16,334 182,189 198,523 63,446 135,077 5 - 39 1986 2013'],
  [null,'Denver','CO',226286,2006,2013,'17,413 165,058 43,815 17,413 208,873 226,286 67,378 158,908 5 - 39 2006 2013'],
  ['Plaza Seven','Minneapolis','MN',76610,1987,2016,'6,604 54,240 15,766 6,604 70,006 76,610 21,110 55,500 5 - 39 1987 2016'],
  [null,'Denver','CO',139960,1982,2016,'20,876 99,941 19,143 20,876 119,084 139,960 31,134 108,826 5 - 39 1982 2016']
];
const n=i=>String(i+1).padStart(2,'0');
const metric=(id,type,amount,o)=>({id,type,amount,currency:'USD',date:'2025-12-31',scope:'whole_asset',shareBasis:'at_100_percent',sourceId:FSP,...o});
export const propertyPilot={
  schemaVersion:1,lane:'physical_asset',
  sources:[
    {id:FSP,title:'Franklin Street Properties Corp. Form 10-K, fiscal year 2025 — Schedule III, Real Estate and Accumulated Depreciation',publisher:'U.S. Securities and Exchange Commission (EDGAR)',url:'https://www.sec.gov/Archives/edgar/data/1031316/000110465926025284/fsp-20251231x10k.htm',landingUrl:'https://www.sec.gov/Archives/edgar/data/1031316/000110465926025284/0001104659-26-025284-index.htm',asOf:'2025-12-31',publishedAt:'2026-03-09',retrievedAt:'2026-10-24',reuse:'EDGAR public filing content is free to access and reuse (SEC webmaster FAQ).',reuseUrl:'https://www.sec.gov/about/webmaster-frequently-asked-questions',excerpt:'SCHEDULE III … December 31, 2025 … (in thousands) … Commercial Properties … Balance — Real Estate … $ 1,202,183 … (1) There are no encumbrances on the above properties. … (3) Original date of acquisition by Sponsored Entity. Item 2: All of the properties listed above are owned, directly or indirectly, by us.'},
    {id:PFI,title:'Current PFI and PF2 projects as at 31 March 2025 (PFI and PF2 projects: 2025 summary data)',publisher:'HM Treasury / National Infrastructure and Service Transformation Authority (GOV.UK)',url:'https://assets.publishing.service.gov.uk/media/69c14bc7d588c92c483e4ba3/Current-PFI-PF2-projects-as-at-31-March-2025-OFFICIAL.ods',landingUrl:'https://www.gov.uk/government/publications/pfi-and-pfi2-projects-2025-summary-data',asOf:'2025-03-31',publishedAt:'2026-03-26',retrievedAt:'2026-10-24',reuse:'Open Government Licence v3.0. Contains public sector information licensed under the Open Government Licence v3.0.',reuseUrl:'https://www.gov.uk/government/publications/pfi-and-pfi2-projects-2025-summary-data',excerpt:'Unique HMT Project ID 241 · Project Name: A249 Stockbury to Sheerness · Procuring Authority: NATIONAL HIGHWAYS · Region: ENGLAND South East · Project Status: In operation · Date of financial close: 01/02/2004 · Contract expiry date: 31/05/2034 · Capital Value (£m): £73.00 · SPV Name: Sheppey Route · Equity Holder (1): 3i Group PLC · Equity Holding (1): 0.5 · Equity Holder (2): HICL Infrastructure Company · Equity Holding (2): 0.5'}
  ],
  entities:[
    {id:'property-entity-fsp',name:'Franklin Street Properties Corp.',kind:'reit_issuer'},
    {id:'property-entity-national-highways',name:'National Highways',kind:'public_authority'},
    {id:'property-entity-sheppey-route',name:'Sheppey Route',kind:'spv'},
    {id:'property-entity-3i',name:'3i Group PLC',kind:'investor_company'},
    {id:'property-entity-hicl',name:'HICL Infrastructure Company',kind:'investor_company'}
  ],
  assets:rows.map(([label,locality,state,total,built,acquired,figures],i)=>({
    id:`property-asset-fsp-${n(i)}`,kind:'asset',assetKind:'building',label:label??`${locality}, ${state} commercial property (row ${i+1}; street-address name withheld)`,nameWithheld:label===null,propertyType:'commercial',
    location:{country:'US',subdivision:`US-${state}`,locality,precision:'locality',sourceText:`${locality}, ${state}`,sourceId:FSP},
    yearBuilt:built,yearAcquired:acquired,sourceId:FSP,locator:`Schedule III, Commercial Properties row ${i+1}`,excerpt:`${label??WITHHELD}, ${locality}, ${state} — ${figures}`,
    metrics:[
      metric(`property-metric-fsp-${n(i)}-cost`,'asset_value',total*1000,{basis:'cost',grossOrNet:'gross',reported:`$${total.toLocaleString('en-US')} thousand (Historical Cost, Total)`}),
      metric(`property-metric-fsp-${n(i)}-encumbrance`,'encumbrance',0,{basis:'source_reported',grossOrNet:'not_applicable',reported:'— (note 1: There are no encumbrances on the above properties.)'})
    ]
  })),
  projects:[
    {id:'property-project-a249',kind:'project',label:'A249 Stockbury to Sheerness',sector:'Roads and Highway Maintenance',status:'In operation',
      location:{country:'GB',subdivision:'GB-ENG',locality:null,precision:'subdivision',sourceText:'ENGLAND South East',sourceId:PFI},
      dates:{ojeu:'2002-03-01',preferredBidder:'2003-04-28',financialClose:'2004-02-01',firstOperations:'2006-07-01',constructionCompletion:'2007-01-01',contractExpiry:'2034-05-31'},
      sourceId:PFI,locator:'Sheet1, Unique HMT Project ID 241',
      metrics:[{id:'property-metric-a249-capital-value',type:'project_cost',amount:73000000,currency:'GBP',date:'2025-03-31',scope:'project_total',shareBasis:'at_100_percent',basis:'cost',costStage:'not_stated',grossOrNet:'not_applicable',reported:'£73.00 (Capital Value (£m))',sourceId:PFI}]}
  ],
  claims:[
    ...rows.map((_,i)=>({id:`property-claim-${n(i)}`,type:'asset_interest',from:'property-entity-fsp',to:`property-asset-fsp-${n(i)}`,scope:null,stake:{status:'unknown',percentage:null,denominator:null,basis:null,reason:'percentage_not_stated'},sourceId:FSP,locator:`Schedule III row ${i+1}; Item 2. Properties`,sourceLabel:'All of the properties listed above are owned, directly or indirectly, by us.',temporalKind:'snapshot',asOf:'2025-12-31',effectiveFrom:null,effectiveTo:null,endSemantics:'not_stated'})),
    {id:'property-claim-15',type:'procures_project',from:'property-entity-national-highways',to:'property-project-a249',scope:null,stake:{status:'not_applicable',percentage:null,denominator:null,basis:null,reason:'role_carries_no_stake'},sourceId:PFI,locator:'ID 241 · Procuring Authority; Date of financial close; Contract expiry date',sourceLabel:'Procuring Authority: NATIONAL HIGHWAYS (Procuring authority type: ALB)',temporalKind:'interval',asOf:'2025-03-31',effectiveFrom:'2004-02-01',effectiveTo:'2034-05-31',endSemantics:'source_contract_expiry_date'},
    {id:'property-claim-16',type:'concession_grant',from:'property-entity-national-highways',to:'property-entity-sheppey-route',scope:'property-project-a249',stake:{status:'not_applicable',percentage:null,denominator:null,basis:null,reason:'role_carries_no_stake'},sourceId:PFI,locator:'ID 241 · SPV Name; Date of financial close; Contract expiry date; Operational period of contract (years): 30',sourceLabel:'SPV Name: Sheppey Route (standard-terms PFI contract)',temporalKind:'interval',asOf:'2025-03-31',effectiveFrom:'2004-02-01',effectiveTo:'2034-05-31',endSemantics:'source_contract_expiry_date'},
    {id:'property-claim-17',type:'direct_equity_ownership',from:'property-entity-3i',to:'property-entity-sheppey-route',scope:'property-project-a249',stake:{status:'known',percentage:50,denominator:'SPV equity as returned by the department (Equity Holding (1): 0.5)',basis:'source_label',reason:null},sourceId:PFI,locator:'ID 241 · Equity Holder (1); Equity Holding (1)',sourceLabel:'Equity Holder (1): 3i Group PLC · Equity Holding (1): 0.5',temporalKind:'snapshot',asOf:'2025-03-31',effectiveFrom:null,effectiveTo:null,endSemantics:'not_stated'},
    {id:'property-claim-18',type:'direct_equity_ownership',from:'property-entity-hicl',to:'property-entity-sheppey-route',scope:'property-project-a249',stake:{status:'known',percentage:50,denominator:'SPV equity as returned by the department (Equity Holding (2): 0.5)',basis:'source_label',reason:null},sourceId:PFI,locator:'ID 241 · Equity Holder (2); Equity Holding (2)',sourceLabel:'Equity Holder (2): HICL Infrastructure Company · Equity Holding (2): 0.5',temporalKind:'snapshot',asOf:'2025-03-31',effectiveFrom:null,effectiveTo:null,endSemantics:'not_stated'}
  ],
  gaps:[
    {id:'property-gap-fsp-title',subject:'property-entity-fsp',field:'asset_title',status:'unknown',reason:'title_holder_not_stated',note:'Schedule III and Item 2 say the properties are owned "directly or indirectly"; the title-holding subsidiaries are not named, so no asset_title claim is recorded.'},
    {id:'property-gap-fsp-share',subject:'property-entity-fsp',field:'asset_interest_percentage',status:'unknown',reason:'percentage_not_stated',note:'No per-property percentage is stated. It is not set to 100%.'},
    {id:'property-gap-fsp-fair-value',subject:'property-entity-fsp',field:'asset_value (fair)',status:'unavailable',reason:'not_reported_in_schedule_iii',note:'Schedule III reports cost-based carrying amounts only; no market or fair value is inferred.'},
    {id:'property-gap-a249-title',subject:'property-project-a249',field:'asset_title',status:'unknown',reason:'title_holder_not_stated',note:'The PFI dataset does not say who holds title to the road, so 3i\'s and HICL\'s derived interest in the physical asset is unknown.'},
    {id:'property-gap-a249-lenders',subject:'property-entity-sheppey-route',field:'lends_to',status:'unknown',reason:'not_in_source',note:'Senior debt providers are not fields in the dataset; no lender is inferred.'},
    {id:'property-gap-a249-operator',subject:'property-project-a249',field:'operates_asset',status:'unknown',reason:'not_in_source',note:'The dataset names no operator. The SPV is not assumed to operate the road.'}
  ]
};
export const ROLE_LABELS={asset_title:'Legal title',asset_interest:'Asset interest',direct_equity_ownership:'Equity in SPV',manages_asset:'Asset manager',operates_asset:'Operator',lease_of:'Lease',concession_grant:'PFI / concession contract',procures_project:'Procuring authority',lends_to:'Lender',project_sponsor:'Project sponsor'};
export const METRIC_LABELS={project_cost:'Project cost',investment_commitment:'Investment commitment',contract_value:'Contract value',enterprise_value:'Enterprise value',asset_value:'Asset value',encumbrance:'Encumbrance',debt_amount:'Debt amount',disclosed_stake_value:'Disclosed stake value'};
const NON_OWNER=['manages_asset','operates_asset','lease_of','concession_grant','procures_project','lends_to'],OWNER=['asset_title','asset_interest','direct_equity_ownership','project_sponsor'];
const NOT_OWNED_VALUE=['project_cost','investment_commitment','contract_value'];
const ROLE_ENDS={asset_title:['entity','asset'],asset_interest:['entity','asset|project'],direct_equity_ownership:['entity','spv'],manages_asset:['entity','asset'],operates_asset:['entity','asset'],lease_of:['entity','entity'],concession_grant:['public_authority','spv'],procures_project:['public_authority','project'],lends_to:['entity','entity'],project_sponsor:['entity','project']};
const METRIC_SUBJECT={asset:['asset_value','encumbrance','enterprise_value','debt_amount'],project:['project_cost','investment_commitment','contract_value','enterprise_value','debt_amount']};
const HOSTS=['www.sec.gov','www.gov.uk','assets.publishing.service.gov.uk'];
// Publication ceiling = locality. Street addresses, postcodes, ZIP codes, title/parcel numbers and coordinates are rejected anywhere in the public data.
const FORBIDDEN_TEXT=[/\b\d{1,5}\s+(?:[A-Z0-9][\w.]*\s+){0,3}(?:street|st\.?|avenue|ave\.?|road|rd\.?|broadway|parkway|pkwy|freeway|place|boulevard|blvd|drive|lane|square|plaza)\b/i,/\b[A-Z]{1,2}\d[A-Z\d]?\s+\d[A-Z]{2}\b/,/\b(?:TX|CO|MN|CA|NY)\s+\d{5}\b/,/\btitle (?:number|no\.?)\s*[A-Z]{0,3}\d/i,/\bparcel (?:id|number)\b/i,/-?\d{1,3}\.\d{4,},\s*-?\d{1,3}\.\d{4,}/];
const keys=(row,allowed)=>{if(!row||typeof row!=='object'||Object.keys(row).sort().join('|')!==allowed.split(' ').sort().join('|'))throw new Error('Unexpected property fields');};
const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&new Date(v).toISOString().slice(0,10)===v;
const text=v=>typeof v==='string'&&v.trim().length>0;
const fail=m=>{throw new Error(m);};
function scan(value,path=''){
  if(typeof value==='string'){if(!/(?:^|\.)(?:url|landingUrl|reuseUrl)$/.test(path)&&FORBIDDEN_TEXT.some(r=>r.test(value)))fail(`Publication ceiling exceeded at ${path}`);}
  else if(value&&typeof value==='object')for(const [k,v] of Object.entries(value))scan(v,path?`${path}.${k}`:k);
}
function checkMetric(m,subject,sources){
  keys(m,m.type==='project_cost'?'id type amount currency date scope shareBasis basis costStage grossOrNet reported sourceId':'id type amount currency date scope shareBasis basis grossOrNet reported sourceId');
  if(!/^property-metric-[a-z0-9-]+$/.test(m.id)||!METRIC_SUBJECT[subject.kind]?.includes(m.type))fail('Metric type not allowed on this record kind');
  if(!Number.isInteger(m.amount)||m.amount<0||!/^[A-Z]{3}$/.test(m.currency)||!date(m.date)||!text(m.reported))fail('Invalid property metric value');
  if(!['whole_asset','holder_share','equity_tranche','debt_tranche','project_total','portfolio_total'].includes(m.scope)||!['at_100_percent','at_share','unknown'].includes(m.shareBasis)||!['gross','net','not_applicable','unknown'].includes(m.grossOrNet))fail('Invalid valuation scope');
  if(!['fair','appraised','book','cost','assessed_for_tax','source_reported'].includes(m.basis))fail('Invalid valuation basis');
  if(m.type==='project_cost'&&!['estimated','at_financial_close','outturn','not_stated'].includes(m.costStage))fail('Invalid cost stage');
  if(m.type==='asset_value'&&m.basis==='cost'&&/market|fair/i.test(m.reported))fail('Cost basis presented as market value');
  const source=sources.get(m.sourceId);if(!source||m.date!==source.asOf)fail('Metric date must be the source as-of date');
}
function checkLocation(l,sources){
  keys(l,'country subdivision locality precision sourceText sourceId');
  if(!/^[A-Z]{2}$/.test(l.country)||(l.subdivision!==null&&!new RegExp(`^${l.country}-[A-Z0-9]{1,3}$`).test(l.subdivision))||!['country','subdivision','locality'].includes(l.precision))fail('Invalid or over-precise location');
  if((l.precision==='locality')!==(l.locality!==null)||!text(l.sourceText)||!sources.has(l.sourceId)||(l.locality&&!l.sourceText.includes(l.locality)))fail('Location needs its own source text');
}
export function validatePropertyPilot(data){
  keys(data,'schemaVersion lane sources entities assets projects claims gaps');
  if(data.schemaVersion!==1||data.lane!=='physical_asset'||!['sources','entities','assets','projects','claims','gaps'].every(k=>Array.isArray(data[k])))fail('Invalid property schema');
  const sources=new Map(),records=new Map(),ids=new Set(),pairs=new Set();
  const unique=id=>{if(ids.has(id))fail('Duplicate property id');ids.add(id);};
  for(const s of data.sources){
    keys(s,'id title publisher url landingUrl asOf publishedAt retrievedAt reuse reuseUrl excerpt');unique(s.id);
    for(const u of [s.url,s.landingUrl,s.reuseUrl]){const url=new URL(u);if(url.protocol!=='https:'||url.username||url.password||!HOSTS.includes(url.hostname))fail('Invalid property source host');}
    if(!['title','publisher','reuse','excerpt'].every(k=>text(s[k]))||![s.asOf,s.publishedAt,s.retrievedAt].every(date)||s.asOf>s.publishedAt||s.publishedAt>s.retrievedAt)fail('Invalid property source');
    sources.set(s.id,s);
  }
  for(const e of data.entities){keys(e,'id name kind');unique(e.id);if(!/^property-entity-[a-z0-9-]+$/.test(e.id)||!text(e.name)||!['reit_issuer','public_authority','spv','investor_company'].includes(e.kind))fail('Invalid property entity');records.set(e.id,e);}
  for(const a of data.assets){
    keys(a,'id kind assetKind label nameWithheld propertyType location yearBuilt yearAcquired sourceId locator excerpt metrics');unique(a.id);
    if(!/^property-asset-[a-z0-9-]+$/.test(a.id)||a.kind!=='asset'||!['building','land_parcel_group','estate','power_plant','generator_unit','transmission_line','pipeline','road','port','airport','water_works','telecom_network','other'].includes(a.assetKind)||!text(a.label)||typeof a.nameWithheld!=='boolean'||a.propertyType!=='commercial'||!sources.has(a.sourceId)||!text(a.locator)||!text(a.excerpt))fail('Invalid property asset');
    if(![a.yearBuilt,a.yearAcquired].every(y=>Number.isInteger(y)&&y>1800&&y<=Number(sources.get(a.sourceId).asOf.slice(0,4))))fail('Invalid asset year');
    checkLocation(a.location,sources);if(!Array.isArray(a.metrics)||!a.metrics.length)fail('Asset needs metrics');for(const m of a.metrics){unique(m.id);checkMetric(m,a,sources);}records.set(a.id,a);
  }
  for(const p of data.projects){
    keys(p,'id kind label sector status location dates sourceId locator metrics');unique(p.id);
    if(!/^property-project-[a-z0-9-]+$/.test(p.id)||p.kind!=='project'||!text(p.label)||!text(p.sector)||/housing|residential/i.test(p.sector)||!text(p.status)||!sources.has(p.sourceId)||!text(p.locator))fail('Invalid property project');
    keys(p.dates,'ojeu preferredBidder financialClose firstOperations constructionCompletion contractExpiry');if(!Object.values(p.dates).every(date)||p.dates.financialClose>p.dates.contractExpiry)fail('Invalid project dates');
    checkLocation(p.location,sources);for(const m of p.metrics){unique(m.id);checkMetric(m,p,sources);}records.set(p.id,p);
  }
  if(data.claims.length>30||[...data.assets,...data.projects].flatMap(r=>r.metrics).length>30)fail('Bounded pilot cap exceeded');
  const kindOf=r=>r?.kind==='asset'||r?.kind==='project'?r.kind:r?.kind==='spv'?'spv':r?.kind==='public_authority'?'public_authority':r?'entity':null;
  const matches=(r,want)=>want.split('|').some(w=>w===kindOf(r)||(w==='entity'&&r&&!['asset','project'].includes(r.kind)));
  for(const c of data.claims){
    keys(c,'id type from to scope stake sourceId locator sourceLabel temporalKind asOf effectiveFrom effectiveTo endSemantics');unique(c.id);keys(c.stake,'status percentage denominator basis reason');
    const ends=ROLE_ENDS[c.type];if(!/^property-claim-\d+$/.test(c.id)||!ends||!matches(records.get(c.from),ends[0])||!matches(records.get(c.to),ends[1])||(c.scope!==null&&!['asset','project'].includes(records.get(c.scope)?.kind)))fail('Invalid property role endpoints');
    const s=c.stake;
    if(NON_OWNER.includes(c.type)&&(s.status!=='not_applicable'||s.percentage!==null||s.denominator!==null||s.basis!==null))fail('Non-owner role cannot carry an ownership percentage');
    if(OWNER.includes(c.type)){
      if(s.status==='known'&&!(typeof s.percentage==='number'&&s.percentage>0&&s.percentage<=100&&text(s.denominator)&&['economic','equity_in_owner','joint_venture_share','undivided_interest','source_label'].includes(s.basis)&&s.reason===null))fail('Known stake needs percentage, denominator and basis');
      if(s.status==='unknown'&&!(s.percentage===null&&s.denominator===null&&s.basis===null&&text(s.reason)))fail('Unknown stake stays null with a reason');
      if(!['known','unknown'].includes(s.status))fail('Owner role stake must be known or unknown');
    }
    const source=sources.get(c.sourceId);if(!source||!text(c.locator)||!text(c.sourceLabel)||c.asOf!==source.asOf||!['snapshot','interval'].includes(c.temporalKind))fail('Invalid property claim evidence');
    if(c.temporalKind==='interval'?!(date(c.effectiveFrom)&&date(c.effectiveTo)&&c.effectiveFrom<c.effectiveTo&&text(c.endSemantics)&&c.endSemantics!=='not_stated'):(c.effectiveFrom!==null||c.effectiveTo!==null))fail('Contract or concession needs a dated term');
    if(['concession_grant','lease_of'].includes(c.type)&&c.temporalKind!=='interval')fail('Contract or concession needs a dated term');
    const pair=`${c.type}|${c.from}|${c.to}|${c.scope}`;if(pairs.has(pair))fail('Duplicate property claim');pairs.add(pair);
  }
  for(const g of data.gaps){keys(g,'id subject field status reason note');unique(g.id);if(!records.has(g.subject)||!['unknown','unavailable'].includes(g.status)||!text(g.field)||!text(g.reason)||!text(g.note))fail('Invalid property gap');}
  scan(data);
  return data;
}
// Two-lane rule: a universe declares one lane; the security lane (share/unit positions) is never summed with buildings or projects.
export function assertSingleLane(items){const lanes=new Set(items.map(i=>i.lane));if(lanes.size!==1||![...lanes].every(l=>['security','physical_asset'].includes(l)))throw new Error('Exposure lanes cannot be mixed');return [...lanes][0];}
// Owned-value aggregate over metrics attached to assets: one lane, metric type, currency, date and basis. Project cost / contract value never count as owned value.
export function physicalAssetTotal(data,{metricType,assetIds,lane='physical_asset'}){
  validatePropertyPilot(data);assertSingleLane([{lane:data.lane},{lane}]);if(lane!=='physical_asset')fail('Exposure lanes cannot be mixed');
  if(NOT_OWNED_VALUE.includes(metricType))fail(`${metricType} is not an owned value`);
  const records=new Map([...data.assets,...data.projects].map(r=>[r.id,r]));
  const metrics=assetIds.map(id=>{const r=records.get(id);if(!r)fail('Unknown asset');const m=r.metrics.filter(x=>x.type===metricType);if(m.length!==1)fail('Metric missing');return m[0];});
  for(const k of ['currency','date','basis','scope','shareBasis'])if(new Set(metrics.map(m=>m[k])).size!==1)fail(`Cannot aggregate across ${k}`);
  if(new Set(assetIds).size!==assetIds.length)fail('Duplicate asset in aggregate');
  return {amount:metrics.reduce((t,m)=>t+m.amount,0),currency:metrics[0].currency,date:metrics[0].date,basis:metrics[0].basis,count:metrics.length};
}
// Look-through is never multiplied in this pilot: any undisclosed link keeps the derived share unknown.
export function lookThrough(links){
  if(!links.length)fail('Empty chain');
  const missing=links.find(l=>l.stake.status!=='known');
  if(missing)return {status:'unknown',percentage:null,reason:'intermediate_stake_not_disclosed'};
  return {status:'unknown',percentage:null,reason:'look_through_formula_not_approved'};
}
validatePropertyPilot(propertyPilot);
