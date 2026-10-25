import assert from 'node:assert/strict';
export async function checkNbimLayer(browser,origin){
  for(const width of [320,390,1280]){
    const context=await browser.newContext({viewport:{width,height:844},isMobile:width<600,hasTouch:width<600});const page=await context.newPage();
    const requests=[];page.on('request',r=>{if(r.url().includes('nbim-equities'))requests.push(r.url());});
    await page.goto(origin);await page.waitForFunction(()=>window.__assetsMap?.getState());if(width<600)await page.locator('#mobile-options').click();
    await page.locator('#nbim-launcher').waitFor({state:'visible'});await page.waitForFunction(()=>!document.querySelector('#nbim-launcher').disabled);
    assert.equal(requests.length,0,'NBIM list is not requested on initial load');
    const snapshot=await page.evaluate(()=>JSON.stringify({state:window.__assetsMap.getState(),count:document.querySelector('#portfolio-summary').textContent}));
    await page.locator('#nbim-launcher').click();await page.locator('#nbim-dialog article').first().waitFor();
    assert.equal(await page.locator('#nbim-dialog article').count(),25);
    assert.match(await page.locator('#nbim-dialog [role="status"]').textContent(),/of 7,077 matching holdings/);
    assert.equal(await page.locator('#nbim-dialog').evaluate(e=>e.scrollWidth<=e.clientWidth+1),true,'No horizontal overflow');
    await page.locator('#nbim-search').fill('alphabet');
    assert.ok(await page.locator('#nbim-dialog article h3',{hasText:'Alphabet Inc'}).count()>=1);
    assert.match(await page.locator('#nbim-dialog article',{hasText:'Alphabet Inc'}).first().textContent(),/Ownership 1\.17% · voting 0\.52%/);
    await page.locator('#nbim-search').fill('');await page.locator('#nbim-country').selectOption('JP');
    await page.getByRole('button',{name:/^Show 25 more$/}).click();assert.equal(await page.locator('#nbim-dialog article').count(),50);
    assert.equal(await page.locator('#nbim-dialog').evaluate(e=>e.scrollWidth<=e.clientWidth+1),true,'No horizontal overflow (filtered)');
    await page.locator('#nbim-dialog details summary').click();assert.equal(await page.locator('#nbim-dialog details a').isVisible(),true);
    await page.screenshot({path:`artifacts/nbim-${width}.png`});
    await page.getByRole('button',{name:'← Back to map',exact:true}).click();assert.equal(await page.locator('#nbim-dialog').isVisible(),false);
    assert.equal(await page.evaluate(()=>document.activeElement.id),width<600?'mobile-options':'nbim-launcher');
    assert.equal(await page.evaluate(()=>JSON.stringify({state:window.__assetsMap.getState(),count:document.querySelector('#portfolio-summary').textContent})),snapshot,'Holdings state and totals unchanged');
    if(width<600)await page.locator('#mobile-options').click();
    await page.locator('#nbim-launcher').click();await page.keyboard.press('Escape');assert.equal(await page.locator('#nbim-dialog').isVisible(),false);
    assert.equal(requests.length,1,'list fetched once per page');
    if(width>=600){
      await page.evaluate(()=>window.__assetsMap.selectNode('norgesbank-2026-06-30'));
      await page.locator('#detail-panel [data-open-nbim]').click();await page.locator('#nbim-dialog article').first().waitFor();
      assert.equal(await page.locator('#nbim-dialog').isVisible(),true,'Norges Bank details open the global list');
      await page.keyboard.press('Escape');
    }
    await context.close();
  }
}
