function showResult(data) {
  var container = document.getElementById('result-container');

  if (data.success) {
    document.getElementById('result-type').textContent = data.prefix || '';
    document.getElementById('result-country').textContent = data.country.toUpperCase();
    container.className = 'result-card success';
  } else {
    document.getElementById('result-type').textContent = 'NOT RECOGNIZED';
    document.getElementById('result-country').textContent = '';
    container.className = 'result-card failure';
  }

  container.classList.remove('hidden');
}

function hideResult() {
  document.getElementById('result-container').classList.add('hidden');
}

function onInput() {
  var raw = document.getElementById('plate-input').value;
  var letters = raw.toUpperCase().replace(/[^A-Z]/g, '');

  if (letters.length < 2) {
    hideResult();
    return;
  }

  var result = lookupPlate(letters);
  if (result) {
    showResult({ success: true, prefix: result.prefix, country: result.country, plateCode: result.fullCode });
  } else {
    showResult({ success: false, message: 'Code "' + letters + '" not found' });
  }
}

document.addEventListener('DOMContentLoaded', function () {
  var input = document.getElementById('plate-input');
  input.addEventListener('input', onInput);
  input.focus();
});
