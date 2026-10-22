import assert from 'node:assert/strict';
export async function checkSearchContext(browser,origin){
 for(const width of [390,1280]){
  const context=await browser.newContext({viewport:{width,height:844},isMobile:width===390,hasTouch:width===390});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.goto(origin);await page.waitForFunction(()=>window.__assetsMap?.getState());
   const search=page.locator('#search');await search.fill('atlassian');
   const rows=page.locator('#search-results button');assert.equal(await rows.count(),3);
   const ids=await rows.evaluateAll(bs=>bs.map(b=>b.dataset.searchNode));
   for(const cls of ['CL A','CMN','COMMON'])assert.ok((await rows.allTextContents()).some(t=>t.includes('Reported class: '+cls)));
   assert.ok(await page.locator('.search-context').isVisible());
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   for(const box of await rows.evaluateAll(bs=>bs.map(b=>{const r=b.getBoundingClientRect();return {w:r.width,h:r.height,right:r.right,left:r.left};}))){assert.ok(box.h>=44);assert.ok(box.left>=0&&box.right<=width);}
   await page.screenshot({path:`artifacts/search-atlassian-${width}.png`});
   // Every displayed record still opens its original instrument/evidence view.
   for(const id of ids){
    await search.fill('atlassian');await page.locator(`[data-search-node="${id}"]`).click();
    assert.equal(await page.evaluate(()=>window.__assetsMap.getState().rootId),id);
    assert.equal(await page.locator('#search-results').isVisible(),false);
   }
   await search.fill('atlassian');await search.press('ArrowDown');
   assert.equal(await page.evaluate(()=>document.activeElement.dataset.searchNode),ids[0]);
   await page.keyboard.press('ArrowDown');assert.equal(await page.evaluate(()=>document.activeElement.dataset.searchNode),ids[1]);
   await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>window.__assetsMap.getState().rootId),ids[1]);
   await search.fill('atlassian');await search.press('Escape');assert.equal(await page.locator('#search-results').isVisible(),false);
   await search.fill('zzzznomatch');assert.match(await page.locator('#search-results').textContent(),/imported portfolio network/);
   assert.deepEqual(errors,[]);
  }finally{await context.close();}
 }
}
