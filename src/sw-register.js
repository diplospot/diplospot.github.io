var swRegistration = null;

if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    var hadController = !!navigator.serviceWorker.controller;

    navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then(function (reg) {
      swRegistration = reg;

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

      reg.update();
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') {
          reg.update();
        }
      });
      setInterval(function () {
        reg.update();
      }, 60 * 60 * 1000);
    }).catch(function () {});

    var refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (refreshing) return;
      if (!hadController) {
        hadController = true;
        return;
      }
      refreshing = true;
      window.location.reload();
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
