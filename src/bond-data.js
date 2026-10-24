// Debt pilot (#14). Separate asset class: never enters graph-model, portfolio totals, security equivalence or issuer identity resolution.
// Instrument ids are opaque project ids. CUSIPs and US ISINs are withheld (proprietary / licensing-uncertain); LEI is open (GLEIF, CC0).
const K=value=>({value,availability:'known',reason:null}),U=reason=>({value:null,availability:'unknown',reason});
const FD='U.S. Treasury Fiscal Data: "The data is offered free, without restriction, and available to copy, adapt, redistribute, or otherwise use for non-commercial or commercial purposes." (fiscaldata.treasury.gov/api-documentation, checked 2026-10-24)';
const SEC='SEC public filing: "Information presented on sec.gov is considered public information and may be copied or further distributed" (sec.gov/privacy, checked 2026-10-24); cited to the SEC as source';
export const NYFED_NOTICE='© 2026 Federal Reserve Bank of New York. Content from the New York Fed subject to the Terms of Use at newyorkfed.org.';
const API='https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1';
export const bondPilot={
  schemaVersion:1,
  assetClass:'debt',
  entities:[
    {id:'bond-us-treasury',name:'United States Treasury',kind:'sovereign',lei:null,leiSourceId:null},
    {id:'bond-oracle',name:'Oracle Corporation',kind:'corporate',lei:'1Z4GXXU7ZHVWFCD8TV52',leiSourceId:'bond-src-gleif-oracle'},
    {id:'bond-soma',name:'Federal Reserve System Open Market Account (SOMA)',kind:'central_bank',lei:null,leiSourceId:null}
  ],
  sources:[
    {id:'bond-src-auction-note',title:'Fiscal Data · Treasury securities auctions (10-Year note issued 2025-08-15)',url:`${API}/accounting/od/auctions_query?filter=issue_date:eq:2025-08-15,security_term:eq:10-Year`,publisher:'U.S. Treasury, Bureau of the Fiscal Service',sourceKind:'auction_result',asOf:'2025-08-15',publishedAt:null,retrievedAt:'2026-10-24',reuse:FD},
    {id:'bond-src-auction-tips',title:'Fiscal Data · Treasury securities auctions (10-Year TIPS issued 2025-07-31)',url:`${API}/accounting/od/auctions_query?filter=issue_date:eq:2025-07-31,security_term:eq:10-Year`,publisher:'U.S. Treasury, Bureau of the Fiscal Service',sourceKind:'auction_result',asOf:'2025-07-31',publishedAt:null,retrievedAt:'2026-10-24',reuse:FD},
    {id:'bond-src-mspd',title:'Monthly Statement of the Public Debt, Table III marketable detail, 30 September 2026',url:`${API}/debt/mspd/mspd_table_3_market?filter=record_date:eq:2026-09-30,maturity_date:in:(2035-07-15,2035-08-15)`,publisher:'U.S. Treasury, Bureau of the Fiscal Service',sourceKind:'dmo_register',asOf:'2026-09-30',publishedAt:null,retrievedAt:'2026-10-24',reuse:FD},
    {id:'bond-src-soma',title:'New York Fed · SOMA Treasury holdings as of 30 September 2026',url:'https://markets.newyorkfed.org/api/soma/tsy/get/asof/2026-09-30.json',publisher:'Federal Reserve Bank of New York',sourceKind:'holder_disclosure',asOf:'2026-09-30',publishedAt:null,retrievedAt:'2026-10-24',reuse:`New York Fed Terms of Use (updated 6/9/2023): non-exclusive licence to use, copy and distribute Content with attribution; SOMA data is not listed under Use Restrictions. ${NYFED_NOTICE}`},
    {id:'bond-src-orcl-424b2',title:'Oracle Corporation prospectus supplement (Rule 424(b)(2)) dated 24 September 2025',url:'https://www.sec.gov/Archives/edgar/data/1341439/000119312525217490/d37885d424b2.htm',publisher:'Oracle Corporation via SEC EDGAR',sourceKind:'final_prospectus',asOf:'2025-09-24',publishedAt:'2025-09-25',retrievedAt:'2026-10-24',reuse:SEC},
    {id:'bond-src-orcl-10k',title:'Oracle Corporation Form 10-K for fiscal year ended 31 May 2026 · Notes payable and other borrowings (Tables)',url:'https://www.sec.gov/Archives/edgar/data/1341439/000119312526277521/R33.htm',publisher:'Oracle Corporation via SEC EDGAR',sourceKind:'issuer_report',asOf:'2026-05-31',publishedAt:'2026-06-22',retrievedAt:'2026-10-24',reuse:SEC},
    {id:'bond-src-gleif-oracle',title:'GLEIF LEI record · ORACLE CORPORATION',url:'https://api.gleif.org/api/v1/lei-records/1Z4GXXU7ZHVWFCD8TV52',publisher:'Global Legal Entity Identifier Foundation',sourceKind:'regulatory_reference_data',asOf:'2025-11-26',publishedAt:null,retrievedAt:'2026-10-24',reuse:'GLEIF LEI data "provided under the CC0 licence" (gleif.org LEI data terms of use, checked 2026-10-24)'}
  ],
  instruments:[
    {id:'bond-ust-note-2035',name:'United States Treasury 4.250% Note due 15 August 2035',issuerId:'bond-us-treasury',debtSubtype:'note',currency:'USD',sameIssueGroupId:null},
    {id:'bond-ust-tips-2035',name:'United States Treasury 1.875% Inflation-Protected Note (TIPS) due 15 July 2035',issuerId:'bond-us-treasury',debtSubtype:'inflation_linked',currency:'USD',sameIssueGroupId:null},
    {id:'bond-orcl-2030',name:'Oracle Corporation 4.450% Notes due 26 September 2030',issuerId:'bond-oracle',debtSubtype:'note',currency:'USD',sameIssueGroupId:null},
    {id:'bond-orcl-2035',name:'Oracle Corporation 5.200% Notes due 26 September 2035',issuerId:'bond-oracle',debtSubtype:'note',currency:'USD',sameIssueGroupId:null}
  ],
  relationships:[
    {id:'bond-rel-1',predicate:'debt_issued_by',from:'bond-ust-note-2035',to:'bond-us-treasury',sourceId:'bond-src-auction-note'},
    {id:'bond-rel-2',predicate:'debt_issued_by',from:'bond-ust-tips-2035',to:'bond-us-treasury',sourceId:'bond-src-auction-tips'},
    {id:'bond-rel-3',predicate:'debt_issued_by',from:'bond-orcl-2030',to:'bond-oracle',sourceId:'bond-src-orcl-424b2'},
    {id:'bond-rel-4',predicate:'debt_issued_by',from:'bond-orcl-2035',to:'bond-oracle',sourceId:'bond-src-orcl-424b2'}
  ],
  terms:[
    {id:'bond-terms-1',instrumentId:'bond-ust-note-2035',sourceId:'bond-src-auction-note',termsSourceKind:'auction_result',termsEffectiveFrom:'2025-08-15',termsEffectiveTo:null,locator:'Original auction record (auction_date 2025-08-06, reopening "No"); later reopenings appear only as MSPD tranche rows',excerpt:'"int_rate":"4.250000" "issue_date":"2025-08-15" "maturity_date":"2035-08-15" "first_int_payment_date":"2026-02-15" "int_payment_frequency":"Semi-Annual" "callable":"No" "total_accepted":"56253817500"',fields:{
      currencyOfDenomination:K('USD'),issueDate:K('2025-08-15'),datedDate:K('2025-08-15'),firstCouponDate:K('2026-02-15'),maturityDate:K('2035-08-15'),couponType:K('fixed'),couponRate:K(4.25),couponFrequency:K('semi_annual'),dayCount:U('not_stated_in_source'),
      denominationMinimum:K(100),denominationIncrement:K(100),principalIndexation:K('none'),seniority:U('not_stated_in_source'),optionality:K('Not callable'),issuedAmountAtTranche:K(56253817500),governingLaw:U('not_stated_in_source'),listingVenues:U('not_stated_in_source')}},
    {id:'bond-terms-2',instrumentId:'bond-ust-tips-2035',sourceId:'bond-src-auction-tips',termsSourceKind:'auction_result',termsEffectiveFrom:'2025-07-31',termsEffectiveTo:null,locator:'Original auction record (auction_date 2025-07-24, reopening "No"); later reopenings appear only as MSPD tranche rows',excerpt:'"int_rate":"1.875000" "dated_date":"2025-07-15" "issue_date":"2025-07-31" "maturity_date":"2035-07-15" "inflation_index_security":"Yes" "cpi_base_reference_period":"1982-1984=100" "ref_cpi_on_dated_date":"321.097580" "total_accepted":"22430027400"',fields:{
      currencyOfDenomination:K('USD'),issueDate:K('2025-07-31'),datedDate:K('2025-07-15'),firstCouponDate:K('2026-01-15'),maturityDate:K('2035-07-15'),couponType:K('inflation_linked_fixed_real'),couponRate:K(1.875),couponFrequency:K('semi_annual'),dayCount:U('not_stated_in_source'),
      denominationMinimum:K(100),denominationIncrement:K(100),principalIndexation:K('CPI (1982-1984=100); reference CPI on dated date 321.097580; index ratio on issue date 1.001080; lag not stated in source'),seniority:U('not_stated_in_source'),optionality:K('Not callable'),issuedAmountAtTranche:K(22430027400),governingLaw:U('not_stated_in_source'),listingVenues:U('not_stated_in_source')}},
    {id:'bond-terms-3',instrumentId:'bond-orcl-2030',sourceId:'bond-src-orcl-424b2',termsSourceKind:'final_prospectus',termsEffectiveFrom:'2025-09-26',termsEffectiveTo:null,locator:'Cover page and "Description of the Notes"',excerpt:'"$3,000,000,000 aggregate principal amount of 4.450% notes due 2030"; "The 2030 Notes will mature on September 26, 2030"; "Interest on the Notes will be payable semi-annually on March 26 and September 26, commencing March 26, 2026."',fields:{
      currencyOfDenomination:K('USD'),issueDate:K('2025-09-26'),datedDate:K('2025-09-26'),firstCouponDate:K('2026-03-26'),maturityDate:K('2030-09-26'),couponType:K('fixed'),couponRate:K(4.45),couponFrequency:K('semi_annual'),dayCount:K('30/360 (360-day year of twelve 30-day months)'),
      denominationMinimum:K(2000),denominationIncrement:K(1000),principalIndexation:K('none'),seniority:K('senior_unsecured'),optionality:K('Make-whole call (Treasury rate + 15 bps) before par call date 2030-08-26; at par on or after it'),issuedAmountAtTranche:K(3000000000),governingLaw:K('State of New York'),listingVenues:K('Not listed ("We do not intend to apply for listing of the Notes on any securities exchange.")')}},
    {id:'bond-terms-4',instrumentId:'bond-orcl-2035',sourceId:'bond-src-orcl-424b2',termsSourceKind:'final_prospectus',termsEffectiveFrom:'2025-09-26',termsEffectiveTo:null,locator:'Cover page and "Description of the Notes"',excerpt:'"$4,000,000,000 aggregate principal amount of 5.200% notes due 2035"; "the 2035 Notes will mature on September 26, 2035"; "Interest on the Notes will be calculated on the basis of a 360-day year comprised of twelve 30-day months."',fields:{
      currencyOfDenomination:K('USD'),issueDate:K('2025-09-26'),datedDate:K('2025-09-26'),firstCouponDate:K('2026-03-26'),maturityDate:K('2035-09-26'),couponType:K('fixed'),couponRate:K(5.2),couponFrequency:K('semi_annual'),dayCount:K('30/360 (360-day year of twelve 30-day months)'),
      denominationMinimum:K(2000),denominationIncrement:K(1000),principalIndexation:K('none'),seniority:K('senior_unsecured'),optionality:K('Make-whole call (Treasury rate + 20 bps) before par call date 2035-06-26; at par on or after it'),issuedAmountAtTranche:K(4000000000),governingLaw:K('State of New York'),listingVenues:K('Not listed ("We do not intend to apply for listing of the Notes on any securities exchange.")')}}
  ],
  outstanding:[
    {id:'bond-out-1',instrumentId:'bond-ust-note-2035',sourceId:'bond-src-mspd',metricType:'outstanding_principal',unit:'face_amount',scope:'security_line',asOfDate:'2026-09-30',faceCurrency:'USD',amount:134934.7665,scale:1000000,indexed:false,heldByIssuerExcluded:'unknown',locator:'Table III, src_line_nbr 401-403 (original issue plus reopenings of 2025-09-15 and 2025-10-15)',excerpt:'"issued_amt":"56253.9043" / "38998.0312" / "39722.831"; "redeemed_amt":"-40"; "outstanding_amt":"134934.7665" (Outstanding Amount (in Millions))'},
    {id:'bond-out-2',instrumentId:'bond-ust-tips-2035',sourceId:'bond-src-mspd',metricType:'outstanding_principal',unit:'face_amount',scope:'security_line',asOfDate:'2026-09-30',faceCurrency:'USD',amount:63567.91831011,scale:1000000,indexed:true,heldByIssuerExcluded:'unknown',locator:'Table III, src_line_nbr 816-818 (issues of 2025-07-31, 2025-09-30, 2025-11-28); line total includes the inflation adjustment',excerpt:'"inflation_adj_amt":"895.62766791" / "800.55056453" / "744.62737767"; "redeemed_amt":"-348"; "outstanding_amt":"63567.91831011" (Outstanding Amount (in Millions))'},
    {id:'bond-out-3',instrumentId:'bond-orcl-2030',sourceId:'bond-src-orcl-10k',metricType:'outstanding_principal',unit:'face_amount',scope:'security_line',asOfDate:'2026-05-31',faceCurrency:'USD',amount:3000,scale:1000000,indexed:false,heldByIssuerExcluded:'unknown',locator:'Fixed-rate senior notes table, May 31, 2026 Amount column; amounts before unamortized discount/issuance costs',excerpt:'"$3,000, 4.45%, due September 2030(3) September 2025 3,000 4.55%" (Amounts in millions)'},
    {id:'bond-out-4',instrumentId:'bond-orcl-2035',sourceId:'bond-src-orcl-10k',metricType:'outstanding_principal',unit:'face_amount',scope:'security_line',asOfDate:'2026-05-31',faceCurrency:'USD',amount:4000,scale:1000000,indexed:false,heldByIssuerExcluded:'unknown',locator:'Fixed-rate senior notes table, May 31, 2026 Amount column; amounts before unamortized discount/issuance costs',excerpt:'"$4,000, 5.20%, due September 2035(3) September 2025 4,000 5.25%" (Amounts in millions)'}
  ],
  holdings:[
    {id:'bond-hold-1',instrumentId:'bond-ust-note-2035',holderId:'bond-soma',predicate:'direct_debt_holding',sourceId:'bond-src-soma',reportDate:'2026-09-30',metricType:'face_amount',unit:'face_amount',faceCurrency:'USD',faceAmount:14977674200,scale:1,faceBasis:'not_indexed',statedInflationCompensation:null,locator:'holdings row with maturityDate 2035-08-15, coupon 4.250, securityType NotesBonds',excerpt:'"maturityDate":"2035-08-15" "coupon":"4.250" "parValue":"14977674200" "percentOutstanding":"0.1109993709441814"'},
    {id:'bond-hold-2',instrumentId:'bond-ust-tips-2035',holderId:'bond-soma',predicate:'direct_debt_holding',sourceId:'bond-src-soma',reportDate:'2026-09-30',metricType:'face_amount',unit:'face_amount',faceCurrency:'USD',faceAmount:2479164800,scale:1,faceBasis:'unindexed',statedInflationCompensation:98993050.46,locator:'holdings row with maturityDate 2035-07-15, coupon 1.875, securityType TIPS',excerpt:'"maturityDate":"2035-07-15" "coupon":"1.875" "parValue":"2479164800" "inflationCompensation":"98993050.46" "securityType":"TIPS"'}
  ],
  valuations:[
    {id:'bond-val-1',instrumentId:'bond-ust-note-2035',sourceId:'bond-src-auction-note',metricType:'auction_price',unit:'price_per_100_face',value:99.95962,valuationDate:'2025-08-06',valuationBasis:'auction_clearing_price',priceConvention:'unknown',excerpt:'"auction_date":"2025-08-06" "price_per100":"99.95962" (Price per $100)'},
    {id:'bond-val-2',instrumentId:'bond-orcl-2030',sourceId:'bond-src-orcl-424b2',metricType:'clean_price',unit:'price_per_100_face',value:99.938,valuationDate:'2025-09-24',valuationBasis:'offering_price',priceConvention:'clean',excerpt:'Price to public 99.938%, "Plus accrued interest, if any, from September 26, 2025, if settlement occurs after that date."'},
    {id:'bond-val-3',instrumentId:'bond-orcl-2035',sourceId:'bond-src-orcl-424b2',metricType:'clean_price',unit:'price_per_100_face',value:99.985,valuationDate:'2025-09-24',valuationBasis:'offering_price',priceConvention:'clean',excerpt:'Price to public 99.985%, "Plus accrued interest, if any, from September 26, 2025, if settlement occurs after that date."'}
  ],
  gaps:[
    {id:'bond-gap-1',instrumentId:'bond-ust-note-2035',category:'coverage',reason:'holder_register_not_public',detail:'SOMA is the only named holder admitted. No public register identifies the holders of the remaining outstanding principal; it is undisclosed, not an "other holders" entity.'},
    {id:'bond-gap-2',instrumentId:'bond-ust-tips-2035',category:'coverage',reason:'holder_register_not_public',detail:'SOMA is the only named holder admitted. Its par is unindexed while MSPD outstanding includes the inflation adjustment, so no share of issue or coverage ratio is computed.'},
    {id:'bond-gap-3',instrumentId:'bond-ust-tips-2035',category:'outstanding',reason:'not_stated_in_source',detail:'MSPD states the line total only inclusive of inflation adjustment. An unindexed outstanding total is not stated and is not derived here.'},
    {id:'bond-gap-4',instrumentId:'bond-ust-tips-2035',category:'valuation',reason:'basis_needs_review',detail:'The auction record carries both adjusted and unadjusted prices plus accrued-interest fields; the price basis is not admitted until reviewed.'},
    {id:'bond-gap-5',instrumentId:'bond-ust-tips-2035',category:'metric',reason:'basis_not_documented',detail:'SOMA states "percentOutstanding":"0.0404186746142682" for this TIPS without documenting its indexation basis; it is not used.'},
    {id:'bond-gap-6',instrumentId:'bond-orcl-2030',category:'coverage',reason:'source_not_admitted',detail:'No holder disclosure is admitted. SEC Form N-PORT fund filings were not retrieved in this pass, and no public register of noteholders exists. Holder coverage is unknown.'},
    {id:'bond-gap-7',instrumentId:'bond-orcl-2035',category:'coverage',reason:'source_not_admitted',detail:'No holder disclosure is admitted. SEC Form N-PORT fund filings were not retrieved in this pass, and no public register of noteholders exists. Holder coverage is unknown.'},
    {id:'bond-gap-8',instrumentId:'bond-orcl-2030',category:'reporting_period',reason:'stale_outstanding',detail:'Outstanding is as of 2026-05-31 (Form 10-K). It is not carried forward to later dates; any holding at another date has share of issue unknown.'},
    {id:'bond-gap-9',instrumentId:'bond-orcl-2035',category:'reporting_period',reason:'stale_outstanding',detail:'Outstanding is as of 2026-05-31 (Form 10-K). It is not carried forward to later dates; any holding at another date has share of issue unknown.'}
  ]
};
export const bondMetricDictionary=Object.freeze([
  {metricType:'face_amount',unit:'face_amount + face currency',denominator:'none',forbidden:'Adding across currencies, to reported values or to share counts'},
  {metricType:'outstanding_principal',unit:'face_amount + face currency',denominator:'none',forbidden:'Using it as a holding, or at a date other than its own'},
  {metricType:'reported_value',unit:'currency_value + value currency',denominator:'none',forbidden:'Treating it as market value when the basis is amortized cost or unknown'},
  {metricType:'share_of_issue_outstanding',unit:'percent',denominator:'outstanding_principal: same line, date, face currency and indexation basis',forbidden:'Value ÷ face; holder face ÷ issuer-wide debt; summing holders into a 100% register'},
  {metricType:'portfolio_weight',unit:'percent',denominator:'net_assets ("% of fund net assets") or selected_disclosed_value ("% of disclosed value")',forbidden:'Face ÷ net assets; a denominator in another currency, date or valuation basis'},
  {metricType:'clean_price / dirty_price / auction_price',unit:'price_per_100_face',denominator:'none',forbidden:'Mixing price sources, conventions or dates in one comparison'}
]);
export const FORBIDDEN_DEBT_PREDICATES=Object.freeze(['direct_equity_ownership','beneficial_ownership','voting_authority','control_assertion']);
const HOSTS=['api.fiscaldata.treasury.gov','markets.newyorkfed.org','www.sec.gov','api.gleif.org'];
const TERM_FIELDS='currencyOfDenomination issueDate datedDate firstCouponDate maturityDate couponType couponRate couponFrequency dayCount denominationMinimum denominationIncrement principalIndexation seniority optionality issuedAmountAtTranche governingLaw listingVenues';
const keys=(row,allowed)=>{if(!row||typeof row!=='object'||Object.keys(row).sort().join('|')!==allowed.split(' ').sort().join('|'))throw new Error('Unexpected bond fields');};
const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&new Date(v).toISOString().slice(0,10)===v;
const text=v=>typeof v==='string'&&v.trim().length>0;
const amount=v=>typeof v==='number'&&Number.isFinite(v)&&v>0;
const fail=message=>{throw new Error(message);};
// CUSIP (9 chars, check digit) and US/CA ISIN shapes; LEIs (20 chars) do not match.
const CUSIP=/(^|[^0-9A-Z])[0-9]{3}[0-9A-Z]{5}[0-9]([^0-9A-Z]|$)/,US_ISIN=/(US|CA)[0-9A-Z]{9}[0-9]/;
function scan(value,path=''){
  if(typeof value==='string'){if(CUSIP.test(value)||US_ISIN.test(value)||/cusip|isin/i.test(value))fail(`Proprietary instrument identifier withheld: ${path}`);return;}
  if(value&&typeof value==='object')for(const [k,v] of Object.entries(value)){if(/cusip|isin|figi|sedol/i.test(k))fail(`Proprietary instrument identifier field: ${k}`);if(/equity|voting|beneficial|control|ownership/i.test(k))fail(`Equity metric not defined for debt: ${k}`);scan(v,`${path}.${k}`);}
}
export function validateBondPilot(data){
  keys(data,'schemaVersion assetClass entities sources instruments relationships terms outstanding holdings valuations gaps');
  if(data.schemaVersion!==1||data.assetClass!=='debt')fail('Invalid bond schema');
  for(const k of ['entities','sources','instruments','relationships','terms','outstanding','holdings','valuations','gaps'])if(!Array.isArray(data[k]))fail('Invalid bond schema');
  scan(data);
  const ids=new Set(),id=row=>{if(!/^bond-[a-z0-9-]+$/.test(row.id)||ids.has(row.id))fail('Invalid or duplicate bond id');ids.add(row.id);};
  const entities=new Map(),sources=new Map(),instruments=new Map();
  for(const s of data.sources){keys(s,'id title url publisher sourceKind asOf publishedAt retrievedAt reuse');id(s);const url=new URL(s.url);
    if(!text(s.title)||!text(s.publisher)||!text(s.reuse)||url.protocol!=='https:'||url.username||url.password||!HOSTS.includes(url.hostname)||!['auction_result','dmo_register','holder_disclosure','final_prospectus','issuer_report','regulatory_reference_data'].includes(s.sourceKind)||!date(s.retrievedAt)||!date(s.asOf)||s.asOf>s.retrievedAt||(s.publishedAt!==null&&(!date(s.publishedAt)||s.publishedAt<s.asOf||s.publishedAt>s.retrievedAt)))fail('Invalid bond source');sources.set(s.id,s);}
  for(const e of data.entities){keys(e,'id name kind lei leiSourceId');id(e);
    if(!text(e.name)||/other holders|remaining holders|rest of market|residual/i.test(e.name)||!['sovereign','corporate','central_bank','fund','insurer'].includes(e.kind)||(e.lei===null)!==(e.leiSourceId===null)||(e.lei!==null&&(!/^[0-9A-Z]{18}[0-9]{2}$/.test(e.lei)||sources.get(e.leiSourceId)?.sourceKind!=='regulatory_reference_data')))fail('Invalid bond entity');entities.set(e.id,e);}
  const issuers={sovereign:new Set(),corporate:new Set()};
  for(const i of data.instruments){keys(i,'id name issuerId debtSubtype currency sameIssueGroupId');id(i);const issuer=entities.get(i.issuerId);
    if(!text(i.name)||!issuer||!['sovereign','corporate'].includes(issuer.kind)||!['bill','note','bond','frn','inflation_linked','zero_coupon','convertible'].includes(i.debtSubtype)||!/^[A-Z]{3}$/.test(i.currency)||i.sameIssueGroupId!==null)fail('Invalid bond instrument');
    issuers[issuer.kind].add(i.issuerId);instruments.set(i.id,i);}
  if(issuers.sovereign.size>1||issuers.corporate.size>1)fail('Pilot bound: one sovereign and one corporate issuer');
  for(const issuerId of [...issuers.sovereign,...issuers.corporate])if(data.instruments.filter(i=>i.issuerId===issuerId).length>2)fail('Pilot bound: at most two instruments per issuer');
  const predicate=p=>{if(FORBIDDEN_DEBT_PREDICATES.includes(p))fail(`Equity predicate rejected for debt target: ${p}`);};
  for(const r of data.relationships){keys(r,'id predicate from to sourceId');id(r);predicate(r.predicate);
    if(!['debt_issued_by','guaranteed_by','issuing_agent_for'].includes(r.predicate)||!sources.has(r.sourceId)||(r.predicate==='debt_issued_by'&&instruments.get(r.from)?.issuerId!==r.to)||(r.predicate!=='debt_issued_by'&&!entities.has(r.to)))fail('Invalid bond relationship');}
  for(const t of data.terms){keys(t,'id instrumentId sourceId termsSourceKind termsEffectiveFrom termsEffectiveTo locator excerpt fields');id(t);
    if(!instruments.has(t.instrumentId)||!sources.has(t.sourceId)||!['final_prospectus','pricing_supplement','final_terms','term_sheet_fwp','auction_announcement','auction_result','dmo_register','regulatory_reference_data','issuer_report'].includes(t.termsSourceKind)||!date(t.termsEffectiveFrom)||t.termsEffectiveTo!==null||!text(t.locator)||!text(t.excerpt))fail('Invalid bond terms');
    keys(t.fields,TERM_FIELDS);
    for(const f of Object.values(t.fields)){keys(f,'value availability reason');if(f.availability==='known'?(f.value===null||f.reason!==null):(!['unknown','not_applicable'].includes(f.availability)||f.value!==null||!text(f.reason)))fail('Invalid bond term envelope');}
    for(const k of ['issueDate','datedDate','firstCouponDate','maturityDate'])if(t.fields[k].value!==null&&!date(t.fields[k].value))fail('Invalid bond term date');
    if(t.fields.currencyOfDenomination.value!==instruments.get(t.instrumentId).currency)fail('Terms currency differs from instrument');
    if((instruments.get(t.instrumentId).debtSubtype==='inflation_linked')===(t.fields.principalIndexation.value==='none'))fail('Inflation-linked bonds require stated principal indexation');}
  const metric=(r,type,unit)=>{if(r.metricType!==type||r.unit!==unit)fail(`Wrong metric/unit: ${r.id}`);};
  for(const o of data.outstanding){keys(o,'id instrumentId sourceId metricType unit scope asOfDate faceCurrency amount scale indexed heldByIssuerExcluded locator excerpt');id(o);metric(o,'outstanding_principal','face_amount');const s=sources.get(o.sourceId);
    if(!instruments.has(o.instrumentId)||!['dmo_register','issuer_report'].includes(s?.sourceKind)||!['tranche','security_line','same_issue_group'].includes(o.scope)||o.scope!=='security_line'||!date(o.asOfDate)||o.asOfDate!==s.asOf||o.faceCurrency!==instruments.get(o.instrumentId).currency||!amount(o.amount)||![1,1000,1000000].includes(o.scale)||typeof o.indexed!=='boolean'||![true,false,'unknown'].includes(o.heldByIssuerExcluded)||!text(o.locator)||!text(o.excerpt))fail('Invalid bond outstanding observation');
    if(o.indexed&&instruments.get(o.instrumentId).debtSubtype!=='inflation_linked')fail('Only inflation-linked principal can be indexed');}
  const snapshots=new Map();
  for(const h of data.holdings){keys(h,'id instrumentId holderId predicate sourceId reportDate metricType unit faceCurrency faceAmount scale faceBasis statedInflationCompensation locator excerpt');id(h);predicate(h.predicate);metric(h,'face_amount','face_amount');const s=sources.get(h.sourceId),inst=instruments.get(h.instrumentId);
    if(!inst||!['central_bank','fund','insurer'].includes(entities.get(h.holderId)?.kind)||!['direct_debt_holding','fund_holding','managed_holding'].includes(h.predicate)||s?.sourceKind!=='holder_disclosure'||!date(h.reportDate)||h.reportDate!==s.asOf||h.faceCurrency!==inst.currency||!amount(h.faceAmount)||![1,1000,1000000].includes(h.scale)||!['not_indexed','unindexed','indexed'].includes(h.faceBasis)||(inst.debtSubtype==='inflation_linked')===(h.faceBasis==='not_indexed')||(h.statedInflationCompensation!==null&&(typeof h.statedInflationCompensation!=='number'||h.faceBasis!=='unindexed'))||!text(h.locator)||!text(h.excerpt))fail('Invalid bond holding');
    if(snapshots.has(h.sourceId)&&snapshots.get(h.sourceId)!==h.reportDate)fail('One snapshot date per holder source');snapshots.set(h.sourceId,h.reportDate);}
  for(const v of data.valuations){keys(v,'id instrumentId sourceId metricType unit value valuationDate valuationBasis priceConvention excerpt');id(v);
    if(!instruments.has(v.instrumentId)||!sources.has(v.sourceId)||!['clean_price','dirty_price','auction_price'].includes(v.metricType)||v.unit!=='price_per_100_face'||!amount(v.value)||v.value>1000||!date(v.valuationDate)||v.valuationDate>sources.get(v.sourceId).retrievedAt||!['offering_price','auction_clearing_price','market','fair','amortized_cost','book','nominal','unknown'].includes(v.valuationBasis)||!['clean','dirty','unknown'].includes(v.priceConvention)||(v.metricType==='clean_price'&&v.priceConvention!=='clean')||(v.metricType==='dirty_price'&&v.priceConvention!=='dirty')||!text(v.excerpt))fail('Invalid bond valuation');}
  for(const g of data.gaps){keys(g,'id instrumentId category reason detail');id(g);
    if(!instruments.has(g.instrumentId)||!['coverage','outstanding','valuation','metric','reporting_period'].includes(g.category)||!['holder_register_not_public','below_disclosure_threshold','held_via_depository','source_not_admitted','not_stated_in_source','basis_needs_review','basis_not_documented','stale_outstanding'].includes(g.reason)||!text(g.detail))fail('Invalid bond gap');}
  for(const i of data.instruments){
    if(!data.gaps.some(g=>g.instrumentId===i.id&&g.category==='coverage'))fail('Every line needs an explicit holder-coverage gap');
    if(!data.terms.some(t=>t.instrumentId===i.id)||!data.outstanding.some(o=>o.instrumentId===i.id))fail('Every line needs terms and an outstanding observation (go/no-go)');}
  if(claimCount(data)>30)fail('Pilot bound: at most 30 claims');
  for(const h of data.holdings){const total=data.holdings.filter(x=>x.instrumentId===h.instrumentId&&x.reportDate===h.reportDate).reduce((n,x)=>n+x.faceAmount*x.scale,0),o=data.outstanding.find(x=>x.instrumentId===h.instrumentId&&x.asOfDate===h.reportDate);if(o&&total>o.amount*o.scale)fail('Stop condition: disclosed holders exceed outstanding');}
  return data;
}
export const claimCount=data=>['relationships','terms','outstanding','holdings','valuations'].reduce((n,k)=>n+data[k].length,0);
const basis=row=>row.indexed===true||row.faceBasis==='indexed'?'indexed':'unindexed';
// §5.2 compatibility: face amounts add only within one line, currency, date and indexation basis.
export function sumFace(rows){
  if(!rows.length)fail('Nothing to add');
  for(const r of rows)if(r.unit!=='face_amount')fail('Refusing to add face amounts with currency values or other units');
  const same=(label,f)=>{if(new Set(rows.map(f)).size>1)fail(`Refusing to aggregate across ${label}`);};
  same('currencies',r=>r.faceCurrency);same('tranches or lines',r=>r.instrumentId);same('dates',r=>r.reportDate??r.asOfDate);same('indexation bases',basis);
  return rows.reduce((n,r)=>n+(r.faceAmount??r.amount)*r.scale,0);
}
export function sumValues(rows){
  if(!rows.length)fail('Nothing to add');
  for(const r of rows)if(r.unit!=='currency_value')fail('Refusing to add currency values with face amounts or prices');
  if(rows.some(r=>r.priceConvention==='unknown'||r.valuationBasis==='unknown'))fail('Refusing to aggregate values with unknown convention or basis');
  const same=(label,f)=>{if(new Set(rows.map(f)).size>1)fail(`Refusing to aggregate across ${label}`);};
  same('currencies',r=>r.valueCurrency);same('dates',r=>r.valuationDate);same('valuation bases',r=>r.valuationBasis);same('price conventions',r=>r.priceConvention);
  return rows.reduce((n,r)=>n+r.value,0);
}
export function portfolioWeight(numerator,denominator){
  if(numerator.unit!=='currency_value')fail('Portfolio weight needs a reported value numerator, never face');
  if(!['net_assets','selected_disclosed_value'].includes(denominator.kind))fail('Portfolio weight needs a named denominator');
  if(numerator.valueCurrency!==denominator.valueCurrency||numerator.valuationDate!==denominator.valuationDate)fail('Denominator currency or date differs');
  if(denominator.kind==='selected_disclosed_value'&&numerator.valuationBasis!==denominator.valuationBasis)fail('Denominator valuation basis differs');
  return {value:numerator.value/denominator.value*100,unit:'percent',label:denominator.kind==='net_assets'?'% of fund net assets':`% of disclosed ${denominator.scope} value`};
}
export function shareOfIssue(data,holdingId){
  const h=data.holdings.find(x=>x.id===holdingId);if(!h)fail('Unknown holding');
  const lines=data.outstanding.filter(o=>o.instrumentId===h.instrumentId);
  const o=lines.find(x=>x.asOfDate===h.reportDate);
  if(!o)return {status:'unknown',reason:'no_outstanding_at_holding_date',label:'No outstanding observation at the holding date; not carried across dates'};
  if(o.faceCurrency!==h.faceCurrency)return {status:'unknown',reason:'currency_mismatch',label:'Face currencies differ'};
  if(basis(o)!==basis(h))return {status:'unknown',reason:'indexation_basis_mismatch',label:`Holding is ${basis(h)} par; outstanding is ${basis(o)} principal`};
  return {status:'known',value:h.faceAmount*h.scale/(o.amount*o.scale)*100,unit:'percent',outstandingId:o.id,label:`share of outstanding principal (face ÷ face, ${o.scope.replace('_',' ')}, as of ${o.asOfDate})`};
}
// Disclosed-holder coverage. The complement is an explicit gap, never a holder.
export function holderCoverage(data,instrumentId){
  const holdings=data.holdings.filter(h=>h.instrumentId===instrumentId);
  if(!holdings.length)return {status:'no_disclosed_holders',coverageStatus:'unknown'};
  if(new Set(holdings.map(h=>h.reportDate)).size>1||holdings.length>1)return {status:'side_by_side',coverageStatus:'partial',reason:'overlap_or_dates_unreviewed'};
  const share=shareOfIssue(data,holdings[0].id);
  if(share.status!=='known')return {status:'side_by_side',coverageStatus:'partial',reason:share.reason};
  return {status:'computed',coverageStatus:'partial',disclosed:share.value,undisclosed:100-share.value,label:'share of outstanding principal attributed to disclosed holders'};
}
validateBondPilot(bondPilot);
