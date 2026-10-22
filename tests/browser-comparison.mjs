import assert from 'node:assert/strict';
export async function checkPortfolioComparison(browser,origin){
  for(const width of [320,390,1280]){
    const context=await browser.newContext({viewport:{width,height:844},isMobile:width<600,hasTouch:width<600});const page=await context.newPage();
    await page.goto(origin);await page.waitForFunction(()=>window.__assetsMap?.getState());await page.waitForFunction(()=>!document.querySelector('#comparison-launcher').disabled);
    const launch=async()=>{if(width<600)await page.locator('#mobile-options').click();await page.locator('#comparison-launcher').click();};
    await launch();await page.locator('#comparison-left').selectOption('blackrock-2026-06-30');await page.locator('#comparison-right').selectOption('statestreet-2026-06-30');assert.equal(await page.locator('#comparison-dialog article').count(),20);
    assert.equal(await page.locator('#comparison-dialog').evaluate(e=>e.scrollWidth<=e.clientWidth+1),true,'Comparison fits phone without horizontal scrolling');
    await page.locator('#comparison-right').selectOption('pif-2026-06-30');assert.ok(await page.locator('#comparison-dialog article').count()<=5);
    await page.locator('#comparison-search').fill('no such shared instrument');assert.equal(await page.locator('#comparison-dialog article').count(),0);
    await page.locator('#comparison-search').fill('');await page.locator('#comparison-right').selectOption('blackrock-2026-06-30');assert.match(await page.locator('#comparison-summary').textContent(),/Choose two different/);
    await page.locator('#comparison-right').selectOption('statestreet-2026-06-30');await page.locator('#comparison-search').fill('APPLE');
    const chosen=await page.locator('[data-comparison-select]').first().getAttribute('data-comparison-select');await page.locator('[data-comparison-select]').first().click();
    assert.equal(await page.locator('#comparison-dialog').isVisible(),false);assert.equal(await page.evaluate(()=>window.__assetsMap.getState().rootId),chosen);
    if(width<600){assert.equal(await page.locator('#detail-sheet').isVisible(),true);await page.locator('#close-mobile-details').click();}
    await launch();await page.locator('#comparison-dialog article button').first().click();assert.ok(await page.evaluate(()=>window.__assetsMap.getState().selectedEdgeId));
    if(width<600)await page.locator('#close-mobile-details').click();
    await launch();await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>document.activeElement.id),width<600?'mobile-options':'comparison-launcher');
    await context.close();
  }
}
