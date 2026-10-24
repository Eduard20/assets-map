import assert from 'node:assert/strict';
export async function checkBondPilot(browser,origin){
  for(const width of [320,390,1280]){
    const context=await browser.newContext({viewport:{width,height:844},isMobile:width<600,hasTouch:width<600});const page=await context.newPage();
    await page.goto(origin);await page.waitForFunction(()=>window.__assetsMap?.getState());if(width<600)await page.locator('#mobile-options').click();
    await page.locator('#bond-launcher').waitFor({state:'visible'});
    await page.waitForFunction(()=>!document.querySelector('#bond-launcher').disabled);
    assert.equal(await page.locator('#bond-dialog').isVisible(),false);
    const snapshot=await page.evaluate(()=>JSON.stringify({state:window.__assetsMap.getState(),count:document.querySelector('#portfolio-summary').textContent}));
    await page.locator('#bond-launcher').click();assert.equal(await page.locator('#bond-dialog article').count(),4);
    assert.equal(await page.locator('#bond-dialog').evaluate(e=>e.scrollWidth<=e.clientWidth+1),true,'No horizontal overflow');
    await page.locator('#bond-filter').selectOption('bond-oracle');assert.equal(await page.locator('#bond-dialog article').count(),2);
    await page.locator('#bond-dialog article summary').first().click();assert.equal(await page.locator('#bond-dialog article a').first().isVisible(),true);
    assert.equal(await page.locator('#bond-dialog').evaluate(e=>e.scrollWidth<=e.clientWidth+1),true,'No horizontal overflow with evidence open');
    await page.getByRole('button',{name:'Show both issuers',exact:true}).click();assert.equal(await page.locator('#bond-dialog article').count(),4);
    await page.screenshot({path:`artifacts/bond-${width}.png`});
    await page.locator('#bond-dialog').getByRole('button',{name:'← Back to map',exact:true}).click();assert.equal(await page.locator('#bond-dialog').isVisible(),false);
    assert.equal(await page.evaluate(()=>document.activeElement.id),width<600?'mobile-options':'bond-launcher');
    assert.equal(await page.evaluate(()=>JSON.stringify({state:window.__assetsMap.getState(),count:document.querySelector('#portfolio-summary').textContent})),snapshot,'Holdings state and totals unchanged');
    if(width<600)await page.locator('#mobile-options').click();
    await page.locator('#bond-launcher').click();await page.keyboard.press('Escape');assert.equal(await page.locator('#bond-dialog').isVisible(),false);
    await context.close();
  }
}
