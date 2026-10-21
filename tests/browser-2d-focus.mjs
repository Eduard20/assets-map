import assert from 'node:assert/strict';
export async function check2DFocus(browser,origin){
 const context=await browser.newContext({viewport:{width:1280,height:900}});
 const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.goto(origin);await page.waitForFunction(()=>window.__assetsMap?.getState());
  await page.locator('[data-view="2d"]').click();
  await page.waitForFunction(()=>window.__assetsMap.getState().view==='2d');
  const nodeId=await page.locator('#graph-2d [data-node]').first().getAttribute('data-node');
  await page.locator('#graph-2d [data-node]').first().focus();
  const oldNode=await page.locator('#graph-2d [data-node]').first().elementHandle();
  await page.setViewportSize({width:900,height:700});
  await page.waitForFunction(node=>!node.isConnected,oldNode);
  await page.waitForFunction(id=>document.activeElement?.dataset.node===id,nodeId);
  for(const key of ['Enter','Space']){
   await page.keyboard.press(key);
   assert.equal(await page.evaluate(()=>document.activeElement?.dataset.node),nodeId,'2D node focus survives keyboard selection redraw');
   assert.equal(await page.evaluate(()=>window.__assetsMap.getState().selectedId),nodeId);
  }
  const edge=page.locator('#graph-2d [data-edge]').first();const edgeId=await edge.getAttribute('data-edge');await edge.focus();
  const oldEdge=await edge.elementHandle();
  await page.setViewportSize({width:1000,height:700});
  await page.waitForFunction(node=>!node.isConnected,oldEdge);
  await page.waitForFunction(id=>document.activeElement?.dataset.edge===id,edgeId);
  for(const key of ['Enter','Space']){
   await page.keyboard.press(key);
   assert.equal(await page.evaluate(()=>document.activeElement?.dataset.edge),edgeId,'2D edge focus survives keyboard selection redraw');
   assert.equal(await page.evaluate(()=>window.__assetsMap.getState().selectedEdgeId),edgeId);
  }
  await page.locator('#zoom-in').focus();
  await page.setViewportSize({width:1100,height:750});
  await page.waitForTimeout(100);
  assert.equal(await page.evaluate(()=>document.activeElement.id),'zoom-in','Graph resize must not steal external-control focus');
  assert.deepEqual(errors,[]);
 }finally{await context.close();}
}
