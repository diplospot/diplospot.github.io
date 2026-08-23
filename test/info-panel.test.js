const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function createInfoPanelSandbox(buildInfo, swRegistration) {
  const infoPanelJs = fs.readFileSync(path.join(__dirname, '..', 'src', 'info-panel.js'), 'utf8');

  const modalClasses = new Set(['hidden']);
  const handlers = { document: {}, button: null, close: null, backdrop: null, refresh: null };
  let reloadCount = 0;

  const buildInfoEl = { textContent: buildInfo === undefined ? '"__BUILD_INFO__"' : JSON.stringify(buildInfo) };
  const repoLink = { href: '#', textContent: '' };
  const builtAtEl = { textContent: '' };
  const commitLink = { href: '#', textContent: '' };
  const statusEl = { textContent: '' };
  const backdropMock = { addEventListener: (evt, fn) => { if (evt === 'click') handlers.backdrop = fn; } };

  const buttonMock = { addEventListener: (evt, fn) => { if (evt === 'click') handlers.button = fn; } };
  const closeMock = { addEventListener: (evt, fn) => { if (evt === 'click') handlers.close = fn; } };
  const refreshMock = { addEventListener: (evt, fn) => { if (evt === 'click') handlers.refresh = fn; } };
  const modalMock = {
    classList: {
      add: (c) => modalClasses.add(c),
      remove: (c) => modalClasses.delete(c),
      contains: (c) => modalClasses.has(c)
    },
    querySelector: (sel) => sel === '.info-modal-backdrop' ? backdropMock : null
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
    'build-info': buildInfoEl
  };

  const sandbox = {
    swRegistration,
    document: {
      getElementById: (id) => elements[id] || null,
      addEventListener: (evt, fn) => { handlers.document[evt] = fn; }
    },
    window: { location: { reload: () => { reloadCount++; } } },
    Date: Date,
    JSON: JSON,
    isNaN: isNaN
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
    getReloadCount: () => reloadCount
  };
}

test('opening the info modal populates repo link, build time, commit link, and update status', () => {
  const buildInfo = {
    commit: 'abcdef1234567890abcdef1234567890abcdef12',
    repoUrl: 'https://github.com/diplospot/diplospot.github.io',
    builtAt: '2026-01-02T03:04:05.000Z'
  };
  const { handlers, modalClasses, repoLink, builtAtEl, commitLink, statusEl } = createInfoPanelSandbox(buildInfo, { waiting: null, update: () => {} });

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

test('close button and backdrop click both dismiss the modal', () => {
  const buildInfo = { commit: 'abc1234', repoUrl: 'https://github.com/x/y', builtAt: '2026-01-01T00:00:00.000Z' };

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
  const buildInfo = { commit: 'abc1234', repoUrl: 'https://github.com/x/y', builtAt: '2026-01-01T00:00:00.000Z' };
  const { handlers, modalClasses } = createInfoPanelSandbox(buildInfo, null);

  handlers.document.keydown({ key: 'Escape' });
  assert.ok(modalClasses.has('hidden'), 'Escape should be a no-op while already hidden');

  handlers.button();
  assert.equal(modalClasses.has('hidden'), false);
  handlers.document.keydown({ key: 'Escape' });
  assert.ok(modalClasses.has('hidden'), 'Escape should close the open modal');
});

test('Force Refresh reloads the page', () => {
  const buildInfo = { commit: 'abc1234', repoUrl: 'https://github.com/x/y', builtAt: '2026-01-01T00:00:00.000Z' };
  const { handlers, getReloadCount } = createInfoPanelSandbox(buildInfo, null);

  handlers.refresh();
  assert.equal(getReloadCount(), 1);
});
