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
  assert.ok(content.includes('🗺️'), 'map-link should contain map icon');
  assert.ok(content.includes('position:fixed'), 'map-link CSS should be position:fixed');
});

test('dist/map.html and dist/map/index.html exist and are minified', () => {
  const mapHtmlPath = path.join(__dirname, '../dist/map.html');
  const mapDirIndexPath = path.join(__dirname, '../dist/map/index.html');
  assert.ok(fs.existsSync(mapHtmlPath), 'dist/map.html should exist');
  assert.ok(fs.existsSync(mapDirIndexPath), 'dist/map/index.html should exist');

  const content = fs.readFileSync(mapHtmlPath, 'utf8');
  assert.ok(content.includes('id="locations-table"'), 'map.html should contain locations table');
  assert.ok(content.includes('id="map"'), 'map.html should contain map element');
  assert.ok(content.includes('leaflet.css'), 'map.html should link Leaflet CSS');
  assert.ok(content.includes('leaflet.js'), 'map.html should include Leaflet JS');
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

test('saveCurrentLocation saves location on pin button click and toggles icon to checkmark', async () => {
  const appJsSource = fs.readFileSync(path.join(__dirname, '../src/app.js'), 'utf8');
  const ofmCodesSource = fs.readFileSync(path.join(__dirname, '../src/ofm_codes.js'), 'utf8');

  let positionRequested = false;
  const localStorage = createLocalStorageMock();

  const pinBtnMock = {
    textContent: '📍',
    classList: { add: () => {}, remove: () => {} },
  };

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
    setTimeout: setTimeout,
    clearTimeout: clearTimeout,
    document: {
      getElementById: (id) => {
        if (id === 'pin-button') return pinBtnMock;
        return { textContent: '', innerHTML: '', classList: { add: () => {}, remove: () => {} } };
      },
      addEventListener: () => {},
    },
  };

  vm.createContext(sandbox);
  vm.runInContext(ofmCodesSource + '\n' + appJsSource, sandbox);

  // show result for France first
  sandbox.showResult({ success: true, country: 'France' });

  // automatic save should NOT have happened
  assert.equal(
    positionRequested,
    false,
    'geolocation should not run automatically on input/result'
  );

  // click save location
  sandbox.saveCurrentLocation();

  assert.ok(positionRequested, 'getCurrentPosition should be called when user clicks pin');
  const parsed = JSON.parse(localStorage.store.diplospot_locations);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].country, 'France');
  assert.equal(parsed[0].latitude, 37.7749);
  assert.equal(parsed[0].longitude, -122.4194);
  assert.equal(pinBtnMock.textContent, '✓', 'Pin button icon should turn into checkmark');
});

function createMapSandbox(navigator, localStorageSeed) {
  const mapJsSource = fs.readFileSync(path.join(__dirname, '../src/map.js'), 'utf8');

  const promptClassList = new Set();
  const tableWrapperClassList = new Set();
  const sheetClassList = new Set();
  const toggleClassList = new Set();
  const backdropClassList = new Set();
  const mapClassList = new Set();

  const createClassListMock = (set) => ({
    add: (c) => set.add(c),
    remove: (c) => set.delete(c),
    contains: (c) => set.has(c),
  });

  const promptMock = { classList: createClassListMock(promptClassList) };
  const tableWrapperMock = { classList: createClassListMock(tableWrapperClassList) };
  const sheetMock = { classList: createClassListMock(sheetClassList) };

  let toggleAriaExpanded = 'false';
  const toggleMock = {
    classList: createClassListMock(toggleClassList),
    setAttribute: (name, val) => {
      if (name === 'aria-expanded') toggleAriaExpanded = String(val);
    },
    getAttribute: (name) => (name === 'aria-expanded' ? toggleAriaExpanded : null),
  };

  const backdropMock = { classList: createClassListMock(backdropClassList) };
  const mapElMock = { classList: createClassListMock(mapClassList) };

  const elements = {
    'permission-prompt': promptMock,
    'bottom-sheet': sheetMock,
    'sheet-toggle': toggleMock,
    'sheet-backdrop': backdropMock,
    'sheet-close-btn': { addEventListener: () => {} },
    'sheet-header': { addEventListener: () => {} },
    'locations-body': { innerHTML: '', appendChild: () => {} },
    'no-locations': { classList: createClassListMock(new Set()) },
    map: mapElMock,
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
    setTimeout: (fn) => fn(),
    document: {
      getElementById: (id) => elements[id] || null,
      querySelector: (sel) => (sel === '.table-wrapper' ? sheetMock : null),
      createElement: () => ({ appendChild: () => {}, setAttribute: () => {} }),
      addEventListener: () => {},
    },
    window: { addEventListener: () => {} },
  };

  vm.createContext(sandbox);
  vm.runInContext(mapJsSource, sandbox);

  return {
    sandbox,
    promptClassList,
    tableWrapperClassList,
    sheetClassList,
    toggleClassList,
    backdropClassList,
    localStorage,
    getToggleAriaExpanded: () => toggleAriaExpanded,
  };
}

test('map.js shows the permission prompt when there is no prior grant and permissions.query is unavailable (e.g. iOS Safari)', async () => {
  let positionRequested = false;
  const { sandbox, promptClassList, sheetClassList } = createMapSandbox({
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
  assert.equal(sheetClassList.has('hidden'), true, 'bottom sheet SHOULD have hidden class');
});

test('map.js remembers a prior grant and skips the prompt on later visits without permissions.query', async () => {
  let positionRequested = false;
  const { sandbox, promptClassList, sheetClassList } = createMapSandbox(
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
  assert.equal(sheetClassList.has('hidden'), false, 'bottom sheet should NOT have hidden class');
});

test('map.js clears a stale grant and shows the prompt if a remembered grant no longer works', async () => {
  const { sandbox, promptClassList, sheetClassList, localStorage } = createMapSandbox(
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
  assert.equal(sheetClassList.has('hidden'), true, 'bottom sheet SHOULD have hidden class');
});

test('map.js shows table and remembers the grant when permissions.query reports granted', async () => {
  const { sandbox, promptClassList, sheetClassList, localStorage } = createMapSandbox({
    geolocation: {},
    permissions: { query: async () => ({ state: 'granted' }) },
  });

  sandbox.checkGeolocationPermission();
  await new Promise((resolve) => setTimeout(resolve, 50));

  assert.equal(promptClassList.has('hidden'), true, 'permission-prompt SHOULD have hidden class');
  assert.equal(sheetClassList.has('hidden'), false, 'bottom sheet should NOT have hidden class');
  assert.equal(
    localStorage.store.diplospot_geo_granted,
    '1',
    'should remember the grant for future visits'
  );
});

test('openBottomSheet and closeBottomSheet toggle bottom sheet visibility and aria-expanded state', () => {
  const { sandbox, sheetClassList, backdropClassList, getToggleAriaExpanded } = createMapSandbox(
    {}
  );

  // Initially closed
  sandbox.closeBottomSheet();
  assert.equal(sheetClassList.has('closed'), true, 'Sheet should have closed class');
  assert.equal(backdropClassList.has('hidden'), true, 'Backdrop should have hidden class');
  assert.equal(getToggleAriaExpanded(), 'false', 'aria-expanded should be false');

  // Open sheet
  sandbox.openBottomSheet();
  assert.equal(sheetClassList.has('closed'), false, 'Sheet should not have closed class');
  assert.equal(sheetClassList.has('hidden'), false, 'Sheet should not have hidden class');
  assert.equal(backdropClassList.has('hidden'), false, 'Backdrop should not have hidden class');
  assert.equal(getToggleAriaExpanded(), 'true', 'aria-expanded should be true');

  // Close sheet
  sandbox.closeBottomSheet();
  assert.equal(sheetClassList.has('closed'), true, 'Sheet should have closed class');
  assert.equal(backdropClassList.has('hidden'), true, 'Backdrop should have hidden class');
  assert.equal(getToggleAriaExpanded(), 'false', 'aria-expanded should be false');
});

test('updateLeafletMap limits markers to the last 20 locations and sets popup content with country and timestamp', () => {
  const mapJsSource = fs.readFileSync(path.join(__dirname, '../src/map.js'), 'utf8');

  let markersAdded = [];
  let fitBoundsCalled = false;
  let fitBoundsArgs = null;

  const mockFeatureGroup = {
    addTo: function () {
      return mockFeatureGroup;
    },
    clearLayers: function () {
      markersAdded = [];
    },
    addLayer: function (marker) {
      markersAdded.push(marker);
    },
  };

  const mockMapInstance = {
    setView: function () {
      return mockMapInstance;
    },
    fitBounds: function (bounds, opts) {
      fitBoundsCalled = true;
      fitBoundsArgs = { bounds, opts };
    },
    invalidateSize: function () {},
  };

  const L = {
    map: function () {
      return mockMapInstance;
    },
    tileLayer: function () {
      return { addTo: function () {} };
    },
    featureGroup: function () {
      return mockFeatureGroup;
    },
    marker: function (latlng) {
      const m = {
        latlng,
        popupContent: '',
        bindPopup: function (content) {
          m.popupContent = content;
          return m;
        },
      };
      return m;
    },
  };

  const locations = [];
  for (let i = 1; i <= 25; i++) {
    locations.push({
      timestamp: `2026-01-01T00:00:${i < 10 ? '0' + i : i}.000Z`,
      country: `Country ${i}`,
      latitude: i,
      longitude: i * 2,
    });
  }

  const mapElMock = { classList: { add: () => {}, remove: () => {} } };

  const sandbox = {
    L,
    document: {
      getElementById: (id) => (id === 'map' ? mapElMock : null),
      addEventListener: () => {},
    },
    Date,
    JSON,
    isNaN,
    setTimeout: (fn) => fn(),
  };

  vm.createContext(sandbox);
  vm.runInContext(mapJsSource, sandbox);

  sandbox.updateLeafletMap(locations);

  assert.equal(markersAdded.length, 20, 'Should limit map markers to the last 20 locations');
  assert.equal(fitBoundsCalled, true, 'Should call fitBounds on map');
  assert.equal(fitBoundsArgs.bounds.length, 20);

  // The 20 items rendered should be from index 5 to 24 (Country 6 through Country 25)
  assert.ok(markersAdded[0].popupContent.includes('Country 6'));
  assert.ok(markersAdded[19].popupContent.includes('Country 25'));
  assert.ok(
    markersAdded[19].popupContent.includes('<strong>Country 25</strong>'),
    'Popup content should include bold country name'
  );
});

test('deleteLocation removes specific entry from localStorage and re-renders table', async () => {
  const mapJsSource = fs.readFileSync(path.join(__dirname, '../src/map.js'), 'utf8');

  const initialLocations = [
    { timestamp: '2026-01-01T00:00:00.000Z', country: 'France', latitude: 10, longitude: 20 },
    { timestamp: '2026-01-02T00:00:00.000Z', country: 'Germany', latitude: 30, longitude: 40 },
  ];

  const localStorage = createLocalStorageMock({
    diplospot_locations: JSON.stringify(initialLocations),
  });

  let appendedChildren = [];
  const tbodyMock = {
    set innerHTML(val) {
      if (val === '') appendedChildren = [];
    },
    appendChild: (child) => {
      appendedChildren.push(child);
    },
  };

  const noLocationsClassList = new Set(['hidden']);
  const noLocationsMock = {
    classList: {
      add: (c) => noLocationsClassList.add(c),
      remove: (c) => noLocationsClassList.delete(c),
    },
  };

  const sandbox = {
    navigator: {},
    localStorage,
    Date: Date,
    JSON: JSON,
    isNaN: isNaN,
    document: {
      getElementById: (id) => {
        if (id === 'locations-body') return tbodyMock;
        if (id === 'no-locations') return noLocationsMock;
        return null;
      },
      querySelector: () => null,
      createElement: (tag) => {
        const attributes = {};
        const elem = {
          tag,
          children: [],
          listeners: {},
          attributes,
          appendChild: (child) => elem.children.push(child),
          addEventListener: (event, handler) => {
            elem.listeners[event] = handler;
          },
          setAttribute: (name, value) => {
            attributes[name] = value;
          },
        };
        return elem;
      },
      addEventListener: () => {},
    },
  };

  vm.createContext(sandbox);
  vm.runInContext(mapJsSource, sandbox);

  sandbox.renderLocations();

  assert.equal(appendedChildren.length, 2);

  // Because table is sorted reverse-chronologically, first row in table is Germany (2026-01-02), second is France (2026-01-01)
  assert.equal(appendedChildren[0].children[1].textContent, 'Germany');
  assert.equal(appendedChildren[1].children[1].textContent, 'France');

  // Find the delete button in the second row (France, original index 0)
  const secondRow = appendedChildren[1];
  const lastTd = secondRow.children[3]; // tdAction
  const deleteBtn = lastTd.children[0];

  assert.equal(deleteBtn.className, 'delete-btn');
  assert.equal(deleteBtn.textContent, '🗑️');

  // Click delete button for France (original index 0)
  deleteBtn.listeners['click']();

  // Verify localStorage updated (France removed, Germany remains)
  const updatedLocations = JSON.parse(localStorage.store.diplospot_locations);
  assert.equal(updatedLocations.length, 1);
  assert.equal(updatedLocations[0].country, 'Germany');

  // Verify table re-rendered with 1 item remaining (Germany)
  assert.equal(appendedChildren.length, 1);
  assert.equal(appendedChildren[0].children[1].textContent, 'Germany');

  // Click delete button for remaining item (Germany, original index 0 after re-render)
  const newLastTd = appendedChildren[0].children[3];
  const newDeleteBtn = newLastTd.children[0];
  newDeleteBtn.listeners['click']();

  const finalLocations = JSON.parse(localStorage.store.diplospot_locations);
  assert.equal(finalLocations.length, 0);
  assert.equal(
    noLocationsClassList.has('hidden'),
    false,
    'no-locations should be visible when empty'
  );
});

test('renderLocations sorts locations in reverse chronological order (latest timestamp first)', () => {
  const mapJsSource = fs.readFileSync(path.join(__dirname, '../src/map.js'), 'utf8');

  const initialLocations = [
    { timestamp: '2026-01-01T00:00:00.000Z', country: 'France', latitude: 10, longitude: 20 },
    { timestamp: '2026-01-03T00:00:00.000Z', country: 'Italy', latitude: 50, longitude: 60 },
    { timestamp: '2026-01-02T00:00:00.000Z', country: 'Germany', latitude: 30, longitude: 40 },
  ];

  const localStorage = createLocalStorageMock({
    diplospot_locations: JSON.stringify(initialLocations),
  });

  let appendedChildren = [];
  const tbodyMock = {
    set innerHTML(val) {
      if (val === '') appendedChildren = [];
    },
    appendChild: (child) => {
      appendedChildren.push(child);
    },
  };

  const sandbox = {
    navigator: {},
    localStorage,
    Date: Date,
    JSON: JSON,
    isNaN: isNaN,
    document: {
      getElementById: (id) => (id === 'locations-body' ? tbodyMock : null),
      querySelector: () => null,
      createElement: (tag) => {
        const attributes = {};
        const elem = {
          tag,
          children: [],
          textContent: '',
          listeners: {},
          attributes,
          appendChild: (child) => elem.children.push(child),
          addEventListener: (event, handler) => {
            elem.listeners[event] = handler;
          },
          setAttribute: (name, value) => {
            attributes[name] = value;
          },
        };
        return elem;
      },
      addEventListener: () => {},
    },
  };

  vm.createContext(sandbox);
  vm.runInContext(mapJsSource, sandbox);

  sandbox.renderLocations();

  assert.equal(appendedChildren.length, 3);
  assert.equal(appendedChildren[0].children[1].textContent, 'Italy');
  assert.equal(appendedChildren[1].children[1].textContent, 'Germany');
  assert.equal(appendedChildren[2].children[1].textContent, 'France');
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
