var NATO_PHONETIC = {
  'alfa': 'A', 'alpha': 'A', 'bravo': 'B', 'charlie': 'C', 'delta': 'D',
  'echo': 'E', 'foxtrot': 'F', 'golf': 'G', 'hotel': 'H', 'india': 'I',
  'juliet': 'J', 'juliett': 'J', 'kilo': 'K', 'lima': 'L', 'mike': 'M',
  'november': 'N', 'oscar': 'O', 'papa': 'P', 'quebec': 'Q', 'romeo': 'R',
  'sierra': 'S', 'tango': 'T', 'uniform': 'U', 'victor': 'V', 'whiskey': 'W',
  'xray': 'X', 'x-ray': 'X', 'yankee': 'Y', 'zulu': 'Z'
};

var IGNORE_WORDS = { 'the': 1, 'and': 1, 'for': 1, 'are': 1, 'but': 1, 'not': 1, 'you': 1, 'all': 1, 'can': 1, 'had': 1, 'her': 1, 'was': 1, 'one': 1, 'our': 1, 'out': 1, 'has': 1, 'his': 1, 'how': 1, 'its': 1, 'let': 1, 'may': 1, 'new': 1, 'now': 1, 'old': 1, 'see': 1, 'way': 1, 'who': 1, 'did': 1, 'get': 1, 'say': 1, 'she': 1, 'too': 1, 'use': 1, 'that': 1, 'with': 1, 'have': 1, 'this': 1, 'will': 1, 'your': 1, 'from': 1, 'they': 1, 'been': 1, 'said': 1, 'each': 1, 'make': 1, 'like': 1, 'just': 1, 'over': 1, 'such': 1, 'take': 1, 'than': 1, 'them': 1, 'very': 1, 'when': 1, 'what': 1, 'come': 1, 'code': 1, 'plate': 1 };

function parseSpokenLetters(text) {
  var words = text.toLowerCase().trim().split(/[\s,]+/).filter(Boolean);
  var letters = '';

  for (var i = 0; i < words.length; i++) {
    var word = words[i];
    if (NATO_PHONETIC[word]) {
      letters += NATO_PHONETIC[word];
    } else if (word.length === 1 && /^[a-z]$/.test(word)) {
      letters += word.toUpperCase();
    } else if (/^[a-z]{2,4}$/.test(word) && !IGNORE_WORDS[word]) {
      letters += word.toUpperCase();
    }
  }

  return letters;
}

function VoiceController(onCommand) {
  this.onCommand = onCommand;
  this.useNativeDictation = typeof MetaGlassSDK !== 'undefined' && MetaGlassSDK.isSupported;
  this.listening = false;
  this.recognition = null;
}

VoiceController.prototype.speak = function (text) {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    var utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.1;
    window.speechSynthesis.speak(utterance);
  }
};

VoiceController.prototype.stopListening = function () {
  this.listening = false;
  if (this.recognition) {
    try { this.recognition.stop(); } catch (e) {}
  }
  if (this.useNativeDictation) {
    try { MetaGlassSDK.dictation.stop(); } catch (e) {}
  }
};

VoiceController.prototype.startListening = function () {
  if (this.listening) return;
  this.listening = true;

  if (this.useNativeDictation) {
    this._startNativeDictation();
  } else {
    this._startWebSpeech();
  }
};

VoiceController.prototype._startNativeDictation = function () {
  var self = this;
  var dictation = MetaGlassSDK.dictation;

  dictation.addEventListener('result', function (e) {
    self._processInput(e.text || '');
  });

  dictation.addEventListener('stopped', function () {
    if (self.listening) {
      setTimeout(function () { dictation.start(); }, 500);
    }
  });

  dictation.addEventListener('error', function () {
    setTimeout(function () {
      if (self.listening) dictation.start();
    }, 2000);
  });

  dictation.start();
};

VoiceController.prototype._startWebSpeech = function () {
  var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return;

  var self = this;
  this.recognition = new SpeechRecognition();
  this.recognition.continuous = true;
  this.recognition.interimResults = false;
  this.recognition.lang = 'en-US';
  this.micWorking = false;

  this.recognition.onstart = function () {
    self.micWorking = true;
    console.log('[DiploSpot] Speech recognition started');
  };

  this.recognition.onresult = function (event) {
    for (var i = event.resultIndex; i < event.results.length; i++) {
      if (event.results[i].isFinal) {
        self._processInput(event.results[i][0].transcript);
      }
    }
  };

  this.recognition.onerror = function (e) {
    console.log('[DiploSpot] Speech error:', e.error);
    if (e.error === 'not-allowed' || e.error === 'service-not-available') {
      self.micWorking = false;
      self.recognition = null;
      return;
    }
    setTimeout(function () {
      if (self.listening) {
        try { self.recognition.start(); } catch (ex) {}
      }
    }, 1000);
  };

  this.recognition.onend = function () {
    if (self.listening && self.micWorking) {
      try { self.recognition.start(); } catch (e) {}
    }
  };

  try {
    this.recognition.start();
  } catch (e) {
    this.recognition = null;
  }
};

VoiceController.prototype._processInput = function (text) {
  var lower = text.toLowerCase().trim();
  if (!lower) return;

  var status = document.getElementById('status-text');
  console.log('[DiploSpot] Heard:', text);
  if (status) status.textContent = 'Heard: "' + text + '"';

  if (lower.includes('scan')) {
    this.onCommand({ type: 'scan' });
    return;
  }

  var letters = parseSpokenLetters(text);
  if (letters.length >= 2 && letters.length <= 4) {
    this.onCommand({ type: 'letters', value: letters });
  } else {
    setTimeout(function () { if (typeof updateStatus === 'function') updateStatus(); }, 2000);
  }
};
