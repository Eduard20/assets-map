import assert from 'node:assert/strict';
export async function checkCountryPilot(browser,origin){
  for(const width of [320,390,1280]){
    const context=await browser.newContext({viewport:{width,height:844},isMobile:width<600,hasTouch:width<600});const page=await context.newPage();
    const requests=[];page.on('request',r=>{if(!r.url().startsWith(origin))requests.push(r.url());});
    await page.goto(origin);await page.waitForFunction(()=>window.__assetsMap?.getState());if(width<600)await page.locator('#mobile-options').click();
    await page.locator('#country-launcher').waitFor({state:'visible'});
    await page.waitForFunction(()=>!document.querySelector('#country-launcher').disabled);
    assert.equal(await page.locator('#country-dialog').isVisible(),false);
    const snapshot=await page.evaluate(()=>JSON.stringify({state:window.__assetsMap.getState(),count:document.querySelector('#portfolio-summary').textContent}));
    await page.locator('#country-launcher').click();assert.equal(await page.locator('#country-dialog article').count(),5);
    assert.equal(await page.locator('#country-title').textContent(),'Country exploration: Armenia · Pilot');
    const noOverflow=async label=>assert.equal(await page.locator('#country-dialog').evaluate(e=>e.scrollWidth<=e.clientWidth+1),true,`No horizontal overflow (${label})`);
    await noOverflow('operating location');
    await page.locator('#country-dimension').selectOption('investorDomicile');assert.equal(await page.locator('#country-dialog article').count(),1);
    await page.locator('#country-value').selectOption('non_resident');assert.equal(await page.locator('#country-dialog article').count(),2);await noOverflow('investor domicile');
    await page.locator('#country-dimension').selectOption('reportingCurrency');assert.equal(await page.locator('#country-dialog article').count(),1);
    await page.locator('#country-dialog article summary').first().click();assert.equal(await page.locator('#country-dialog article a').first().isVisible(),true);await noOverflow('evidence');
    await page.getByRole('button',{name:'Operating location = Armenia',exact:true}).click();assert.equal(await page.locator('#country-dialog article').count(),5);
    await page.screenshot({path:`artifacts/country-${width}.png`});
    await page.getByRole('button',{name:'← Back to map',exact:true}).click();assert.equal(await page.locator('#country-dialog').isVisible(),false);
    assert.equal(await page.evaluate(()=>document.activeElement.id),width<600?'mobile-options':'country-launcher');
    assert.equal(await page.evaluate(()=>JSON.stringify({state:window.__assetsMap.getState(),count:document.querySelector('#portfolio-summary').textContent})),snapshot,'Holdings state and totals unchanged');
    if(width<600)await page.locator('#mobile-options').click();
    await page.locator('#country-launcher').click();await page.keyboard.press('Escape');assert.equal(await page.locator('#country-dialog').isVisible(),false);
    assert.deepEqual(requests,[],'No third-party requests');
    await context.close();
  }
}
