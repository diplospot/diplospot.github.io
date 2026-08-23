function getBuildInfo() {
  var el = document.getElementById('build-info');
  if (!el) return null;
  try {
    return JSON.parse(el.textContent);
  } catch (e) {
    return null;
  }
}

document.addEventListener('DOMContentLoaded', function () {
  var button = document.getElementById('info-button');
  var modal = document.getElementById('info-modal');
  if (!button || !modal) return;

  var closeButton = document.getElementById('info-modal-close');
  var backdrop = modal.querySelector('.info-modal-backdrop');
  var refreshButton = document.getElementById('info-force-refresh');
  var repoLink = document.getElementById('info-repo-link');
  var builtAtEl = document.getElementById('info-built-at');
  var commitLink = document.getElementById('info-commit-link');
  var statusEl = document.getElementById('info-update-status');
  var buildInfo = getBuildInfo();

  function openModal() {
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

    modal.classList.remove('hidden');
  }

  function closeModal() {
    modal.classList.add('hidden');
  }

  button.addEventListener('click', openModal);
  if (closeButton) closeButton.addEventListener('click', closeModal);
  if (backdrop) backdrop.addEventListener('click', closeModal);
  if (refreshButton) {
    refreshButton.addEventListener('click', function () {
      window.location.reload();
    });
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
      closeModal();
    }
  });
});
