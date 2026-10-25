import {checkCppSnb} from './browser-cpp-snb.mjs';
import {checkRelationshipCards} from './browser-relationship-cards.mjs';
import {checkUaeHoldings} from './browser-uae.mjs';
import {checkSearchContext} from './browser-search-context.mjs';
import {checkPortfolioComparison} from './browser-comparison.mjs';
import {checkInstitutionalPilot} from './browser-institutional.mjs';
import {checkBondPilot} from './browser-bond.mjs';
import {checkPilotLayersSection} from './browser-pilot-layers.mjs';
import {checkGoldPilot} from './browser-gold.mjs';
import {checkIssuerPilot} from './browser-issuer.mjs';
import {checkPropertyPilot} from './browser-property.mjs';
import {checkCountryPilot} from './browser-country.mjs';
import {checkHoldersPilot} from './browser-holders.mjs';
import {check2DFocus} from './browser-2d-focus.mjs';
import {checkLoadingRecovery} from './browser-loading-recovery.mjs';
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';

const portfolioIds = [
  'berkshire-2026-06-30','blackrock-2026-06-30','cpp-2026-06-30','geode-2026-06-30','goldmansachs-2026-06-30',
  'jpmorgan-2026-06-30','morganstanley-2026-06-30','norgesbank-2026-06-30','pif-2026-06-30','snb-2026-06-30','statestreet-2026-06-30','vanguardglobaladvisers-2026-06-30'
];
const initialNetworkNodes = 108;
const eligibleHoldingRows = 162145;
const origin = 'http://127.0.0.1:8088';
const server = spawn(process.execPath, ['scripts/serve.mjs'], {
  env: {...process.env, PORT: '8088'}, stdio: 'pipe'
});
let browser;
const errors = [];
const watchErrors = page => page.on('pageerror', error => errors.push(error.message));
const selectedId = page => page.evaluate(() => window.__assetsMap.getState().selectedId);
const bubbles = page => page.locator('#graph-3d button[data-node-id]');

async function expectView(page, view) {
  await page.waitForFunction(expected => window.__assetsMap?.getState()?.view === expected && ['2d', '3d', 'list'].every(name => {
    const container = document.querySelector(`#graph-${name}`);
    const button = document.querySelector(`[data-view="${name}"]`);
    return container && container.hidden === (name !== expected) && button?.getAttribute('aria-pressed') === String(name === expected);
  }), view);
  for (const name of ['2d', '3d', 'list']) {
    assert.equal(await page.locator(`#graph-${name}`).isVisible(), name === view, `${name} visibility while ${view} is active`);
    assert.equal(await page.locator(`[data-view="${name}"]`).getAttribute('aria-pressed'), String(name === view), `${name} toggle state`);
  }
}

async function expectReal3D(page, count = 4) {
  if(await page.evaluate(()=>window.__assetsMap?.getState()?.view)!=='3d')await page.locator('[data-view="3d"]').click();
  await expectView(page, '3d');
  await page.waitForFunction(expected => document.querySelectorAll('#graph-3d button[data-node-id]').length === expected, count);
  assert.equal(await page.locator('#graph-3d canvas').count(), 1, 'The default view must render real WebGL, not silently pass through 2D fallback');
  const webgl = await page.locator('#graph-3d canvas').evaluate(canvas => {
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    return Boolean(gl && !gl.isContextLost() && gl.drawingBufferWidth > 0 && gl.drawingBufferHeight > 0);
  });
  assert.equal(webgl, true, '3D canvas must have a working WebGL context (CI uses SwiftShader)');
  for (const button of await bubbles(page).all()) assert.equal(await button.isVisible(), true, 'Every bubble retains an accessible button after fitting');
  const ids = await bubbles(page).evaluateAll(buttons => buttons.map(button => button.dataset.nodeId));
  assert.equal(new Set(ids).size, count, 'Each visible graph entity needs one accessible bubble button');
  assert.equal(await bubbles(page).evaluateAll(buttons => buttons.every(button => {
    const name = button.getAttribute('aria-label') || button.textContent;
    return name.trim().length > 0 && !button.disabled && button.tabIndex >= 0;
  })), true, 'Bubble buttons must be named and keyboard reachable');
}

async function ensureNoOverflow(page, width) {
  await page.setViewportSize({width, height: 844});
  await page.waitForFunction(() => {
    const canvas = document.querySelector('#graph-3d canvas').getBoundingClientRect();
    const labels = [...document.querySelectorAll('#graph-3d button[data-node-id]')].filter(button=>button.dataset.labelVisible!=='false');
    return document.documentElement.scrollWidth <= innerWidth && canvas.left >= 0 && canvas.right <= innerWidth + 1
      && labels.every(button => { const rect=button.getBoundingClientRect(); return rect.left>=canvas.left && rect.right<=canvas.right && rect.top>=canvas.top && rect.bottom<=canvas.bottom; });
  });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Horizontal overflow at ${width}px`);
  const canvas = await page.locator('#graph-3d canvas').boundingBox();
  assert.ok(canvas && canvas.width > 0 && canvas.height > 0, `Missing 3D canvas at ${width}px`);
  assert.ok(canvas.x >= -1 && canvas.x + canvas.width <= width + 1, `3D canvas exceeds viewport at ${width}px`);
}

try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Test server did not start within 10 seconds')), 10000);
    const done = callback => value => { clearTimeout(timer); callback(value); };
    server.stdout.once('data', done(resolve));
    server.once('error', done(reject));
    server.once('exit', done(code => reject(new Error(`Test server exited before startup (${code})`))));
  });
  browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_PATH ? {executablePath: process.env.CHROMIUM_PATH} : {}),
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']
  });
  await mkdir('artifacts', {recursive: true});
  await checkLoadingRecovery(browser,origin);
  await checkRelationshipCards(browser,origin);
  await check2DFocus(browser,origin);
  const context = await browser.newContext({viewport: {width: 1440, height: 1000}});
  const page = await context.newPage();
  watchErrors(page);
  await page.goto(origin);
  await page.waitForFunction(() => window.__assetsMap?.getState());
  await expectReal3D(page,initialNetworkNodes);
  await page.screenshot({path:'artifacts/initial-network-desktop.png',fullPage:true});
  for(const viewport of [{width:320,height:568},{width:390,height:844},{width:844,height:390}]){
    await page.setViewportSize(viewport);await page.waitForTimeout(150);
    await page.screenshot({path:`artifacts/initial-network-${viewport.width}x${viewport.height}.png`,fullPage:true});
  }
  await page.setViewportSize({width:1440,height:1000});
  assert.equal(await page.locator('#dataset').inputValue(),'portfolios');
  assert.equal(await page.evaluate(()=>window.__assetsMap.getModel().holdingEdges.length),eligibleHoldingRows);
  assert.equal(await page.evaluate(()=>window.__assetsMap.getGraph().edges.length),454);
  assert.deepEqual(await page.locator('#portfolio option').evaluateAll(options=>options.map(option=>option.value).filter(value=>value!=='all').sort()),portfolioIds,'all twelve admitted managers are selectable');
  assert.equal(await page.locator('#portfolio option').count(),13,'twelve managers plus the shared-network option');
  const startingIds=await page.evaluate(()=>window.__assetsMap.getGraph().nodes.map(n=>n.id).sort());
  const appleId=await page.evaluate(()=>window.__assetsMap.getModel().nodes.find(n=>n.label==='APPLE INC'&&n.sector==='COM').id);
  // Keyboard can reach all network securities even when dense labels are decluttered.
  await page.locator(`#graph-3d button[data-node-id="${appleId}"]`).focus();
  // A real responsive rebuild must preserve focus, not silently swallow Enter.
  await page.setViewportSize({width:390,height:844});
  try { await page.waitForFunction(id=>document.activeElement?.dataset.nodeId===id&&document.querySelector(`#graph-3d button[data-node-id="${id}"]`)?.style.width==='110px',appleId,{timeout:10000}); } catch(error) { console.error('Resize focus diagnostic',await page.evaluate(id=>({active:document.activeElement?.outerHTML?.slice(0,500),label:document.querySelector(`#graph-3d button[data-node-id="${id}"]`)?.outerHTML?.slice(0,500),width:innerWidth}),appleId));throw error; }
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(()=>window.__assetsMap.getState().rootId),appleId);
  await page.setViewportSize({width:1440,height:1000});
  assert.equal(await page.evaluate(()=>window.__assetsMap.getGraph().nodes.length),10,'focused Apple shows only itself and its nine reported investors');
  assert.ok(await page.evaluate(id=>{const isolatedTo=id=>{const g=window.__assetsMap.getGraph(),scope=new Set(g.focusScope);return g.focused===true&&scope.has(id)&&g.edges.every(e=>scope.has(e.source)||scope.has(e.target))&&g.nodes.every(n=>scope.has(n.id)||g.edges.some(e=>e.source===n.id||e.target===n.id));};return isolatedTo(id);},appleId),'every visible link touches the focused security');
  assert.equal(await page.locator('#show-whole-network').isVisible(),true);
  assert.match(await page.locator('#detail-panel').textContent(),/9 REPORTED INVESTORS/);
  assert.equal(await page.locator('.investor-card').count(),9);
  assert.deepEqual(await page.evaluate(id=>{
    const edges=window.__assetsMap.getModel().edges.filter(edge=>edge.target===id);
    return {investors:edges.length,sourceRows:edges.reduce((sum,edge)=>sum+edge.portfolioPositions.length,0),classes:[...new Set(edges.map(edge=>edge.portfolioPosition.securityClass))]};
  },appleId),{investors:9,sourceRows:67,classes:['COM']},'exact Apple COM grouping preserves all 67 source rows without merging differently reported classes');
  assert.equal(await page.evaluate(()=>window.__assetsMap.getModel().nodes.filter(node=>node.label==='APPLE INC').length),3,'COM, CMN and COMMON Apple descriptions remain separate identities');
  await page.locator('#focus-back').click();assert.equal(await page.evaluate(()=>window.__assetsMap.getState().rootId),'blackrock-2026-06-30');
  await page.locator('[data-view="2d"]').click();await expectView(page,'2d');
  await page.locator(`.graph-node[data-node="${appleId}"]`).focus();
  await page.locator(`.graph-node[data-node="${appleId}"] .node-card`).click();
  assert.equal(await page.evaluate(()=>window.__assetsMap.getState().rootId),appleId);
  assert.equal(await page.evaluate(()=>window.__assetsMap.getGraph().nodes.length),10,'2D focus also isolates Apple');
  await page.locator('#show-whole-network').click();
  assert.deepEqual(await page.evaluate(()=>window.__assetsMap.getGraph().nodes.map(n=>n.id).sort()),startingIds,'Show whole network restores the overview');
  assert.equal(await page.locator('#show-whole-network').isVisible(),false);
  await page.locator('#focus-back').click();assert.equal(await page.evaluate(()=>window.__assetsMap.getGraph().nodes.length),10,'Back returns to the isolated focus');
  await page.locator('#focus-back').click();await page.locator('[data-view="3d"]').click();
  await page.locator('#top-n').selectOption('40');
  const expandedCount=await page.evaluate(()=>window.__assetsMap.getGraph().nodes.length);assert.ok(expandedCount>initialNetworkNodes);await expectReal3D(page,expandedCount);
  await page.locator('#holdings-search').fill('APPLE');await expectView(page,'list');
  assert.ok(await page.locator('.holding-row').count()>0);assert.ok(await page.locator('.holding-row').count()<=50);
  await page.locator(`.holding-row[data-select="${appleId}"]`).first().click();assert.match(await page.locator('#detail-panel').textContent(),/9 REPORTED INVESTORS/);
  await page.locator('#detail-panel [data-edge]').first().click();await page.locator('#detail-panel [data-edge]').first().click();assert.match(await page.locator('#detail-panel').textContent(),/Information-table row/);
  await page.locator('#focus-back').click();assert.equal(await page.locator('#holdings-search').inputValue(),'APPLE');
  await page.locator('#holdings-search').fill('');
  await page.locator('[data-holdings-page="1"]').click();assert.match(await page.locator('.holdings-pagination').textContent(),/Page 2/);
  for(const p of await page.locator('#portfolio option').evaluateAll(options=>options.map(o=>o.value))){await page.locator('#portfolio').selectOption(p);assert.equal(await page.evaluate(()=>window.__assetsMap.getGraph().nodes.filter(n=>n.kind==='manager').length),portfolioIds.length);assert.equal(await page.evaluate(()=>window.__assetsMap.getModel().holdingEdges.length),eligibleHoldingRows);}
  await page.locator('#portfolio').selectOption('all');await page.locator('#top-n').selectOption('20');await page.locator('[data-view="3d"]').click();await expectReal3D(page,initialNetworkNodes);
  // Shared-security discovery covers the full network, independently of top-N.
  await page.locator('#holdings-mode').selectOption('shared');await expectView(page,'list');
  assert.equal(await page.locator('.shared-instrument-row').count(),50);
  const warningContrast=await page.locator('#graph-list .context-note').evaluate(el=>{
    const style=getComputedStyle(el),luminance=color=>{const rgb=color.match(/[0-9.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};
    const a=luminance(style.color),b=luminance(style.backgroundColor);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
  });assert.ok(warningContrast>=4.5,'shared-security coverage warning meets normal-text contrast');
  await page.locator('[data-holdings-page="1"]').click();assert.match(await page.locator('.holdings-pagination').textContent(),/Page 2/);
  await page.locator('#holdings-search').fill('APPLE');
  await page.locator(`.shared-instrument-row[data-select="${appleId}"]`).click();
  assert.match(await page.locator('#detail-panel').textContent(),/9 REPORTED INVESTORS/);
  await page.locator('#detail-panel [data-edge]').first().click();
  await page.locator('#detail-panel [data-edge]').first().click();assert.match(await page.locator('#detail-panel').textContent(),/Information-table row/);
  await page.locator('#focus-back').click();assert.equal(await page.locator('#holdings-mode').inputValue(),'shared');
  assert.equal(await page.locator('#holdings-search').inputValue(),'APPLE');
  await page.locator('#holdings-search').fill('');
  await page.screenshot({path:'artifacts/shared-discovery-desktop.png',fullPage:true});
  await page.locator('#reset-map').click();await expectReal3D(page,initialNetworkNodes);
  assert.equal(await page.locator('#holdings-mode').inputValue(),'rows');
  // A manager bubble opens more of its own network in both renderers.
  for(const view of ['3d','2d']){
    await page.locator(`[data-view="${view}"]`).click();await expectView(page,view);
    const managerSelector=view==='3d'?'#graph-3d button[data-node-id="blackrock-2026-06-30"]':'.graph-node[data-node="blackrock-2026-06-30"] .node-card';
    await page.locator(view==='3d'?managerSelector:'.graph-node[data-node="blackrock-2026-06-30"]').focus();
    await page.locator(managerSelector).click();
    assert.ok(await page.evaluate(()=>{const isolatedTo=id=>{const g=window.__assetsMap.getGraph(),scope=new Set(g.focusScope);return g.focused===true&&scope.has(id)&&g.edges.every(e=>scope.has(e.source)||scope.has(e.target))&&g.nodes.every(n=>scope.has(n.id)||g.edges.some(e=>e.source===n.id||e.target===n.id));};return isolatedTo('blackrock-2026-06-30');}),'BlackRock focus hides unrelated filers and securities');
    const expanded=await page.evaluate(()=>window.__assetsMap.getGraph().nodes.length);
    await page.locator(managerSelector).click();assert.ok(await page.evaluate(()=>window.__assetsMap.getGraph().nodes.length)>expanded);
    await page.locator('#focus-back').click();assert.equal(await page.evaluate(()=>window.__assetsMap.getGraph().nodes.length),expanded);
    await page.locator('#focus-back').click();assert.equal(await page.evaluate(()=>window.__assetsMap.getGraph().nodes.length),initialNetworkNodes);
    const issuerId=await page.evaluate(()=>window.__assetsMap.getModel().roleEdges.find(e=>e.role.manager==='berkshire-2026-06-30'&&e.role.securityClass==='CL B NEW').source);
    await page.locator(view==='3d'?`#graph-3d button[data-node-id="${issuerId}"]`:`.graph-node[data-node="${issuerId}"]`).focus();
    await page.locator(view==='3d'?`#graph-3d button[data-node-id="${issuerId}"]`:`.graph-node[data-node="${issuerId}"] .node-card`).click();
    assert.ok(await page.evaluate(()=>window.__assetsMap.getGraph().edges.some(e=>e.kind==='issuer_reporting_entity')));
    assert.ok(await page.evaluate(()=>window.__assetsMap.getGraph().edges.filter(e=>e.source==='berkshire-2026-06-30').length)>=20);
    assert.match(await page.locator('#detail-panel').textContent(),/Outgoing investments/);
    await page.locator('#focus-back').click();assert.equal(await page.evaluate(()=>window.__assetsMap.getGraph().nodes.length),initialNetworkNodes);
  }
  await page.locator('[data-view="3d"]').click();await expectReal3D(page,initialNetworkNodes);
  await page.screenshot({path:'artifacts/shared-network-desktop.png',fullPage:true});
  for(const width of [320,390]){await ensureNoOverflow(page,width);await expectReal3D(page,initialNetworkNodes);}
  await page.screenshot({path:'artifacts/shared-network-mobile.png',fullPage:true});
  await page.setViewportSize({width:1440,height:1000});
  await page.locator('#dataset').selectOption('researched');await page.waitForFunction(()=>window.__assetsMap.getModel().meta.mode==='researched');
  await expectReal3D(page);
  assert.equal(await page.locator('#dataset').inputValue(),'researched');
  assert.equal(await page.evaluate(()=>window.__assetsMap.getGraph().edges.length),4);
  await page.locator('[data-view="list"]').click();
  assert.equal(await page.locator('.list-connection').count(),4);
  const researchEdges=await page.evaluate(()=>window.__assetsMap.getModel().edges.map(e=>({id:e.id,kind:e.kind})));
  for(const edge of researchEdges){
    await page.locator(`#graph-list [data-edge="${edge.id}"]`).click();
    const detail=await page.locator('#detail-panel').textContent();
    assert.match(detail,/Historical snapshot/);assert.match(detail,/does not establish a current position/);
    if(edge.kind==='beneficial_ownership')assert.match(detail,/Less than 1%/);
    if(edge.kind==='managed_holding'){assert.match(detail,/31,661,076/);assert.match(detail,/9,161,448,952 USD/);}
    if(edge.kind==='voting_authority')assert.match(detail,/not an additional holding/);
  }
  await page.locator('[data-view="3d"]').click();await expectReal3D(page);
  await page.screenshot({path:'artifacts/researched-desktop.png',fullPage:true});
  for(const width of [320,390]){await ensureNoOverflow(page,width);await expectReal3D(page);}
  await page.screenshot({path:'artifacts/researched-mobile.png',fullPage:true});
  await page.setViewportSize({width:1440,height:1000});
  await page.locator('#dataset').selectOption('sample');
  await page.waitForFunction(()=>window.__assetsMap.getState().rootId==='blackrock');
  await expectReal3D(page);
  assert.ok((await page.locator('#detail-panel').textContent()).includes('Client assets under management'));
  await page.screenshot({path: 'artifacts/desktop.png', fullPage: true});

  // Real native buttons must work with both pointer and keyboard input.
  const firstChild = page.locator('#graph-3d button[data-node-id]:not([data-node-id="blackrock"])').first();
  const childId = await firstChild.getAttribute('data-node-id');
  await firstChild.click();
  assert.equal(await selectedId(page), childId);
  await page.locator('#graph-3d button[data-node-id="blackrock"]').focus();
  await page.keyboard.press('Enter');
  assert.equal(await selectedId(page), 'blackrock');

  const labelBox = await firstChild.boundingBox();
  assert.ok(labelBox);
  await page.mouse.move(labelBox.x + labelBox.width / 2, labelBox.y + labelBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(labelBox.x + labelBox.width / 2 + 24, labelBox.y + labelBox.height / 2);
  await page.mouse.move(labelBox.x + labelBox.width / 2, labelBox.y + labelBox.height / 2);
  await page.mouse.up();
  assert.equal(await selectedId(page), 'blackrock', 'A drag that returns to the same HTML label must not select it');

  const cameraState = () => page.evaluate(() => window.__assetsMap.getCameraState());
  const cameraDistance = state => Math.hypot(...state.position.map((value, index) => value - state.target[index]));
  await page.locator('#fit-map').click();
  await page.waitForTimeout(300);
  const fitted = await cameraState();
  assert.ok(fitted?.position?.length === 3 && fitted?.target?.length === 3, 'Expose camera state to verify real controls');
  await page.locator('#zoom-in').click();
  const zoomedIn = await cameraState();
  assert.ok(cameraDistance(zoomedIn) < cameraDistance(fitted) - 1, 'Zoom in should move the camera closer');
  await page.locator('#zoom-out').click();
  const zoomedOut = await cameraState();
  assert.ok(cameraDistance(zoomedOut) > cameraDistance(zoomedIn) + 1, 'Zoom out should move the camera farther away');
  await page.locator('#fit-map').click();
  await page.waitForFunction(before => {
    const camera = window.__assetsMap.getCameraState();
    return camera.position.every((value, index) => Math.abs(value - before.position[index]) < .1)
      && camera.target.every((value, index) => Math.abs(value - before.target[index]) < .1);
  }, fitted);

  // Orbit through a nonselected bubble's canvas region, above its HTML label.
  // This exercises the renderer's raycast gesture gate rather than merely
  // dragging a DOM button whose native click never reaches the canvas.
  const box = await page.locator(`#graph-3d button[data-node-id="${childId}"]`).boundingBox();
  assert.ok(box, 'The bubble label should be visible');
  const start = {x: box.x + box.width / 2, y: box.y - 18};
  assert.equal(await page.evaluate(({x, y}) => document.elementFromPoint(x, y)?.tagName, start), 'CANVAS');
  await page.mouse.click(start.x, start.y);
  assert.equal(await selectedId(page), childId, 'The visible sphere itself must support raycast selection');
  await page.locator('#graph-3d button[data-node-id="blackrock"]').focus();
  await page.keyboard.press('Enter');
  assert.equal(await selectedId(page), 'blackrock');
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 72, start.y + 36, {steps: 12});
  await page.mouse.up();
  assert.equal(await selectedId(page), 'blackrock', 'Orbit drag must not select the bubble it started on');
  const orbited = await cameraState();
  assert.ok(orbited.position.some((value, index) => Math.abs(value - fitted.position[index]) > 1), 'Canvas drag should really orbit the camera');
  await page.locator('#fit-map').click();
  await page.waitForFunction(before => {
    const camera = window.__assetsMap.getCameraState();
    return camera.position.every((value, index) => Math.abs(value - before.position[index]) < .1);
  }, fitted);

  await page.locator('#search').fill('berkshire');
  await page.locator('[data-search-node="berkshire"]').click();
  await expectReal3D(page, 6);
  await page.locator('[data-filter="managed_holding"]').click();
  assert.equal(await bubbles(page).count(), 1);
  assert.equal(await page.locator('#empty-state').isVisible(), true);
  await page.locator('[data-filter="all"]').click();
  await expectReal3D(page, 6);
  await page.locator('[data-view="list"]').click();
  await expectView(page, 'list');
  assert.equal(await page.locator('.list-connection').count(), 5);
  await page.locator('.list-connection').first().click();
  assert.ok((await page.locator('#detail-panel').textContent()).includes('Not disclosed in sample'));
  await page.locator('#reset-map').click();
  await expectReal3D(page);
  assert.equal(await selectedId(page), 'blackrock');
  await page.screenshot({path: 'artifacts/3d.png', fullPage: true});

  for (const width of [320, 390, 768]) {
    await ensureNoOverflow(page, width);
    await expectReal3D(page);
    assert.equal(await page.evaluate(() => {
      const controls = document.querySelector('.zoom-tools').getBoundingClientRect();
      return [...document.querySelectorAll('#graph-3d button[data-node-id]')].every(button => {
        const label = button.getBoundingClientRect();
        return label.right <= controls.left || label.left >= controls.right || label.bottom <= controls.top || label.top >= controls.bottom;
      });
    }), true, `Bubble names must not be covered by map controls at ${width}px`);
    await page.screenshot({path: `artifacts/3d-${width}.png`, fullPage: true});
  }
  await page.setViewportSize({width: 390, height: 844});
  await page.screenshot({path: 'artifacts/mobile.png', fullPage: true});
  await page.locator('[data-view="2d"]').click();
  await expectView(page, '2d');
  await page.waitForFunction(() => document.querySelector('#graph-2d svg').viewBox.baseVal.width < 500);
  assert.equal(await page.locator('.graph-node').count(), 4);
  await page.locator('#mobile-options').click();
  await page.locator('#mobile-help').click();
  assert.equal(await page.locator('#info-dialog').isVisible(), true);
  await page.locator('#dialog-done').click();

  // Emulate an actual touch tap, independently of mouse click behavior.
  const touchContext = await browser.newContext({viewport: {width: 390, height: 844}, isMobile: true, hasTouch: true});
  const touchPage = await touchContext.newPage();
  watchErrors(touchPage);
  await touchPage.goto(origin);
  await touchPage.waitForFunction(()=>window.__assetsMap?.getState());
  await expectReal3D(touchPage,initialNetworkNodes);
  for(const viewport of [{width:320,height:568},{width:390,height:844},{width:844,height:390}]){
    await touchPage.setViewportSize(viewport);
    await touchPage.waitForTimeout(150);
    const area=await touchPage.locator('#graph-stage').boundingBox();
    assert.ok(area.height>=viewport.height*.42,'phone graph uses the main screen, not a sliver below controls');
    assert.ok(area.y+area.height<=viewport.height,'graph fits on screen');
    assert.equal(await touchPage.locator('#portfolio-controls').isVisible(),false);
    assert.equal(await touchPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    for(const selector of ['#mobile-options','#mobile-details','#zoom-in','#zoom-out','#fit-map','#reset-map','[data-view="2d"]']){
      const target=await touchPage.locator(selector).boundingBox();assert.ok(target.width>=44&&target.height>=44,`${selector} has a finger-sized target`);
    }
    await touchPage.screenshot({path:`artifacts/network-phone-${viewport.width}x${viewport.height}.png`,fullPage:true});
  }
  await touchPage.setViewportSize({width:390,height:844});
  // Discover shared instruments through the phone sheet, then inspect evidence.
  for(const viewport of [{width:320,height:568},{width:390,height:844},{width:844,height:390}]){
    await touchPage.setViewportSize(viewport);
    await touchPage.locator('#mobile-options').tap();
    await touchPage.locator('#holdings-mode').selectOption('shared');
    await touchPage.locator('#holdings-search').fill('APPLE');
    await touchPage.locator('#mobile-apply-controls').tap();await expectView(touchPage,'list');
    assert.equal(await touchPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    assert.ok(await touchPage.locator('.shared-instrument-row').count()>0);
    await touchPage.locator(`.shared-instrument-row[data-select="${appleId}"]`).tap();
    assert.equal(await touchPage.locator('#detail-sheet').getAttribute('aria-modal'),'true');
    assert.match(await touchPage.locator('#detail-panel').textContent(),/9 REPORTED INVESTORS/);
    await touchPage.locator('#detail-panel [data-edge]').first().tap();
    await touchPage.locator('#detail-panel [data-edge]').first().tap();
    assert.match(await touchPage.locator('#detail-panel').textContent(),/Information-table row/);
    await touchPage.locator('#close-mobile-details').tap();
    await expectView(touchPage,'list');
    assert.equal(await touchPage.evaluate(()=>document.activeElement?.dataset.select),appleId);
    await touchPage.locator(`.shared-instrument-row[data-select="${appleId}"]`).tap();
    assert.equal(await touchPage.locator('#detail-sheet').getAttribute('aria-modal'),'true');
    await touchPage.keyboard.press('Escape');
    await touchPage.locator('#focus-back').tap();
    await touchPage.screenshot({path:`artifacts/shared-discovery-phone-${viewport.width}.png`,fullPage:true});
    await touchPage.locator('#reset-map').tap();await expectReal3D(touchPage,initialNetworkNodes);
  }
  await touchPage.setViewportSize({width:390,height:844});
  // A newly admitted manager is reachable and expandable from the phone UI.
  await touchPage.locator('#mobile-options').tap();
  assert.deepEqual(await touchPage.locator('#portfolio option').evaluateAll(options=>options.map(option=>option.value).filter(value=>value!=='all').sort()),portfolioIds);
  await touchPage.locator('#portfolio').selectOption('vanguardglobaladvisers-2026-06-30');
  await touchPage.locator('#close-mobile-controls').tap();
  assert.equal(await touchPage.evaluate(()=>window.__assetsMap.getState().rootId),'vanguardglobaladvisers-2026-06-30');
  assert.match(await touchPage.locator('#detail-panel').textContent(),/not The Vanguard Group/);
  assert.match(await touchPage.locator('#detail-panel').textContent(),/not additional economic exposure/);
  const geodeBefore=await touchPage.evaluate(()=>({ids:window.__assetsMap.getGraph().nodes.map(node=>node.id).sort(),holdings:window.__assetsMap.getGraph().edges.filter(edge=>edge.source==='vanguardglobaladvisers-2026-06-30').length}));
  await expectReal3D(touchPage,geodeBefore.ids.length);
  await touchPage.locator('#graph-3d button[data-node-id="vanguardglobaladvisers-2026-06-30"]').tap();
  assert.ok(await touchPage.evaluate(()=>window.__assetsMap.getGraph().edges.filter(edge=>edge.source==='vanguardglobaladvisers-2026-06-30').length)>geodeBefore.holdings,'phone tap opens more of the new manager’s actual holdings');
  assert.deepEqual(await touchPage.evaluate(()=>window.__assetsMap.getGraph().nodes.filter(node=>node.kind==='manager').map(node=>node.id)),['vanguardglobaladvisers-2026-06-30'],'phone focus isolates the new manager from other filers');
  await touchPage.screenshot({path:'artifacts/network-phone-vga.png',fullPage:true});
  await touchPage.locator('#focus-back').tap();
  assert.deepEqual(await touchPage.evaluate(()=>window.__assetsMap.getGraph().nodes.map(node=>node.id).sort()),geodeBefore.ids,'phone Back restores the new manager’s surrounding context');
  await touchPage.locator('#reset-map').tap();await expectReal3D(touchPage,initialNetworkNodes);
  // PIF's complete five-row slice is connected, and its excluded-manager scope stays visible.
  await touchPage.locator('#mobile-options').tap();
  await touchPage.locator('#portfolio').selectOption('pif-2026-06-30');
  await touchPage.locator('#close-mobile-controls').tap();
  assert.equal(await touchPage.evaluate(()=>window.__assetsMap.getState().rootId),'pif-2026-06-30');
  assert.match(await touchPage.locator('#detail-panel').textContent(),/Saudi Electronic Games Holding Co/);
  assert.match(await touchPage.locator('#detail-panel').textContent(),/separately reported holdings are outside this information table/);
  assert.equal(await touchPage.evaluate(()=>window.__assetsMap.getGraph().edges.filter(edge=>edge.source==='pif-2026-06-30').length),5);
  await touchPage.screenshot({path:'artifacts/network-phone-pif.png',fullPage:true});
  await touchPage.locator('#reset-map').tap();await expectReal3D(touchPage,initialNetworkNodes);
  await touchPage.locator('#mobile-options').tap();
  assert.equal(await touchPage.locator('#mobile-controls').getAttribute('aria-modal'),'true');
  await touchPage.locator('#top-n').selectOption('40');
  await touchPage.locator('#close-mobile-controls').tap();
  assert.equal(await touchPage.locator('#portfolio-controls').isVisible(),false);
  await touchPage.locator('#mobile-details').tap();
  assert.equal(await touchPage.locator('#detail-panel').isVisible(),true);
  await touchPage.screenshot({path:'artifacts/network-phone-details.png',fullPage:true});
  await touchPage.locator('#close-mobile-details').tap();
  assert.equal(await touchPage.locator('#detail-panel').isVisible(),false);
  const cdp=await touchContext.newCDPSession(touchPage);
  const dragTouch=async(x,y,dx,dy)=>{
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
    for(let i=1;i<=5;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx*i/5,y:y+dy*i/5,id:1}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  };
  const touchLabelBox=await touchPage.locator('#graph-3d button[data-node-id="blackrock-2026-06-30"]').boundingBox();
  const beforeOrbit=await touchPage.evaluate(()=>window.__assetsMap.getCameraState());
  const beforeGestureId=await selectedId(touchPage);
  await dragTouch(touchLabelBox.x+touchLabelBox.width/2,touchLabelBox.y+touchLabelBox.height/2,45,35);
  await touchPage.waitForTimeout(120);
  const afterOrbit=await touchPage.evaluate(()=>window.__assetsMap.getCameraState());
  assert.ok(afterOrbit.position.some((n,i)=>Math.abs(n-beforeOrbit.position[i])>1),'touch drag starting on a label rotates the 3D network');
  assert.equal(await selectedId(touchPage),beforeGestureId,'drag does not select a node');
  const canvasBox=await touchPage.locator('#graph-3d canvas').boundingBox();
  const px=canvasBox.x+canvasBox.width/2,py=canvasBox.y+canvasBox.height/2;
  const distanceBefore=cameraDistance(await touchPage.evaluate(()=>window.__assetsMap.getCameraState()));
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:px-35,y:py,id:1},{x:px+35,y:py,id:2}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:px-70,y:py,id:1},{x:px+70,y:py,id:2}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  const distanceAfter=cameraDistance(await touchPage.evaluate(()=>window.__assetsMap.getCameraState()));
  assert.ok(distanceAfter<distanceBefore-1,'two fingers zoom the 3D network');
  assert.equal(await selectedId(touchPage),beforeGestureId,'3D pinch is not a selection');
  await touchPage.locator('#fit-map').tap();
  const touchBefore=await touchPage.evaluate(()=>({nodes:window.__assetsMap.getGraph().nodes.map(node=>node.id).sort(),edges:window.__assetsMap.getGraph().edges.map(edge=>edge.id).sort(),holdings:window.__assetsMap.getGraph().edges.filter(edge=>edge.source==='blackrock-2026-06-30').map(edge=>edge.id)}));
  await touchPage.locator('#graph-3d button[data-node-id="blackrock-2026-06-30"]').tap();
  assert.ok((await touchPage.evaluate(()=>window.__assetsMap.getGraph().edges.filter(edge=>edge.source==='blackrock-2026-06-30').map(edge=>edge.id))).some(id=>!touchBefore.holdings.includes(id)),'phone tap reveals new manager holdings even at the node ceiling');
  assert.ok(await touchPage.evaluate(()=>window.__assetsMap.getGraph().nodes.length)<=200,'phone expansion preserves the node ceiling');
  await touchPage.locator('#focus-back').tap();
  assert.deepEqual(await touchPage.evaluate(()=>({nodes:window.__assetsMap.getGraph().nodes.map(node=>node.id).sort(),edges:window.__assetsMap.getGraph().edges.map(edge=>edge.id).sort()})),{nodes:touchBefore.nodes,edges:touchBefore.edges},'phone Back restores exact network context');
  await touchPage.locator('[data-view="2d"]').tap();await expectView(touchPage,'2d');
  const svg=touchPage.locator('#graph-2d svg'),nodeHit=touchPage.locator('.relationship-card.selected .node-card').first();
  const nodeBox=await nodeHit.boundingBox(),beforePan=await touchPage.locator('.viewport').getAttribute('transform');
  await dragTouch(nodeBox.x+nodeBox.width/2,nodeBox.y+nodeBox.height/2,40,25);
  assert.notEqual(await touchPage.locator('.viewport').getAttribute('transform'),beforePan,'2D can pan starting on a node');
  assert.equal(await selectedId(touchPage),beforeGestureId,'2D drag is not a tap');
  const rect=await svg.boundingBox(),cx=rect.x+rect.width/2,cy=rect.y+rect.height/2;
  const beforePinch=await touchPage.locator('.viewport').getAttribute('transform');
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:cx-30,y:cy,id:1},{x:cx+30,y:cy,id:2}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:cx-65,y:cy-10,id:1},{x:cx+65,y:cy+10,id:2}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  assert.notEqual(await touchPage.locator('.viewport').getAttribute('transform'),beforePinch,'2D pinch changes zoom');
  await touchPage.locator('#fit-map').tap();
  await touchPage.screenshot({path:'artifacts/network-phone-2d.png',fullPage:true});
  await touchPage.setViewportSize({width:844,height:390});await touchPage.waitForTimeout(150);
  await touchPage.screenshot({path:'artifacts/network-phone-2d-landscape.png',fullPage:true});
  await touchPage.setViewportSize({width:390,height:844});
  await touchPage.locator('#reset-map').tap();await expectReal3D(touchPage,initialNetworkNodes);
  await touchPage.locator('#mobile-options').tap();
  await touchPage.locator('#dataset').selectOption('sample');
  await touchPage.waitForFunction(()=>window.__assetsMap.getState().rootId==='blackrock');
  await expectReal3D(touchPage);
  const touchBubble = touchPage.locator('#graph-3d button[data-node-id]:not([data-node-id="blackrock"])').first();
  const tappedId = await touchBubble.getAttribute('data-node-id');
  await touchBubble.tap();
  assert.equal(await selectedId(touchPage), tappedId, 'A touch tap must select the bubble');
  await touchContext.close();

  // A separately isolated browser context proves honest behavior when WebGL
  // really is unavailable, even though the main CI context requires working 3D.
  const fallbackContext = await browser.newContext({viewport: {width: 390, height: 844}});
  await fallbackContext.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
      return /^(?:webgl2?|experimental-webgl)$/.test(kind) ? null : getContext.call(this, kind, ...args);
    };
    window.WebGLRenderingContext = undefined;
    window.WebGL2RenderingContext = undefined;
  });
  const fallbackPage = await fallbackContext.newPage();
  watchErrors(fallbackPage);
  await fallbackPage.goto(origin);
  await expectView(fallbackPage, '2d');
  await fallbackPage.locator('[data-view="3d"]').click();
  await expectView(fallbackPage, '2d');
  assert.equal(await fallbackPage.locator('#graph-3d canvas').count(), 0);
  assert.match(await fallbackPage.locator('#view-notice').textContent(), /3D.*(?:unavailable|not available|not supported|could not)/i);
  assert.equal(await fallbackPage.locator('#view-notice').isVisible(), true);
  assert.equal(await fallbackPage.locator('#status').isVisible(), true);
  assert.equal(await fallbackPage.locator('.graph-node').count(), initialNetworkNodes);
  await fallbackPage.locator('[data-view="list"]').click();
  await expectView(fallbackPage, 'list');
  await fallbackPage.locator('[data-view="3d"]').click();
  await expectView(fallbackPage, '2d');
  assert.equal(await fallbackPage.locator('#graph-3d canvas').count(), 0);
  await fallbackPage.screenshot({path: 'artifacts/no-webgl.png', fullPage: true});
  await fallbackContext.close();

  // Hold the dynamic renderer import open, then change views. A late import
  // must never override the user's newer List choice or reveal a hidden canvas.
  const raceContext = await browser.newContext({viewport: {width: 1440, height: 1000}});
  let releaseImport;
  const importGate = new Promise(resolve => { releaseImport = resolve; });
  let importRequested;
  const importStarted = new Promise(resolve => { importRequested = resolve; });
  await raceContext.route('**/src/graph-3d.js*', async route => {
    const response = await route.fetch();
    const source = await response.text();
    importRequested();
    await importGate;
    await route.fulfill({response, body: `${source}\nwindow.__assetsMap3DModuleLoaded = true;\n`});
  });
  const racePage = await raceContext.newPage();
  watchErrors(racePage);
  await racePage.goto(origin, {waitUntil: 'domcontentloaded'});
  await racePage.waitForFunction(() => window.__assetsMap?.getState());
  await racePage.locator('[data-view="3d"]').click();
  await Promise.race([importStarted, new Promise((_, reject) => setTimeout(() => reject(new Error('Requested 3D import was never started')), 10000))]);
  await racePage.locator('[data-view="list"]').click();
  await expectView(racePage, 'list');
  releaseImport();
  await racePage.waitForFunction(() => window.__assetsMap3DModuleLoaded);
  await expectView(racePage, 'list');
  assert.equal(await racePage.locator('.zoom-tools').isVisible(), false);
  await racePage.locator('[data-view="3d"]').click();
  await expectReal3D(racePage,initialNetworkNodes);
  await raceContext.close();

  await checkCppSnb(browser,origin);
  await checkUaeHoldings(browser,origin);
  await checkSearchContext(browser,origin);
  await checkInstitutionalPilot(browser,origin);
  await checkPilotLayersSection(browser,origin);
  await checkBondPilot(browser,origin);
  await checkGoldPilot(browser,origin);
  await checkIssuerPilot(browser,origin);
  await checkPropertyPilot(browser,origin);
  await checkCountryPilot(browser,origin);
  await checkHoldersPilot(browser,origin);
  await checkPortfolioComparison(browser,origin);
  assert.deepEqual(errors, [], 'Browser JavaScript errors');
  console.log('Browser smoke passed: default 2D cards, optional real 3D, keyboard/touch selection, drag suppression, camera controls, responsive layouts, no-WebGL fallback, and async view switching.');
} catch(error) {
  let index=0;for(const context of browser?.contexts()||[])for(const page of context.pages())await page.screenshot({path:`artifacts/failure-${index++}.png`,fullPage:true}).catch(()=>{});
  throw error;
} finally {
  await browser?.close();
  server.kill();
}
