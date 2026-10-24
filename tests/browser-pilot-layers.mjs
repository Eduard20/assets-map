import assert from 'node:assert/strict';
const LAUNCHERS=['institutional','bond','gold','issuer','property','country'].map(id=>`${id}-launcher`);
export async function checkPilotLayersSection(browser,origin){
  for(const width of [320,390,1280]){
    const context=await browser.newContext({viewport:{width,height:844},isMobile:width<600,hasTouch:width<600});const page=await context.newPage();
    await page.goto(origin);await page.waitForFunction(()=>window.__assetsMap?.getState());
    assert.deepEqual(await page.evaluate(()=>[...document.querySelectorAll('#pilot-layers button')].map(b=>b.id)).then(ids=>LAUNCHERS.every(id=>ids.includes(id))),true,'Every pilot launcher lives in the section');
    if(width<600){
      assert.equal(await page.locator('#pilot-layers').isVisible(),false);await page.locator('#mobile-options').click();
      assert.equal(await page.evaluate(()=>document.querySelector('#mobile-controls-content').firstElementChild.id==='pilot-layers'||document.querySelector('#mobile-controls-content').children[1]?.id==='pilot-layers'),true,'Section leads the phone panel');
    }
    await page.locator('#pilot-layers').waitFor({state:'visible'});
    assert.equal(await page.getByRole('heading',{name:'More asset classes'}).isVisible(),true);
    if(width>=600)assert.ok(await page.locator('#pilot-layers').evaluate(e=>e.getBoundingClientRect().bottom<=window.innerHeight),'Section is above the fold on desktop');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),true,'No horizontal page overflow');
    await page.screenshot({path:`artifacts/pilot-layers-${width}.png`});
    await context.close();
  }
}
