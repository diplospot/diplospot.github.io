const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

test('dist/index.html is minified', () => {
  const content = fs.readFileSync(path.join(__dirname, '../dist/index.html'), 'utf8');
  // Check for lack of indentation (multiple spaces or tabs at start of line)
  assert.strictEqual(/\n\s\s+/.test(content), false, 'index.html should not have multiple spaces for indentation');
  assert.strictEqual(content.includes('\n\n'), false, 'index.html should not have double newlines');
});

test('dist/sw.js is minified', () => {
  const content = fs.readFileSync(path.join(__dirname, '../dist/sw.js'), 'utf8');
  // Check for lack of multiple spaces and newlines
  assert.strictEqual(content.includes('  '), false, 'sw.js should not have double spaces');
  assert.strictEqual(content.includes('\n'), false, 'sw.js should be a single line');
});

test('favicon.ico exists in src and dist', () => {
  const srcIcoExists = fs.existsSync(path.join(__dirname, '../src/favicon.ico'));
  const distIcoExists = fs.existsSync(path.join(__dirname, '../dist/favicon.ico'));
  assert.strictEqual(srcIcoExists, true, 'src/favicon.ico should exist');
  assert.strictEqual(distIcoExists, true, 'dist/favicon.ico should exist');
});
