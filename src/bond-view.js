import {bondPilot,bondMetricDictionary,validateBondPilot,shareOfIssue,holderCoverage,claimCount,NYFED_NOTICE} from './bond-data.js';
const n=(v,d=8)=>v.toLocaleString('en-US',{maximumFractionDigits:d});
const face=(v,scale,cur)=>scale===1000000?`${cur} ${n(v)} million face`:`${cur} ${n(v*scale)} face`;
const pct=v=>`${v.toFixed(2)}%`;
const shown=f=>f.availability==='known'?String(f.value):`Unknown — ${f.reason.replaceAll('_',' ')}`;
export function mountBondPilot({document,launcher,beforeOpen=()=>{},returnFocus=()=>launcher,data=bondPilot}){
  validateBondPilot(data);
  const dialog=document.createElement('dialog');dialog.id='bond-dialog';dialog.setAttribute('aria-labelledby','bond-title');
  const el=(tag,text,parent=dialog)=>{const node=document.createElement(tag);if(text)node.textContent=text;parent.append(node);return node;};
  const top=el('div','');top.className='bond-top';
  el('span','SEPARATE LAYER · PILOT',top);const close=el('button','← Back to map',top);close.type='button';
  el('h2','Bonds and debt securities · Pilot').id='bond-title';
  el('p',`Four debt lines from two issuers, ${claimCount(data)} sourced claims. Debt is a separate asset class: a creditor position is not equity, beneficial ownership, voting or control, and nothing here enters the share view, portfolio totals or issuer matching.`).className='bond-notice';
  el('p','Terms, outstanding amounts, holdings and prices are separate records with their own sources and dates. Face amounts, currency values and prices per 100 face are different units and are never added together. Holder coverage is incomplete: undisclosed principal is a disclosure gap, not a holder.');
  el('p','Instruments use project ids and descriptive names; CUSIPs are withheld for licensing reasons.').className='bond-muted';
  const label=el('label','Explore an issuer');const filter=el('select','',label);filter.id='bond-filter';
  el('option','Both issuers',filter).value='all';
  const issuerIds=[...new Set(data.instruments.map(i=>i.issuerId))],entities=new Map(data.entities.map(e=>[e.id,e])),sources=new Map(data.sources.map(s=>[s.id,s]));
  for(const id of issuerIds)el('option',entities.get(id).name,filter).value=id;
  const count=el('p','');count.setAttribute('role','status');
  const list=el('div','');list.className='bond-lines';
  const evidence=(parent,sourceId,excerpt,locator)=>{const s=sources.get(sourceId);const d=el('details','',parent);el('summary','Evidence',d);
    el('p',`Source: ${s.publisher} · as of ${s.asOf}${s.publishedAt?` · published ${s.publishedAt}`:''} · retrieved ${s.retrievedAt}`,d);
    if(locator)el('p',`Locator: ${locator}`,d);el('p',`Excerpt: ${excerpt}`,d);el('p',`Reuse: ${s.reuse}`,d).className='bond-muted';
    const a=el('a',s.title,d);a.href=s.url;a.target='_blank';a.rel='noopener noreferrer';};
  function render(){
    list.replaceChildren();const lines=data.instruments.filter(i=>filter.value==='all'||i.issuerId===filter.value);
    count.textContent=`${lines.length} of ${data.instruments.length} pilot debt lines`;
    for(const inst of lines){
      const issuer=entities.get(inst.issuerId),card=el('article','',list);card.className='bond-line';el('h3',inst.name,card);
      el('p',`Debt lane · ${issuer.kind==='sovereign'?'Sovereign':'Corporate'} issuer: ${issuer.name}${issuer.lei?` · LEI ${issuer.lei}`:''} · ${inst.debtSubtype.replace('_',' ')} · ${inst.currency}`,card).className='bond-kind';
      if(issuer.kind==='corporate')el('p',`${issuer.name} common stock appears separately in the 13F share view. Equity and debt stay in separate lanes and are never added into one exposure.`,card).className='bond-muted';
      const t=data.terms.find(x=>x.instrumentId===inst.id),f=t.fields;
      el('h4',`Terms · ${t.termsSourceKind.replace('_',' ')}`,card);const dl=el('dl','',card);
      for(const [k,v] of [['Coupon',`${shown(f.couponRate)}% · ${shown(f.couponType)} · ${shown(f.couponFrequency)}`],['Issue / dated',`${shown(f.issueDate)} / ${shown(f.datedDate)}`],['Maturity',shown(f.maturityDate)],['Issued at original tranche',f.issuedAmountAtTranche.availability==='known'?`${inst.currency} ${n(f.issuedAmountAtTranche.value)} face (a term, not today's outstanding)`:shown(f.issuedAmountAtTranche)],['Principal indexation',shown(f.principalIndexation)],['Seniority',shown(f.seniority)],['Day count',shown(f.dayCount)],['Optionality',shown(f.optionality)],['Governing law',shown(f.governingLaw)]]){el('dt',k,dl);el('dd',v,dl);}
      evidence(card,t.sourceId,t.excerpt,t.locator);
      el('h4','Outstanding principal',card);
      for(const o of data.outstanding.filter(x=>x.instrumentId===inst.id)){el('p',`${face(o.amount,o.scale,o.faceCurrency)} · ${o.scope.replace('_',' ')} · as of ${o.asOfDate} · ${o.indexed?'indexed (includes inflation adjustment)':'not indexed'} · issuer-held excluded: ${o.heldByIssuerExcluded}`,card);evidence(card,o.sourceId,o.excerpt,o.locator);}
      el('h4','Disclosed holders',card);const holdings=data.holdings.filter(h=>h.instrumentId===inst.id);
      if(!holdings.length)el('p','No holder disclosure admitted for this line.',card);
      for(const h of holdings){const share=shareOfIssue(data,h.id),box=el('div','',card);box.className='bond-holding';
        el('p',`${entities.get(h.holderId).name} · ${h.predicate.replaceAll('_',' ')} · ${face(h.faceAmount,h.scale,h.faceCurrency)} (${h.faceBasis.replace('_',' ')} par) · as of ${h.reportDate}`,box);
        if(h.statedInflationCompensation!==null)el('p',`Stated separately, not added: inflation compensation ${h.faceCurrency} ${n(h.statedInflationCompensation)}.`,box);
        el('p',share.status==='known'?`Share of issue: ${pct(share.value)} — ${share.label}. Computed by this pilot, not by the source.`:`Share of issue: not computed — ${share.label}.`,box).className='bond-metric';
        evidence(box,h.sourceId,h.excerpt,h.locator);}
      const cov=holderCoverage(data,inst.id),c=el('p','',card);c.className='bond-coverage';
      c.textContent=cov.status==='computed'?`Holder coverage: partial. Disclosed holders ${pct(cov.disclosed)} of outstanding principal · Undisclosed ${pct(cov.undisclosed)} — a disclosure gap, not a holder.`:cov.status==='side_by_side'?'Holder coverage: partial; no coverage ratio is computed because the bases or dates differ.':'Holder coverage: unknown. Undisclosed principal is a disclosure gap, not a holder.';
      const vals=data.valuations.filter(v=>v.instrumentId===inst.id);
      if(vals.length){el('h4','Prices',card);for(const v of vals){el('p',`${n(v.value)} per 100 face · ${v.valuationBasis.replaceAll('_',' ')} · convention: ${v.priceConvention} · ${v.valuationDate}. A price is not a term or a holding value.`,card);evidence(card,v.sourceId,v.excerpt);}}
      const gaps=data.gaps.filter(g=>g.instrumentId===inst.id),gd=el('details','',card);el('summary',`Gaps and limits (${gaps.length})`,gd);const ul=el('ul','',gd);
      for(const g of gaps)el('li',`${g.category.replace('_',' ')} · ${g.reason.replaceAll('_',' ')}: ${g.detail}`,ul);
    }
  }
  filter.addEventListener('change',render);
  const reset=el('button','Show both issuers');reset.type='button';reset.addEventListener('click',()=>{filter.value='all';render();filter.focus();});
  const md=el('details','');md.className='bond-dictionary';el('summary','Metric dictionary and aggregation rules',md);const ul=el('ul','',md);
  for(const m of bondMetricDictionary)el('li',`${m.metricType} · unit ${m.unit} · denominator ${m.denominator} · never: ${m.forbidden}`,ul);
  el('p','No sum or ratio crosses currencies, tranches or lines, reporting dates, indexation bases, valuation bases or price conventions. Equity, beneficial, voting and control predicates are rejected for debt targets.',md);
  el('p',`SOMA holdings: ${NYFED_NOTICE} Share-of-issue figures are this pilot's calculation, not New York Fed content.`).className='bond-muted';
  document.body.append(dialog);launcher.setAttribute('aria-haspopup','dialog');launcher.setAttribute('aria-controls',dialog.id);
  launcher.addEventListener('click',()=>{beforeOpen();filter.value='all';render();dialog.showModal();close.focus();});
  close.addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>returnFocus().focus());
  return {dialog};
}
