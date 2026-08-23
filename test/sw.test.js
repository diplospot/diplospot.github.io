const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

test('sw-register.js triggers reg.update immediately and on visibilitychange', (t) => {
  const vm = require('node:vm');
  const swRegisterJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'sw-register.js'), 'utf8');

  let updateCalledCount = 0;
  let loadHandler = null;
  let visibilityHandler = null;
  let intervalDelay = null;

  const mockReg = {
    waiting: null,
    update: () => {
      updateCalledCount++;
    },
    addEventListener: () => {},
  };

  const sandbox = {
    navigator: {
      serviceWorker: {
        register: async () => mockReg,
        addEventListener: () => {},
      },
    },
    window: {
      addEventListener: (evt, handler) => {
        if (evt === 'load') loadHandler = handler;
      },
    },
    document: {
      visibilityState: 'visible',
      addEventListener: (evt, handler) => {
        if (evt === 'visibilitychange') visibilityHandler = handler;
      },
      getElementById: () => null,
    },
    setInterval: (fn, delay) => {
      intervalDelay = delay;
    },
  };

  vm.createContext(sandbox);
  vm.runInContext(swRegisterJs, sandbox);

  assert.ok(loadHandler, 'load event listener should be added');
  loadHandler();

  // Wait for promise microtask resolution
  return Promise.resolve().then(() => {
    assert.strictEqual(
      updateCalledCount,
      1,
      'reg.update() should be called immediately on registration'
    );
    assert.ok(visibilityHandler, 'visibilitychange event listener should be added');

    // Simulate tab becoming visible
    sandbox.document.visibilityState = 'visible';
    visibilityHandler();
    assert.strictEqual(
      updateCalledCount,
      2,
      'reg.update() should be called when document becomes visible'
    );

    // Simulate tab becoming hidden
    sandbox.document.visibilityState = 'hidden';
    visibilityHandler();
    assert.strictEqual(
      updateCalledCount,
      2,
      'reg.update() should NOT be called when document becomes hidden'
    );
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
        },
      },
    },
    window: {
      addEventListener: (evt, handler) => {
        if (evt === 'load') loadHandler = handler;
      },
      location: {
        reload: () => {
          reloadCount++;
        },
      },
    },
    document: {
      visibilityState: 'visible',
      addEventListener: () => {},
      getElementById: () => null,
    },
    setInterval: () => {},
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

test('sw-register.js shows the update notification when it receives an UPDATE_READY message', () => {
  const vm = require('node:vm');
  const swRegisterJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'sw-register.js'), 'utf8');

  let loadHandler = null;
  let messageHandler = null;
  const notificationClasses = new Set(['hidden']);
  const notificationMock = {
    classList: {
      remove: (c) => notificationClasses.delete(c),
      add: (c) => notificationClasses.add(c),
    },
    querySelector: (sel) => (sel === '.refresh-button' ? { onclick: null } : null),
  };

  const sandbox = {
    navigator: {
      serviceWorker: {
        controller: {},
        register: async () => ({ waiting: null, update: () => {}, addEventListener: () => {} }),
        addEventListener: (evt, handler) => {
          if (evt === 'message') messageHandler = handler;
        },
      },
    },
    window: {
      addEventListener: (evt, handler) => {
        if (evt === 'load') loadHandler = handler;
      },
      location: { reload: () => {} },
    },
    document: {
      visibilityState: 'visible',
      addEventListener: () => {},
      getElementById: (id) => (id === 'update-notification' ? notificationMock : null),
    },
    setInterval: () => {},
  };

  vm.createContext(sandbox);
  vm.runInContext(swRegisterJs, sandbox);

  loadHandler();

  return Promise.resolve().then(() => {
    assert.ok(messageHandler, 'message listener should be added');
    assert.ok(
      notificationClasses.has('hidden'),
      'notification should be hidden before an update is ready'
    );

    messageHandler({ data: { type: 'UPDATE_READY' } });
    assert.strictEqual(
      notificationClasses.has('hidden'),
      false,
      'notification should be shown after UPDATE_READY'
    );
  });
});

test('built map.html should NOT contain service worker registration or update notification', (t) => {
  const distMap = path.join(__dirname, '..', 'dist', 'map.html');
  assert.ok(fs.existsSync(distMap), 'dist/map.html should exist');

  const content = fs.readFileSync(distMap, 'utf8');
  assert.strictEqual(
    content.includes('navigator.serviceWorker.register'),
    false,
    'map.html should not contain service worker registration'
  );
  assert.strictEqual(
    content.includes('id="update-notification"'),
    false,
    'map.html should not contain update notification UI'
  );
});

test('built sw.js should have cache-first strategy and version v4', (t) => {
  const distSw = path.join(__dirname, '..', 'dist', 'sw.js');
  assert.ok(fs.existsSync(distSw), 'dist/sw.js should exist');

  const content = fs.readFileSync(distSw, 'utf8');

  assert.ok(
    content.includes('CACHE_NAME="diplospot-v4"') ||
      content.includes("CACHE_NAME = 'diplospot-v4'"),
    'Should have updated cache version'
  );
  assert.ok(content.includes('caches.match'), 'Should use caches.match');
  assert.ok(
    content.includes('response') || /\|\|fetch\(/.test(content),
    'Should check for cached response'
  );
  assert.ok(content.includes('buildinfo.js'), 'buildinfo.js should be in ASSETS');
  assert.ok(content.includes('checkForUpdate'), 'Should contain checkForUpdate function');
  assert.ok(content.includes('refreshAllAssets'), 'Should contain refreshAllAssets function');
  assert.ok(content.includes('UPDATE_READY'), 'Should contain UPDATE_READY message type');
  assert.ok(content.includes('CHECK_UPDATE'), 'Should contain CHECK_UPDATE message type');

  // Verify that inlined scripts are NOT in ASSETS
  assert.strictEqual(content.includes('app.js'), false, 'app.js should not be in ASSETS');
  assert.strictEqual(
    content.includes('ofm_codes.js'),
    false,
    'ofm_codes.js should not be in ASSETS'
  );
  assert.strictEqual(
    content.includes('sw-register.js'),
    false,
    'sw-register.js should not be in ASSETS'
  );
});

test('build should generate buildinfo.js with commit, repoUrl, and builtAt', (t) => {
  const distBuildInfo = path.join(__dirname, '..', 'dist', 'buildinfo.js');
  assert.ok(fs.existsSync(distBuildInfo), 'dist/buildinfo.js should exist');

  const content = fs.readFileSync(distBuildInfo, 'utf8');
  assert.ok(content.includes('self.BUILD_INFO'), 'Should assign self.BUILD_INFO');

  const match = content.match(/self\.BUILD_INFO\s*=\s*(\{.*\});/);
  assert.ok(match, 'Should contain a JSON object assigned to self.BUILD_INFO');

  const info = JSON.parse(match[1]);
  assert.ok('commit' in info, 'buildinfo.js should include commit');
  assert.ok('repoUrl' in info, 'buildinfo.js should include repoUrl');
  assert.ok('builtAt' in info, 'buildinfo.js should include builtAt');
});
