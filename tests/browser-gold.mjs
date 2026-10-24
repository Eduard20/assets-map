import assert from 'node:assert/strict';
export async function checkGoldPilot(browser,origin){
  for(const width of [320,390,1280]){
    const context=await browser.newContext({viewport:{width,height:844},isMobile:width<600,hasTouch:width<600});const page=await context.newPage();
    await page.goto(origin);await page.waitForFunction(()=>window.__assetsMap?.getState());if(width<600)await page.locator('#mobile-options').click();
    await page.locator('#gold-launcher').waitFor({state:'visible'});
    await page.waitForFunction(()=>!document.querySelector('#gold-launcher').disabled);
    assert.equal(await page.locator('#gold-dialog').isVisible(),false);
    const snapshot=await page.evaluate(()=>JSON.stringify({state:window.__assetsMap.getState(),count:document.querySelector('#portfolio-summary').textContent}));
    await page.locator('#gold-launcher').click();assert.equal(await page.locator('#gold-dialog article').count(),25);assert.equal(await page.locator('#gold-dialog .gold-authority').count(),3);
    assert.equal(await page.locator('#gold-dialog').evaluate(e=>e.scrollWidth<=e.clientWidth+1),true,'No horizontal overflow');
    await page.locator('#gold-filter').selectOption('gold-snb');assert.equal(await page.locator('#gold-dialog article').count(),2);
    assert.equal(await page.locator('#gold-dialog').evaluate(e=>e.scrollWidth<=e.clientWidth+1),true,'No horizontal overflow (filtered)');
    await page.locator('#gold-dialog summary').first().click();assert.equal(await page.locator('#gold-dialog article a').first().isVisible(),true);
    await page.getByRole('button',{name:'Show all authorities',exact:true}).click();assert.equal(await page.locator('#gold-dialog article').count(),25);
    await page.screenshot({path:`artifacts/gold-${width}.png`});
    await page.getByRole('button',{name:'← Back to map',exact:true}).click();assert.equal(await page.locator('#gold-dialog').isVisible(),false);
    assert.equal(await page.evaluate(()=>document.activeElement.id),width<600?'mobile-options':'gold-launcher');
    assert.equal(await page.evaluate(()=>JSON.stringify({state:window.__assetsMap.getState(),count:document.querySelector('#portfolio-summary').textContent})),snapshot,'Holdings state and totals unchanged');
    if(width<600)await page.locator('#mobile-options').click();
    await page.locator('#gold-launcher').click();await page.keyboard.press('Escape');assert.equal(await page.locator('#gold-dialog').isVisible(),false);
    await context.close();
  }
}
