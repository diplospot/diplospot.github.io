var CACHE_NAME = 'diplospot-v4';
var ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './buildinfo.js',
  './icon-192.png',
  './icon-512.png',
  './favicon-32.png',
  './favicon-16.png',
  './favicon.png'
];

function log(message) {
  try { console.log('[sw]', message); } catch (e) {}
  notifyClients({ type: 'SW_LOG', message: message, time: new Date().toISOString() });
}

function notifyClients(msg) {
  return self.clients.matchAll({ includeUncontrolled: true }).then(function (clients) {
    clients.forEach(function (c) { c.postMessage(msg); });
  }).catch(function () {});
}

function parseBuildInfo(text) {
  try {
    var start = text.indexOf('{');
    var end = text.lastIndexOf('}');
    return JSON.parse(text.slice(start, end + 1));
  } catch (e) {
    return null;
  }
}

function getCachedBuildInfo() {
  return caches.open(CACHE_NAME).then(function (cache) {
    return cache.match('./buildinfo.js');
  }).then(function (cached) {
    return cached ? cached.text() : null;
  }).then(function (text) {
    return text ? parseBuildInfo(text) : null;
  });
}

function checkForUpdate() {
  return fetch('./buildinfo.js', { cache: 'no-store' }).then(function (res) {
    return res.text();
  }).then(function (text) {
    var remote = parseBuildInfo(text);
    if (!remote) return;
    return getCachedBuildInfo().then(function (current) {
      if (!current || current.commit !== remote.commit) {
        log('new build detected: ' + remote.commit + ' (was ' + (current && current.commit) + ')');
        return refreshAllAssets(remote);
      }
      log('up to date: ' + remote.commit);
      return notifyClients({ type: 'BUILD_STATUS', local: current, remote: remote, refreshed: false });
    });
  }).catch(function (e) {
    log('update check failed: ' + e);
  });
}

function refreshAllAssets(remote) {
  return caches.open(CACHE_NAME).then(function (cache) {
    return Promise.all(ASSETS.map(function (url) {
      return fetch(url, { cache: 'reload' }).then(function (res) {
        if (res && res.status === 200) {
          log('refreshed ' + url);
          return cache.put(url, res);
        }
      }).catch(function (e) {
        log('refresh FAILED: ' + url + ' - ' + e);
      });
    }));
  }).then(function () {
    log('refresh complete for ' + remote.commit);
    return notifyClients({ type: 'UPDATE_READY', buildInfo: remote });
  });
}

self.addEventListener('install', function (event) {
  log('install: starting, CACHE_NAME=' + CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return Promise.all(ASSETS.map(function (url) {
        return cache.add(url).then(function () {
          log('precached ' + url);
        }).catch(function (e) {
          log('precache FAILED: ' + url + ' - ' + e);
        });
      }));
    }).then(function () {
      log('install: complete');
    })
  );
});

self.addEventListener('activate', function (event) {
  log('activate: starting');
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(
        names.filter(function (name) { return name !== CACHE_NAME; })
          .map(function (name) {
            log('deleting old cache: ' + name);
            return caches.delete(name);
          })
      );
    }).then(function () {
      log('activate: clients.claim()');
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (event) {
  if (event.request.mode === 'navigate') {
    event.waitUntil(checkForUpdate());
  }
  event.respondWith(
    caches.match(event.request).then(function (response) {
      if (response) {
        return response;
      }
      return fetch(event.request).then(function (networkResponse) {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }
        var responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then(function (cache) {
          cache.put(event.request, responseToCache);
        }).catch(function () {});
        return networkResponse;
      });
    })
  );
});

self.addEventListener('message', function (event) {
  if (!event.data) return;
  if (event.data.type === 'SKIP_WAITING') {
    log('SKIP_WAITING received');
    self.skipWaiting();
  } else if (event.data.type === 'CHECK_UPDATE') {
    checkForUpdate();
  }
});
