const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// src/ofm_codes.js is a plain browser <script>, not a CommonJS module,
// so evaluate it in a sandbox to get at lookupPlate().
const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'ofm_codes.js'), 'utf8');
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(source, sandbox);

test('looks up a known 2-letter code', () => {
  const result = sandbox.lookupPlate('CY');
  assert.equal(result.country, 'China');
  assert.equal(result.prefix, null);
});

test('parses a plate-type prefix followed by the country code', () => {
  const result = sandbox.lookupPlate('DCY');
  assert.equal(result.prefix, 'Diplomat');
  assert.equal(result.code, 'CY');
  assert.equal(result.country, 'China');
});

test('is case-insensitive and strips non-letter characters', () => {
  const result = sandbox.lookupPlate('c-y');
  assert.equal(result.country, 'China');
});

test('returns null for an unrecognized code', () => {
  assert.equal(sandbox.lookupPlate('ZZ'), null);
});

test('returns null for fewer than 2 letters', () => {
  assert.equal(sandbox.lookupPlate('A'), null);
});

test('handles 3 letters correctly when first is a special prefix', () => {
  const result = sandbox.lookupPlate('DCY');
  assert.equal(result.prefix, 'Diplomat');
  assert.equal(result.country, 'China');
});

test('handles 3 letters correctly when first is NOT a special prefix (it should only take first 2)', () => {
  // If user somehow enters 3 letters not starting with C, D, S
  // lookupPlate takes first 2.
  const result = sandbox.lookupPlate('XZA');
  assert.equal(result.prefix, null);
  assert.equal(result.code, 'XZ');
  assert.equal(result.country, 'Australia');
});
