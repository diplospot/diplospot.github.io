var serverBuildEl = null;
var pendingRefreshReload = false;

function formatBuildInfo(info) {
  if (!info) return 'unknown';
  var built = info.builtAt ? new Date(info.builtAt) : null;
  var when = built && !isNaN(built.getTime()) ? built.toLocaleString() : (info.builtAt || 'unknown');
  return (info.commit ? info.commit.substring(0, 7) : 'unknown') + ' (' + when + ')';
}

// Wires a modal's close button + backdrop click to hide it, and returns
// open/close helpers.
function wireModal(modal, closeButton, onOpen) {
  var backdrop = modal.querySelector('.info-modal-backdrop');

  function close() {
    modal.classList.add('hidden');
  }

  function open() {
    if (onOpen) onOpen();
    modal.classList.remove('hidden');
  }

  if (closeButton) closeButton.addEventListener('click', close);
  if (backdrop) backdrop.addEventListener('click', close);

  return {
    open: open,
    close: close,
    isOpen: function () { return !modal.classList.contains('hidden'); }
  };
}

// Sends the active worker a CHECK_UPDATE request. Shared by opening the info
// modal (to refresh the "Server build" display) and Force Refresh (to know
// when it's safe to reload). Returns whether a request was actually sent.
function requestServerCheck() {
  if (!swRegistration || !swRegistration.active) return false;
  swRegistration.active.postMessage({ type: 'CHECK_UPDATE' });
  return true;
}

if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', function (event) {
    var data = event.data;
    if (!data) return;
    if (data.type === 'BUILD_STATUS') {
      if (serverBuildEl) serverBuildEl.textContent = formatBuildInfo(data.remote);
      pendingRefreshReload = false;
    } else if (data.type === 'UPDATE_READY') {
      if (serverBuildEl) serverBuildEl.textContent = formatBuildInfo(data.buildInfo);
      if (pendingRefreshReload) {
        pendingRefreshReload = false;
        window.location.reload();
      }
    }
  });
}

function getBuildInfo() {
  return (typeof window !== 'undefined' && window.BUILD_INFO) || null;
}

document.addEventListener('DOMContentLoaded', function () {
  var button = document.getElementById('info-button');
  var modal = document.getElementById('info-modal');
  if (!button || !modal) return;

  var repoLink = document.getElementById('info-repo-link');
  var builtAtEl = document.getElementById('info-built-at');
  var commitLink = document.getElementById('info-commit-link');
  var statusEl = document.getElementById('info-update-status');
  var refreshButton = document.getElementById('info-force-refresh');
  var buildInfo = getBuildInfo();
  serverBuildEl = document.getElementById('info-server-build');

  var infoModal = wireModal(modal, document.getElementById('info-modal-close'), function () {
    if (buildInfo) {
      if (repoLink) {
        repoLink.href = buildInfo.repoUrl;
        repoLink.textContent = buildInfo.repoUrl;
      }
      if (builtAtEl) {
        var built = new Date(buildInfo.builtAt);
        builtAtEl.textContent = isNaN(built.getTime()) ? buildInfo.builtAt : built.toLocaleString();
      }
      if (commitLink) {
        commitLink.href = buildInfo.repoUrl + '/commit/' + buildInfo.commit;
        commitLink.textContent = buildInfo.commit.substring(0, 7);
      }
    }

    if (statusEl) {
      if (swRegistration) {
        statusEl.textContent = swRegistration.waiting ? 'Update available' : 'Up to date';
        swRegistration.update();
      } else {
        statusEl.textContent = 'Unavailable';
      }
    }

    if (serverBuildEl) {
      serverBuildEl.textContent = 'Checking…';
      if (!requestServerCheck()) serverBuildEl.textContent = 'Unavailable';
    }
  });

  button.addEventListener('click', infoModal.open);
  if (refreshButton) {
    refreshButton.addEventListener('click', function () {
      if (swRegistration && swRegistration.waiting) {
        swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
      } else if (requestServerCheck()) {
        pendingRefreshReload = true;
        // reload happens from the message listener above, once UPDATE_READY arrives —
        // never reload immediately here, refreshAllAssets is async and may still be in flight.
      } else {
        window.location.reload();
      }
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && infoModal.isOpen()) {
      infoModal.close();
    }
  });
});
