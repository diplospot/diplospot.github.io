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

  const typeHTML = elements['result-type'].innerHTML;
  assert.ok(typeHTML.includes('https://github.com/nparashuram/diplospot/issues/new'), 'Should contain GitHub new issue URL');
  assert.ok(typeHTML.includes('NOT RECOGNIZED'), 'Should contain link text');

  const expectedTitle = encodeURIComponent('[Unknown Plate] XX plate spotted');
  const expectedBodyPart = encodeURIComponent('Spotted a license plate with the code XX.');

  assert.ok(typeHTML.includes(expectedTitle), 'URL should include prefilled title with extracted code XX');
  assert.ok(typeHTML.includes(expectedBodyPart), 'URL should include prefilled body with extracted code XX');
  assert.strictEqual(elements['result-country'].textContent, '', 'result-country should be empty on failure');
});

function setupOnInputSandbox() {
  const appSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');

  let blurred = false;
  const inputEl = {
    value: '',
    maxLength: 3,
    blur: () => { blurred = true; },
    focus: () => {}
  };
  const elements = {
    'result-container': { className: '', classList: { add: () => {}, remove: () => {} } },
    'result-type': { innerHTML: '', textContent: '' },
    'result-country': { innerHTML: '', textContent: '' },
    'plate-input': inputEl
  };

  const appSandbox = {
    document: {
      getElementById: (id) => elements[id],
      addEventListener: () => {}
    }
  };
  vm.createContext(appSandbox);
  vm.runInContext(source, appSandbox);
  vm.runInContext(appSource, appSandbox);

  return {
    setValue: (value) => { inputEl.value = value; appSandbox.onInput(); },
    wasBlurred: () => blurred
  };
}

test('loses focus after typing 2 letters when the first letter is not C, D, or S', () => {
  const { setValue, wasBlurred } = setupOnInputSandbox();

  setValue('X');
  assert.equal(wasBlurred(), false, 'should not blur after 1 letter');

  setValue('XZ');
  assert.equal(wasBlurred(), true, 'should blur after 2 letters');
});

test('loses focus after typing 3 letters when the first letter is C, D, or S', () => {
  const { setValue, wasBlurred } = setupOnInputSandbox();

  setValue('D');
  assert.equal(wasBlurred(), false, 'should not blur after 1 letter');

  setValue('DC');
  assert.equal(wasBlurred(), false, 'should not blur after 2 letters when first letter is a plate prefix');

  setValue('DCY');
  assert.equal(wasBlurred(), true, 'should blur after 3 letters');
});

test('focusing the plate input hides the map link and selects all text, blurring restores the link', () => {
  const appSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'app.js'), 'utf8');

  let focusHandler, blurHandler;
  let selectCallCount = 0;
  const mapLinkClasses = new Set();
  const inputEl = {
    value: '',
    maxLength: 3,
    blur: () => {},
    select: () => { selectCallCount++; },
    focus: () => { if (focusHandler) focusHandler(); },
    addEventListener: (evt, handler) => {
      if (evt === 'focus') focusHandler = handler;
      if (evt === 'blur') blurHandler = handler;
    }
  };
  const mapLinkEl = {
    classList: {
      add: (c) => mapLinkClasses.add(c),
      remove: (c) => mapLinkClasses.delete(c)
    }
  };
  const elements = { 'plate-input': inputEl, 'map-link': mapLinkEl };

  let domReadyHandler;
  const appSandbox = {
    document: {
      getElementById: (id) => elements[id],
      addEventListener: (evt, handler) => { if (evt === 'DOMContentLoaded') domReadyHandler = handler; }
    }
  };
  vm.createContext(appSandbox);
  vm.runInContext(source, appSandbox);
  vm.runInContext(appSource, appSandbox);
  domReadyHandler();

  assert.ok(mapLinkClasses.has('hidden'), 'map link should be hidden once the input auto-focuses on load');
  assert.equal(selectCallCount, 1, 'input text should be selected when the input is focused');

  blurHandler();
  assert.ok(!mapLinkClasses.has('hidden'), 'map link should be visible once the input blurs');

  focusHandler();
  assert.ok(mapLinkClasses.has('hidden'), 'map link should hide again when the input is focused');
});
