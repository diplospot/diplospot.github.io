const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('index.html contains fixed Map link', () => {
  const content = fs.readFileSync(path.join(__dirname, '../dist/index.html'), 'utf8');
  assert.ok(content.includes('id="map-link"'), 'index.html should have map-link element');
  assert.ok(content.includes('href="/map"'), 'map-link should point to /map');
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

test('map.js renders locations and checks geolocation permission', async () => {
  const mapJsSource = fs.readFileSync(path.join(__dirname, '../src/map.js'), 'utf8');

  const rows = [];
  const tbodyMock = {
    innerHTML: '',
    appendChild: (tr) => rows.push(tr)
  };
  const noLocationsMock = {
    classList: { add: () => {}, remove: () => {} }
  };

  let positionRequested = false;

  const mockLocations = [
    { timestamp: '2026-07-06T18:00:00.000Z', country: 'FRANCE', latitude: 48.8566, longitude: 2.3522 }
  ];

  const elements = {
    'locations-body': tbodyMock,
    'no-locations': noLocationsMock
  };

  const createdElements = [];

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
      getItem: (key) => JSON.stringify(mockLocations)
    },
    Date: Date,
    JSON: JSON,
    isNaN: isNaN,
    document: {
      getElementById: (id) => elements[id] || null,
      createElement: (tag) => {
        const el = { tag: tag, children: [], textContent: '' };
        el.appendChild = (child) => el.children.push(child);
        createdElements.push(el);
        return el;
      },
      addEventListener: () => {}
    }
  };

  vm.createContext(sandbox);
  vm.runInContext(mapJsSource, sandbox);

  sandbox.renderLocations();
  sandbox.checkAndRequestGeolocation();
  await new Promise(resolve => setTimeout(resolve, 50));

  assert.equal(rows.length, 1, 'Should have rendered 1 row');
  assert.ok(positionRequested, 'map page should request geolocation permission when not granted');
});
