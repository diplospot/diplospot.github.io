function showResult(data) {
  var container = document.getElementById('result-container');
  resetPinButton();

  if (data.success) {
    currentCountry = data.country || 'Unknown';
    currentCode = data.code || '';
    currentFlag = data.flag || '';
    document.getElementById('result-type').textContent = data.prefix || '';
    var flagPrefix = data.flag ? data.flag + ' ' : '';
    var wikiUrl =
      'https://en.wikipedia.org/wiki/Special:Search?search=' +
      encodeURIComponent(data.country) +
      '&go=Go';
    document.getElementById('result-country').innerHTML =
      '<a href="' +
      wikiUrl +
      '" target="_blank" rel="noopener">' +
      flagPrefix +
      data.country.toUpperCase() +
      '</a>';
    container.className = 'result-card success';
    if (data.source === 'Spotted') {
      container.classList.add('spotted');
    }
  } else {
    currentCountry = 'Unknown';
    currentFlag = '';
    var raw = document.getElementById('plate-input').value;
    var letters = raw.toUpperCase().replace(/[^A-Z]/g, '');
    var countryCode = getCountryCode(letters);
    currentCode = countryCode || '';

    if (countryCode) {
      var title = '[Unknown Plate] ' + countryCode + ' plate spotted';
      var body =
        'Spotted a license plate with the code ' +
        countryCode +
        ". This is not recognized but should we added to src/ofm_codes.js under SPOTTED_CODES, so that we know that this plate exists, but we don't know what it stands for.";
      var githubUrl =
        'https://github.com/diplospot/diplospot.github.io/issues/new?title=' +
        encodeURIComponent(title) +
        '&body=' +
        encodeURIComponent(body);
      document.getElementById('result-type').innerHTML =
        '<a href="' + githubUrl + '" target="_blank" rel="noopener">NOT RECOGNIZED</a>';
    } else {
      document.getElementById('result-type').textContent = 'NOT RECOGNIZED';
    }
    document.getElementById('result-country').textContent = '';
    container.className = 'result-card failure';
  }

  container.classList.remove('hidden');
}

function hideResult() {
  document.getElementById('result-container').classList.add('hidden');
}

function onInput() {
  var input = document.getElementById('plate-input');
  var raw = input.value;
  var letters = raw.toUpperCase().replace(/[^A-Z]/g, '');

  var isSpecial = letters.length > 0 && !!PLATE_PREFIXES[letters[0]];

  if (letters.length > 0) {
    if (!isSpecial) {
      input.maxLength = 2;
      if (letters.length > 2) {
        letters = letters.substring(0, 2);
        input.value = letters;
      }
    } else {
      input.maxLength = 3;
    }
  } else {
    input.maxLength = 3;
  }

  if (letters.length >= (isSpecial ? 3 : 2)) {
    input.blur();
  }

  if (letters.length < 2) {
    hideResult();
    return;
  }

  var result = lookupPlate(letters);
  if (result) {
    result.success = true;
    showResult(result);
  } else {
    showResult({ success: false, message: 'Code "' + letters + '" not found' });
  }
}

var currentCountry = 'Unknown';
var currentCode = '';
var currentFlag = '';
var pinTimeout = null;

function resetPinButton() {
  var pinBtn = document.getElementById('pin-button');
  if (pinBtn) {
    pinBtn.textContent = '📍';
    pinBtn.classList.remove('saved');
  }
  if (pinTimeout) {
    clearTimeout(pinTimeout);
    pinTimeout = null;
  }
}

function saveCurrentLocation() {
  try {
    if (!('geolocation' in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      function (position) {
        try {
          var locations = JSON.parse(localStorage.getItem('diplospot_locations') || '[]');
          locations.push({
            timestamp: new Date().toISOString(),
            country: currentCountry,
            code: currentCode,
            flag: currentFlag,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
          localStorage.setItem('diplospot_locations', JSON.stringify(locations));
          localStorage.setItem('diplospot_geo_granted', '1');

          var pinBtn = document.getElementById('pin-button');
          if (pinBtn) {
            pinBtn.textContent = '✓';
            pinBtn.classList.add('saved');
            if (pinTimeout) clearTimeout(pinTimeout);
            pinTimeout = setTimeout(resetPinButton, 5000);
          }
        } catch (e) {}
      },
      function () {},
      { timeout: 5000 }
    );
  } catch (e) {}
}

document.addEventListener('DOMContentLoaded', function () {
  var input = document.getElementById('plate-input');
  var pinBtn = document.getElementById('pin-button');

  input.addEventListener('input', onInput);
  input.addEventListener('focus', function () {
    input.select();
  });
  if (pinBtn) {
    pinBtn.addEventListener('click', saveCurrentLocation);
  }
  input.focus();
});
