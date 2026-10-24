import assert from 'node:assert/strict';
export async function checkPropertyPilot(browser,origin){
  for(const width of [320,390,1280]){
    const context=await browser.newContext({viewport:{width,height:844},isMobile:width<600,hasTouch:width<600});const page=await context.newPage();
    const requests=[];page.on('request',r=>{if(!r.url().startsWith(origin))requests.push(r.url());});
    await page.goto(origin);await page.waitForFunction(()=>window.__assetsMap?.getState());if(width<600)await page.locator('#mobile-options').click();
    await page.locator('#property-launcher').waitFor({state:'visible'});
    await page.waitForFunction(()=>!document.querySelector('#property-launcher').disabled);
    assert.equal(await page.locator('#property-dialog').isVisible(),false);
    const snapshot=await page.evaluate(()=>JSON.stringify({state:window.__assetsMap.getState(),count:document.querySelector('#portfolio-summary').textContent}));
    await page.locator('#property-launcher').click();assert.equal(await page.locator('#property-dialog article').count(),15);
    assert.equal(await page.locator('#property-title').textContent(),'Property and infrastructure · Pilot');
    assert.equal(await page.locator('#property-dialog').evaluate(e=>e.scrollWidth<=e.clientWidth+1),true,'No horizontal overflow');
    await page.locator('#property-filter').selectOption('infrastructure');assert.equal(await page.locator('#property-dialog article').count(),1);
    assert.equal(await page.locator('#property-dialog').evaluate(e=>e.scrollWidth<=e.clientWidth+1),true,'No horizontal overflow (project card)');
    await page.locator('#property-dialog summary').first().click();assert.equal(await page.locator('#property-dialog a').first().isVisible(),true);
    await page.getByRole('button',{name:'Show both cases',exact:true}).click();assert.equal(await page.locator('#property-dialog article').count(),15);
    await page.screenshot({path:`artifacts/property-${width}.png`});
    await page.getByRole('button',{name:'← Back to map',exact:true}).click();assert.equal(await page.locator('#property-dialog').isVisible(),false);
    assert.equal(await page.evaluate(()=>document.activeElement.id),width<600?'mobile-options':'property-launcher');
    assert.equal(await page.evaluate(()=>JSON.stringify({state:window.__assetsMap.getState(),count:document.querySelector('#portfolio-summary').textContent})),snapshot,'Holdings state and totals unchanged');
    if(width<600)await page.locator('#mobile-options').click();
    await page.locator('#property-launcher').click();await page.keyboard.press('Escape');assert.equal(await page.locator('#property-dialog').isVisible(),false);
    assert.deepEqual(requests,[],'No third-party requests');
    await context.close();
  }
}
