import assert from 'node:assert/strict';
export async function checkIssuerPilot(browser,origin){
  for(const width of [320,390,1280]){
    const context=await browser.newContext({viewport:{width,height:844},isMobile:width<600,hasTouch:width<600});const page=await context.newPage();
    await page.goto(origin);await page.waitForFunction(()=>window.__assetsMap?.getState());if(width<600)await page.locator('#mobile-options').click();
    await page.locator('#issuer-launcher').waitFor({state:'visible'});
    await page.waitForFunction(()=>!document.querySelector('#issuer-launcher').disabled);
    assert.equal(await page.locator('#issuer-dialog').isVisible(),false);
    const snapshot=await page.evaluate(()=>JSON.stringify({state:window.__assetsMap.getState(),count:document.querySelector('#portfolio-summary').textContent}));
    await page.locator('#issuer-launcher').click();assert.equal(await page.locator('#issuer-dialog article').count(),25);assert.equal(await page.locator('#issuer-dialog .issuer-card').count(),5);
    assert.equal(await page.locator('#issuer-dialog').evaluate(e=>e.scrollWidth<=e.clientWidth+1),true,'No horizontal overflow');
    await page.locator('#issuer-filter').selectOption('issuer-alphabet');assert.equal(await page.locator('#issuer-dialog article').count(),8);
    assert.equal(await page.locator('#issuer-dialog').evaluate(e=>e.scrollWidth<=e.clientWidth+1),true,'No horizontal overflow (filtered)');
    await page.locator('#issuer-dialog summary').first().click();assert.equal(await page.locator('#issuer-dialog article a').first().isVisible(),true);
    await page.getByRole('button',{name:'Show all issuers',exact:true}).click();assert.equal(await page.locator('#issuer-dialog article').count(),25);
    await page.screenshot({path:`artifacts/issuer-${width}.png`});
    await page.getByRole('button',{name:'← Back to map',exact:true}).click();assert.equal(await page.locator('#issuer-dialog').isVisible(),false);
    assert.equal(await page.evaluate(()=>document.activeElement.id),width<600?'mobile-options':'issuer-launcher');
    assert.equal(await page.evaluate(()=>JSON.stringify({state:window.__assetsMap.getState(),count:document.querySelector('#portfolio-summary').textContent})),snapshot,'Holdings state and totals unchanged');
    if(width<600)await page.locator('#mobile-options').click();
    await page.locator('#issuer-launcher').click();await page.keyboard.press('Escape');assert.equal(await page.locator('#issuer-dialog').isVisible(),false);
    await context.close();
  }
}
