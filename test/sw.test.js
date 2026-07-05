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
});

test('built sw.js should have cache-first strategy and version v2', (t) => {
  const distSw = path.join(__dirname, '..', 'dist', 'sw.js');
  assert.ok(fs.existsSync(distSw), 'dist/sw.js should exist');

  const content = fs.readFileSync(distSw, 'utf8');

  assert.ok(content.includes('CACHE_NAME="diplospot-v2"') || content.includes("CACHE_NAME = 'diplospot-v2'"), 'Should have updated cache version');
  assert.ok(content.includes('caches.match'), 'Should use caches.match');
  assert.ok(content.includes('response') || content.includes('e||fetch'), 'Should check for cached response');

  // Verify that inlined scripts are NOT in ASSETS
  assert.strictEqual(content.includes('app.js'), false, 'app.js should not be in ASSETS');
  assert.strictEqual(content.includes('ofm_codes.js'), false, 'ofm_codes.js should not be in ASSETS');
  assert.strictEqual(content.includes('sw-register.js'), false, 'sw-register.js should not be in ASSETS');
});
