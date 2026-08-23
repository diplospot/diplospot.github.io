if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('./sw.js').then(function (reg) {
      if (reg.waiting) {
        showUpdateNotification(reg);
      }

      reg.addEventListener('updatefound', function () {
        var newWorker = reg.installing;
        newWorker.addEventListener('statechange', function () {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdateNotification(reg);
          }
        });
      });

      // Check for a new version now, and again whenever the tab regains focus.
      // Fire-and-forget: registration already happens on window 'load', after the
      // cache-first fetch handler has served the page, so this can't delay first paint.
      reg.update();
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') {
          reg.update();
        }
      });
    });

    var refreshing;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (refreshing) return;
      window.location.reload();
      refreshing = true;
    });
  });
}

function showUpdateNotification(reg) {
  var notification = document.getElementById('update-notification');
  if (!notification) return;

  notification.classList.remove('hidden');
  var refreshButton = notification.querySelector('.refresh-button');
  if (refreshButton) {
    refreshButton.onclick = function () {
      if (reg.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
    };
  }
}
