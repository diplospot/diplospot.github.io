const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function createInfoPanelSandbox(buildInfo, swRegistration) {
  const infoPanelJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'info-panel.js'), 'utf8');

  const modalClasses = new Set(['hidden']);
  const handlers = {
    document: {},
    swMessage: null,
    button: null,
    close: null,
    backdrop: null,
    refresh: null,
  };
  let reloadCount = 0;

  const repoLink = { href: '#', textContent: '' };
  const builtAtEl = { textContent: '' };
  const commitLink = { href: '#', textContent: '' };
  const statusEl = { textContent: '' };
  const serverBuildEl = { textContent: '' };
  const backdropMock = {
    addEventListener: (evt, fn) => {
      if (evt === 'click') handlers.backdrop = fn;
    },
  };

  const buttonMock = {
    addEventListener: (evt, fn) => {
      if (evt === 'click') handlers.button = fn;
    },
  };
  const closeMock = {
    addEventListener: (evt, fn) => {
      if (evt === 'click') handlers.close = fn;
    },
  };
  const refreshMock = {
    addEventListener: (evt, fn) => {
      if (evt === 'click') handlers.refresh = fn;
    },
  };

  const modalMock = {
    classList: {
      add: (c) => modalClasses.add(c),
      remove: (c) => modalClasses.delete(c),
      contains: (c) => modalClasses.has(c),
    },
    querySelector: (sel) => (sel === '.info-modal-backdrop' ? backdropMock : null),
  };

  const elements = {
    'info-button': buttonMock,
    'info-modal': modalMock,
    'info-modal-close': closeMock,
    'info-force-refresh': refreshMock,
    'info-repo-link': repoLink,
    'info-built-at': builtAtEl,
    'info-commit-link': commitLink,
    'info-update-status': statusEl,
    'info-server-build': serverBuildEl,
  };

  const sandbox = {
    swRegistration,
    navigator: {
      serviceWorker: {
        addEventListener: (evt, fn) => {
          if (evt === 'message') handlers.swMessage = fn;
        },
      },
    },
    document: {
      getElementById: (id) => elements[id] || null,
      addEventListener: (evt, fn) => {
        handlers.document[evt] = fn;
      },
    },
    window: {
      location: {
        reload: () => {
          reloadCount++;
        },
      },
      BUILD_INFO: buildInfo,
    },
    Date: Date,
    JSON: JSON,
    isNaN: isNaN,
  };

  vm.createContext(sandbox);
  vm.runInContext(infoPanelJs, sandbox);
  handlers.document.DOMContentLoaded();

  return {
    handlers,
    modalClasses,
    repoLink,
    builtAtEl,
    commitLink,
    statusEl,
    serverBuildEl,
    getReloadCount: () => reloadCount,
  };
}

test('opening the info modal populates repo link, build time, commit link, and update status', () => {
  const buildInfo = {
    commit: 'abcdef1234567890abcdef1234567890abcdef12',
    repoUrl: 'https://github.com/diplospot/diplospot.github.io',
    builtAt: '2026-01-02T03:04:05.000Z',
  };
  const { handlers, modalClasses, repoLink, builtAtEl, commitLink, statusEl } =
    createInfoPanelSandbox(buildInfo, { waiting: null, update: () => {} });

  assert.ok(handlers.button, 'info-button click handler should be registered');
  handlers.button();

  assert.equal(modalClasses.has('hidden'), false, 'modal should be visible after opening');
  assert.equal(repoLink.href, buildInfo.repoUrl);
  assert.equal(repoLink.textContent, buildInfo.repoUrl);
  assert.equal(commitLink.href, buildInfo.repoUrl + '/commit/' + buildInfo.commit);
  assert.equal(commitLink.textContent, buildInfo.commit.substring(0, 7));
  assert.ok(builtAtEl.textContent.length > 0, 'built-at should be populated');
  assert.equal(statusEl.textContent, 'Up to date');
});

test('shows "Update available" when the registration has a waiting worker', () => {
  const { handlers, statusEl } = createInfoPanelSandbox(
    { commit: 'abc1234', repoUrl: 'https://github.com/x/y', builtAt: '2026-01-01T00:00:00.000Z' },
    { waiting: {}, update: () => {} }
  );

  handlers.button();
  assert.equal(statusEl.textContent, 'Update available');
});

test('shows "Unavailable" when there is no service worker registration', () => {
  const { handlers, statusEl } = createInfoPanelSandbox(
    { commit: 'abc1234', repoUrl: 'https://github.com/x/y', builtAt: '2026-01-01T00:00:00.000Z' },
    null
  );

  handlers.button();
  assert.equal(statusEl.textContent, 'Unavailable');
});

test('opening the modal requests a live server build check from the active worker', () => {
  const activeMessages = [];
  const { handlers, serverBuildEl } = createInfoPanelSandbox(
    { commit: 'abc1234', repoUrl: 'https://github.com/x/y', builtAt: '2026-01-01T00:00:00.000Z' },
    { waiting: null, active: { postMessage: (msg) => activeMessages.push(msg) }, update: () => {} }
  );

  handlers.button();
  assert.equal(activeMessages.length, 1);
  assert.equal(activeMessages[0].type, 'CHECK_UPDATE');
  assert.equal(serverBuildEl.textContent, 'Checking…');
});

test('close button and backdrop click both dismiss the modal', () => {
  const buildInfo = {
    commit: 'abc1234',
    repoUrl: 'https://github.com/x/y',
    builtAt: '2026-01-01T00:00:00.000Z',
  };

  const closeCase = createInfoPanelSandbox(buildInfo, null);
  closeCase.handlers.button();
  closeCase.handlers.close();
  assert.ok(closeCase.modalClasses.has('hidden'), 'close button should hide the modal');

  const backdropCase = createInfoPanelSandbox(buildInfo, null);
  backdropCase.handlers.button();
  backdropCase.handlers.backdrop();
  assert.ok(backdropCase.modalClasses.has('hidden'), 'backdrop click should hide the modal');
});

test('Escape key dismisses the modal only while it is open', () => {
  const buildInfo = {
    commit: 'abc1234',
    repoUrl: 'https://github.com/x/y',
    builtAt: '2026-01-01T00:00:00.000Z',
  };
  const { handlers, modalClasses } = createInfoPanelSandbox(buildInfo, null);

  handlers.document.keydown({ key: 'Escape' });
  assert.ok(modalClasses.has('hidden'), 'Escape should be a no-op while already hidden');

  handlers.button();
  assert.equal(modalClasses.has('hidden'), false);
  handlers.document.keydown({ key: 'Escape' });
  assert.ok(modalClasses.has('hidden'), 'Escape should close the open modal');
});

test('Force Refresh sends SKIP_WAITING when a waiting worker exists, without reloading directly', () => {
  const waitingMessages = [];
  const buildInfo = {
    commit: 'abc1234',
    repoUrl: 'https://github.com/x/y',
    builtAt: '2026-01-01T00:00:00.000Z',
  };
  const { handlers, getReloadCount } = createInfoPanelSandbox(buildInfo, {
    waiting: { postMessage: (msg) => waitingMessages.push(msg) },
    update: () => {},
  });

  handlers.refresh();
  assert.equal(waitingMessages.length, 1);
  assert.equal(waitingMessages[0].type, 'SKIP_WAITING');
  assert.equal(getReloadCount(), 0, 'should not reload immediately; controllerchange handles it');
});

test('Force Refresh with no waiting worker requests a check and reloads only once UPDATE_READY arrives', () => {
  const activeMessages = [];
  const buildInfo = {
    commit: 'abc1234',
    repoUrl: 'https://github.com/x/y',
    builtAt: '2026-01-01T00:00:00.000Z',
  };
  const { handlers, getReloadCount } = createInfoPanelSandbox(buildInfo, {
    waiting: null,
    active: { postMessage: (msg) => activeMessages.push(msg) },
    update: () => {},
  });

  handlers.refresh();
  assert.equal(activeMessages.length, 1);
  assert.equal(activeMessages[0].type, 'CHECK_UPDATE');
  assert.equal(getReloadCount(), 0, 'should not reload before the refresh actually completes');

  handlers.swMessage({
    data: {
      type: 'UPDATE_READY',
      buildInfo: { commit: 'def4567', builtAt: '2026-01-02T00:00:00.000Z' },
    },
  });
  assert.equal(
    getReloadCount(),
    1,
    'should reload once UPDATE_READY confirms the refresh finished'
  );
});

test('Force Refresh with no registration at all reloads immediately', () => {
  const buildInfo = {
    commit: 'abc1234',
    repoUrl: 'https://github.com/x/y',
    builtAt: '2026-01-01T00:00:00.000Z',
  };
  const { handlers, getReloadCount } = createInfoPanelSandbox(buildInfo, null);

  handlers.refresh();
  assert.equal(getReloadCount(), 1);
});

test('BUILD_STATUS and UPDATE_READY messages update the server build display', () => {
  const buildInfo = {
    commit: 'abc1234',
    repoUrl: 'https://github.com/x/y',
    builtAt: '2026-01-01T00:00:00.000Z',
  };
  const { handlers, serverBuildEl } = createInfoPanelSandbox(buildInfo, null);

  handlers.swMessage({
    data: {
      type: 'BUILD_STATUS',
      remote: { commit: 'abc1234567', builtAt: '2026-01-01T00:00:00.000Z' },
    },
  });
  assert.ok(
    serverBuildEl.textContent.startsWith('abc1234'),
    'server build should reflect BUILD_STATUS commit'
  );

  handlers.swMessage({
    data: {
      type: 'UPDATE_READY',
      buildInfo: { commit: 'def4567890', builtAt: '2026-01-02T00:00:00.000Z' },
    },
  });
  assert.ok(
    serverBuildEl.textContent.startsWith('def4567'),
    'server build should reflect UPDATE_READY commit'
  );
});

test('View Logs is a real link that opens in a new tab, not a JS modal', () => {
  const content = fs.readFileSync(path.join(__dirname, '..', 'dist', 'index.html'), 'utf8');
  assert.ok(
    /<a[^>]*href="\.\/logs"[^>]*target="_blank"/.test(content),
    'View Logs should link to ./logs in a new tab'
  );
  assert.strictEqual(
    content.includes('id="logs-modal"'),
    false,
    'logs modal markup should no longer exist'
  );
});
