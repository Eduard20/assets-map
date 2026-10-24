// Country dimensions are independent facts. None is inferred from another, from a name, a legal-form suffix or a currency.
// Isolated pilot: never enters graph-model, portfolio totals, security equivalence or issuer identity resolution. No country aggregate exists.
const R='2026-10-24';
const AR='https://ameriabank.am/Portals/0/files/ir/annual-reports/annual_report_2025_eng.pdf',CV='https://conversebank.am/en/shareholders/',CBA='https://www.cba.am/en/licensed-banks/';
const SEC='https://www.sec.gov/Archives/edgar/data/1717393/000110465926029442/',GL='https://api.gleif.org/api/v1/lei-records/';
const AR_NOTE='PDF p. 52 (printed pp. 101–102), Notes: Background, Organisation and operations';
export const DIMENSIONS=[
  {id:'investorDomicile',label:'Investor domicile',scope:'claim',kind:'country',definition:'Where the holding party is domiciled or resident, as stated for its role as investor (registry jurisdiction or the regulator-defined residence status in the disclosure).',canSay:'"Armenian investors": holders that a source places in Armenia.',cannotSay:'Where the held asset is, where the issuer is incorporated, or where any ultimate owner sits. "Non-resident" excludes Armenia but names no country.'},
  {id:'issuerDomicile',label:'Issuer / legal-entity domicile',scope:'entity',kind:'country',definition:'The jurisdiction under whose law the entity is incorporated or registered.',canSay:'"Armenian companies": entities legally established in Armenia.',cannotSay:'Where the entity operates or where its owners are. A foreign-incorporated parent can run Armenian operations.'},
  {id:'listingLocation',label:'Exchange / listing location',scope:'entity',kind:'country',definition:'The country of an exchange on which the entity\'s equity is listed, per the exchange record or the issuer\'s registration statement.',canSay:'"Listed in Armenia": equity listed on an Armenian exchange.',cannotSay:'Domicile, operations or investor base. Unlisted is never assumed from absence of evidence.'},
  {id:'operatingLocation',label:'Underlying asset / operating location',scope:'entity',kind:'country',definition:'Where the source says the entity\'s operations, licensed activity or concession assets are.',canSay:'"Assets in Armenia" and "exposure to Armenia" at the level of named operations.',cannotSay:'How much of the entity is Armenian, or any country total. Segment names are the issuer\'s reporting construct, not an asset census.'},
  {id:'reportingCurrency',label:'Reporting / valuation currency',scope:'entity',kind:'currency',definition:'The presentation currency of the source\'s figures.',canSay:'Which currency the reported amounts are in.',cannotSay:'Any geography. AMD reporting does not make an entity Armenian, and USD reporting does not make it American.'}
];
const DIM_IDS=DIMENSIONS.map(d=>d.id),ENTITY_DIMS=DIM_IDS.filter(id=>id!=='investorDomicile');
export const COUNTRY_NAMES={AM:'Armenia',GB:'United Kingdom',GE:'Georgia',LU:'Luxembourg',FR:'France',US:'United States',AR:'Argentina',IT:'Italy',BR:'Brazil',UY:'Uruguay',EC:'Ecuador'};
export const CURRENCY_NAMES={AMD:'Armenian dram',USD:'US dollar'};
const BASES={
  investorDomicile:['registry_jurisdiction','residence_status','incorporation_statement'],
  issuerDomicile:['registry_jurisdiction','incorporation_statement','subsidiary_list'],
  listingLocation:['exchange_listing_record','listing_statement'],
  operatingLocation:['operations_statement','regulator_licence','concession_statement','segment_disclosure'],
  reportingCurrency:['presentation_currency_statement']
};
export const BASIS_LABELS={registry_jurisdiction:'LEI registry jurisdiction',residence_status:'residence status stated in the disclosure',incorporation_statement:'incorporation statement',subsidiary_list:'issuer\'s list of subsidiaries',exchange_listing_record:'exchange instrument record',listing_statement:'listing statement',operations_statement:'operations statement',regulator_licence:'banking licence register',concession_statement:'concession statement',segment_disclosure:'reportable segments',presentation_currency_statement:'presentation currency statement'};
export const UNKNOWN_REASONS={not_stated_in_source:'not stated in the cited source',not_reviewed_in_pilot:'not reviewed in this pilot',no_inference_from_name:'only the name or legal-form suffix points anywhere; no inference from a name',no_listing_found:'no equity listing found in the reviewed sources (not recorded as unlisted)',percentage_not_stated:'percentage not stated'};
const known=(codes,basis,sourceId,locator,excerpt,note=null)=>({status:'known',codes,basis,sourceId,locator,excerpt,reason:null,note});
const nonResident=(sourceId,locator,excerpt,note)=>({status:'non_resident',codes:[],basis:'residence_status',sourceId,locator,excerpt,reason:null,note});
const unknown=(reason,note)=>({status:'unknown',codes:[],basis:null,sourceId:null,locator:null,excerpt:null,reason,note});
const NR='Counterparty: only its investor-role domicile is recorded.';
const dims=(o={})=>Object.fromEntries(ENTITY_DIMS.map(id=>[id,o[id]??unknown('not_reviewed_in_pilot',NR)]));
const cvHolder=(name)=>`Shareholders page, holder "${name}"`;
export const countryPilot={
  schemaVersion:1,
  country:'AM',
  dimensions:DIMENSIONS,
  sources:[
    {id:'country-src-ameria-ar',publisher:'Ameriabank CJSC',title:'Ameriabank Annual Report 2025 (consolidated financial statements)',url:AR,asOf:'2025-12-31',asOfBasis:'statement_date',retrievedAt:R,language:'en',reuse:'© Ameriabank, all rights reserved (website terms of use); no open licence. Only short factual excerpts are kept, with attribution and a link.',excerpt:'As at 31 December 2025 and 2024 the Bank’s shareholding structure was as follows'},
    {id:'country-src-converse',publisher:'Converse Bank CJSC',title:'Converse Bank: Shareholders (About Us)',url:CV,asOf:'2025-02-14',asOfBasis:'page_last_updated',retrievedAt:R,language:'en (Armenian version prevails)',reuse:'© Converse Bank; the terms page grants no reuse licence. Only short factual excerpts are kept, with attribution and a link.',excerpt:'Note: In case of discrepancies between the Armenian and English versions of this page, the Armenian version shall prevail. Last update: 2025-02-14 11:12:54'},
    {id:'country-src-amx-acba-holders',publisher:'Armenia Securities Exchange (AMX)',title:'AMX issuer database: ACBA BANK OJSC major shareholders (API record behind the issuer page)',url:'https://amx.am/api/major-shareholders/2',asOf:'2026-05-07',asOfBasis:'record_updated',retrievedAt:R,language:'hy/en/ru',reuse:'© Armenia Stock Exchange, all rights reserved; robots.txt Content-Signal "use=reference". Facts referenced with attribution and a link.',excerpt:'"ACBA FEDERATION" CJSC … shares_percent 75.0000 … (Proparco) … shares_percent 10.0000 … updated_at 2026-05-07'},
    {id:'country-src-amx-acba-issuer',publisher:'Armenia Securities Exchange (AMX)',title:'AMX issuer database: ACBA BANK OJSC profile and instruments (API record)',url:'https://amx.am/api/issuer/2',asOf:'2026-02-09',asOfBasis:'record_updated',retrievedAt:R,language:'hy/en/ru',reuse:'© Armenia Stock Exchange, all rights reserved; robots.txt Content-Signal "use=reference". Facts referenced with attribution and a link.',excerpt:'company_short_name_en ACBA BANK OJSC | country_en Republic of Armenia | updated_at 2026-02-09'},
    {id:'country-src-cba-banks',publisher:'Central Bank of Armenia',title:'CBA register of licensed banks',url:CBA,asOf:null,asOfBasis:'undated_register',retrievedAt:R,language:'en (hy available)',reuse:'© Central Bank of Armenia (terms of use: content protected; information for informational purposes). Only licence facts are kept, with attribution and a link.',excerpt:'Licensed Financial Organizations · Banks'},
    {id:'country-src-caap-20f',publisher:'Corporación América Airports S.A. (SEC EDGAR)',title:'Form 20-F for fiscal year 2025, accession 0001104659-26-029442',url:`${SEC}caap-20251231x20f.htm`,asOf:'2025-12-31',asOfBasis:'statement_date',retrievedAt:R,language:'en',reuse:'SEC EDGAR filing; the SEC webmaster FAQ states public filing content may be accessed and reused freely.',excerpt:'Filed 2026-03-17; period of report 2025-12-31.'},
    {id:'country-src-caap-ex81',publisher:'Corporación América Airports S.A. (SEC EDGAR)',title:'Form 20-F 2025, Exhibit 8.1 List of Subsidiaries',url:`${SEC}caap-20251231xex8d1.htm`,asOf:'2025-12-31',asOfBasis:'statement_date',retrievedAt:R,language:'en',reuse:'SEC EDGAR filing; the SEC webmaster FAQ states public filing content may be accessed and reused freely.',excerpt:'Exhibit 8.1 List of Subsidiaries'},
    {id:'country-src-lion-rns',publisher:'Lion Finance Group PLC (FCA National Storage Mechanism)',title:'4Q25 and FY25 preliminary results, RNS 2459U, 25 February 2026',url:'https://data.fca.org.uk/artefacts/NSM/RNS/a746d49f-ea50-4c6d-a5b0-9dd0f6bfca90.html',asOf:'2026-02-25',asOfBasis:'publication_date',retrievedAt:R,language:'en',reuse:'FCA NSM terms of use: material in the NSM may be used "for any lawful purpose not otherwise excluded" by the terms or the Acceptable Use Policy.',excerpt:'Lion Finance Group PLC profile'},
    ...[['lion','213800XKDG12NQG8VC53','LION FINANCE GROUP PLC','2026-03-05'],['bog','549300RPLD8RXL49Z691','JSC BANK OF GEORGIA (legal name in Georgian script)','2025-10-09'],['ebrd','549300HTGDOVDU6OGK19','EUROPEAN BANK FOR RECONSTRUCTION AND DEVELOPMENT','2026-04-22'],['proparco','969500MRC3KUWRJZP418','SOCIETE DE PROMOTION ET DE PARTICIPATION POUR LA COOPERATION ECONOMIQUE','2026-09-01'],['converse','5493007B2FR3CCMU7O30','Converse Bank','2026-10-07'],['acba','529900XZRBMAJ6ZKAR24','ACBA BANK (legal name in Armenian script)','2026-10-17']]
      .map(([k,lei,name,last])=>({id:`country-src-gleif-${k}`,publisher:'Global Legal Entity Identifier Foundation (GLEIF)',title:`LEI record ${lei} · ${name}`,url:`${GL}${lei}`,asOf:last,asOfBasis:'registry_last_update',retrievedAt:R,language:'en (legal name in local script where registered)',reuse:'GLEIF LEI data terms of use: provided under the CC0 licence.',excerpt:`lei ${lei} | registration.status ISSUED | lastUpdateDate ${last}`}))
  ],
  entities:[
    {id:'country-entity-ameriabank',name:'Ameriabank CJSC',kind:'legal_entity',role:'subject',lei:'254900J7SBC0UJ0GQF17',dims:dims({
      issuerDomicile:known(['AM'],'incorporation_statement','country-src-ameria-ar',AR_NOTE,'Ameriabank CJSC (formerly Armimpexbank CJSC) (the Bank) was established on 8 December 1992 under the laws of the Republic of Armenia.'),
      listingLocation:unknown('no_listing_found','Closed joint-stock company.'),
      operatingLocation:known(['AM'],'operations_statement','country-src-ameria-ar','PDF p. 52, Notes: Background, Armenian business environment','The Group’s operations are primarily located in Armenia.','"Primarily", not exclusively.'),
      reportingCurrency:known(['AMD'],'presentation_currency_statement','country-src-ameria-ar','PDF p. 52, Notes: Basis of preparation, Functional and presentation currency','The AMD is also the presentation currency for the purposes of these consolidated financial statements.')}),
      coverage:'Disclosed universe: the shareholding table in the bank\'s 2025 notes lists three holders and a 100.00% total row as at 2025-12-31. The source also states "the parent company of the Group is Lion Finance Group PLC" and "no ultimate controlling party".'},
    {id:'country-entity-converse',name:'Converse Bank CJSC',kind:'legal_entity',role:'subject',lei:'5493007B2FR3CCMU7O30',dims:dims({
      issuerDomicile:known(['AM'],'registry_jurisdiction','country-src-gleif-converse','LEI record, entity.jurisdiction and entity.legalAddress.country','legalName Converse Bank | jurisdiction AM | legalAddress.country AM'),
      listingLocation:unknown('no_listing_found','Closed joint-stock company.'),
      operatingLocation:known(['AM'],'regulator_licence','country-src-cba-banks','Licensed banks list, entry "Converse Bank" CJSC','"Converse Bank" CJSC … Organization\'s license number: 57 … Date of issuance of the license: 12/20/1993','A CBA banking licence places regulated banking activity in Armenia. It does not locate every asset.'),
      reportingCurrency:unknown('not_reviewed_in_pilot','The shareholders page states equity as "19,947,633,300 AMD", but the financial statements\' presentation currency was not reviewed.')}),
      coverage:'Disclosed universe: the bank\'s shareholders page (last updated 2025-02-14) lists three significant participants and two indirect significant participants. A natural person at the top of one chain is excluded.'},
    {id:'country-entity-acba',name:'ACBA BANK OJSC',kind:'legal_entity',role:'subject',lei:'529900XZRBMAJ6ZKAR24',dims:dims({
      issuerDomicile:known(['AM'],'registry_jurisdiction','country-src-gleif-acba','LEI record, entity.jurisdiction and entity.legalAddress.country','otherNames ACBA BANK | jurisdiction AM | legalAddress.country AM'),
      listingLocation:known(['AM'],'exchange_listing_record','country-src-amx-acba-issuer','issuer_instruments, ticker ACBA','ticker ACBA | instrument_type_en Equity | isin_status_en Listed','The exchange record status "Listed". The AMX profile field country_en "Republic of Armenia" is not used as legal domicile.'),
      operatingLocation:known(['AM'],'regulator_licence','country-src-cba-banks','Licensed banks list, entry "ACBA BANK" OJSC','"ACBA BANK" OJSC … Organization\'s license number: 70 … Date of issuance of the license: 3/29/1996','A CBA banking licence places regulated banking activity in Armenia. It does not locate every asset.'),
      reportingCurrency:unknown('not_reviewed_in_pilot','Financial statements were not reviewed.')}),
      coverage:'Disclosed universe: the AMX major-shareholder record (updated 2026-05-07) itemises two holders. It has no total row, and the rest of the register is not itemised in this source.'},
    {id:'country-entity-aia',name:'Armenia International Airports CJSC',kind:'legal_entity',role:'subject',lei:null,dims:dims({
      issuerDomicile:known(['AM'],'subsidiary_list','country-src-caap-ex81','Exhibit 8.1, entry for Armenia International Airports C.J.S.C.','Armenia International Airports C.J.S.C. · Armenia','The parent\'s subsidiary list pairs the entity with Armenia. No LEI was found for this entity.'),
      listingLocation:unknown('no_listing_found','Only the parent\'s filing was reviewed.'),
      operatingLocation:known(['AM'],'concession_statement','country-src-caap-20f','Item 4.A History and Development of the Company','In 2002, our subsidiary Armenia International Airports CJSC (“AIA”) was awarded the concession to operate the Zvartnots International Airport (“Zvartnots Airport”), located 12 kilometers from downtown Yerevan, Armenia’s capital.'),
      reportingCurrency:unknown('not_stated_in_source','AIA\'s own statements are not in the parent\'s filing. The parent reports in USD, which says nothing about AIA.')}),
      coverage:'Disclosed universe: the parent\'s 20-F calls AIA "our subsidiary". No percentage is captured, and no other holder is reviewed.'},
    {id:'country-entity-caap',name:'Corporación América Airports S.A.',kind:'legal_entity',role:'cross_border_issuer',lei:'959800AWF26KMY2SXF71',dims:dims({
      issuerDomicile:known(['LU'],'incorporation_statement','country-src-caap-20f','Certain Conventions','Corporación América Airports S.A. (“CAAP”) was incorporated under the laws of the Grand Duchy of Luxembourg (“Luxembourg”) on December 14, 2012.'),
      listingLocation:known(['US'],'listing_statement','country-src-caap-20f','Cover page, securities registered pursuant to Section 12(b)','Common Shares, U.S.$1.00 nominal value per share · CAAP · New York Stock Exchange'),
      operatingLocation:known(['AR','IT','BR','UY','EC','AM'],'segment_disclosure','country-src-caap-20f','Presentation of Financial Information, Our Segments','As of and for the fiscal year ended December 31, 2025, we have identified six reportable segments: Argentina, Italy, Brazil, Uruguay, Ecuador and Armenia.','Segments are named by country. The pilot does not split the issuer by segment or attribute any share of it to Armenia.'),
      reportingCurrency:known(['USD'],'presentation_currency_statement','country-src-caap-20f','Presentation of Financial Information','Our Audited Consolidated Financial Statements are presented in U.S. dollars.')}),
      coverage:'Cross-border issuer: Luxembourg-incorporated and NYSE-listed, reporting in USD, with an Armenian operating segment through its Armenian subsidiary.'},
    {id:'country-entity-lion',name:'Lion Finance Group PLC',kind:'legal_entity',role:'counterparty',lei:'213800XKDG12NQG8VC53',dims:dims({
      issuerDomicile:known(['GB'],'incorporation_statement','country-src-lion-rns','Lion Finance Group PLC profile','Registered under number 10917019 in England and Wales','England and Wales is recorded as GB.'),
      listingLocation:known(['GB'],'listing_statement','country-src-lion-rns','Lion Finance Group PLC profile','Lion Finance Group PLC is listed on the London Stock Exchange\'s main market in the Equity Shares (Commercial Companies) category')}),coverage:null},
    {id:'country-entity-bog',name:'JSC Bank of Georgia',kind:'legal_entity',role:'counterparty',lei:'549300RPLD8RXL49Z691',dims:dims(),coverage:null},
    {id:'country-entity-ebrd',name:'European Bank for Reconstruction and Development (EBRD)',kind:'international_organisation',role:'counterparty',lei:'549300HTGDOVDU6OGK19',dims:dims(),coverage:null},
    {id:'country-entity-agi-llc',name:'"Advanced Global Investments" LLC',kind:'legal_entity',role:'counterparty',lei:null,dims:dims(),coverage:null},
    {id:'country-entity-agi-sarl',name:'"Advanced Global Investments" S.a.r.I. (former "Blakery Assets" LTD)',kind:'legal_entity',role:'counterparty',lei:null,dims:dims(),coverage:null},
    {id:'country-entity-haypost',name:'HayPost Trust Management S. a. r. l.',kind:'legal_entity',role:'counterparty',lei:null,dims:dims(),coverage:null},
    {id:'country-entity-postfinance',name:'PostFinance international S.a.r.I.',kind:'legal_entity',role:'counterparty',lei:null,dims:dims(),coverage:null},
    {id:'country-entity-church',name:'The Armenian Apostolic Church, presented by Mother See of Holy Etchmiadzin',kind:'religious_organisation',role:'counterparty',lei:null,dims:dims(),coverage:null},
    {id:'country-entity-acba-federation',name:'"ACBA FEDERATION" CJSC',kind:'legal_entity',role:'counterparty',lei:null,dims:dims({issuerDomicile:unknown('no_inference_from_name','The AMX record states no country, and no LEI record was found. The Armenian-script name and the "CJSC" suffix are not evidence of domicile.')}),coverage:null},
    {id:'country-entity-proparco',name:'Société de Promotion et de Participation pour la Coopération Économique (Proparco)',kind:'legal_entity',role:'counterparty',lei:'969500MRC3KUWRJZP418',dims:dims(),coverage:null}
  ],
  claims:[
    {id:'country-claim-ameria-lion',type:'direct_equity_ownership',from:'country-entity-lion',to:'country-entity-ameriabank',stake:{status:'known',percentage:'60.00',denominator:'Bank shares (shareholding structure table)'},asOf:'2025-12-31',sourceId:'country-src-ameria-ar',locator:`${AR_NOTE}, shareholding table`,excerpt:'Lion Finance Group PLC 60.00% 60.00%',
      investorDomicile:known(['GB'],'registry_jurisdiction','country-src-gleif-lion','LEI record, entity.jurisdiction','legalName LION FINANCE GROUP PLC | jurisdiction GB | legalAddress.country GB')},
    {id:'country-claim-ameria-bog',type:'direct_equity_ownership',from:'country-entity-bog',to:'country-entity-ameriabank',stake:{status:'known',percentage:'30.00',denominator:'Bank shares (shareholding structure table)'},asOf:'2025-12-31',sourceId:'country-src-ameria-ar',locator:`${AR_NOTE}, shareholding table`,excerpt:'Bank of Georgia JSC 30.00% 30.00%',
      investorDomicile:known(['GE'],'registry_jurisdiction','country-src-gleif-bog','LEI record, entity.jurisdiction','otherNames JOINT STOCK COMPANY BANK OF GEORGIA | jurisdiction GE | legalAddress.country GE','The source table names "Bank of Georgia JSC". The LEI match is corroborated beyond the name: this LEI\'s direct accounting-consolidation parent is Lion Finance Group PLC\'s LEI, the holder named beside it. It is a reviewable candidate match, not a merge.')},
    {id:'country-claim-ameria-ebrd',type:'direct_equity_ownership',from:'country-entity-ebrd',to:'country-entity-ameriabank',stake:{status:'known',percentage:'10.00',denominator:'Bank shares (shareholding structure table)'},asOf:'2025-12-31',sourceId:'country-src-ameria-ar',locator:`${AR_NOTE}, shareholding table`,excerpt:'European Bank of Reconstruction and Development (EBRD) 10.00% 10.00%',
      investorDomicile:known(['GB'],'registry_jurisdiction','country-src-gleif-ebrd','LEI record, entity.jurisdiction','legalName EUROPEAN BANK FOR RECONSTRUCTION AND DEVELOPMENT | jurisdiction GB | legalForm other BANK','The EBRD is an international financial institution. GB is the LEI registry\'s jurisdiction field, not a statement that it is a UK company. The source spells it "European Bank of Reconstruction and Development"; the LEI match is a reviewable candidate, not a merge.')},
    {id:'country-claim-converse-agi',type:'direct_equity_ownership',from:'country-entity-agi-llc',to:'country-entity-converse',stake:{status:'known',percentage:'72.89',denominator:'Equity share'},asOf:'2025-02-14',sourceId:'country-src-converse',locator:cvHolder('"Advanced Global Investments" LLC'),excerpt:'"Advanced Global Investments" LLC … Residence: non-resident … Equity share: 72.89%',
      investorDomicile:nonResident('country-src-converse',cvHolder('"Advanced Global Investments" LLC'),'Residence: non-resident','Not Armenian-resident. The country is not stated, and no LEI record was found.')},
    {id:'country-claim-converse-haypost',type:'direct_equity_ownership',from:'country-entity-haypost',to:'country-entity-converse',stake:{status:'known',percentage:'22.11',denominator:'Equity share'},asOf:'2025-02-14',sourceId:'country-src-converse',locator:cvHolder('HayPost Trust Management S. a. r. l.'),excerpt:'HayPost Trust Management S. a. r. l. … Residence: non-resident … Equity share: 22.11%',
      investorDomicile:nonResident('country-src-converse',cvHolder('HayPost Trust Management S. a. r. l.'),'Residence: non-resident','Not Armenian-resident. The country is not stated. The "S.a.r.l." suffix is not used to infer one.')},
    {id:'country-claim-converse-church',type:'direct_equity_ownership',from:'country-entity-church',to:'country-entity-converse',stake:{status:'known',percentage:'5',denominator:'Equity share'},asOf:'2025-02-14',sourceId:'country-src-converse',locator:cvHolder('The Armenian Apostolic Church'),excerpt:'The Armenian Apostolic Church, presented by Mother See of Holy Etchmiadzin … Residence: resident … Equity share : 5%',
      investorDomicile:known(['AM'],'residence_status','country-src-converse',cvHolder('The Armenian Apostolic Church'),'Residence: resident','Resident under the bank\'s Armenian disclosure, recorded as AM.')},
    {id:'country-claim-agi-sarl-llc',type:'direct_equity_ownership',from:'country-entity-agi-sarl',to:'country-entity-agi-llc',stake:{status:'known',percentage:'100',denominator:'Shares of "Advanced Global Investments" LLC'},asOf:'2025-02-14',sourceId:'country-src-converse',locator:'Shareholders page, Indirect significant participant',excerpt:'"Advanced Global Investments" S.a.r.I. is the indirect significant participant of "Converse Bank" CJSC as holds 100% shares of "Advanced Global Investments" LLC, which is the significant participant of the Bank.',
      investorDomicile:unknown('not_stated_in_source','The page gives no residence for indirect participants. The "S.a.r.I." suffix is not used to infer a country.')},
    {id:'country-claim-postfinance-haypost',type:'direct_equity_ownership',from:'country-entity-postfinance',to:'country-entity-haypost',stake:{status:'known',percentage:'100',denominator:'Shares of HayPost Trust Management S.a.r.I.'},asOf:'2025-02-14',sourceId:'country-src-converse',locator:'Shareholders page, Indirect significant participant',excerpt:'PostFinance international S.a.r.I. is an indirect significant participant of "Converse Bank" CJSC, as it owns 100% of the shares of "HayPost Trust Management S.a.r.I., a significant participant of the Bank.',
      investorDomicile:unknown('not_stated_in_source','No residence is given. The LEI search found a differently named "PostFinance International Development B.V." (NL), which is not merged with this entity.')},
    {id:'country-claim-acba-federation',type:'direct_equity_ownership',from:'country-entity-acba-federation',to:'country-entity-acba',stake:{status:'known',percentage:'75.0000',denominator:'shares_percent (AMX major-shareholder record)'},asOf:'2026-05-07',sourceId:'country-src-amx-acba-holders',locator:'Record id 1, company_id 2',excerpt:'"ACBA FEDERATION" CJSC | shares_count 4488993.0000 | shares_percent 75.0000',
      investorDomicile:unknown('no_inference_from_name','The AMX record has no country or residence field, and no LEI record was found. The name is not used.')},
    {id:'country-claim-acba-proparco',type:'direct_equity_ownership',from:'country-entity-proparco',to:'country-entity-acba',stake:{status:'known',percentage:'10.0000',denominator:'shares_percent (AMX major-shareholder record)'},asOf:'2026-05-07',sourceId:'country-src-amx-acba-holders',locator:'Record id 2, company_id 2',excerpt:'«SOCIÉTÉ DE PROMOTION ET DE PARTICIPATION POUR LA COOPERATION ÉCONOMIQUE» Public Limited Company (Proparco) | shares_count 598500.0000 | shares_percent 10.0000',
      investorDomicile:known(['FR'],'registry_jurisdiction','country-src-gleif-proparco','LEI record, entity.jurisdiction','legalName SOCIETE DE PROMOTION ET DE PARTICIPATION POUR LA COOPERATION ECONOMIQUE | jurisdiction FR | legalAddress.country FR')},
    {id:'country-claim-caap-aia',type:'subsidiary_relation',from:'country-entity-caap',to:'country-entity-aia',stake:{status:'unknown',percentage:null,denominator:null,reason:'percentage_not_stated'},asOf:'2025-12-31',sourceId:'country-src-caap-20f',locator:'Item 4.A History and Development of the Company',excerpt:'In 2002, our subsidiary Armenia International Airports CJSC (“AIA”) was awarded the concession',
      investorDomicile:known(['LU'],'incorporation_statement','country-src-caap-20f','Certain Conventions','Corporación América Airports S.A. (“CAAP”) was incorporated under the laws of the Grand Duchy of Luxembourg')}
  ],
  paths:[
    {id:'country-path-converse-agi',claimIds:['country-claim-agi-sarl-llc','country-claim-converse-agi'],note:'Cross-border chain kept with its intermediate. The source calls the S.a.r.I. an "indirect significant participant". No look-through percentage is computed.'},
    {id:'country-path-converse-postfinance',claimIds:['country-claim-postfinance-haypost','country-claim-converse-haypost'],note:'Cross-border chain kept with its intermediate. No look-through percentage is computed.'}
  ],
  exclusions:[
    {id:'country-excl-converse-agi-owner',subjectId:'country-entity-agi-sarl',holderKind:'natural_person',sourceId:'country-src-converse',reason:'The source names the 100% shareholder of "Advanced Global Investments" S.a.r.I. as an individual. Natural person, excluded for privacy: no name is stored.'}
  ]
};
// --- queries (record matches only; never sums stakes, values or countries) ---
const matches=(v,code)=>code==='unknown'?v.status==='unknown':code==='non_resident'?v.status==='non_resident':v.status==='known'&&v.codes.includes(code);
export function queryCountry(data,dimension,code){
  const dim=DIMENSIONS.find(d=>d.id===dimension);if(!dim)throw new Error('Unknown country dimension');
  if(dim.scope==='claim')return {dimension:dim,code,claims:data.claims.filter(c=>matches(c.investorDomicile,code)),entities:[]};
  return {dimension:dim,code,claims:[],entities:data.entities.filter(e=>matches(e.dims[dimension],code))};
}
export function dimensionValues(data,dimension){
  const dim=DIMENSIONS.find(d=>d.id===dimension),vals=dim.scope==='claim'?data.claims.map(c=>c.investorDomicile):data.entities.map(e=>e.dims[dimension]);
  const codes=[...new Set(vals.flatMap(v=>v.codes))].sort((a,b)=>a==='AM'?-1:b==='AM'?1:a.localeCompare(b));
  return [...codes,...(vals.some(v=>v.status==='non_resident')?['non_resident']:[]),...(vals.some(v=>v.status==='unknown')?['unknown']:[])];
}
// A chain keeps every intermediate. Stakes are not multiplied in this pilot.
export function ownershipPath(data,pathId){const p=data.paths.find(x=>x.id===pathId),claims=p.claimIds.map(id=>data.claims.find(c=>c.id===id));return {entities:[claims[0].from,...claims.map(c=>c.to)],claims,derivedPercentage:null,reason:'no_chain_multiplication_in_pilot'};}
// Armenian entity = Armenia-domiciled or Armenia-resident per a source. Operating in Armenia alone (a foreign issuer) does not count.
export const armenianEntityIds=data=>[...new Set([...data.entities.filter(e=>e.dims.issuerDomicile.codes.includes('AM')).map(e=>e.id),...data.claims.filter(c=>c.investorDomicile.codes.includes('AM')).map(c=>c.from)])];
export const factCount=data=>data.claims.length+data.entities.reduce((n,e)=>n+ENTITY_DIMS.filter(d=>e.dims[d].status!=='unknown').length,0);
// --- validator ---
const keys=(row,allowed,what='country')=>{if(!row||typeof row!=='object'||Array.isArray(row)||Object.keys(row).sort().join('|')!==allowed.split(' ').sort().join('|'))throw new Error(`Unexpected ${what} fields`);};
const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&new Date(v).toISOString().slice(0,10)===v;
const text=v=>typeof v==='string'&&v.trim().length>0;
const HOSTS=['ameriabank.am','conversebank.am','www.cba.am','amx.am','api.gleif.org','www.sec.gov','data.fca.org.uk'];
const AS_OF_BASES=['statement_date','page_last_updated','record_updated','registry_last_update','publication_date','undated_register'];
const COUNTRIES=Object.keys(COUNTRY_NAMES),CURRENCIES=Object.keys(CURRENCY_NAMES);
const KINDS=['legal_entity','international_organisation','religious_organisation'],ROLES=['subject','cross_border_issuer','counterparty'];
const PCT=/^(100(\.0+)?|\d{1,2}(\.\d+)?)$/;
export function validateCountryPilot(data){
  keys(data,'schemaVersion country dimensions sources entities claims paths exclusions');
  if(data.schemaVersion!==1||data.country!=='AM'||![data.dimensions,data.sources,data.entities,data.claims,data.paths,data.exclusions].every(Array.isArray))throw new Error('Invalid country schema');
  if(data.dimensions.map(d=>d.id).join('|')!==DIM_IDS.join('|'))throw new Error('Country dimensions must be the five independent fields');
  for(const d of data.dimensions){keys(d,'id label scope kind definition canSay cannotSay','dimension');if(![d.label,d.definition,d.canSay,d.cannotSay].every(text))throw new Error('Invalid country dimension');}
  const sources=new Map();
  for(const s of data.sources){keys(s,'id publisher title url asOf asOfBasis retrievedAt language reuse excerpt','source');const url=new URL(s.url);
    if(sources.has(s.id)||!/^country-src-[a-z0-9-]+$/.test(s.id)||![s.publisher,s.title,s.language,s.reuse,s.excerpt].every(text)||url.protocol!=='https:'||url.username||url.password||!HOSTS.includes(url.hostname))throw new Error('Invalid country source host or fields');
    if(!date(s.retrievedAt)||!AS_OF_BASES.includes(s.asOfBasis)||(s.asOf===null)!==(s.asOfBasis==='undated_register')||(s.asOf!==null&&(!date(s.asOf)||s.asOf>s.retrievedAt)))throw new Error('Invalid country source dates');sources.set(s.id,s);}
  const value=(v,dimension)=>{
    keys(v,'status codes basis sourceId locator excerpt reason note','dimension value');const kind=DIMENSIONS.find(d=>d.id===dimension).kind;
    if(!Array.isArray(v.codes)||(v.note!==null&&!text(v.note)))throw new Error('Invalid country dimension value');
    if(v.status==='unknown'){if(v.codes.length||v.basis!==null||v.sourceId!==null||v.locator!==null||v.excerpt!==null||!Object.hasOwn(UNKNOWN_REASONS,v.reason)||v.reason==='percentage_not_stated'||!text(v.note))throw new Error('Unknown country value must stay empty with a reason');return;}
    if(!['known','non_resident'].includes(v.status))throw new Error('Invalid country dimension status');
    if(v.status==='non_resident'&&(dimension!=='investorDomicile'||v.codes.length||v.basis!=='residence_status'||!text(v.note)))throw new Error('Non-resident is an investor residence status without a country');
    if(v.status==='known'){if(!v.codes.length||new Set(v.codes).size!==v.codes.length)throw new Error('Invalid country codes');
      if(kind==='country'&&v.codes.some(c=>CURRENCIES.includes(c)))throw new Error('Currency is not geography');
      if(kind==='currency'&&v.codes.some(c=>COUNTRIES.includes(c)))throw new Error('Geography is not currency');
      if(!v.codes.every(c=>(kind==='country'?COUNTRIES:CURRENCIES).includes(c)))throw new Error('Invalid country codes');}
    if(!BASES[dimension].includes(v.basis))throw new Error(`Country basis not allowed for ${dimension} (no inference from names, currencies or other dimensions)`);
    if(!sources.has(v.sourceId)||!text(v.locator)||!text(v.excerpt)||v.reason!==null)throw new Error('Known country value needs its own source, locator and excerpt');
  };
  const entities=new Map();
  for(const e of data.entities){keys(e,'id name kind role lei dims coverage','entity');
    if(entities.has(e.id)||!/^country-entity-[a-z0-9-]+$/.test(e.id)||!text(e.name)||!KINDS.includes(e.kind)||!ROLES.includes(e.role)||(e.lei!==null&&!/^[A-Z0-9]{18}\d{2}$/.test(e.lei)))throw new Error('Invalid country entity (legal entities only; no natural persons)');
    if((e.role==='counterparty')!==(e.coverage===null)||(e.coverage!==null&&!text(e.coverage)))throw new Error('Subject entities need a disclosed-universe coverage label');
    keys(e.dims,ENTITY_DIMS.join(' '),'entity dimension');for(const d of ENTITY_DIMS)value(e.dims[d],d);entities.set(e.id,e);}
  const claims=new Map();
  for(const c of data.claims){keys(c,'id type from to stake asOf sourceId locator excerpt investorDomicile','claim');const src=sources.get(c.sourceId);
    if(claims.has(c.id)||!/^country-claim-[a-z0-9-]+$/.test(c.id)||!['direct_equity_ownership','subsidiary_relation'].includes(c.type)||!entities.has(c.from)||!entities.has(c.to)||c.from===c.to||!src||!text(c.locator)||!text(c.excerpt))throw new Error('Invalid country claim');
    if(!date(c.asOf)||c.asOf>src.retrievedAt||(src.asOf!==null&&c.asOf!==src.asOf))throw new Error('Invalid country claim as-of date');
    const s=c.stake;
    if(s?.status==='known'){keys(s,'status percentage denominator','stake');if(typeof s.percentage!=='string'||!PCT.test(s.percentage)||!text(s.denominator))throw new Error('Known stake needs a source percentage and denominator');}
    else if(s?.status==='unknown'){keys(s,'status percentage denominator reason','stake');if(s.percentage!==null||s.denominator!==null||s.reason!=='percentage_not_stated')throw new Error('Unknown stake stays null with a reason, never 0% or 100%');}
    else throw new Error('Invalid stake');
    value(c.investorDomicile,'investorDomicile');claims.set(c.id,c);}
  const pathIds=new Set();
  for(const p of data.paths){keys(p,'id claimIds note','path');const cs=Array.isArray(p.claimIds)?p.claimIds.map(id=>claims.get(id)):[];
    if(pathIds.has(p.id)||!/^country-path-[a-z0-9-]+$/.test(p.id)||cs.length<2||cs.some(c=>!c)||cs.some((c,i)=>i&&cs[i-1].to!==c.from)||!text(p.note))throw new Error('Ownership paths must keep every intermediate entity');pathIds.add(p.id);}
  for(const x of data.exclusions){keys(x,'id subjectId holderKind sourceId reason','exclusion');if(!/^country-excl-[a-z0-9-]+$/.test(x.id)||!entities.has(x.subjectId)||x.holderKind!=='natural_person'||!sources.has(x.sourceId)||!text(x.reason))throw new Error('Invalid country exclusion');}
  if(armenianEntityIds(data).length>5)throw new Error('Country pilot exceeds the five-Armenian-entity cap');
  if(factCount(data)>30)throw new Error('Country pilot exceeds the 30-claim cap');
  return data;
}
validateCountryPilot(countryPilot);
