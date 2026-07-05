const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('ci.yml has least-privilege permissions', () => {
  const ciPath = path.join(__dirname, '..', '.github', 'workflows', 'ci.yml');
  assert.ok(fs.existsSync(ciPath), 'ci.yml should exist');

  const content = fs.readFileSync(ciPath, 'utf8');
  assert.ok(content.includes('permissions:'), 'ci.yml should have a permissions block');
  assert.ok(content.includes('contents: read'), 'ci.yml should have contents: read permission');
});
