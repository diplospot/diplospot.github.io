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
