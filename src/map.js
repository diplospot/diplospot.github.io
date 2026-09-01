var leafletMap = null;
var leafletMarkersGroup = null;

function initLeafletMap() {
  var mapEl = document.getElementById('map');
  if (!mapEl || typeof L === 'undefined') return;

  if (!leafletMap) {
    leafletMap = L.map('map').setView([0, 0], 2);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(leafletMap);
    leafletMarkersGroup = L.featureGroup().addTo(leafletMap);
  }
}

function updateLeafletMap(locations) {
  var mapEl = document.getElementById('map');
  if (!mapEl) return;

  initLeafletMap();

  if (!leafletMap || !leafletMarkersGroup) return;

  leafletMarkersGroup.clearLayers();

  var validLocations = [];
  if (locations && locations.length > 0) {
    for (var i = 0; i < locations.length; i++) {
      var item = locations[i];
      if (typeof item.latitude === 'number' && typeof item.longitude === 'number') {
        validLocations.push(item);
      }
    }
  }

  var recentLocations = validLocations.slice(-20);

  var bounds = [];
  for (var j = 0; j < recentLocations.length; j++) {
    var loc = recentLocations[j];
    var tsFormatted = loc.timestamp || '';
    try {
      var d = new Date(loc.timestamp);
      if (!isNaN(d.getTime())) {
        tsFormatted = d.toLocaleString();
      }
    } catch (e) {}

    var countryStr = loc.country || 'Unknown';
    var popupContent =
      '<strong>' + countryStr + '</strong><br/>' + (tsFormatted ? tsFormatted : '');

    var marker = L.marker([loc.latitude, loc.longitude]).bindPopup(popupContent);
    leafletMarkersGroup.addLayer(marker);
    bounds.push([loc.latitude, loc.longitude]);
  }

  if (bounds.length > 0) {
    leafletMap.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
  }

  setTimeout(function () {
    if (leafletMap) leafletMap.invalidateSize();
  }, 100);
}

function renderLocations() {
  var tbody = document.getElementById('locations-body');
  var noLocations = document.getElementById('no-locations');
  if (!tbody) return;

  var locations = [];
  try {
    locations = JSON.parse(localStorage.getItem('diplospot_locations') || '[]');
  } catch (e) {
    locations = [];
  }

  tbody.innerHTML = '';
  if (!locations || locations.length === 0) {
    if (noLocations) noLocations.classList.remove('hidden');
    updateLeafletMap([]);
    return;
  }

  if (noLocations) noLocations.classList.add('hidden');

  updateLeafletMap(locations);

  var displayLocations = [];
  for (var i = 0; i < locations.length; i++) {
    displayLocations.push({
      item: locations[i],
      originalIndex: i,
    });
  }

  displayLocations.sort(function (a, b) {
    var timeA = new Date(a.item.timestamp).getTime();
    var timeB = new Date(b.item.timestamp).getTime();
    if (isNaN(timeA)) timeA = 0;
    if (isNaN(timeB)) timeB = 0;
    if (timeB !== timeA) {
      return timeB - timeA;
    }
    return b.originalIndex - a.originalIndex;
  });

  for (var i = 0; i < displayLocations.length; i++) {
    var entry = displayLocations[i];
    var item = entry.item;
    var originalIndex = entry.originalIndex;
    var tr = document.createElement('tr');

    var tdTime = document.createElement('td');
    var ts = item.timestamp;
    try {
      var d = new Date(item.timestamp);
      if (!isNaN(d.getTime())) {
        ts = d.toLocaleString();
      }
    } catch (e) {}
    tdTime.textContent = ts || '';

    var tdCountry = document.createElement('td');
    tdCountry.textContent = item.country || '';

    var tdLatLong = document.createElement('td');
    var lat = typeof item.latitude === 'number' ? item.latitude.toFixed(4) : item.latitude || '';
    var lng = typeof item.longitude === 'number' ? item.longitude.toFixed(4) : item.longitude || '';
    tdLatLong.textContent = lat !== '' && lng !== '' ? lat + ', ' + lng : '';

    var tdAction = document.createElement('td');
    var deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.textContent = '🗑️';
    deleteBtn.setAttribute('aria-label', 'Delete location');
    (function (indexToDelete) {
      deleteBtn.addEventListener('click', function () {
        deleteLocation(indexToDelete);
      });
    })(originalIndex);
    tdAction.appendChild(deleteBtn);

    tr.appendChild(tdTime);
    tr.appendChild(tdCountry);
    tr.appendChild(tdLatLong);
    tr.appendChild(tdAction);
    tbody.appendChild(tr);
  }
}

function deleteLocation(index) {
  try {
    var locations = JSON.parse(localStorage.getItem('diplospot_locations') || '[]');
    if (index >= 0 && index < locations.length) {
      locations.splice(index, 1);
      localStorage.setItem('diplospot_locations', JSON.stringify(locations));
    }
  } catch (e) {}
  renderLocations();
}

function isBottomSheetOpen() {
  var backdrop = document.getElementById('sheet-backdrop');
  var sheet = document.getElementById('bottom-sheet') || document.querySelector('.table-wrapper');
  if (!sheet) return false;
  return (
    !sheet.classList.contains('closed') &&
    !sheet.classList.contains('hidden') &&
    (backdrop ? !backdrop.classList.contains('hidden') : true)
  );
}

function openBottomSheet() {
  var backdrop = document.getElementById('sheet-backdrop');
  var sheet = document.getElementById('bottom-sheet') || document.querySelector('.table-wrapper');
  var toggle = document.getElementById('sheet-toggle');

  if (backdrop) backdrop.classList.remove('hidden');
  if (sheet) {
    sheet.classList.remove('hidden');
    sheet.classList.remove('closed');
  }
  if (toggle) toggle.setAttribute('aria-expanded', 'true');

  if (leafletMap) {
    setTimeout(function () {
      leafletMap.invalidateSize();
    }, 100);
  }
}

function closeBottomSheet() {
  var backdrop = document.getElementById('sheet-backdrop');
  var sheet = document.getElementById('bottom-sheet') || document.querySelector('.table-wrapper');
  var toggle = document.getElementById('sheet-toggle');

  if (backdrop) backdrop.classList.add('hidden');
  if (sheet) sheet.classList.add('closed');
  if (toggle) toggle.setAttribute('aria-expanded', 'false');

  if (leafletMap) {
    setTimeout(function () {
      leafletMap.invalidateSize();
    }, 100);
  }
}

function toggleBottomSheet() {
  if (isBottomSheetOpen()) {
    closeBottomSheet();
  } else {
    openBottomSheet();
  }
}

function setTableVisible(visible) {
  var promptEl = document.getElementById('permission-prompt');
  var sheetToggle = document.getElementById('sheet-toggle');
  var bottomSheet =
    document.getElementById('bottom-sheet') || document.querySelector('.table-wrapper');
  var backdrop = document.getElementById('sheet-backdrop');

  if (promptEl) promptEl.classList[visible ? 'add' : 'remove']('hidden');
  if (sheetToggle) sheetToggle.classList[visible ? 'remove' : 'add']('hidden');
  if (bottomSheet) bottomSheet.classList[visible ? 'remove' : 'add']('hidden');
  if (visible) {
    closeBottomSheet();
  } else if (backdrop) {
    backdrop.classList.add('hidden');
  }
}

function showTable() {
  setTableVisible(true);
  renderLocations();
}

function showPermissionPrompt() {
  setTableVisible(false);
}

function checkGeolocationPermission() {
  try {
    if (!('geolocation' in navigator)) {
      showPermissionPrompt();
      return;
    }

    if (localStorage.getItem('diplospot_geo_granted') === '1') {
      navigator.geolocation.getCurrentPosition(
        function () {
          showTable();
        },
        function () {
          localStorage.removeItem('diplospot_geo_granted');
          showPermissionPrompt();
        },
        { timeout: 5000 }
      );
      return;
    }

    if ('permissions' in navigator) {
      navigator.permissions
        .query({ name: 'geolocation' })
        .then(function (res) {
          if (res && res.state === 'granted') {
            localStorage.setItem('diplospot_geo_granted', '1');
            showTable();
          } else {
            showPermissionPrompt();
          }
        })
        .catch(function () {
          showPermissionPrompt();
        });
    } else {
      showPermissionPrompt();
    }
  } catch (e) {
    showPermissionPrompt();
  }
}

function requestPermission() {
  if (!('geolocation' in navigator)) return;
  navigator.geolocation.getCurrentPosition(
    function () {
      localStorage.setItem('diplospot_geo_granted', '1');
      showTable();
    },
    function () {},
    { timeout: 5000 }
  );
}

document.addEventListener('DOMContentLoaded', function () {
  var btn = document.getElementById('enable-location-btn');
  if (btn) {
    btn.addEventListener('click', requestPermission);
  }

  var toggleBtn = document.getElementById('sheet-toggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', openBottomSheet);
  }

  var closeBtn = document.getElementById('sheet-close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeBottomSheet);
  }

  var backdrop = document.getElementById('sheet-backdrop');
  if (backdrop) {
    backdrop.addEventListener('click', closeBottomSheet);
  }

  var sheetHeader = document.getElementById('sheet-header');
  if (sheetHeader) {
    var startY = 0;
    sheetHeader.addEventListener('touchstart', function (e) {
      if (e.touches && e.touches.length > 0) {
        startY = e.touches[0].clientY;
      }
    });
    sheetHeader.addEventListener('touchmove', function (e) {
      if (e.touches && e.touches.length > 0) {
        var currentY = e.touches[0].clientY;
        if (currentY - startY > 50) {
          closeBottomSheet();
        }
      }
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isBottomSheetOpen()) {
      closeBottomSheet();
    }
  });

  window.addEventListener('resize', function () {
    if (leafletMap) leafletMap.invalidateSize();
  });

  checkGeolocationPermission();
});
