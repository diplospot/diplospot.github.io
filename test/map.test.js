const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('index.html contains fixed relative Map link', () => {
  const content = fs.readFileSync(path.join(__dirname, '../dist/index.html'), 'utf8');
  assert.ok(content.includes('id="map-link"'), 'index.html should have map-link element');
  assert.ok(content.includes('href="./map"') || content.includes('href="map"'), 'map-link should point to relative map path');
  assert.ok(!content.includes('href="/map"'), 'map-link should not point to absolute /map path');
  assert.ok(content.includes('Map'), 'map-link should contain Map text');
  assert.ok(content.includes('position:fixed'), 'map-link CSS should be position:fixed');
});

test('dist/map.html and dist/map/index.html exist and are minified', () => {
  const mapHtmlPath = path.join(__dirname, '../dist/map.html');
  const mapDirIndexPath = path.join(__dirname, '../dist/map/index.html');
  assert.ok(fs.existsSync(mapHtmlPath), 'dist/map.html should exist');
  assert.ok(fs.existsSync(mapDirIndexPath), 'dist/map/index.html should exist');

  const content = fs.readFileSync(mapHtmlPath, 'utf8');
  assert.ok(content.includes('id="locations-table"'), 'map.html should contain locations table');
  assert.strictEqual(/\n\s\s+/.test(content), false, 'map.html should not have indentation');
});

test('trySaveLocation saves location when geolocation permission is granted', async () => {
  const appJsSource = fs.readFileSync(path.join(__dirname, '../src/app.js'), 'utf8');
  const ofmCodesSource = fs.readFileSync(path.join(__dirname, '../src/ofm_codes.js'), 'utf8');

  let savedStorage = null;
  const mockLocalStorage = {
    getItem: (key) => savedStorage,
    setItem: (key, val) => { savedStorage = val; }
  };

  let positionRequested = false;
  const mockGeolocation = {
    getCurrentPosition: (successCb) => {
      positionRequested = true;
      successCb({ coords: { latitude: 37.7749, longitude: -122.4194 } });
    }
  };

  const mockPermissions = {
    query: async (queryObj) => {
      if (queryObj.name === 'geolocation') {
        return { state: 'granted' };
      }
      return { state: 'denied' };
    }
  };

  const sandbox = {
    navigator: {
      geolocation: mockGeolocation,
      permissions: mockPermissions
    },
    localStorage: mockLocalStorage,
    Date: Date,
    JSON: JSON,
    document: {
      getElementById: () => null,
      addEventListener: () => {}
    }
  };

  vm.createContext(sandbox);
  vm.runInContext(ofmCodesSource + '\n' + appJsSource, sandbox);

  sandbox.trySaveLocation('France');

  await new Promise(resolve => setTimeout(resolve, 50));

  assert.ok(positionRequested, 'getCurrentPosition should have been called');
  assert.ok(savedStorage, 'localStorage should have been updated');
  const parsed = JSON.parse(savedStorage);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].country, 'France');
  assert.equal(parsed[0].latitude, 37.7749);
  assert.equal(parsed[0].longitude, -122.4194);
  assert.ok(parsed[0].timestamp);
});

test('trySaveLocation does nothing when geolocation permission is prompt or denied', async () => {
  const appJsSource = fs.readFileSync(path.join(__dirname, '../src/app.js'), 'utf8');

  let savedStorage = null;
  let positionRequested = false;

  const sandbox = {
    navigator: {
      geolocation: {
        getCurrentPosition: () => { positionRequested = true; }
      },
      permissions: {
        query: async () => ({ state: 'prompt' })
      }
    },
    localStorage: {
      getItem: () => savedStorage,
      setItem: (k, v) => { savedStorage = v; }
    },
    Date: Date,
    JSON: JSON,
    document: { getElementById: () => null, addEventListener: () => {} }
  };

  vm.createContext(sandbox);
  vm.runInContext(appJsSource, sandbox);

  sandbox.trySaveLocation('France');
  await new Promise(resolve => setTimeout(resolve, 50));

  assert.equal(positionRequested, false, 'getCurrentPosition should not be called when state is prompt');
  assert.equal(savedStorage, null, 'localStorage should not be updated');
});

test('map.js shows permission prompt and hides table when permission is prompt or denied', async () => {
  const mapJsSource = fs.readFileSync(path.join(__dirname, '../src/map.js'), 'utf8');

  let positionRequested = false;
  const promptClassList = new Set(['hidden']);
  const tableWrapperClassList = new Set();

  const promptMock = { classList: { add: (c) => promptClassList.add(c), remove: (c) => promptClassList.delete(c) } };
  const tableWrapperMock = { classList: { add: (c) => tableWrapperClassList.add(c), remove: (c) => tableWrapperClassList.delete(c) } };

  const elements = {
    'permission-prompt': promptMock,
    'locations-body': { innerHTML: '', appendChild: () => {} },
    'no-locations': { classList: { add: () => {}, remove: () => {} } }
  };

  const sandbox = {
    navigator: {
      geolocation: {
        getCurrentPosition: () => { positionRequested = true; }
      },
      permissions: {
        query: async () => ({ state: 'prompt' })
      }
    },
    localStorage: { getItem: () => '[]' },
    Date: Date,
    JSON: JSON,
    isNaN: isNaN,
    document: {
      getElementById: (id) => elements[id] || null,
      querySelector: (sel) => sel === '.table-wrapper' ? tableWrapperMock : null,
      createElement: () => ({ appendChild: () => {} }),
      addEventListener: () => {}
    }
  };

  vm.createContext(sandbox);
  vm.runInContext(mapJsSource, sandbox);

  sandbox.checkGeolocationPermission();
  await new Promise(resolve => setTimeout(resolve, 50));

  assert.equal(positionRequested, false, 'getCurrentPosition should not be called automatically');
  assert.equal(promptClassList.has('hidden'), false, 'permission-prompt should NOT have hidden class');
  assert.equal(tableWrapperClassList.has('hidden'), true, 'table-wrapper SHOULD have hidden class');
});

test('map.js shows table and hides permission prompt when permission is granted', async () => {
  const mapJsSource = fs.readFileSync(path.join(__dirname, '../src/map.js'), 'utf8');

  const promptClassList = new Set();
  const tableWrapperClassList = new Set(['hidden']);

  const promptMock = { classList: { add: (c) => promptClassList.add(c), remove: (c) => promptClassList.delete(c) } };
  const tableWrapperMock = { classList: { add: (c) => tableWrapperClassList.add(c), remove: (c) => tableWrapperClassList.delete(c) } };

  const elements = {
    'permission-prompt': promptMock,
    'locations-body': { innerHTML: '', appendChild: () => {} },
    'no-locations': { classList: { add: () => {}, remove: () => {} } }
  };

  const sandbox = {
    navigator: {
      geolocation: {},
      permissions: {
        query: async () => ({ state: 'granted' })
      }
    },
    localStorage: { getItem: () => '[]' },
    Date: Date,
    JSON: JSON,
    isNaN: isNaN,
    document: {
      getElementById: (id) => elements[id] || null,
      querySelector: (sel) => sel === '.table-wrapper' ? tableWrapperMock : null,
      createElement: () => ({ appendChild: () => {} }),
      addEventListener: () => {}
    }
  };

  vm.createContext(sandbox);
  vm.runInContext(mapJsSource, sandbox);

  sandbox.checkGeolocationPermission();
  await new Promise(resolve => setTimeout(resolve, 50));

  assert.equal(promptClassList.has('hidden'), true, 'permission-prompt SHOULD have hidden class');
  assert.equal(tableWrapperClassList.has('hidden'), false, 'table-wrapper should NOT have hidden class');
});

test('clicking enable location button triggers getCurrentPosition and shows table on success', async () => {
  const mapJsSource = fs.readFileSync(path.join(__dirname, '../src/map.js'), 'utf8');

  let positionRequested = false;
  const promptClassList = new Set();
  const tableWrapperClassList = new Set(['hidden']);

  const promptMock = { classList: { add: (c) => promptClassList.add(c), remove: (c) => promptClassList.delete(c) } };
  const tableWrapperMock = { classList: { add: (c) => tableWrapperClassList.add(c), remove: (c) => tableWrapperClassList.delete(c) } };

  const elements = {
    'permission-prompt': promptMock,
    'locations-body': { innerHTML: '', appendChild: () => {} },
    'no-locations': { classList: { add: () => {}, remove: () => {} } }
  };

  const sandbox = {
    navigator: {
      geolocation: {
        getCurrentPosition: (successCb) => {
          positionRequested = true;
          successCb({ coords: { latitude: 0, longitude: 0 } });
        }
      }
    },
    localStorage: { getItem: () => '[]' },
    Date: Date,
    JSON: JSON,
    isNaN: isNaN,
    document: {
      getElementById: (id) => elements[id] || null,
      querySelector: (sel) => sel === '.table-wrapper' ? tableWrapperMock : null,
      createElement: () => ({ appendChild: () => {} }),
      addEventListener: () => {}
    }
  };

  vm.createContext(sandbox);
  vm.runInContext(mapJsSource, sandbox);

  sandbox.requestPermission();

  assert.ok(positionRequested, 'getCurrentPosition should be called on button click');
  assert.equal(promptClassList.has('hidden'), true, 'permission-prompt should be hidden after grant');
  assert.equal(tableWrapperClassList.has('hidden'), false, 'table-wrapper should be visible after grant');
});
