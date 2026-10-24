import assert from 'node:assert/strict';

export async function checkUaeHoldings(browser,origin){
  for(const width of [320,390,1280]){
    const context=await browser.newContext({viewport:{width,height:900},isMobile:width<600,hasTouch:width<600});
    const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(`${origin}/?dataset=uae`);
    await page.waitForFunction(()=>window.__assetsMap?.getModel()?.meta.datasetId==='uae'&&window.__assetsMap.getState().view==='list');
    const info=await page.evaluate(()=>{const m=window.__assetsMap.getModel();return{total:m.edges.length,groups:m.meta.investorIds,group:m.meta.investorIds.at(-1),edge:m.edges.find(e=>e.source===m.meta.investorIds.at(-1)),affiliations:m.edges.filter(e=>e.kind==='reported_portfolio_affiliation'),snapshotOnly:m.edges.find(e=>e.disclosure.correctionStatus==='source_snapshot_only'||e.disclosure.evidence.some(item=>item.amendment_status==='source_snapshot_only'))};});
    assert.ok(info.total>0);assert.ok(info.groups.length>1,'UAE view admits more than EIA');
    assert.equal(await page.locator('.research-row').count(),Math.min(30,info.total));
    const allRows=new Set();
    for(;;){
      for(const id of await page.locator('.research-row').evaluateAll(rows=>rows.map(row=>row.dataset.edge)))allRows.add(id);
      const next=page.locator('#graph-list [data-holdings-page]').last();
      if(await next.isDisabled())break;
      await next.click();
    }
    assert.equal(allRows.size,info.total,'Every admitted row is browsable, not only eight graph edges');
    if(width<600)await page.locator('#mobile-options').click();
    await page.locator('#uae-group').selectOption(info.group);
    await page.locator('#uae-snapshot').selectOption(info.edge.asOf);
    const selected=await page.evaluate(()=>{const m=window.__assetsMap.getModel(),s=window.__assetsMap.getState();return m.edges.filter(e=>e.source===s.uaeGroupFilter&&e.asOf===s.snapshotDate).length;});
    assert.equal(await page.locator('.research-row').count(),Math.min(30,selected));
    await page.locator('#uae-coverage summary').click();assert.match(await page.locator('#uae-coverage-content').textContent(),/not all|Partial|partial/);
    const target=await page.evaluate(id=>window.__assetsMap.getModel().nodeMap.get(id).label,info.edge.target);
    await page.locator('#uae-search').fill(target);
    await page.locator('#uae-browse').click();
    assert.equal(await page.locator('#graph-list').isVisible(),true);
    const evidence=page.locator(`.research-row[data-edge="${info.edge.id}"]`);await evidence.click();
    assert.equal(await page.locator('#detail-panel').isVisible(),true);assert.match(await page.locator('#detail-panel').textContent(),/Historical snapshot/);
    assert.match(await page.locator('#detail-panel').textContent(),/does not establish a current position/);
    assert.equal(await page.locator('#detail-panel a.source-link').count(),info.edge.disclosure.evidence.length);
    if(info.edge.kind==='reported_group_interest')assert.match(await page.locator('#detail-panel').textContent(),/does not identify an immediate legal shareholder/);
    if(width<600){await page.locator('#close-mobile-details').click();assert.equal(await page.locator('#detail-sheet').isVisible(),false);assert.equal(await page.evaluate(()=>document.activeElement.dataset.edge),info.edge.id,'Close restores the evidence row');await evidence.click();await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>document.activeElement.dataset.edge),info.edge.id,'Escape restores the evidence row');await page.locator('#mobile-options').click();await page.keyboard.press('Escape');assert.equal(await page.locator('#mobile-controls').isVisible(),false);}
    await page.locator('#focus-back').click();
    await page.locator('.research-explore').first().click();
    await page.waitForFunction(()=>window.__assetsMap.getState().view==='2d');
    await page.locator('#focus-back').click();
    await page.waitForFunction(()=>window.__assetsMap.getState().view==='list');
    assert.equal(await page.locator('#uae-search').inputValue(),target);
    assert.equal(await page.locator('#uae-group').inputValue(),info.group);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'No horizontal page overflow');
    assert.equal(await page.locator('#graph-list').evaluate(e=>e.scrollWidth<=e.clientWidth+1),true,'No horizontal inventory overflow');
    await page.screenshot({path:`artifacts/uae-${width}.png`});
    await page.evaluate(()=>window.__assetsMap.setDataset('researched'));
    assert.equal(await page.evaluate(()=>window.__assetsMap.getModel().edges.length),4,'Historical disclosure set remains four');
    assert.equal(await page.locator('#uae-controls').isVisible(),false);
    await page.evaluate(()=>window.__assetsMap.setDataset('uae'));
    assert.equal(await page.locator('.research-row').count(),Math.min(30,info.total));
    for(const affiliation of info.affiliations){
      if(width<600)await page.locator('#mobile-options').click();
      await page.locator('#uae-group').selectOption(affiliation.source);
      await page.locator('#uae-snapshot').selectOption(affiliation.asOf);
      const assetName=await page.evaluate(id=>window.__assetsMap.getModel().nodeMap.get(id).label,affiliation.target);
      await page.locator('#uae-search').fill(assetName);await page.locator('#uae-browse').click();
      const assetRow=page.locator(`.research-row[data-edge="${affiliation.id}"]`);
      assert.match(await assetRow.textContent(),/Not equity/);
      assert.doesNotMatch(await assetRow.locator('.holding-value').textContent(),/%|equity percentage|Group interest|Not reported/);
      await assetRow.click();
      assert.match(await page.locator('#detail-panel .type-badge').textContent(),/asset \/ brand affiliation/);
      assert.match(await page.locator('#detail-panel').textContent(),/This is not a company equity interest/);
      assert.match(await page.locator('#detail-panel').textContent(),/not inferred from this link/);
      assert.equal(await page.evaluate(id=>{const m=window.__assetsMap.getModel(),e=m.edges.find(e=>e.id===id);return e.stakePercent==null&&e.valueUsd==null&&e.disclosure.metrics.length===0;},affiliation.id),true,'Asset/brand links have no equity or valuation metric');
      if(width<600)await page.locator('#close-mobile-details').click();
    }
    if(info.snapshotOnly){
      await page.evaluate(id=>window.__assetsMap.selectEdge(id),info.snapshotOnly.id);
      assert.match(await page.locator('#detail-panel').textContent(),/Bounded source review through/);
      assert.match(await page.locator('#detail-panel').textContent(),/Correction coverage is nonexhaustive; correction completeness is not established/);
      assert.doesNotMatch(await page.locator('#detail-panel').textContent(),/Source corrections checked on|Filing-family correction discovery checked on/);
      if(width<600)await page.locator('#close-mobile-details').click();
    }
    assert.deepEqual(errors,[]);await context.close();
  }
  // A late UAE response may not replace a newer chosen data view or seed its cache.
  const context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage();
  let release,started;const gate=new Promise(r=>{release=r;}),requested=new Promise(r=>{started=r;});
  await context.route('**/data/uae.json',async route=>{const response=await route.fetch();started();await gate;await route.fulfill({response});});
  await page.goto(`${origin}/?dataset=uae`,{waitUntil:'domcontentloaded'});await requested;
  await page.evaluate(()=>window.__assetsMap.setDataset('sample'));release();
  await page.waitForFunction(()=>document.querySelector('#graph-stage').getAttribute('aria-busy')==='false');
  assert.equal(await page.locator('#dataset').inputValue(),'sample');
  await page.evaluate(()=>window.__assetsMap.setDataset('uae'));
  assert.equal(await page.evaluate(()=>window.__assetsMap.getState().view),'list');
  await context.close();
}
