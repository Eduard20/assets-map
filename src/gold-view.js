import {goldPilot,validateGoldPilot,decimalSum,toTonnes,toFineTroyOunces,roundingInterval} from './gold-data.js';
const UNIT={fine_troy_ounce:'fine troy oz',million_fine_troy_ounces:'million fine troy oz',tonne:'t',kilogram:'kg'};
const BASIS={market:'market value',statutory_book:'statutory book value (not market value)',official_fixed_price:'official fixed price',historical_cost:'historical cost',unknown:'basis unknown'};
const TYPE={reserve_quantity:'Reported quantity',reserve_valuation:'Reported valuation',custody_disclosure:'Storage disclosure',reserve_change_event:'Source-stated change'};
const PER={fine_troy_ounce:'fine troy ounce',million_fine_troy_ounces:'million fine troy ounces',tonne:'tonne',kilogram:'kilogram'};
const FINENESS={fine_gold:'fine gold',gross_weight:'gross weight',unknown:'fineness basis not stated'};
export function groupDecimal(s){const neg=s.startsWith('-'),[i,f]=s.replace('-','').split('.');return (neg?'−':'')+i.replace(/\B(?=(\d{3})+(?!\d))/g,',')+(f?'.'+f:'');}
export function roundDecimal(s,places){const neg=s.startsWith('-'),[i,f='']=s.replace('-','').split('.');if(f.length<=places)return s;const n=BigInt(i+f.slice(0,places))+(Number(f[places])>=5?1n:0n),t=n.toString().padStart(places+1,'0');return (neg?'-':'')+(places?`${t.slice(0,-places)}.${t.slice(-places)}`:t);}
const t3=s=>groupDecimal(roundDecimal(s,3));
// Per-authority quantity summary. Never sums across authorities; a line sum stays within one source, date, unit and basis.
export function goldSummaries(data=goldPilot){
  return data.authorities.map(a=>{
    const own=data.claims.filter(c=>c.authorityId===a.id),total=own.find(c=>c.type==='reserve_quantity'),lines=own.filter(c=>c.type==='custody_disclosure');
    if(total){const ozt=total.unitRaw==='fine_troy_ounce'?total.quantityRaw:total.alsoStated?.unitRaw==='fine_troy_ounce'?total.alsoStated.quantityRaw:null;
      return {authority:a,origin:'source_stated',stated:`${groupDecimal(total.quantityRaw)} ${UNIT[total.unitRaw]}`,also:total.alsoStated?`${groupDecimal(total.alsoStated.quantityRaw)} ${UNIT[total.alsoStated.unitRaw]}`:null,
        ozt:ozt?{value:groupDecimal(ozt),origin:'source-stated'}:{value:t3(toFineTroyOunces(total.quantityRaw,total.unitRaw)),origin:'GOLD-MASS-v1'},
        converted:total.unitRaw==='fine_troy_ounce'?null:t3(toFineTroyOunces(total.quantityRaw,total.unitRaw)),
        tonnes:{value:total.unitRaw==='tonne'?groupDecimal(total.quantityRaw):t3(toTonnes(total.quantityRaw,total.unitRaw)),full:toTonnes(total.quantityRaw,total.unitRaw),origin:total.unitRaw==='tonne'?'source-stated':'GOLD-MASS-v1'},
        interval:roundingInterval(total.quantityRaw).map(v=>({raw:v,unit:total.unitRaw,ozt:t3(toFineTroyOunces(v,total.unitRaw)),tonnes:t3(toTonnes(v,total.unitRaw))})),fineness:total.finenessBasis,claim:total};}
    const units=new Set(lines.map(c=>c.unitRaw));if(units.size!==1)return {authority:a,origin:'unavailable'};
    const unit=[...units][0],sum=decimalSum(lines.map(c=>c.quantityRaw));
    return {authority:a,origin:'calculated_line_sum',stated:null,lineCount:lines.length,ozt:{value:groupDecimal(toFineTroyOunces(sum,unit)),origin:'GOLD-LINESUM-v1'},tonnes:{value:t3(toTonnes(sum,unit)),full:toTonnes(sum,unit),origin:'GOLD-MASS-v1'},fineness:lines[0].finenessBasis,
      bookSum:decimalSum(own.filter(c=>c.type==='reserve_valuation').map(c=>c.valueRaw))};
  });
}
export function mountGoldPilot({document,launcher,beforeOpen=()=>{},returnFocus=()=>launcher,data=goldPilot}){
  validateGoldPilot(data);
  const dialog=document.createElement('dialog');dialog.id='gold-dialog';dialog.setAttribute('aria-labelledby','gold-title');
  const el=(tag,text,parent=dialog)=>{const node=document.createElement(tag);if(text)node.textContent=text;parent.append(node);return node;};
  const top=el('div','');top.className='gold-top';
  el('span','SEPARATE LAYER · PILOT',top);const close=el('button','← Back to map',top);close.type='button';
  el('h2','Central-bank gold reserves · Pilot').id='gold-title';
  el('p',`Three reporting authorities, one reference date (${data.referenceDate}). Quantity, valuation and storage are separate source claims. There is no world total: values are in different currencies and on different bases, so they are never added up across authorities.`).className='gold-notice';
  el('p','Swaps, deposits, loans, pledges and allocated status are unknown for every authority. Unknown is not zero and does not mean unencumbered. Gold is not an equity holding and never enters the share map, portfolio totals or issuer matching.');
  el('h3','Quantities side by side (not summed)');
  el('p',`Original units are kept. Conversions use ${data.conversionRule.id}: 1 troy oz = ${data.conversionRule.gramsPerTroyOunce} g; 1 t = 1,000,000 g. Display values are rounded to 3 decimals.`).className='gold-rule';
  const compare=el('div','');compare.className='gold-compare';
  const label=el('label','Explore one reporting authority');const filter=el('select','',label);filter.id='gold-filter';
  el('option','All three authorities',filter).value='all';
  for(const a of data.authorities)el('option',a.name,filter).value=a.id;
  const count=el('p','');count.setAttribute('role','status');
  const list=el('div','');list.className='gold-claims';
  const sources=new Map(data.sources.map(s=>[s.id,s])),names=new Map(data.authorities.map(a=>[a.id,a.name])),summaries=goldSummaries(data);
  const link=(source,parent)=>{const a=el('a',source.title,parent);a.href=source.url;a.target='_blank';a.rel='noopener noreferrer';};
  function renderCompare(){
    compare.replaceChildren();
    for(const s of summaries.filter(s=>filter.value==='all'||s.authority.id===filter.value)){
      const card=el('section','',compare);card.className='gold-authority';el('h4',s.authority.name,card);
      el('p',`Perimeter: ${s.authority.perimeter.replaceAll('_',' ')}`,card).className='gold-kind';
      if(s.origin==='source_stated'){
        el('p',`Source-stated: ${s.stated}${s.also?` (also stated: ${s.also})`:''} · ${FINENESS[s.fineness]}`,card);
        el('p',`Fine troy oz: ${s.ozt.value} (${s.ozt.origin}) · Tonnes: ${s.tonnes.value} (${s.tonnes.origin})`,card).className='gold-figure';
        if(s.converted&&s.ozt.origin==='source-stated')el('p',`Converted from kg by GOLD-MASS-v1: ${s.converted} fine troy oz. The source’s own fine-ounce figure is shown first; the source notes that different methods and rounding rules are used to calculate fine weight.`,card);
        el('p',`Rounding interval of the stated figure: [${groupDecimal(s.interval[0].raw)}, ${groupDecimal(s.interval[1].raw)}) ${UNIT[s.interval[0].unit]} = [${s.interval[0].ozt}, ${s.interval[1].ozt}) fine troy oz.`,card);
        if(s.fineness==='unknown')el('p','Fineness basis is not stated in this table, so equality with fine-gold figures is not established.',card);
      }else if(s.origin==='calculated_line_sum'){
        el('p',`No source-stated total. ${s.lineCount} source lines in fine troy oz (${FINENESS[s.fineness]}).`,card);
        el('p',`Calculated line sum: ${s.ozt.value} fine troy oz (GOLD-LINESUM-v1) · Tonnes: ${s.tonnes.value} (GOLD-MASS-v1)`,card).className='gold-figure';
        el('p',`Calculated book-value line sum: USD ${groupDecimal(s.bookSum)} at the statutory rate. Not market value; not comparable with the market values of other authorities.`,card);
      }
      el('p',`Storage: ${s.authority.custody.status==='disclosed'?'disclosed by source (see storage cards)':'unknown'} · Encumbrance: ${s.authority.encumbrance.status} · Allocation: ${s.authority.allocation.status}`,card);
      if(s.authority.custody.status==='unknown')el('p',`Why storage is unknown: ${s.authority.custody.reason}.`,card);
      for(const r of data.reconciliations.filter(r=>data.claims.find(c=>c.id===r.claimIds[0]).authorityId===s.authority.id)){const p=el('p',`Reconciliation (${r.classification.replaceAll('_',' ')}): ${r.note}`,card);p.className='gold-conflict';}
    }
  }
  function value(c){
    if(c.type==='reserve_quantity')return `${groupDecimal(c.quantityRaw)} ${UNIT[c.unitRaw]} · ${FINENESS[c.finenessBasis]} · ${c.scope}. ${c.inclusionNote}.`;
    if(c.type==='reserve_valuation')return `${c.currency} ${groupDecimal(c.valueRaw)}${c.valueMultiplier==='1000000'?' million':c.valueMultiplier==='1000000000'?' billion':''} · ${BASIS[c.valuationBasis]} · ${c.scope} · price used: ${c.currency} ${groupDecimal(c.priceReference.priceRaw)} per ${PER[c.priceReference.unitRaw]}`;
    if(c.type==='custody_disclosure')return `${c.custodian} · ${c.location} (${c.granularity}) · ${c.quantityRaw!==null?`${groupDecimal(c.quantityRaw)} ${UNIT[c.unitRaw]} = ${t3(toTonnes(c.quantityRaw,c.unitRaw))} t (GOLD-MASS-v1)`:`${c.shareRaw}% (source-stated share)`}`;
    return `${c.eventKind.replaceAll('_',' ')} · ${groupDecimal(c.quantityRaw)} ${UNIT[c.unitRaw]} · ${c.periodStart} to ${c.periodEnd}. A source statement about the event, not a difference between snapshots.`;
  }
  function render(){
    renderCompare();list.replaceChildren();const claims=data.claims.filter(c=>filter.value==='all'||c.authorityId===filter.value);count.textContent=`${claims.length} of ${data.claims.length} pilot claims`;
    for(const c of claims){
      const card=el('article','',list);card.className='gold-claim';el('h4',`${names.get(c.authorityId)} · ${TYPE[c.type]}`,card);
      el('p',value(c),card).className='gold-kind';
      const source=sources.get(c.sourceId),date=c.reportDate??c.valuationDate??c.disclosureDate??c.periodEnd;
      el('p',`${c.type==='custody_disclosure'?'Disclosure date':c.type==='reserve_change_event'?'Period end':'Reference date'}: ${date} · Retrieved: ${source.retrievedAt}`,card);
      const details=el('details','',card);el('summary','Evidence and limits',details);
      el('p',`Locator: ${c.locator}`,details);el('p',`Excerpt: ${c.excerpt}`,details);
      if(c.type==='reserve_valuation'&&c.priceReference.sourceId!==c.sourceId){const p=sources.get(c.priceReference.sourceId);el('p',`Price basis: ${p.excerpt}`,details);link(p,details);}
      link(source,details);el('p',`Reuse terms: ${source.reuse}`,details);
      el('p',c.type==='custody_disclosure'?'A storage statement for this holder and date only. It does not show ownership by the custodian or allocated status.':c.type==='reserve_valuation'?'Valuation is a separate metric from quantity. A change in value can come entirely from price.':'Quantity is not an equity percentage and does not establish storage location or encumbrance.',details);
    }
  }
  filter.addEventListener('change',render);
  const reset=el('button','Show all authorities');reset.type='button';reset.addEventListener('click',()=>{filter.value='all';render();filter.focus();});
  document.body.append(dialog);launcher.setAttribute('aria-haspopup','dialog');launcher.setAttribute('aria-controls',dialog.id);
  launcher.addEventListener('click',()=>{beforeOpen();filter.value='all';render();dialog.showModal();close.focus();});
  close.addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>returnFocus().focus());
  return {dialog};
}
