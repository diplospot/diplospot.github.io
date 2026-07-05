const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('README.md exists and contains the GitHub Pages link', () => {
  const readmePath = path.join(__dirname, '..', 'README.md');
  assert.ok(fs.existsSync(readmePath), 'README.md should exist');

  const content = fs.readFileSync(readmePath, 'utf8');
  const expectedLink = 'https://nparashuram.github.io/diplospot/';
  assert.ok(content.includes(expectedLink), `README.md should contain the link: ${expectedLink}`);
});
