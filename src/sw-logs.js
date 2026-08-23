var SW_LOG_KEY = 'diplospot-sw-logs';
var MAX_LOGS = 200;
var onSwLog = null;

function loadStoredLogs() {
  try {
    var raw = localStorage.getItem(SW_LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function persistLogs(logs) {
  try {
    localStorage.setItem(SW_LOG_KEY, JSON.stringify(logs));
  } catch (e) {}
}

var swLogs = loadStoredLogs();

if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', function (event) {
    var data = event.data;
    if (!data || data.type !== 'SW_LOG') return;
    swLogs.push({ time: data.time, message: data.message });
    if (swLogs.length > MAX_LOGS) swLogs = swLogs.slice(-MAX_LOGS);
    persistLogs(swLogs);
    if (typeof onSwLog === 'function') onSwLog(swLogs);
  });
}
