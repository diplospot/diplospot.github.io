function showResult(data) {
  var container = document.getElementById('result-container');

  if (data.success) {
    document.getElementById('result-type').textContent = data.prefix || '';
    document.getElementById('result-country').textContent = data.country.toUpperCase();
    container.className = 'result-card success';
  } else {
    var raw = document.getElementById('plate-input').value;
    var letters = raw.toUpperCase().replace(/[^A-Z]/g, '');
    var searchUrl = 'https://www.google.com/search?q=US+diplomatic+license+plate+starts+with+' + letters;
    document.getElementById('result-type').innerHTML = '<a href="' + searchUrl + '" target="_blank" rel="noopener">NOT RECOGNIZED</a>';
    document.getElementById('result-country').textContent = '';
    container.className = 'result-card failure';
  }

  container.classList.remove('hidden');
}

function hideResult() {
  document.getElementById('result-container').classList.add('hidden');
}

function onInput() {
  var input = document.getElementById('plate-input');
  var raw = input.value;
  var letters = raw.toUpperCase().replace(/[^A-Z]/g, '');

  if (letters.length > 0) {
    var firstLetter = letters[0];
    var isSpecial = firstLetter === 'C' || firstLetter === 'D' || firstLetter === 'S';
    if (!isSpecial) {
      input.maxLength = 2;
      if (letters.length > 2) {
        letters = letters.substring(0, 2);
        input.value = letters;
      }
    } else {
      input.maxLength = 3;
    }
  } else {
    input.maxLength = 3;
  }

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
