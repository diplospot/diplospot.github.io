const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

test('built index.html should contain service worker registration and notification UI', (t) => {
  const distIndex = path.join(__dirname, '..', 'dist', 'index.html');
  assert.ok(fs.existsSync(distIndex), 'dist/index.html should exist');

  const content = fs.readFileSync(distIndex, 'utf8');

  // Check for update notification div
  assert.ok(content.includes('id="update-notification"'), 'Should contain update-notification div');
  assert.ok(content.includes('class="refresh-button"'), 'Should contain refresh button');

  // Check for service worker registration logic
  assert.ok(content.includes('navigator.serviceWorker.register'), 'Should contain service worker registration');
  assert.ok(content.includes('showUpdateNotification'), 'Should contain showUpdateNotification function');
  assert.ok(content.includes('SKIP_WAITING'), 'Should contain SKIP_WAITING message logic');
  assert.ok(content.includes('visibilitychange'), 'Should contain visibilitychange listener for update check');
});

test('sw-register.js triggers reg.update immediately and on visibilitychange', (t) => {
  const vm = require('node:vm');
  const swRegisterJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'sw-register.js'), 'utf8');

  let updateCalledCount = 0;
  let loadHandler = null;
  let visibilityHandler = null;
  let intervalDelay = null;

  const mockReg = {
    waiting: null,
    update: () => { updateCalledCount++; },
    addEventListener: () => {}
  };

  const sandbox = {
    navigator: {
      serviceWorker: {
        register: async () => mockReg,
        addEventListener: () => {}
      }
    },
    window: {
      addEventListener: (evt, handler) => {
        if (evt === 'load') loadHandler = handler;
      }
    },
    document: {
      visibilityState: 'visible',
      addEventListener: (evt, handler) => {
        if (evt === 'visibilitychange') visibilityHandler = handler;
      },
      getElementById: () => null
    },
    setInterval: (fn, delay) => { intervalDelay = delay; }
  };

  vm.createContext(sandbox);
  vm.runInContext(swRegisterJs, sandbox);

  assert.ok(loadHandler, 'load event listener should be added');
  loadHandler();

  // Wait for promise microtask resolution
  return Promise.resolve().then(() => {
    assert.strictEqual(updateCalledCount, 1, 'reg.update() should be called immediately on registration');
    assert.ok(visibilityHandler, 'visibilitychange event listener should be added');

    // Simulate tab becoming visible
    sandbox.document.visibilityState = 'visible';
    visibilityHandler();
    assert.strictEqual(updateCalledCount, 2, 'reg.update() should be called when document becomes visible');

    // Simulate tab becoming hidden
    sandbox.document.visibilityState = 'hidden';
    visibilityHandler();
    assert.strictEqual(updateCalledCount, 2, 'reg.update() should NOT be called when document becomes hidden');
    assert.ok(intervalDelay > 0, 'should also schedule a periodic update check');
  });
});

test('sw-register.js does not reload on the initial controller claim, only on a real replacement', () => {
  const vm = require('node:vm');
  const swRegisterJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'sw-register.js'), 'utf8');

  let loadHandler = null;
  let controllerChangeHandler = null;
  let reloadCount = 0;

  const sandbox = {
    navigator: {
      serviceWorker: {
        controller: null,
        register: async () => ({ waiting: null, update: () => {}, addEventListener: () => {} }),
        addEventListener: (evt, handler) => {
          if (evt === 'controllerchange') controllerChangeHandler = handler;
        }
      }
    },
    window: {
      addEventListener: (evt, handler) => {
        if (evt === 'load') loadHandler = handler;
      },
      location: { reload: () => { reloadCount++; } }
    },
    document: {
      visibilityState: 'visible',
      addEventListener: () => {},
      getElementById: () => null
    },
    setInterval: () => {}
  };

  vm.createContext(sandbox);
  vm.runInContext(swRegisterJs, sandbox);

  loadHandler();
  assert.ok(controllerChangeHandler, 'controllerchange listener should be added');

  controllerChangeHandler();
  assert.strictEqual(reloadCount, 0, 'should not reload on the first-ever controller claim');

  controllerChangeHandler();
  assert.strictEqual(reloadCount, 1, 'should reload when a controller is genuinely replaced');

  controllerChangeHandler();
  assert.strictEqual(reloadCount, 1, 'should not reload a second time once already refreshing');
});

test('built map.html should NOT contain service worker registration or update notification', (t) => {
  const distMap = path.join(__dirname, '..', 'dist', 'map.html');
  assert.ok(fs.existsSync(distMap), 'dist/map.html should exist');

  const content = fs.readFileSync(distMap, 'utf8');
  assert.strictEqual(content.includes('navigator.serviceWorker.register'), false, 'map.html should not contain service worker registration');
  assert.strictEqual(content.includes('id="update-notification"'), false, 'map.html should not contain update notification UI');
});

test('built sw.js should have cache-first strategy and version v3', (t) => {
  const distSw = path.join(__dirname, '..', 'dist', 'sw.js');
  assert.ok(fs.existsSync(distSw), 'dist/sw.js should exist');

  const content = fs.readFileSync(distSw, 'utf8');

  assert.ok(content.includes('CACHE_NAME="diplospot-v3"') || content.includes("CACHE_NAME = 'diplospot-v3'"), 'Should have updated cache version');
  assert.ok(content.includes('caches.match'), 'Should use caches.match');
  assert.ok(content.includes('response') || /\|\|fetch\(/.test(content), 'Should check for cached response');

  // Verify that inlined scripts are NOT in ASSETS
  assert.strictEqual(content.includes('app.js'), false, 'app.js should not be in ASSETS');
  assert.strictEqual(content.includes('ofm_codes.js'), false, 'ofm_codes.js should not be in ASSETS');
  assert.strictEqual(content.includes('sw-register.js'), false, 'sw-register.js should not be in ASSETS');
});
