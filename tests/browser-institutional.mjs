import assert from 'node:assert/strict';
export async function checkInstitutionalPilot(browser,origin){
  for(const width of [320,390,1280]){
    const context=await browser.newContext({viewport:{width,height:844},isMobile:width<600,hasTouch:width<600});const page=await context.newPage();
    await page.goto(origin);await page.waitForFunction(()=>window.__assetsMap?.getState());if(width<600)await page.locator('#mobile-options').click();
    await page.locator('#institutional-launcher').waitFor({state:'visible'});
    await page.waitForFunction(()=>!document.querySelector('#institutional-launcher').disabled);
    assert.equal(await page.locator('#institutional-dialog').isVisible(),false);
    const snapshot=await page.evaluate(()=>JSON.stringify({state:window.__assetsMap.getState(),count:document.querySelector('#portfolio-summary').textContent}));
    await page.locator('#institutional-launcher').click();assert.equal(await page.locator('#institutional-dialog article').count(),4);
    assert.equal(await page.locator('#institutional-dialog').evaluate(e=>e.scrollWidth<=e.clientWidth+1),true,'No horizontal overflow');
    await page.locator('#institutional-filter').selectOption('institution-nvidia');assert.equal(await page.locator('#institutional-dialog article').count(),2);
    await page.locator('#institutional-dialog summary').first().click();assert.equal(await page.locator('#institutional-dialog a').first().isVisible(),true);
    await page.getByRole('button',{name:'Show all relationships',exact:true}).click();assert.equal(await page.locator('#institutional-dialog article').count(),4);
    await page.screenshot({path:`artifacts/institutional-${width}.png`});
    await page.getByRole('button',{name:'← Back to map',exact:true}).click();assert.equal(await page.locator('#institutional-dialog').isVisible(),false);
    assert.equal(await page.evaluate(()=>document.activeElement.id),width<600?'mobile-options':'institutional-launcher');
    assert.equal(await page.evaluate(()=>JSON.stringify({state:window.__assetsMap.getState(),count:document.querySelector('#portfolio-summary').textContent})),snapshot,'Holdings state and totals unchanged');
    if(width<600)await page.locator('#mobile-options').click();
    await page.locator('#institutional-launcher').click();await page.keyboard.press('Escape');assert.equal(await page.locator('#institutional-dialog').isVisible(),false);
    await context.close();
  }
}
