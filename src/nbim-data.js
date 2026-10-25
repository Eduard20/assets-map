// NBIM (Government Pension Fund Global) published equity holdings, kept as a
// separate layer. Rows never join 13F instruments, issuers or portfolio totals.
export const NBIM_FIELDS=Object.freeze(['id','name','country','incorporation','sector','code','usd','nok','ownershipPct','votingPct']);
export const NBIM_SECTORS=Object.freeze(['Basic Materials','Consumer Discretionary','Consumer Staples','Energy','Financials','Health Care','Industrials','Real Estate','Technology','Telecommunications','Utilities']);
export const NBIM_DATA_PATH='../data/nbim-equities-2026-06-30.json';
// Published to at most two decimals; compare in hundredths to avoid float noise.
const percent=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=100&&Math.abs(Math.round(v*100)-v*100)<1e-6;
const amount=v=>Number.isSafeInteger(v)&&v>0;
const code2=v=>typeof v==='string'&&/^[A-Z]{2}$/.test(v);
export function validateNbimEquities(data){
  const fail=message=>{throw new Error(`Invalid NBIM equities: ${message}`);};
  if(!data||data.schemaVersion!==1)fail('schema version');
  if(data.datasetId!=='nbim-gpfg-equities-2026-06-30'||data.asOf!=='2026-06-30'||!/^\d{4}-\d{2}-\d{2}$/.test(data.retrievedAt||''))fail('dataset identity or dates');
  const s=data.source;
  if(!s||s.publisher!=='Norges Bank Investment Management'||!String(s.dataUrl).startsWith('https://www.nbim.no/')||!String(s.pageUrl).startsWith('https://www.nbim.no/')||!/^[0-9a-f]{64}$/.test(s.rawSha256||'')||!Number.isSafeInteger(s.rawBytes)||!s.reuse)fail('source');
  if(JSON.stringify(data.fields)!==JSON.stringify(NBIM_FIELDS))fail('fields');
  if(!Array.isArray(data.rows)||data.rows.length!==data.coverage?.equityRows)fail('row count');
  const ids=new Set();let previous=Infinity;
  for(const row of data.rows){
    if(!Array.isArray(row)||row.length!==NBIM_FIELDS.length)fail('row shape');
    const [id,name,country,incorporation,sector,code,usd,nok,ownership,voting]=row;
    if(!/^[a-z0-9]{12}$/.test(id)||ids.has(id))fail(`id ${id}`);ids.add(id);
    if(typeof name!=='string'||!name.trim()||name!==name.trim())fail(`name ${id}`);
    if(!code2(country)||(incorporation!==null&&!code2(incorporation)))fail(`country ${id}`);
    if(!NBIM_SECTORS.includes(sector))fail(`sector ${id}`);
    if(code!==null&&(typeof code!=='string'||!code.trim()))fail(`listing code ${id}`);
    if(!amount(usd)||!amount(nok))fail(`value ${id}`);
    if(!percent(ownership)||!percent(voting))fail(`percent ${id}`);
    if(usd>previous)fail('rows must be ordered by published USD value');previous=usd;
  }
  return data;
}
// Columnar rows become plain objects only for display.
export const nbimRows=data=>data.rows.map(row=>Object.fromEntries(NBIM_FIELDS.map((field,index)=>[field,row[index]])));
