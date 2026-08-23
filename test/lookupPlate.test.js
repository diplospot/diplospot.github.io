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

test('looks up a spotted code (GK)', () => {
  const result = sandbox.lookupPlate('GK');
  assert.equal(result.country, 'Unknown');
  assert.equal(result.source, 'Spotted');
});

test('parses a plate-type prefix followed by a spotted country code (DGK)', () => {
  const result = sandbox.lookupPlate('DGK');
  assert.equal(result.prefix, 'Diplomat');
  assert.equal(result.code, 'GK');
  assert.equal(result.country, 'Unknown');
  assert.equal(result.source, 'Spotted');
});

test('no overlap between OFM_CODES and SPOTTED_CODES', () => {
  const ofmCodes = Object.keys(sandbox.OFM_CODES);
  const spottedCodes = Object.keys(sandbox.SPOTTED_CODES);
  for (const code of spottedCodes) {
    assert.ok(!ofmCodes.includes(code), `Code ${code} should not be in both OFM_CODES and SPOTTED_CODES`);
  }
});

test('getCountryCode extracts 2-letter country code from various plate formats', () => {
  assert.equal(sandbox.getCountryCode('XX'), 'XX');
  assert.equal(sandbox.getCountryCode('DXX'), 'XX');
  assert.equal(sandbox.getCountryCode('SXX'), 'XX');
  assert.equal(sandbox.getCountryCode('CXX'), 'XX');
  assert.equal(sandbox.getCountryCode('ABC'), 'AB');
  assert.equal(sandbox.getCountryCode('X'), null);
});

test('unrecognized plate generates prefilled GitHub issue URL parameters', () => {
  const appSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');

  // Set up mock DOM
  const elements = {
    'result-container': { className: '', classList: { add: () => {}, remove: () => {} } },
    'result-type': { innerHTML: '', textContent: '' },
    'result-country': { innerHTML: '', textContent: '' },
    'plate-input': { value: 'DXX' }
  };

  const appSandbox = {
    document: {
      getElementById: (id) => elements[id],
      addEventListener: () => {}
    },
    getCountryCode: sandbox.getCountryCode,
    lookupPlate: sandbox.lookupPlate,
    trySaveLocation: () => {}
  };

  vm.createContext(appSandbox);
  vm.runInContext(appSource, appSandbox);

  // Call showResult for unrecognized plate result
  appSandbox.showResult({ success: false, message: 'Code "DXX" not found' });

  const countryHTML = elements['result-country'].innerHTML;
  assert.ok(countryHTML.includes('https://github.com/nparashuram/diplospot/issues/new'), 'Should contain GitHub new issue URL');
  assert.ok(countryHTML.includes('File%20an%20issue') || countryHTML.includes('File an issue'), 'Should contain link text');

  const expectedTitle = encodeURIComponent('[Unknown Plate] XX plate spotted');
  const expectedBodyPart = encodeURIComponent('Spotted a license plate with the code XX.');

  assert.ok(countryHTML.includes(expectedTitle), 'URL should include prefilled title with extracted code XX');
  assert.ok(countryHTML.includes(expectedBodyPart), 'URL should include prefilled body with extracted code XX');
});
