import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {createModel, initialState} from '../src/graph-model.js';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const data = JSON.parse(await readFile(new URL('../data/graph.json', import.meta.url), 'utf8'));
const dom = new JSDOM(html, {url: 'http://localhost/'});
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  fetch: async () => ({ok: true, json: async () => data})
});
// jsdom has no WebGL. Make that explicit instead of depending on its noisy
// "not implemented" canvas exception to exercise the fallback.
dom.window.HTMLCanvasElement.prototype.getContext = () => null;
dom.window.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
dom.window.HTMLDialogElement.prototype.close = function () { this.open = false; };
const $ = selector => document.querySelector(selector);
const click = selector => $(selector).dispatchEvent(new dom.window.MouseEvent('click', {bubbles: true}));
async function waitFor(check, message) {
  const deadline = Date.now() + 3000;
  while (!check()) {
    assert.ok(Date.now() < deadline, message);
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}
await import('../src/app.js');
await waitFor(() => window.__assetsMap && window.__assetsMap.getState().view === '2d' && !$('#graph-2d').hidden, 'App did not settle into the no-WebGL 2D fallback');

function assertActiveView(view) {
  assert.equal(window.__assetsMap.getState().view, view);
  for (const name of ['2d', '3d', 'list']) {
    assert.equal($(`#graph-${name}`).hidden, name !== view, `${name} view visibility`);
    assert.equal($(`[data-view="${name}"]`).getAttribute('aria-pressed'), String(name === view), `${name} toggle state`);
  }
}

test('3D is the requested default, with an honest no-WebGL 2D fallback', () => {
  assert.equal(initialState(createModel(data)).view, '3d');
  assertActiveView('2d');
  assert.equal($('#graph-3d canvas'), null);
  assert.equal($('#view-notice').hidden, false);
  assert.match($('#view-notice').textContent, /Showing the 2D map/i);
  assert.equal($('#status').hidden, false);
  assert.match($('#status').textContent, /3D.*(?:unavailable|not available|not supported|could not)/i);
});

test('app initializes known nodes and distinguishes AUM from ownership', () => {
  assert.equal(document.querySelectorAll('.graph-node').length, 4);
  assert.match($('#detail-panel').textContent, /Client assets under management/);
  assert.match($('#detail-panel').textContent, /\$15.5T/);
});

test('search and root navigation work', () => {
  $('#search').value = 'Berkshire';
  $('#search').dispatchEvent(new dom.window.Event('input'));
  assert.equal(document.querySelectorAll('[data-search-node]').length, 1);
  click('[data-search-node="berkshire"]');
  assert.equal(window.__assetsMap.getState().rootId, 'berkshire');
  assert.equal(document.querySelectorAll('.graph-node').length, 6);
});

test('relationship filters and no-results state work', () => {
  click('[data-filter="managed_holding"]');
  assert.equal(document.querySelectorAll('.edge').length, 0);
  assert.equal($('#empty-state').hidden, false);
  click('[data-filter="all"]');
  assert.equal(document.querySelectorAll('.edge').length, 5);
});

test('connection evidence and unknown stake label are visible', () => {
  click('#detail-panel [data-edge]');
  assert.match($('#detail-panel').textContent, /CONNECTION DETAILS/);
  assert.match($('#detail-panel').textContent, /Not disclosed in sample/);
  assert.match($('#detail-panel').textContent, /2025/);
  assert.ok($('#detail-panel a.source-link').href.startsWith('https://'));
});

test('List remains useful after WebGL failure, and reset safely retries the default', async () => {
  click('[data-view="list"]');
  assertActiveView('list');
  assert.equal(document.querySelectorAll('.list-connection').length, 5);
  assert.equal($('.zoom-tools').hidden, true);
  click('#reset-map');
  await waitFor(() => window.__assetsMap.getState().view === '2d' && !$('#graph-2d').hidden, 'Reset did not return to a usable fallback');
  assert.equal(window.__assetsMap.getState().rootId, 'blackrock');
  assert.equal(window.__assetsMap.getState().selectedId, 'blackrock');
  assertActiveView('2d');
  assert.equal($('.zoom-tools').hidden, false);
});

test('an explicit 3D retry still falls back without leaving the controls inconsistent', async () => {
  await window.__assetsMap.setView('list');
  await window.__assetsMap.setView('3d');
  assertActiveView('2d');
  assert.equal($('#graph-3d canvas'), null);
  assert.equal($('#view-notice').hidden, false);
  assert.match($('#view-notice').textContent, /Showing the 2D map/i);
  assert.equal($('#status').hidden, false);
  assert.match($('#status').textContent, /3D.*(?:unavailable|not available|not supported|could not)/i);
});

test('fallback nodes remain keyboard accessible and zoom/reset controls work', () => {
  const node = document.querySelector('.graph-node:not([data-node="blackrock"])');
  assert.equal(node.getAttribute('role'), 'button');
  assert.equal(node.getAttribute('tabindex'), '0');
  node.dispatchEvent(new dom.window.KeyboardEvent('keydown', {key: 'Enter', bubbles: true}));
  assert.equal(window.__assetsMap.getState().selectedId, node.dataset.node);
  const transform = $('#graph-2d .viewport').getAttribute('transform');
  click('#zoom-in');
  assert.notEqual($('#graph-2d .viewport').getAttribute('transform'), transform);
  click('#fit-map');
  assert.equal($('#graph-2d .viewport').getAttribute('transform'), transform);
});

test('methodology controls explain the limits of the sample', () => {
  click('#about-button');
  assert.equal($('#info-dialog').open, true);
  assert.match($('#dialog-content').textContent, /not a complete ownership database/);
  click('#dialog-done');
  assert.equal($('#info-dialog').open, false);
});

test('unloaded entity is explicitly incomplete', () => {
  window.__assetsMap.exploreRoot('spacex');
  assert.equal(document.querySelectorAll('.graph-node').length, 1);
  assert.match($('#detail-panel').textContent, /Missing data does not mean no relationship/);
  assert.equal($('#empty-state').hidden, false);
});
