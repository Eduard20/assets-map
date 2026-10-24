import assert from 'node:assert/strict';
export async function checkRelationshipCards(browser,origin){
 for(const [name,width,height] of [['desktop',1440,1000],['phone',390,844],['phone-320',320,568]]){
  const phone=width<600;
  const context=await browser.newContext({viewport:{width,height},hasTouch:phone});const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const selectDataset=async name=>{if(phone)await page.locator('#mobile-options').click();await page.locator('#dataset').selectOption(name);await page.waitForFunction(expected=>window.__assetsMap.getState().view===(expected==='uae'?'list':'2d')&&document.querySelector('#graph-stage').getAttribute('aria-busy')==='false',name);};
  const assertRootInView=async()=>{
   const card=await page.locator('.relationship-card.selected .node-card').boundingBox(),stage=await page.locator('#graph-2d').boundingBox();
   assert.ok(card&&stage,'Selected card and 2D stage are visible');assert.ok(card.width>=44&&card.height>=44);
   assert.ok(card.x>=stage.x&&card.x+card.width<=stage.x+stage.width+1,'Selected card fits horizontally');
   assert.ok(card.y>=stage.y&&card.y+card.height<=stage.y+stage.height+1,'Selected card fits vertically');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'No horizontal page overflow');
  };
  try{
   await page.goto(origin);await page.waitForFunction(()=>window.__assetsMap?.getGraph());
   assert.equal(await page.evaluate(()=>window.__assetsMap.getState().view),'2d');
   assert.equal(await page.locator('.relationship-card').count(),await page.evaluate(()=>window.__assetsMap.getGraph().nodes.length));
   assert.equal(await page.locator('.edge-visible[marker-end]').count(),await page.evaluate(()=>window.__assetsMap.getGraph().edges.length));
   await page.screenshot({path:`artifacts/relationship-cards-${name}.png`,fullPage:true});
   // Loading another dataset while 2D is hidden must not preserve a phantom
   // desktop viewport and leave the new selected card offscreen on a phone.
   await page.locator('[data-view="list"]').click();await selectDataset('researched');await assertRootInView();
   if(phone){
    await page.locator('#mobile-details').click();assert.equal(await page.locator('#detail-sheet').isVisible(),true);
    await page.locator('#close-mobile-details').click();assert.equal(await page.locator('#detail-sheet').isVisible(),false);
    assert.equal(await page.evaluate(()=>document.activeElement.id),'mobile-details');
   }
   await page.locator('#fit-map').click();await assertRootInView();
   await selectDataset('uae');await page.locator('.research-explore').first().click();
   await page.waitForFunction(()=>window.__assetsMap.getState().view==='2d');await assertRootInView();
   await page.screenshot({path:`artifacts/relationship-cards-reveal-${name}.png`,fullPage:true});
   await page.locator('#focus-back').click();await page.waitForFunction(()=>window.__assetsMap.getState().view==='list');
   await selectDataset('sample');await assertRootInView();
   assert.deepEqual(errors,[]);
  }finally{await context.close();}
 }
}
