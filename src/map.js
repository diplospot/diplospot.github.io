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
    return;
  }

  if (noLocations) noLocations.classList.add('hidden');

  for (var i = 0; i < locations.length; i++) {
    var item = locations[i];
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
    var lat = typeof item.latitude === 'number' ? item.latitude.toFixed(4) : (item.latitude || '');
    var lng = typeof item.longitude === 'number' ? item.longitude.toFixed(4) : (item.longitude || '');
    tdLatLong.textContent = (lat !== '' && lng !== '') ? (lat + ', ' + lng) : '';

    tr.appendChild(tdTime);
    tr.appendChild(tdCountry);
    tr.appendChild(tdLatLong);
    tbody.appendChild(tr);
  }
}

function checkAndRequestGeolocation() {
  try {
    if (!('geolocation' in navigator)) return;

    if ('permissions' in navigator) {
      navigator.permissions.query({ name: 'geolocation' }).then(function (res) {
        if (res && res.state !== 'granted') {
          navigator.geolocation.getCurrentPosition(function () {}, function () {}, { timeout: 5000 });
        }
      }).catch(function () {
        navigator.geolocation.getCurrentPosition(function () {}, function () {}, { timeout: 5000 });
      });
    } else {
      navigator.geolocation.getCurrentPosition(function () {}, function () {}, { timeout: 5000 });
    }
  } catch (e) {}
}

document.addEventListener('DOMContentLoaded', function () {
  renderLocations();
  checkAndRequestGeolocation();
});
