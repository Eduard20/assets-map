// Monetary gold observations are NOT equity, portfolio weights or issuer joins. Quantity, valuation and custody stay separate claims.
const R='2026-10-24',REF='2025-12-31';
const US='https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/gold_reserve?filter=record_date:eq:2025-12-31';
const usLine=(n,facility,form,location,granularity,ozt,usd)=>[
  {id:`gold-claim-us-q${n}`,type:'custody_disclosure',authorityId:'gold-us-treasury',sourceId:'gold-src-us-api',locator:`record_date 2025-12-31, src_line_nbr ${n}`,excerpt:`${facility} | ${form} | ${location} | fine_troy_ounce_qty ${ozt}`,disclosureDate:REF,custodian:facility,location,granularity,quantityRaw:ozt,unitRaw:'fine_troy_ounce',finenessBasis:'fine_gold',shareRaw:null},
  {id:`gold-claim-us-v${n}`,type:'reserve_valuation',authorityId:'gold-us-treasury',sourceId:'gold-src-us-api',locator:`record_date 2025-12-31, src_line_nbr ${n}`,excerpt:`${facility} | ${form} | ${location} | book_value_amt ${usd}`,scope:`line ${n}`,valueRaw:usd,valueMultiplier:'1',currency:'USD',valuationBasis:'statutory_book',valuationDate:REF,priceReference:{priceRaw:'42.222',unitRaw:'fine_troy_ounce',currency:'USD',sourceId:'gold-src-us-page'}}
];
export const goldPilot={
  schemaVersion:1,
  referenceDate:REF,
  conversionRule:{id:'GOLD-MASS-v1',gramsPerTroyOunce:'31.1034768',gramsPerTonne:'1000000',gramsPerKilogram:'1000'},
  authorities:[
    {id:'gold-us-treasury',name:'U.S. Department of the Treasury',reportingAuthority:'Bureau of the Fiscal Service',perimeter:'treasury_owned_gold',encumbrance:{status:'unknown',reason:'not_covered_by_source'},allocation:{status:'unknown',reason:'not_covered_by_source'},custody:{status:'disclosed',reason:'Source lines state facility and location for 2025-12-31'}},
    {id:'gold-bundesbank',name:'Deutsche Bundesbank',reportingAuthority:'Deutsche Bundesbank',perimeter:'central_bank_balance_sheet',encumbrance:{status:'unknown',reason:'not_covered_by_source'},allocation:{status:'unknown',reason:'not_covered_by_source'},custody:{status:'disclosed',reason:'Gold holdings document dated 31 December 2025 states fine weight per custodian'}},
    {id:'gold-snb',name:'Swiss National Bank',reportingAuthority:'Swiss National Bank',perimeter:'central_bank_balance_sheet',encumbrance:{status:'unknown',reason:'not_covered_by_source'},allocation:{status:'unknown',reason:'not_covered_by_source'},custody:{status:'unknown',reason:'Annual Report 2025 (PDF p. 95) gives approximate storage shares without a stated disclosure date; held for reviewer decision under the pilot stop condition for undated custody statements'}}
  ],
  sources:[
    {id:'gold-src-us-api',authorityId:'gold-us-treasury',title:'U.S. Treasury-Owned Gold (Status Report of U.S. Government Gold Reserve), API records for 2025-12-31',url:US,asOf:REF,retrievedAt:R,reuse:'U.S. federal government work (17 U.S.C. § 105); no dataset-specific restriction found on the dataset page',excerpt:'Facility Description | Form Description | Location Description | Fine Troy Ounces | Book Value (8 rows, total-count 8)'},
    {id:'gold-src-us-page',authorityId:'gold-us-treasury',title:'U.S. Treasury-Owned Gold dataset page (definitions and known limitations)',url:'https://fiscaldata.treasury.gov/datasets/status-report-government-gold-reserve/',asOf:null,retrievedAt:R,reuse:'U.S. federal government work (17 U.S.C. § 105); no dataset-specific restriction found on the dataset page',excerpt:'The book value is not the market value, but instead represents the total number of troy ounces multiplied by a value established by law ($42.222), set in 1973.'},
    {id:'gold-src-bbk-holdings',authorityId:'gold-bundesbank',title:'The Deutsche Bundesbank’s gold holdings as per 31 December 2025 (summary by custodian)',url:'https://www.bundesbank.de/resource/blob/618402/0f75835691887a4bd9247a22aa7d46c3/472B63F073F071307366337C94F8C870/goldbarrenliste-data.pdf',asOf:REF,retrievedAt:R,reuse:'Bundesbank conditions for general use § 4.1: may save, forward or reproduce for personal or professional use, unaltered; cite "Source: Deutsche Bundesbank"',excerpt:'Total 267,578 3,360,149.0537 108,031,260.934 3,350,286.5312 107,714,173.571'},
    {id:'gold-src-bbk-accounts',authorityId:'gold-bundesbank',title:'Annual accounts of the Deutsche Bundesbank for 2025 (Annual Report 2025)',url:'https://publikationen.bundesbank.de/content/988046',asOf:REF,retrievedAt:R,reuse:'Bundesbank conditions for general use § 4.1: may save, forward or reproduce for personal or professional use, unaltered; cite "Source: Deutsche Bundesbank"',excerpt:'As at 31 December 2025, the Bundesbank\'s physical holdings (bars) of fine gold amounted to 3,350,285 kg, or 108 million fine ounces (ozf).'},
    {id:'gold-src-snb-ar',authorityId:'gold-snb',title:'Swiss National Bank Annual Report 2025 (annual financial statements)',url:'https://www.snb.ch/public/asset/en/www-snb-ch/publications/communication/annual-report/annrep_2025_komplett/publications0_en/annrep_2025_komplett.en.pdf',asOf:REF,retrievedAt:R,reuse:'SNB copyright notice: information and data may be saved, transmitted or used for non-commercial purposes compatible with their purpose',excerpt:'Item 01 Gold holdings, Breakdown by type … Total 1 040.0 115 351.2 1 040.0 79 047.8'}
  ],
  claims:[
    ...usLine(1,'Mint Held Gold - Deep Storage','Gold Bullion','Denver, CO','city','43853707.279','1851599995.81'),
    ...usLine(2,'Mint Held Gold - Deep Storage','Gold Bullion','Fort Knox, KY','city','147341858.382','6221097412.78'),
    ...usLine(3,'Mint Held Gold - Deep Storage','Gold Bullion','West Point, NY','city','54067331.379','2282841677.17'),
    ...usLine(4,'Mint Held Gold - Working Stock','Gold Coins','All Locations- Coins, blanks, miscellaneous','unspecified','2783218.656','117513614.74'),
    ...usLine(5,'Federal Reserve Bank Held Gold','Gold Bullion','Federal Reserve Banks - NY Vault','facility','13376987.724','564805851.07'),
    ...usLine(6,'Federal Reserve Bank Held Gold','Gold Bullion','Federal Reserve Banks - Display','unspecified','1993.321','84162.40'),
    ...usLine(7,'Federal Reserve Bank Held Gold','Gold Coins','Federal Reserve Banks - NY Vault','facility','73452.066','3101307.82'),
    ...usLine(8,'Federal Reserve Bank Held Gold','Gold Coins','Federal Reserve Banks - Display','unspecified','377.434','15936.11'),
    {id:'gold-claim-bbk-q1',type:'reserve_quantity',authorityId:'gold-bundesbank',sourceId:'gold-src-bbk-holdings',locator:'Page 1, summary table, row Total, fine weight',excerpt:'Total 267,578 3,360,149.0537 108,031,260.934 3,350,286.5312 107,714,173.571',reportDate:REF,scope:'total (bars)',quantityRaw:'3350286.5312',unitRaw:'kilogram',alsoStated:{quantityRaw:'107714173.571',unitRaw:'fine_troy_ounce'},finenessBasis:'fine_gold',inclusionNote:'Fine weight of bars by custodian; gross weight 3,360,149.0537 kg is a separate column'},
    {id:'gold-claim-bbk-q2',type:'reserve_quantity',authorityId:'gold-bundesbank',sourceId:'gold-src-bbk-accounts',locator:'Notes, Assets item 1 “Gold and gold receivables”',excerpt:'As at 31 December 2025, the Bundesbank\'s physical holdings (bars) of fine gold amounted to 3,350,285 kg, or 108 million fine ounces (ozf). These are supplemented by an additional 4 kg of gold receivables',reportDate:REF,scope:'total (bars)',quantityRaw:'3350285',unitRaw:'kilogram',alsoStated:null,finenessBasis:'fine_gold',inclusionNote:'Excludes 4 kg of gold receivables stated separately'},
    {id:'gold-claim-bbk-v1',type:'reserve_valuation',authorityId:'gold-bundesbank',sourceId:'gold-src-bbk-accounts',locator:'Balance sheet as at 31 December 2025, Assets item 1; Notes, Assets item 1',excerpt:'Gold and gold receivables 395,215 (€ million) … The gold was valued at the market price at the end of the year (1 kg = €117,964.50, or 1 ozf = €3,669.106).',scope:'gold and gold receivables',valueRaw:'395215',valueMultiplier:'1000000',currency:'EUR',valuationBasis:'market',valuationDate:REF,priceReference:{priceRaw:'3669.106',unitRaw:'fine_troy_ounce',currency:'EUR',sourceId:'gold-src-bbk-accounts'}},
    {id:'gold-claim-bbk-c1',type:'custody_disclosure',authorityId:'gold-bundesbank',sourceId:'gold-src-bbk-holdings',locator:'Page 1, summary table, custodian Deutsche Bundesbank (Frankfurt am Main), fine weight',excerpt:'Deutsche Bundesbank (Frankfurt am Main) … 1,710,062.4673 kg … 54,979,744.933 ozf',disclosureDate:REF,custodian:'Deutsche Bundesbank',location:'Frankfurt am Main',granularity:'city',quantityRaw:'1710062.4673',unitRaw:'kilogram',finenessBasis:'fine_gold',shareRaw:null},
    {id:'gold-claim-bbk-c2',type:'custody_disclosure',authorityId:'gold-bundesbank',sourceId:'gold-src-bbk-holdings',locator:'Page 1, summary table, custodian Bank of England (London), fine weight',excerpt:'Bank of England (London) … 403,992.4642 kg … 12,988,659.822 ozf',disclosureDate:REF,custodian:'Bank of England',location:'London',granularity:'city',quantityRaw:'403992.4642',unitRaw:'kilogram',finenessBasis:'fine_gold',shareRaw:null},
    {id:'gold-claim-bbk-c3',type:'custody_disclosure',authorityId:'gold-bundesbank',sourceId:'gold-src-bbk-holdings',locator:'Page 1, summary table, custodian Federal Reserve Bank of New York (New York), fine weight',excerpt:'Federal Reserve Bank of New York (New York) … 1,236,231.5997 kg … 39,745,768.816 ozf',disclosureDate:REF,custodian:'Federal Reserve Bank of New York',location:'New York',granularity:'city',quantityRaw:'1236231.5997',unitRaw:'kilogram',finenessBasis:'fine_gold',shareRaw:null},
    {id:'gold-claim-bbk-e1',type:'reserve_change_event',authorityId:'gold-bundesbank',sourceId:'gold-src-bbk-accounts',locator:'Notes, Assets item 1 “Gold and gold receivables”',excerpt:'The gold holdings declined by 0.04 % (1,260 kg, or 0.04 million ozf) in the year under review. This was due to the sale of gold to the Federal Government at market prices for the purpose of minting gold coins.',eventKind:'coin_minting_use',periodStart:'2025-01-01',periodEnd:REF,quantityRaw:'-1260',unitRaw:'kilogram'},
    {id:'gold-claim-snb-q1',type:'reserve_quantity',authorityId:'gold-snb',sourceId:'gold-src-snb-ar',locator:'PDF p. 182, Item 01 Gold holdings, Breakdown by type, row Total, In tonnes, 31.12.2025',excerpt:'Gold bars 1 001.0 111 028.4 … Gold coins 39.0 4 322.7 … Total 1 040.0 115 351.2',reportDate:REF,scope:'total (bars and coins)',quantityRaw:'1040.0',unitRaw:'tonne',alsoStated:null,finenessBasis:'unknown',inclusionNote:'Gold bars 1,001.0 t and gold coins 39.0 t; fine or gross weight basis not stated in this table'},
    {id:'gold-claim-snb-v1',type:'reserve_valuation',authorityId:'gold-snb',sourceId:'gold-src-snb-ar',locator:'PDF p. 170 Balance sheet as at 31 December 2025; PDF p. 182 Valuation rates and Item 01',excerpt:'Gold holdings 01 115 351.2 79 047.8 + 36 303.4 (In CHF millions) … 1 kilogram of gold 110 918.97 … These holdings are stated at market value.',scope:'gold holdings',valueRaw:'115351.2',valueMultiplier:'1000000',currency:'CHF',valuationBasis:'market',valuationDate:REF,priceReference:{priceRaw:'110918.97',unitRaw:'kilogram',currency:'CHF',sourceId:'gold-src-snb-ar'}}
  ],
  reconciliations:[
    {id:'gold-rec-bbk-1',claimIds:['gold-claim-bbk-q1','gold-claim-bbk-q2'],classification:'unexplained_difference',note:'The holdings document states 3,350,286.5312 kg and the annual accounts state 3,350,285 kg for the same date and scope. The 1.5312 kg gap exceeds the rounding interval. The holdings document notes that “Various methods and rounding rules are used to calculate the fine weight”, but neither source reconciles the figures. Both observations are kept.'}
  ]
};
// --- GOLD-MASS-v1 decimal-string arithmetic (BigInt, no binary floats) ---
const DEC=/^-?\d+(\.\d+)?$/;
const parse=s=>{if(typeof s!=='string'||!DEC.test(s))throw new Error('Invalid gold decimal');const neg=s.startsWith('-'),[i,f='']=s.replace('-','').split('.');return {n:BigInt(i+f)*(neg?-1n:1n),s:f.length};};
const fmt=(n,s)=>{const neg=n<0n;let t=(neg?-n:n).toString().padStart(s+1,'0');let out=s?`${t.slice(0,-s)}.${t.slice(-s)}`:t;if(s)out=out.replace(/0+$/,'').replace(/\.$/,'');return (neg&&out!=='0'?'-':'')+out;};
const P=10n**7n,OZ=311034768n; // 31.1034768 g = OZ / 10^7
const divRound=(a,b)=>{const q=a/b,r=a%b;return (r*2n>=b?q+1n:q);};
export const decimalSum=values=>{const p=values.map(parse),s=Math.max(0,...p.map(v=>v.s));return fmt(p.reduce((t,v)=>t+v.n*10n**BigInt(s-v.s),0n),s);};
// Grams as exact {n,s}
const grams=(raw,unit)=>{const {n,s}=parse(raw);if(unit==='fine_troy_ounce')return {n:n*OZ,s:s+7};if(unit==='million_fine_troy_ounces')return {n:n*OZ*10n**6n,s:s+7};if(unit==='kilogram')return {n:n*1000n,s};if(unit==='tonne')return {n:n*10n**6n,s};throw new Error('Unconvertible gold unit');};
export function toTonnes(raw,unit){const g=grams(raw,unit);return fmt(g.n,g.s+6);}
export function toFineTroyOunces(raw,unit,places=3){if(unit==='fine_troy_ounce')return raw;const g=grams(raw,unit);return fmt(divRound(g.n*P*10n**BigInt(places),OZ*10n**BigInt(g.s)),places);}
// Interval for a figure rounded to its last stated digit: [x - h, x + h), converted at both bounds.
export function roundingInterval(raw){const {n,s}=parse(raw);return [fmt(n*10n-5n,s+1),fmt(n*10n+5n,s+1)];}
// --- validator ---
const keys=(row,allowed)=>{if(!row||typeof row!=='object'||Object.keys(row).sort().join('|')!==allowed.split(' ').sort().join('|'))throw new Error('Unexpected gold fields');};
const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&new Date(v).toISOString().slice(0,10)===v;
const HOSTS=['api.fiscaldata.treasury.gov','fiscaldata.treasury.gov','www.bundesbank.de','publikationen.bundesbank.de','www.snb.ch'];
const UNITS=['fine_troy_ounce','million_fine_troy_ounces','tonne','kilogram'],CURRENCIES=['USD','EUR','CHF'],BASES=['market','statutory_book','official_fixed_price','historical_cost','unknown'];
const FINENESS=['fine_gold','gross_weight','unknown'],UNKNOWN_REASONS=['not_covered_by_source','not_separated_in_source','not_disclosed'];
const text=v=>typeof v==='string'&&v.trim().length>0;
const positive=v=>DEC.test(v)&&!v.startsWith('-')&&/[1-9]/.test(v);
const CLAIM_FIELDS={
  reserve_quantity:'id type authorityId sourceId locator excerpt reportDate scope quantityRaw unitRaw alsoStated finenessBasis inclusionNote',
  reserve_valuation:'id type authorityId sourceId locator excerpt scope valueRaw valueMultiplier currency valuationBasis valuationDate priceReference',
  custody_disclosure:'id type authorityId sourceId locator excerpt disclosureDate custodian location granularity quantityRaw unitRaw finenessBasis shareRaw',
  reserve_change_event:'id type authorityId sourceId locator excerpt eventKind periodStart periodEnd quantityRaw unitRaw'
};
export function validateGoldPilot(data){
  keys(data,'schemaVersion referenceDate conversionRule authorities sources claims reconciliations');
  if(data.schemaVersion!==1||data.referenceDate!==REF||![data.authorities,data.sources,data.claims,data.reconciliations].every(Array.isArray))throw new Error('Invalid gold schema');
  keys(data.conversionRule,'id gramsPerTroyOunce gramsPerTonne gramsPerKilogram');
  if(data.conversionRule.id!=='GOLD-MASS-v1'||data.conversionRule.gramsPerTroyOunce!=='31.1034768'||data.conversionRule.gramsPerTonne!=='1000000'||data.conversionRule.gramsPerKilogram!=='1000')throw new Error('Invalid gold conversion rule');
  if(data.authorities.length>3||data.claims.length>30)throw new Error('Gold pilot exceeds caps');
  const authorities=new Map(),sources=new Map(),ids=new Set();
  const status=(v,allowDisclosed)=>{keys(v,'status reason');if(!text(v.reason)||!(v.status==='unknown'||(allowDisclosed&&v.status==='disclosed')))throw new Error('Invalid gold status');};
  for(const a of data.authorities){keys(a,'id name reportingAuthority perimeter encumbrance allocation custody');if(!/^gold-[a-z-]+$/.test(a.id)||authorities.has(a.id)||!text(a.name)||!text(a.reportingAuthority)||!['treasury_owned_gold','central_bank_balance_sheet'].includes(a.perimeter))throw new Error('Invalid gold authority');
    status(a.encumbrance,false);status(a.allocation,false);status(a.custody,true);if(!UNKNOWN_REASONS.includes(a.encumbrance.reason)||!UNKNOWN_REASONS.includes(a.allocation.reason))throw new Error('Invalid gold status');authorities.set(a.id,a);}
  for(const s of data.sources){keys(s,'id authorityId title url asOf retrievedAt reuse excerpt');const url=new URL(s.url);if(sources.has(s.id)||!/^gold-src-[a-z0-9-]+$/.test(s.id)||!authorities.has(s.authorityId)||!text(s.title)||!text(s.excerpt)||!text(s.reuse)||url.protocol!=='https:'||url.username||url.password||!HOSTS.includes(url.hostname)||!date(s.retrievedAt)||(s.asOf!==null&&(!date(s.asOf)||s.asOf>s.retrievedAt)))throw new Error('Invalid gold source');sources.set(s.id,s);}
  const claims=new Map();
  for(const c of data.claims){
    const fields=CLAIM_FIELDS[c?.type];if(!fields)throw new Error('Invalid gold claim type');keys(c,fields);
    const src=sources.get(c.sourceId);
    if(!/^gold-claim-[a-z0-9-]+$/.test(c.id)||ids.has(c.id)||!src||src.authorityId!==c.authorityId||!text(c.locator)||!text(c.excerpt))throw new Error('Invalid gold claim');
    if(c.type==='reserve_quantity'){if(c.reportDate!==REF||!text(c.scope)||!positive(c.quantityRaw)||!UNITS.includes(c.unitRaw)||!FINENESS.includes(c.finenessBasis)||!text(c.inclusionNote))throw new Error('Invalid gold quantity');
      if(c.alsoStated!==null){keys(c.alsoStated,'quantityRaw unitRaw');if(!positive(c.alsoStated.quantityRaw)||!UNITS.includes(c.alsoStated.unitRaw)||c.alsoStated.unitRaw===c.unitRaw)throw new Error('Invalid gold quantity');}}
    if(c.type==='reserve_valuation'){if(c.valuationDate!==REF||!text(c.scope)||!positive(c.valueRaw)||!['1','1000000','1000000000'].includes(c.valueMultiplier)||!CURRENCIES.includes(c.currency)||!BASES.includes(c.valuationBasis))throw new Error('Invalid gold valuation');
      keys(c.priceReference,'priceRaw unitRaw currency sourceId');if(!positive(c.priceReference.priceRaw)||!UNITS.includes(c.priceReference.unitRaw)||c.priceReference.currency!==c.currency||sources.get(c.priceReference.sourceId)?.authorityId!==c.authorityId)throw new Error('Invalid gold valuation');}
    if(c.type==='custody_disclosure'){if(!date(c.disclosureDate)||c.disclosureDate>src.retrievedAt||!text(c.custodian)||!text(c.location)||!['facility','city','country','unspecified'].includes(c.granularity)||authorities.get(c.authorityId).custody.status!=='disclosed')throw new Error('Invalid gold custody');
      const hasQ=c.quantityRaw!==null,hasS=c.shareRaw!==null;if(hasQ===hasS||(hasQ&&(!positive(c.quantityRaw)||!UNITS.includes(c.unitRaw)||!FINENESS.includes(c.finenessBasis)))||(hasS&&(!positive(c.shareRaw)||c.unitRaw!==null)))throw new Error('Invalid gold custody');}
    if(c.type==='reserve_change_event'){if(!['purchase','sale','coin_minting_use','relocation','sale_and_repurchase','perimeter_change'].includes(c.eventKind)||!date(c.periodStart)||!date(c.periodEnd)||c.periodStart>c.periodEnd||c.periodEnd>REF||!DEC.test(c.quantityRaw)||!UNITS.includes(c.unitRaw))throw new Error('Invalid gold event');}
    ids.add(c.id);claims.set(c.id,c);
  }
  for(const a of data.authorities){const own=data.claims.filter(c=>c.authorityId===a.id);
    if(!own.some(c=>c.type==='reserve_valuation')||!own.some(c=>c.type==='reserve_quantity'||c.type==='custody_disclosure'))throw new Error('Gold authority needs distinct quantity and valuation claims');
    if(a.custody.status==='disclosed'&&!own.some(c=>c.type==='custody_disclosure'))throw new Error('Invalid gold custody');}
  const recIds=new Set();
  for(const r of data.reconciliations){keys(r,'id claimIds classification note');if(recIds.has(r.id)||!/^gold-rec-[a-z0-9-]+$/.test(r.id)||!Array.isArray(r.claimIds)||r.claimIds.length!==2||!r.claimIds.every(id=>claims.get(id)?.type==='reserve_quantity')||claims.get(r.claimIds[0]).authorityId!==claims.get(r.claimIds[1]).authorityId||!['compatible_within_rounding','compatible_different_basis','scope_difference_explained','unexplained_difference'].includes(r.classification)||!text(r.note))throw new Error('Invalid gold reconciliation');recIds.add(r.id);}
  return data;
}
validateGoldPilot(goldPilot);
