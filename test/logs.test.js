const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('dist/logs.html and dist/logs/index.html exist and are minified', () => {
  const logsHtmlPath = path.join(__dirname, '../dist/logs.html');
  const logsDirIndexPath = path.join(__dirname, '../dist/logs/index.html');
  assert.ok(fs.existsSync(logsHtmlPath), 'dist/logs.html should exist');
  assert.ok(fs.existsSync(logsDirIndexPath), 'dist/logs/index.html should exist');

  const content = fs.readFileSync(logsHtmlPath, 'utf8');
  assert.ok(
    content.includes('id="logs-content'),
    'logs.html should contain the log output element'
  );
  assert.strictEqual(/\n\s\s+/.test(content), false, 'logs.html should not have indentation');
});

function createLocalStorageMock(seed) {
  const store = Object.assign({}, seed);
  return {
    getItem: (key) => (key in store ? store[key] : null),
    setItem: (key, val) => {
      store[key] = val;
    },
    removeItem: (key) => {
      delete store[key];
    },
    store,
  };
}

function createSwLogsSandbox(localStorageSeed) {
  const swLogsJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'sw-logs.js'), 'utf8');

  let messageHandler = null;
  const localStorage = createLocalStorageMock(localStorageSeed);

  const sandbox = {
    localStorage,
    JSON: JSON,
    navigator: {
      serviceWorker: {
        addEventListener: (evt, fn) => {
          if (evt === 'message') messageHandler = fn;
        },
      },
    },
  };

  vm.createContext(sandbox);
  vm.runInContext(swLogsJs, sandbox);

  return { sandbox, localStorage, sendMessage: (data) => messageHandler({ data }) };
}

test('sw-logs.js appends and persists SW_LOG messages, and notifies onSwLog', () => {
  const { sandbox, localStorage, sendMessage } = createSwLogsSandbox();

  let notified = null;
  sandbox.onSwLog = (logs) => {
    notified = logs;
  };

  sendMessage({ type: 'SW_LOG', time: '2026-01-01T00:00:00.000Z', message: 'install: complete' });

  assert.equal(sandbox.swLogs.length, 1);
  assert.equal(sandbox.swLogs[0].message, 'install: complete');
  assert.ok(notified, 'onSwLog should be called');
  assert.equal(notified.length, 1);

  const stored = JSON.parse(localStorage.store['diplospot-sw-logs']);
  assert.equal(stored.length, 1);
  assert.equal(stored[0].message, 'install: complete');
});

test('sw-logs.js ignores non-SW_LOG messages', () => {
  const { sandbox, sendMessage } = createSwLogsSandbox();
  sendMessage({ type: 'UPDATE_READY' });
  assert.equal(sandbox.swLogs.length, 0);
});

test('logs.js renders stored logs and wires Refresh / Clear buttons', () => {
  const swLogsJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'sw-logs.js'), 'utf8');
  const logsJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'logs.js'), 'utf8');

  const contentEl = { textContent: '', scrollTop: 0, scrollHeight: 42 };
  const handlers = { document: {}, refresh: null, clear: null };
  const refreshMock = {
    addEventListener: (evt, fn) => {
      if (evt === 'click') handlers.refresh = fn;
    },
  };
  const clearMock = {
    addEventListener: (evt, fn) => {
      if (evt === 'click') handlers.clear = fn;
    },
  };

  const elements = {
    'logs-content': contentEl,
    'logs-refresh': refreshMock,
    'logs-clear': clearMock,
  };

  const localStorage = createLocalStorageMock({
    'diplospot-sw-logs': JSON.stringify([
      { time: '2026-01-01T00:00:00.000Z', message: 'install: complete' },
    ]),
  });

  const sandbox = {
    localStorage,
    JSON: JSON,
    navigator: { serviceWorker: { addEventListener: () => {} } },
    document: {
      getElementById: (id) => elements[id] || null,
      addEventListener: (evt, fn) => {
        handlers.document[evt] = fn;
      },
    },
  };

  vm.createContext(sandbox);
  vm.runInContext(swLogsJs + '\n' + logsJs, sandbox);
  handlers.document.DOMContentLoaded();

  assert.ok(
    contentEl.textContent.includes('install: complete'),
    'initial render should include the stored log'
  );

  localStorage.store['diplospot-sw-logs'] = JSON.stringify([
    { time: '2026-01-01T00:00:00.000Z', message: 'install: complete' },
    { time: '2026-01-01T00:00:01.000Z', message: 'activate: clients.claim()' },
  ]);
  handlers.refresh();
  assert.ok(
    contentEl.textContent.includes('activate: clients.claim()'),
    'Refresh should re-read localStorage'
  );

  handlers.clear();
  assert.equal(contentEl.textContent, 'No logs yet.', 'Clear should empty the log view');
  assert.equal(
    JSON.parse(localStorage.store['diplospot-sw-logs']).length,
    0,
    'Clear should persist an empty list'
  );
});
