import assert from 'node:assert/strict';
export async function checkNps(browser, origin) {
 const id='nps-2026-06-30';
 for(const width of [390,1280]) {
  const phone=width<600,context=await browser.newContext({viewport:{width,height:900},isMobile:phone,hasTouch:phone});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  try {
   await page.goto(origin);await page.waitForFunction(()=>window.__assetsMap?.getModel()?.portfolioMap?.size===13);
   if(phone)await page.locator('#mobile-options').click();
   await page.locator('#portfolio').selectOption(id);if(phone)await page.locator('#mobile-apply-controls').click();
   assert.equal(await page.evaluate(()=>window.__assetsMap.getState().rootId),id);
   assert.equal(await page.evaluate(()=>window.__assetsMap.getState().view),'2d');
   assert.ok(await page.evaluate(()=>window.__assetsMap.getGraph().nodes.length<=200));
   if(phone)await page.locator('#mobile-details').click();
   const detail=await page.locator('#detail-panel').textContent();
   assert.match(detail,/155,075,664,624/);assert.match(detail,/Report date 30 Jun 2026/);
   assert.match(detail,/not whole AUM/);assert.match(detail,/corrections checked through 24 Oct 2026/);
   const links=await page.locator('#detail-panel .source-link').evaluateAll(ls=>ls.map(l=>l.href));
   assert.deepEqual(links.sort(),['56942.xml','primary_doc.xml'].map(file=>`https://www.sec.gov/Archives/edgar/data/1608046/000119312526347818/${file}`).sort());
   await page.screenshot({path:`artifacts/nps-snapshot-${width}.png`,fullPage:true});
   await page.locator(`[data-open-holdings="${id}"]`).click();await page.locator('#holdings-search').fill('APPLE INC');
   if(phone)await page.locator('#mobile-apply-controls').click();
   assert.equal(await page.locator('.holding-row').count(),1);await page.locator('.holding-row').click();
   if(phone)assert.equal(await page.locator('#detail-sheet').isVisible(),true);
   await page.locator('.investor-card').filter({has:page.locator(`[data-select="${id}"]`)}).locator('.investor-evidence').click();
   assert.match(await page.locator('#detail-panel').textContent(),/Information-table row/);
   assert.equal(await page.evaluate(pid=>window.__assetsMap.getModel().portfolioMap.get(pid).positions.length,id),551);
   assert.equal(await page.evaluate(pid=>window.__assetsMap.getModel().portfolioMap.get(pid).positions.some(p=>p.rowOrdinal===552),id),false);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);
  } finally {await context.close();}
 }
}
