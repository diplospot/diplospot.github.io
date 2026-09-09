// Shared geolocation permission/state logic used by both index.html (app.js)
// and map.html (map.js), so there is exactly one place that decides what
// "granted" means and how permission errors are interpreted.

var GEO_GRANTED_KEY = 'diplospot_geo_granted';

function geoIsSupported() {
  return 'geolocation' in navigator;
}

function geoMarkGranted() {
  try {
    localStorage.setItem(GEO_GRANTED_KEY, '1');
  } catch (e) {}
}

function geoClearGranted() {
  try {
    localStorage.removeItem(GEO_GRANTED_KEY);
  } catch (e) {}
}

function geoWasGranted() {
  try {
    return localStorage.getItem(GEO_GRANTED_KEY) === '1';
  } catch (e) {
    return false;
  }
}

// Reports 'granted' | 'denied' | 'prompt' | 'unknown' via callback.
// 'unknown' means the Permissions API isn't available/reliable here
// (notably older iOS Safari) - callers should fall back to geoWasGranted()
// rather than treating it as a denial.
function geoQueryPermissionState(callback) {
  if (!geoIsSupported()) {
    callback('unsupported');
    return;
  }
  if ('permissions' in navigator && navigator.permissions && navigator.permissions.query) {
    navigator.permissions
      .query({ name: 'geolocation' })
      .then(function (result) {
        callback(result.state);
      })
      .catch(function () {
        callback('unknown');
      });
  } else {
    callback('unknown');
  }
}

// Wraps navigator.geolocation.getCurrentPosition with:
// - a sane maximumAge so a slow/cold GPS fix doesn't force a fresh request
// - permission state kept in sync with the *real* outcome: only an actual
//   PERMISSION_DENIED (code 1) clears the granted flag. A TIMEOUT (code 3)
//   or POSITION_UNAVAILABLE (code 2) does NOT get treated as a denial.
function geoGetCurrentPosition(onSuccess, onError, options) {
  if (!geoIsSupported()) {
    onError({ code: 0, message: 'Geolocation not supported' });
    return;
  }
  var opts = {
    timeout: (options && options.timeout) || 10000,
    maximumAge: options && options.maximumAge !== undefined ? options.maximumAge : 5 * 60 * 1000,
    enableHighAccuracy: (options && options.enableHighAccuracy) || false,
  };
  navigator.geolocation.getCurrentPosition(
    function (position) {
      geoMarkGranted();
      onSuccess(position);
    },
    function (error) {
      if (error && error.code === 1) {
        geoClearGranted();
      }
      onError(error);
    },
    opts
  );
}

function geoErrorMessage(error) {
  if (!error) return 'Unable to get your location. Please try again.';
  switch (error.code) {
    case 1:
      return 'Location access was denied. Enable it in your browser or device settings and try again.';
    case 2:
      return 'Your location is currently unavailable. Please try again.';
    case 3:
      return 'Getting your location timed out. Please try again.';
    default:
      return 'Unable to get your location. Please try again.';
  }
}
