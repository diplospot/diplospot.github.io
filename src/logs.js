document.addEventListener('DOMContentLoaded', function () {
  var contentEl = document.getElementById('logs-content');
  var refreshButton = document.getElementById('logs-refresh');
  var clearButton = document.getElementById('logs-clear');
  if (!contentEl) return;

  function render() {
    contentEl.textContent = swLogs.length ? swLogs.map(function (e) {
      return '[' + e.time + '] ' + e.message;
    }).join('\n') : 'No logs yet.';
    contentEl.scrollTop = contentEl.scrollHeight;
  }

  onSwLog = render;
  render();

  if (refreshButton) {
    refreshButton.addEventListener('click', function () {
      swLogs = loadStoredLogs();
      render();
    });
  }
  if (clearButton) {
    clearButton.addEventListener('click', function () {
      swLogs = [];
      persistLogs(swLogs);
      render();
    });
  }
});
