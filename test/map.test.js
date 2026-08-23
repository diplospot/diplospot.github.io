const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('index.html contains fixed relative Map link', () => {
  const content = fs.readFileSync(path.join(__dirname, '../dist/index.html'), 'utf8');
  assert.ok(content.includes('id="map-link"'), 'index.html should have map-link element');
  assert.ok(
    content.includes('href="./map"') || content.includes('href="map"'),
    'map-link should point to relative map path'
  );
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

function createLocalStorageMock(seed) {
  const store = Object.assign({}, seed);
  return {
    getItem: (key) => (key in store ? store[key] : null),
    setItem: (key, val) => {
      store[key] = val;
    },
    removeItem: (key) => {
      delete store[key];
    },
    store,
  };
}

test('trySaveLocation saves location when previously granted (localStorage flag set)', async () => {
  const appJsSource = fs.readFileSync(path.join(__dirname, '../src/app.js'), 'utf8');
  const ofmCodesSource = fs.readFileSync(path.join(__dirname, '../src/ofm_codes.js'), 'utf8');

  let positionRequested = false;
  const localStorage = createLocalStorageMock({ diplospot_geo_granted: '1' });

  const sandbox = {
    navigator: {
      geolocation: {
        getCurrentPosition: (successCb) => {
          positionRequested = true;
          successCb({ coords: { latitude: 37.7749, longitude: -122.4194 } });
        },
      },
    },
    localStorage,
    Date: Date,
    JSON: JSON,
    document: {
      getElementById: () => null,
      addEventListener: () => {},
    },
  };

  vm.createContext(sandbox);
  vm.runInContext(ofmCodesSource + '\n' + appJsSource, sandbox);

  sandbox.trySaveLocation('France');

  assert.ok(
    positionRequested,
    'getCurrentPosition should have been called without a permissions.query check'
  );
  const parsed = JSON.parse(localStorage.store.diplospot_locations);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].country, 'France');
  assert.equal(parsed[0].latitude, 37.7749);
  assert.equal(parsed[0].longitude, -122.4194);
  assert.ok(parsed[0].timestamp);
});

test('trySaveLocation does nothing when never previously granted', async () => {
  const appJsSource = fs.readFileSync(path.join(__dirname, '../src/app.js'), 'utf8');

  let positionRequested = false;
  const localStorage = createLocalStorageMock();

  const sandbox = {
    navigator: {
      geolocation: {
        getCurrentPosition: () => {
          positionRequested = true;
        },
      },
    },
    localStorage,
    Date: Date,
    JSON: JSON,
    document: { getElementById: () => null, addEventListener: () => {} },
  };

  vm.createContext(sandbox);
  vm.runInContext(appJsSource, sandbox);

  sandbox.trySaveLocation('France');

  assert.equal(
    positionRequested,
    false,
    'getCurrentPosition should not be called without a prior grant'
  );
  assert.equal(
    localStorage.store.diplospot_locations,
    undefined,
    'localStorage should not be updated'
  );
});

function createMapSandbox(navigator, localStorageSeed) {
  const mapJsSource = fs.readFileSync(path.join(__dirname, '../src/map.js'), 'utf8');

  const promptClassList = new Set();
  const tableWrapperClassList = new Set();
  const promptMock = {
    classList: { add: (c) => promptClassList.add(c), remove: (c) => promptClassList.delete(c) },
  };
  const tableWrapperMock = {
    classList: {
      add: (c) => tableWrapperClassList.add(c),
      remove: (c) => tableWrapperClassList.delete(c),
    },
  };

  const elements = {
    'permission-prompt': promptMock,
    'locations-body': { innerHTML: '', appendChild: () => {} },
    'no-locations': { classList: { add: () => {}, remove: () => {} } },
  };

  const localStorage = createLocalStorageMock(
    Object.assign({ diplospot_locations: '[]' }, localStorageSeed)
  );

  const sandbox = {
    navigator,
    localStorage,
    Date: Date,
    JSON: JSON,
    isNaN: isNaN,
    document: {
      getElementById: (id) => elements[id] || null,
      querySelector: (sel) => (sel === '.table-wrapper' ? tableWrapperMock : null),
      createElement: () => ({ appendChild: () => {} }),
      addEventListener: () => {},
    },
  };

  vm.createContext(sandbox);
  vm.runInContext(mapJsSource, sandbox);

  return { sandbox, promptClassList, tableWrapperClassList, localStorage };
}

test('map.js shows the permission prompt when there is no prior grant and permissions.query is unavailable (e.g. iOS Safari)', async () => {
  let positionRequested = false;
  const { sandbox, promptClassList, tableWrapperClassList } = createMapSandbox({
    geolocation: {
      getCurrentPosition: () => {
        positionRequested = true;
      },
    },
  });

  sandbox.checkGeolocationPermission();
  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.equal(positionRequested, false, 'getCurrentPosition should not be called automatically');
  assert.equal(
    promptClassList.has('hidden'),
    false,
    'permission-prompt should NOT have hidden class'
  );
  assert.equal(tableWrapperClassList.has('hidden'), true, 'table-wrapper SHOULD have hidden class');
});

test('map.js remembers a prior grant and skips the prompt on later visits without permissions.query', async () => {
  let positionRequested = false;
  const { sandbox, promptClassList, tableWrapperClassList } = createMapSandbox(
    {
      geolocation: {
        getCurrentPosition: (successCb) => {
          positionRequested = true;
          successCb({ coords: { latitude: 0, longitude: 0 } });
        },
      },
    },
    { diplospot_geo_granted: '1' }
  );

  sandbox.checkGeolocationPermission();
  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.ok(positionRequested, 'should silently retry geolocation using the remembered grant');
  assert.equal(promptClassList.has('hidden'), true, 'permission-prompt SHOULD have hidden class');
  assert.equal(
    tableWrapperClassList.has('hidden'),
    false,
    'table-wrapper should NOT have hidden class'
  );
});

test('map.js clears a stale grant and shows the prompt if a remembered grant no longer works', async () => {
  const { sandbox, promptClassList, tableWrapperClassList, localStorage } = createMapSandbox(
    {
      geolocation: {
        getCurrentPosition: (successCb, errorCb) => {
          errorCb();
        },
      },
    },
    { diplospot_geo_granted: '1' }
  );

  sandbox.checkGeolocationPermission();
  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.equal(
    localStorage.store.diplospot_geo_granted,
    undefined,
    'stale grant flag should be cleared'
  );
  assert.equal(
    promptClassList.has('hidden'),
    false,
    'permission-prompt should NOT have hidden class'
  );
  assert.equal(tableWrapperClassList.has('hidden'), true, 'table-wrapper SHOULD have hidden class');
});

test('map.js shows table and remembers the grant when permissions.query reports granted', async () => {
  const { sandbox, promptClassList, tableWrapperClassList, localStorage } = createMapSandbox({
    geolocation: {},
    permissions: { query: async () => ({ state: 'granted' }) },
  });

  sandbox.checkGeolocationPermission();
  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.equal(promptClassList.has('hidden'), true, 'permission-prompt SHOULD have hidden class');
  assert.equal(
    tableWrapperClassList.has('hidden'),
    false,
    'table-wrapper should NOT have hidden class'
  );
  assert.equal(
    localStorage.store.diplospot_geo_granted,
    '1',
    'should remember the grant for future visits'
  );
});

test('clicking enable location button triggers getCurrentPosition, shows table, and remembers the grant', async () => {
  let positionRequested = false;
  const { sandbox, promptClassList, tableWrapperClassList, localStorage } = createMapSandbox({
    geolocation: {
      getCurrentPosition: (successCb) => {
        positionRequested = true;
        successCb({ coords: { latitude: 0, longitude: 0 } });
      },
    },
  });

  sandbox.requestPermission();

  assert.ok(positionRequested, 'getCurrentPosition should be called on button click');
  assert.equal(
    promptClassList.has('hidden'),
    true,
    'permission-prompt should be hidden after grant'
  );
  assert.equal(
    tableWrapperClassList.has('hidden'),
    false,
    'table-wrapper should be visible after grant'
  );
  assert.equal(
    localStorage.store.diplospot_geo_granted,
    '1',
    'should remember the grant for future visits'
  );
});
