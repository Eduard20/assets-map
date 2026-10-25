import assert from 'node:assert/strict';

export async function checkCppSnb(browser, origin) {
  for (const width of [390, 1280]) {
    const phone = width < 600;
    const context = await browser.newContext({viewport: {width, height: 900}, isMobile: phone, hasTouch: phone});
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      for (const [slug, rows, exactValue, cik, accession, table] of [['cpp', 1694, '180,776,675,190', '1283718', '000110465926097308', 'infoTable.xml'], ['snb', 2301, '191,389,544,938', '1582202', '000158220226000007', 'InfoTable_Q22026.xml']]) {
        const id = `${slug}-2026-06-30`;
        await page.goto(origin);
        await page.waitForFunction(() => window.__assetsMap?.getModel()?.portfolioMap?.size === 13);
        if (phone) await page.locator('#mobile-options').click();
        await page.locator('#portfolio').selectOption(id);
        if (phone) await page.locator('#mobile-apply-controls').click();
        assert.equal(await page.evaluate(() => window.__assetsMap.getState().rootId), id);
        assert.equal(await page.evaluate(() => window.__assetsMap.getState().view), '2d');
        assert.ok(await page.evaluate(() => window.__assetsMap.getGraph().nodes.length <= 200));
        if (phone) await page.locator('#mobile-details').click();
        const detail = await page.locator('#detail-panel').textContent();
        assert.ok(detail.includes(exactValue));
        assert.match(detail, /Report date 30 Jun 2026/);
        assert.match(detail, /not whole AUM/);
        assert.match(detail, /corrections checked through 24 Oct 2026/);
        assert.deepEqual((await page.locator('#detail-panel .source-link').evaluateAll(links => links.map(link => link.href))).sort(), [table, 'primary_doc.xml'].map(file => `https://www.sec.gov/Archives/edgar/data/${cik}/${accession}/${file}`).sort());
        await page.screenshot({path: `artifacts/${slug}-snapshot-${width}.png`, fullPage: true});
        await page.locator(`[data-open-holdings="${id}"]`).click();
        await page.locator('#holdings-search').fill('APPLE INC');
        if (phone) await page.locator('#mobile-apply-controls').click();
        assert.equal(await page.locator('.holding-row').count(), 1);
        await page.locator('.holding-row').click();
        if (phone) assert.equal(await page.locator('#detail-sheet').isVisible(), true, 'Selecting a holding opens its evidence details');
        const evidence = page.locator('.investor-card').filter({has: page.locator(`[data-select="${id}"]`)}).locator('.investor-evidence');
        await evidence.click();
        assert.match(await page.locator('#detail-panel').textContent(), /Information-table row/);
        assert.equal(await page.evaluate(pid => window.__assetsMap.getModel().portfolioMap.get(pid).positions.length, id), rows);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      }
      assert.deepEqual(errors, []);
    } finally {
      await context.close();
    }
  }
}
