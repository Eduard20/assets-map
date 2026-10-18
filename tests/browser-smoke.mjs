import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const server=spawn(process.execPath,['scripts/serve.mjs'],{env:{...process.env,PORT:'8088'},stdio:'pipe'});
await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);});
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader']});
try{
  await mkdir('artifacts',{recursive:true});const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto('http://127.0.0.1:8088/');await page.waitForFunction(()=>window.__assetsMap);
  assert.equal(await page.locator('.graph-node').count(),4);assert.ok((await page.locator('#detail-panel').textContent()).includes('Client assets under management'));
  await page.screenshot({path:'artifacts/desktop.png',fullPage:true});
  await page.locator('#search').fill('berkshire');await page.locator('[data-search-node="berkshire"]').click();assert.equal(await page.locator('.graph-node').count(),6);
  await page.locator('[data-filter="managed_holding"]').click();assert.equal(await page.locator('.edge').count(),0);assert.equal(await page.locator('#empty-state').isVisible(),true);await page.locator('[data-filter="all"]').click();
  await page.locator('[data-view="list"]').click();assert.equal(await page.locator('.list-connection').count(),5);await page.locator('.list-connection').first().click();assert.ok((await page.locator('#detail-panel').textContent()).includes('Not disclosed in sample'));
  await page.locator('#reset-map').click();await page.locator('[data-view="3d"]').click();await page.waitForTimeout(2000);const did3d=await page.locator('#graph-3d').isVisible();if(did3d){assert.equal(await page.locator('#graph-3d canvas').count(),1);await page.screenshot({path:'artifacts/3d.png',fullPage:true});}else console.log('3D fallback used; WebGL was unavailable.');
  await page.locator('#reset-map').click();
  for(const width of [320,390,768]){await page.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Horizontal overflow at ${width}px`);}
  await page.setViewportSize({width:390,height:844});await page.waitForFunction(()=>document.querySelector('#graph-2d svg').viewBox.baseVal.width<500);await page.screenshot({path:'artifacts/mobile.png',fullPage:true});
  await page.locator('#about-button').click();assert.equal(await page.locator('#info-dialog').isVisible(),true);await page.locator('#dialog-done').click();
  assert.deepEqual(errors,[]);console.log('Browser smoke checks passed. 3D rendered:',did3d);
}finally{await browser.close();server.kill();}
