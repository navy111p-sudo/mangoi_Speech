/**
 * ===========================
 * Mangoi Speech Coach - main.js
 * 영어 발음 교정 학습 도구
 * BTS 레벨별 회화 문장 + 뮼국 원어민 TTS
 * ===========================
 * 크로스브라우저 호환: IE11, Edge, Firefox, Safari, Chrome, Samsung Internet
 * ES5 호환 코드 (var, function, no arrow, no template literal, no async/await)
 */

// =====================h
// 0. 폴리필 (IE11 등 구형 브라우저 지원)
// =====================

// Array.prototype.includes 폴리필
if (!Array.prototype.includes) {
  Array.prototype.includes = function (search, start) {
    if (typeof start !== "number") start = 0;
    if (start < 0) start = Math.max(0, this.length + start);
    for (var i = start; i < this.length; i++) {
      if (this[i] === search) return true;
    }
    return false;
  };
}

// Array.prototype.find 폴리필
if (!Array.prototype.find) {
  Array.prototype.find = function (callback) {
    for (var i = 0; i < this.length; i++) {
      if (callback(this[i], i, this)) return this[i];
    }
    return undefined;
  };
}

// String.prototype.includes 폴리필
if (!String.prototype.includes) {
  String.prototype.includes = function (search, start) {
    if (typeof start !== "number") start = 0;
    return this.indexOf(search, start) !== -1;
  };
}

// String.prototype.startsWith 폴리필
if (!String.prototype.startsWith) {
  String.prototype.startsWith = function (search, pos) {
    pos = !pos || pos < 0 ? 0 : +pos;
    return this.substring(pos, pos + search.length) === search;
  };
}

// String.prototype.trim 폴리필 (IE8 이하)
if (!String.prototype.trim) {
  String.prototype.trim = function () {
    return this.replace(/^\s+|\s+$/g, "");
  };
}

// Object.keys 폴리필 (IE9 이하)
if (!Object.keys) {
  Object.keys = function (obj) {
    var keys = [];
    for (var key in obj) {
      if (obj.hasOwnProperty(key)) keys.push(key);
    }
    return keys;
  };
}

// Number.prototype.toFixed 안전 릴퍨
var safeToFixed = function (num, digits) {
  if (typeof num !== "number" || isNaN(num)) return "0.0";
  try {
    return num.toFixed(digits);
  } catch (e) {
    return String(Math.round(num * Math.pow(10, digits)) / Math.pow(10, digits));
  }
};

// smoothScroll 헬퍼 (scrollIntoView smooth 뮼지원 브라우저용)
function smoothScrollTo(element, block) {
  if (!element) return;
  try {
    element.scrollIntoView({ behavior: "smooth", block: block || "start" });
  } catch (e) {
    // IE/구형 브라우저: 옵션 미지원 시 기본 스크롤
    try {
      element.scrollIntoView(block === "center" ? true : false);
    } catch (e2) {
      window.scrollTo(0, element.offsetTop || 0);
    }
  }
}

// 크로스브라우저 이벤트 바인딩 헬퍼
function addEvent(el, type, handler) {
  if (!el) return;
  if (el.addEventListener) {
    el.addEventListener(type, handler, false);
  } else if (el.attachEvent) {
    el.attachEvent("on" + type, handler);
  } else {
    el["on" + type] = handler;
  }
}

// Promise 폴리필 (IE11 등)
if (typeof Promise === "undefined") {
  window.Promise = function (executor) {
    var self = this;
    self._state = "pending";
    self._value = undefined;
    self._callbacks = [];

    function resolve(value) {
      if (self._state !== "pending") return;
      self._state = "fulfilled";
      self._value = value;
      for (var i = 0; i < self._callbacks.length; i++) {
        var cb = self._callbacks[i];
        if (cb.onFulfilled) {
          try { cb.onFulfilled(self._value); } catch (e) { if (cb.onRejected) cb.onRejected(e); }
        }
      }
    }

    function reject(reason) {
      if (self._state !== "pending") return;
      self._state = "rejected";
      self._value = reason;
      for (var i = 0; i < self._callbacks.length; i++) {
        var cb = self._callbacks[i];
        if (cb.onRejected) cb.onRejected(self._value);
      }
    }

    self.then = function (onFulfilled, onRejected) {
      return new Promise(function (res, rej) {
        var callback = {
          onFulfilled: function (val) {
            try {
              var result = onFulfilled ? onFulfilled(val) : val;
              if (result && typeof result.then === "function") {
                result.then(res, rej);
              } else {
                res(result);
              }
            } catch (e) { rej(e); }
          },
          onRejected: function (reason) {
            try {
              if (onRejected) {
                var result = onRejected(reason);
                res(result);
              } else {
                rej(reason);
              }
            } catch (e) { rej(e); }
          }
        };

        if (self._state === "fulfilled") {
          setTimeout(function () { callback.onFulfilled(self._value); }, 0);
        } else if (self._state === "rejected") {
          setTimeout(function () { callback.onRejected(self._value); }, 0);
        } else {
          self._callbacks.push(callback);
        }
      });
    };

    self["catch"] = function (onRejected) {
      return self.then(null, onRejected);
    };

    try {
      executor(resolve, reject);
    } catch (e) {
      reject(e);
    }
  };

  Promise.resolve = function (val) {
    return new Promise(function (resolve) { resolve(val); });
  };

  Promise.reject = function (reason) {
    return new Promise(function (_, reject) { reject(reason); });
  };
}

// =====================
// 1. 전역 변수 및 설정
// =====================
var currentLevelKey = null;
var currentLevelSentences = [];

var state = {
  currentSentence: "",
  currentAttempt: 1,
  maxAttempts: 3,
  isRecording: false,
  attempts: [],
  recognition: null,
  recordingStartTime: null,
  radarChart: null
};

// =====================
// 2. DOM 요소 참조
// =====================
var DOM = {};

function initDOM() {
  DOM.levelSelect = document.getElementById("levelSelect");
  DOM.levelInfo = document.getElementById("levelInfo");
  DOM.targetSentence = document.getElementById("targetSentence");
  DOM.btnChangeSentence = document.getElementById("btnChangeSentence");
  DOM.btnListenTarget = document.getElementById("btnListenTarget");
  DOM.btnRecord = document.getElementById("btnRecord");
  DOM.recorderStatus = document.getElementById("recorderStatus");
  DOM.attemptDots = document.getElementById("attemptDots");
  DOM.waveAnimation = document.getElementById("waveAnimation");
  DOM.recognizedText = document.getElementById("recognizedText");
  DOM.feedbackSection = document.getElementById("feedbackSection");
  DOM.originalText = document.getElementById("originalText");
  DOM.correctedText = document.getElementById("correctedText");
  DOM.errorList = document.getElementById("errorList");
  DOM.btnListenCorrected = document.getElementById("btnListenCorrected");
  DOM.btnNextAttempt = document.getElementById("btnNextAttempt");
  DOM.reportSection = document.getElementById("reportSection");
  DOM.scorePronunciation = document.getElementById("scorePronunciation");
  DOM.scoreGrammar = document.getElementById("scoreGrammar");
  DOM.scoreFluency = document.getElementById("scoreFluency");
  DOM.scoreAverage = document.getElementById("scoreAverage");
  DOM.gradeDisplay = document.getElementById("gradeDisplay");
  DOM.radarChart = document.getElementById("radarChart");
  DOM.historyTableBody = document.getElementById("historyTableBody");
  DOM.btnRestart = document.getElementById("btnRestart");
  DOM.browserSupport = document.getElementById("browserSupport");
  DOM.feedbackModal = document.getElementById("feedbackModal");
  DOM.btnCloseModal = document.getElementById("btnCloseModal");
  DOM.modalScorePronunciation = document.getElementById("modalScorePronunciation");
  DOM.modalScoreGrammar = document.getElementById("modalScoreGrammar");
  DOM.modalScoreFluency = document.getElementById("modalScoreFluency");
  DOM.modalOriginalText = document.getElementById("modalOriginalText");
  DOM.modalCorrectedText = document.getElementById("modalCorrectedText");
  DOM.modalErrorList = document.getElementById("modalErrorList");
  DOM.btnPlayCorrectedModal = document.getElementById("btnPlayCorrectedModal");
}

// =====================
// 3. 초기화
// =====================
function init() {
  initDOM();
  if (!checkBrowserSupport()) return;
  initLevelSelect();
  setupSpeechRecognition();
  bindEvents();
  updateAttemptUI();
  addEvent(window, "click", function (e) {
    if (e.target === DOM.feedbackModal) closeModal();
  });
}

/**
 * 레벨 선택 초기화 (BTS + SIU + Phonics)
 */
function initLevelSelect() {
  if (!DOM.levelSelect) return;
  var allSets = [
    {name: "BTS", data: typeof BTS_SENTENCES !== "undefined" ? BTS_SENTENCES : {}},
    {name: "SIU Basic", data: typeof SIU_BASIC_SENTENCES !== "undefined" ? SIU_BASIC_SENTENCES : {}},
    {name: "SIU Advance", data: typeof SIU_ADVANCE_SENTENCES !== "undefined" ? SIU_ADVANCE_SENTENCES : {}},
    {name: "Phonics", data: typeof PHONICS_SENTENCES !== "undefined" ? PHONICS_SENTENCES : {}}
  ];
  for (var s = 0; s < allSets.length; s++) {
    var setData = allSets[s];
    var keys = Object.keys(setData.data);
    if (keys.length === 0) continue;
    var optgroup = document.createElement("optgroup");
    optgroup.label = setData.name;
    for (var k = 0; k < keys.length; k++) {
      var key = keys[k];
      var level = setData.data[key];
      var option = document.createElement("option");
      option.value = key;
      option.textContent = key + " - " + level.title;
      optgroup.appendChild(option);
    }
    DOM.levelSelect.appendChild(optgroup);
  }
  addEvent(DOM.levelSelect, "change", handleLevelChange);
  DOM.levelSelect.value = "BTS 1";
  handleLevelChange();
}

/**
 * 문장 데이터 찾기 (BTS, SIU, Phonics 모두 검색)
 */
function findSentenceData(key) {
  if (typeof BTS_SENTENCES !== "undefined" && BTS_SENTENCES[key]) return BTS_SENTENCES[key];
  if (typeof SIU_BASIC_SENTENCES !== "undefined" && SIU_BASIC_SENTENCES[key]) return SIU_BASIC_SENTENCES[key];
  if (typeof SIU_ADVANCE_SENTENCES !== "undefined" && SIU_ADVANCE_SENTENCES[key]) return SIU_ADVANCE_SENTENCES[key];
  if (typeof PHONICS_SENTENCES !== "undefined" && PHONICS_SENTENCES[key]) return PHONICS_SENTENCES[key];
  return null;
}

/**
 * 레벨 변경 처리
 */
function handleLevelChange() {
  var selectedKey = DOM.levelSelect ? DOM.levelSelect.value : "";
  var level = selectedKey ? findSentenceData(selectedKey) : null;
  if (!level) {
    currentLevelKey = null;
    currentLevelSentences = ALL_SENTENCES;
    if (DOM.levelInfo) {
      DOM.levelInfo.textContent = "전체 BTS 문장 (" + ALL_SENTENCES.length + "문장)";
    }
  } else {
    currentLevelKey = selectedKey;
    currentLevelSentences = level.sentences;
    if (DOM.levelInfo) {
      DOM.levelInfo.textContent = level.topic + " (" + level.sentences.length + "문장)";
    }
  }
  var randomSentence = currentLevelSentences[
    Math.floor(Math.random() * currentLevelSentences.length)
  ];
  state.currentSentence = randomSentence;
  state.currentAttempt = 1;
  state.attempts = [];
  state.isRecording = false;
  updateAttemptUI();
  if (DOM.feedbackSection) DOM.feedbackSection.classList.remove("is-visible");
  if (DOM.reportSection) DOM.reportSection.classList.remove("is-visible");
  if (DOM.btnNextAttempt) DOM.btnNextAttempt.classList.remove("is-visible");
  if (DOM.targetText) DOM.targetText.textContent = state.currentSentence;
  if (DOM.recognizedText) DOM.recognizedText.textContent = "";
}

/**
 * 브라우저 지원 확인 - 크로스브라우저 대응
 */
function checkBrowserSupport() {
  var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  var hasTTS = !!(window.speechSynthesis);
  var hasSTT = !!SpeechRecognition;

  if (!hasSTT && !hasTTS) {
    // 둘 다 미지원 (IE11 등)
    if (DOM.browserSupport) {
      DOM.browserSupport.textContent = "미지원 브라우저";
      DOM.browserSupport.style.background = "rgba(239, 68, 68, 0.3)";
    }
    if (DOM.btnRecord) DOM.btnRecord.disabled = true;
    if (DOM.recorderStatus) {
      DOM.recorderStatus.textContent =
        "이 브라우저는 음성 기능을 지원하지 욈습니다. Chrome, Edge, 또는 Safari를 사용해주세요.";
    }
    return false;
  }

  if (!hasSTT && hasTTS) {
    // Firefox 등: TTS만 지원, STT 미지원
    if (DOM.browserSupport) {
      DOM.browserSupport.textContent = "부분 지원";
      DOM.browserSupport.style.background = "rgba(245, 158, 11, 0.3)";
    }
    if (DOM.btnRecord) DOM.btnRecord.disabled = true;
    if (DOM.recorderStatus) {
      DOM.recorderStatus.textContent =
        "이 브라우저는 음성인식(녹음)을 지원하지 않습니다. 원어민 발음 듣기는 가능합니다. 녹음은 Chrome 또는 Edge를 사용해주세요.";
    }
    return true;
  }

  if (DOM.browserSupport) {
    DOM.browserSupport.textContent = "지원됨";
    DOM.browserSupport.style.background = "rgba(16, 185, 129, 0.3)";
  }
  return true;
}

function setupSpeechRecognition() {
  var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    state.recognition = null;
    return;
  }
  state.recognition = new SpeechRecognition();
  state.recognition.lang = "en-US";
  state.recognition.interimResults = true;
  state.recognition.maxAlternatives = 1;
  state.recognition.continuous = false;
  state.recognition.onresult = handleRecognitionResult;
  state.recognition.onend = handleRecognitionEnd;
  state.recognition.onerror = handleRecognitionError;
  state.recognition.onstart = function () {
    state.recordingStartTime = Date.now();
  };
}

function bindEvents() {
  addEvent(DOM.btnRecord, "click", toggleRecording);
  addEvent(DOM.btnChangeSentence, "click", changeSentence);
  addEvent(DOM.btnListenTarget, "click", listenToTarget);
  addEvent(DOM.btnListenCorrected, "click", listenToCorrected);
  addEvent(DOM.btnNextAttempt, "click", nextAttempt);
  addEvent(DOM.btnRestart, "click", restart);
  addEvent(DOM.btnCloseModal, "click", closeModal);
  addEvent(DOM.btnPlayCorrectedModal, "click", function () {
    var text = DOM.modalCorrectedText ? DOM.modalCorrectedText.textContent : "";
    if (text) speak(text);
  });
}

// =====================
// 4. 음성인식 (Speech-to-Text) - 크로스브라우저
// =====================
function toggleRecording() {
  if (!state.recognition) {
    alert("이 브라우저는 음성인식을 지원하지 욈습니다.\nChrome, Edge, 또는 Safari를 사용해주세요.");
    return;
  }
  if (state.isRecording) {
    stopRecording();
  } else {
    startRecording();
  }
}

function startRecording() {
  state.isRecording = true;
  if (DOM.btnRecord) DOM.btnRecord.classList.add("is-recording");
  if (DOM.waveAnimation) DOM.waveAnimation.classList.add("is-active");
  if (DOM.recorderStatus) DOM.recorderStatus.textContent = "듣고 있어요... 영어로 말해주세요";
  if (DOM.recognizedText) {
    DOM.recognizedText.textContent = "";
    DOM.recognizedText.classList.remove("recorder__text--empty");
  }
  if (DOM.feedbackSection) DOM.feedbackSection.classList.remove("is-visible");
  try {
    state.recognition.start();
  } catch (e) {
    console.warn("음성인식 시작 에러:", e);
  }
}

function stopRecording() {
  state.isRecording = false;
  if (DOM.btnRecord) DOM.btnRecord.classList.remove("is-recording");
  if (DOM.waveAnimation) DOM.waveAnimation.classList.remove("is-active");
  if (state.recognition) {
    state.recognition.stop();
  }
}

function handleRecognitionResult(event) {
  var interimTranscript = "";
  var finalTranscript = "";
  for (var i = event.resultIndex; i < event.results.length; i++) {
    var result = event.results[i];
    if (result.isFinal) {
      finalTranscript += result[0].transcript;
    } else {
      interimTranscript += result[0].transcript;
    }
  }
  if (finalTranscript) {
    if (DOM.recognizedText) DOM.recognizedText.textContent = finalTranscript;
  } else {
    if (DOM.recognizedText) {
      DOM.recognizedText.textContent = interimTranscript;
      DOM.recognizedText.style.opacity = "0.6";
    }
  }
}

function handleRecognitionEnd() {
  state.isRecording = false;
  if (DOM.btnRecord) DOM.btnRecord.classList.remove("is-recording");
  if (DOM.waveAnimation) DOM.waveAnimation.classList.remove("is-active");
  if (DOM.recognizedText) DOM.recognizedText.style.opacity = "1";

  // MediaRecorder 자동 중지 (my-recording-playback.js 연동)
  if (window._myRecordingPlayback && typeof window._stopMediaRecorder === "function") {
    window._stopMediaRecorder();
  }

  var spokenText = DOM.recognizedText ? DOM.recognizedText.textContent.trim() : "";
  if (spokenText && spokenText !== "음성 인시 결과가 여기에 표시됩니다") {
    if (DOM.recorderStatus) DOM.recorderStatus.textContent = "분석 중...";
    evaluateSpeech(spokenText);
  } else {
    if (DOM.recorderStatus) {
      DOM.recorderStatus.textContent =
        "시도 " + state.currentAttempt + "/" + state.maxAttempts +
        " - 음성이 인식되지 않았습니다. 다시 시도해주세요.";
    }
    if (DOM.recognizedText) {
      DOM.recognizedText.textContent = "음성 인식 결과가 여기에 표시됩니다";
      DOM.recognizedText.classList.add("recorder__text--empty");
    }
  }
}

function handleRecognitionError(event) {
  state.isRecording = false;
  if (DOM.btnRecord) DOM.btnRecord.classList.remove("is-recording");
  if (DOM.waveAnimation) DOM.waveAnimation.classList.remove("is-active");
  var errorMessage = "";
  switch (event.error) {
    case "no-speech":
      errorMessage = "음성이 감지되지 않았습니다. 마이크에 대고 말해주세요.";
      break;
    case "audio-capture":
      errorMessage = "마이크를 찾을 수 없습니다. 마이크를 연결해주세요.";
      break;
    case "not-allowed":
      errorMessage = "마이크 권한이 거부되었습니다. 브라우저 설정에서 마이크를 허용해주세요.";
      break;
    default:
      errorMessage = "음성인식 오류가 발생했습니다: " + event.error;
  }
  if (DOM.recorderStatus) DOM.recorderStatus.textContent = errorMessage;
}

// =====================
// 5. 평가 시스템 - Promise 기반 (async/await 대신)
// =====================
function evaluateSpeech(spokenText) {
  checkGrammar(spokenText).then(function (grammarResult) {
    var pronunciationScore = calculatePronunciationScore(spokenText, state.currentSentence);
    var grammarScore = calculateGrammarScore(grammarResult.matches);
    var fluencyScore = calculateFluencyScore(spokenText, state.currentSentence);
    var contentRelevance = Math.min(pronunciationScore, fluencyScore) / 100; if (contentRelevance < 0.1) grammarScore = Math.round(grammarScore * 0.2); else if (contentRelevance < 0.2) grammarScore = Math.round(grammarScore * 0.4); else if (contentRelevance < 0.3) grammarScore = Math.round(grammarScore * 0.6); var averageScore = Math.round(((pronunciationScore + grammarScore + fluencyScore) / 3) * 10) / 10;
    var correctedSentence = state.currentSentence

    var attemptResult = {
      attempt: state.currentAttempt,
      spokenText: spokenText,
      correctedText: correctedSentence,
      errors: grammarResult.matches,
      scores: {
        pronunciation: pronunciationScore,
        grammar: grammarScore,
        fluency: fluencyScore,
        average: averageScore
      }
    };
    state.attempts.push(attemptResult);
    showFeedback(attemptResult);
  })["catch"](function (error) {
    console.error("평가 중 오류:", error);
    if (DOM.recorderStatus) DOM.recorderStatus.textContent = "평가 중 오류가 발생했습니다. 다시 시도해주세요.";
  });
}

/**
 * 문법 체크 - fetch + XMLHttpRequest 폴백
 */
function checkGrammar(text) {
  var body = "text=" + encodeURIComponent(text) + "&language=en-US&enabledOnly=false";

  // fetch 지원 시
  if (window.fetch) {
    return fetch("https://api.languagetool.org/v2/check", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body
    }).then(function (response) {
      if (!response.ok) throw new Error("API 응답 오류: " + response.status);
      return response.json();
    })["catch"](function (error) {
      console.warn("LanguageTool API 호출 실패:", error);
      return { matches: performBasicGrammarCheck(text) };
    });
  }

  // fetch 미지원 (IE11 등): XMLHttpRequest 사용
  return new Promise(function (resolve) {
    try {
      var xhr = new XMLHttpRequest();
      xhr.open("POST", "https://api.languagetool.org/v2/check", true);
      xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
      xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
          if (xhr.status === 200) {
            try {
              resolve(JSON.parse(xhr.responseText));
            } catch (e) {
              resolve({ matches: performBasicGrammarCheck(text) });
            }
          } else {
            resolve({ matches: performBasicGrammarCheck(text) });
          }
        }
      };
      xhr.onerror = function () {
        resolve({ matches: performBasicGrammarCheck(text) });
      };
      xhr.send(body);
    } catch (e) {
      resolve({ matches: performBasicGrammarCheck(text) });
    }
  });
}

function performBasicGrammarCheck(text) {
  var errors = [];
  if (text.length > 0 && text[0] !== text[0].toUpperCase()) {
    errors.push({
      message: "This sentence does not start with an uppercase letter.",
      shortMessage: "Capitalization",
      offset: 0,
      length: 1,
      replacements: [{ value: text[0].toUpperCase() }],
      rule: { id: "UPPERCASE_SENTENCE_START", description: "문장은 대문자로 시작해야 합니다." }
    });
  }
  var lastChar = text.trim().slice(-1);
  if ([".", "!", "?"].indexOf(lastChar) === -1) {
    errors.push({
      message: "This sentence does not end with proper punctuation.",
      shortMessage: "Punctuation",
      offset: text.length - 1,
      length: 1,
      replacements: [{ value: text.trim() + "." }],
      rule: { id: "SENTENCE_END_PUNCT", description: "문장은 마침표, 문음표, 느낼표로 끝나야 합니다." }
    });
  }
  if (/ {2,}/.test(text)) {
    errors.push({
      message: "There are multiple spaces in a row.",
      shortMessage: "Extra space",
      offset: text.indexOf("  "),
      length: 2,
      replacements: [{ value: " " }],
      rule: { id: "DOUBLE_SPACE", description: "불필요한 공백이 있습니다." }
    });
  }
  return errors;
}

// ===== IMPROVED SCORING FUNCTIONS =====

// 1. Enhanced Pronunciation Score with phonetic awareness
function calculatePronunciationScore(spoken, target) {
    var spokenClean = spoken.toLowerCase().replace(/[^a-z0-9\s']/g, '').trim();
    var targetClean = target.toLowerCase().replace(/[^a-z0-9\s']/g, '').trim();

    var spokenWords = spokenClean.split(/\s+/).filter(function(w) { return w.length > 0; });
    var targetWords = targetClean.split(/\s+/).filter(function(w) { return w.length > 0; });

    if (targetWords.length === 0) return 0;

    // Word-by-word matching with fuzzy comparison
    var totalScore = 0;
    var matchDetails = [];

    for (var i = 0; i < targetWords.length; i++) {
        var targetWord = targetWords[i];
        var bestScore = 0;
        var bestMatch = '';

        // Search in a window around the expected position
        var searchStart = Math.max(0, i - 1);
        var searchEnd = Math.min(spokenWords.length, i + 2);

        for (var j = searchStart; j < searchEnd; j++) {
            var score = getWordSimilarity(spokenWords[j], targetWord);
            if (score > bestScore) {
                bestScore = score;
                bestMatch = spokenWords[j];
            }
        }

        // Also check exact match anywhere (for reordered words)
        for (var k = 0; k < spokenWords.length; k++) {
            if (spokenWords[k] === targetWord && targetWord.length > 3) {
                bestScore = 1.0;
                bestMatch = spokenWords[k];
                break;
            }
        }

        totalScore += bestScore;
        matchDetails.push({
            target: targetWord,
            spoken: bestMatch,
            score: bestScore
        });
    }

    // Store match details for feedback display
    state.lastMatchDetails = matchDetails;

    var avgScore = totalScore / targetWords.length;

    // Overall string similarity as secondary factor
    var stringSim = calculateSimilarity(spokenClean, targetClean);

    // Weighted combination: 70% word matching + 30% string similarity
    var missingPen = spokenWords.length < targetWords.length * 0.5 ? 0.4 : (spokenWords.length < targetWords.length * 0.75 ? 0.7 : 1.0); var rawScore = (avgScore * 0.8 + stringSim * 0.2) * missingPen * 100; if (stringSim < 0.2 && avgScore < 0.3) rawScore = Math.min(rawScore, 5); else if (stringSim < 0.3 && avgScore < 0.4) rawScore = Math.min(rawScore, 15); else if (stringSim < 0.4 && avgScore < 0.5) rawScore = Math.min(rawScore, 25);

    return Math.round(Math.min(100, Math.max(0, rawScore)));
}
// Enhanced word similarity with phonetic awareness
function getWordSimilarity(word1, word2) {
    if (!word1 || !word2) return 0;
    if (word1 === word2) return 1.0;

    // Basic edit distance similarity
    var editSim = 1 - (levenshteinDistance(word1, word2) / Math.max(word1.length, word2.length));

    // Phonetic similarity (simplified)
    var phoneSim = getPhoneticSimilarity(word1, word2);

    // Starting sound bonus (important for pronunciation)
    var startBonus = 0;
    if (word1.charAt(0) === word2.charAt(0)) startBonus = 0.1;
    if (word1.substring(0, 2) === word2.substring(0, 2)) startBonus = 0.15;

    // Combine: 50% edit distance + 35% phonetic + 15% start bonus
    var sim = Math.min(1.0, editSim * 0.5 + phoneSim * 0.35 + startBonus); return sim < 0.5 ? 0 : (sim < 0.7 ? sim * 0.6 : sim);
}

// Levenshtein distance
function levenshteinDistance(s1, s2) {
    var len1 = s1.length, len2 = s2.length;
    var matrix = [];
    for (var i = 0; i <= len1; i++) {
        matrix[i] = [i];
    }
    for (var j = 0; j <= len2; j++) {
        matrix[0][j] = j;
    }
    for (var i = 1; i <= len1; i++) {
        for (var j = 1; j <= len2; j++) {
            var cost = s1.charAt(i-1) === s2.charAt(j-1) ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i-1][j] + 1,
                matrix[i][j-1] + 1,
                matrix[i-1][j-1] + cost
            );
        }
    }
    return matrix[len1][len2];
}

// Simplified phonetic similarity using common English sound groups
function getPhoneticSimilarity(word1, word2) {
    var p1 = simplifiedPhonetic(word1);
    var p2 = simplifiedPhonetic(word2);
    if (p1 === p2) return 1.0;
    return 1 - (levenshteinDistance(p1, p2) / Math.max(p1.length, p2.length, 1));
}

function simplifiedPhonetic(word) {
    return word.toLowerCase()
        .replace(/ph/g, 'f')
        .replace(/th/g, 'T')
        .replace(/sh/g, 'S')
        .replace(/ch/g, 'C')
        .replace(/ck/g, 'k')
        .replace(/ght/g, 't')
        .replace(/tion/g, 'Sn')
        .replace(/sion/g, 'Sn')
        .replace(/ous/g, 'us')
        .replace(/ight/g, 'it')
        .replace(/ough/g, 'o')
        .replace(/wr/g, 'r')
        .replace(/kn/g, 'n')
        .replace(/gn/g, 'n')
        .replace(/mb$/g, 'm')
        .replace(/wh/g, 'w')
        .replace(/([aeiou])\1+/g, '$1')
        .replace(/([^aeiou])\1+/g, '$1');
}
// 2. Improved calculateSimilarity (Levenshtein-based, normalized)
function calculateSimilarity(str1, str2) {
    if (str1 === str2) return 1;
    var len1 = str1.length, len2 = str2.length;
    if (len1 === 0 || len2 === 0) return 0;
    var dist = levenshteinDistance(str1, str2);
    return 1 - (dist / Math.max(len1, len2));
}

// 3. Improved Grammar Score
function calculateGrammarScore(matches) {
    if (!matches || matches.length === 0) return 100;
    // Weight errors by severity
    var totalPenalty = 0;
    for (var i = 0; i < matches.length; i++) {
        var m = matches[i];
        var type = (m.rule && m.rule.category && m.rule.category.id) || '';
        if (type.indexOf('GRAMMAR') !== -1) totalPenalty += 20;
        else if (type.indexOf('TYPOS') !== -1) totalPenalty += 12;
        else if (type.indexOf('PUNCTUATION') !== -1) totalPenalty += 3;
        else totalPenalty += 15;
    }
    return Math.max(0, Math.round(100 - totalPenalty));
}

// 4. Improved Fluency Score
function calculateFluencyScore(spoken, target) {
    var spokenWords = spoken.trim().split(/\s+/).filter(function(w) { return w.length > 0; });
    var targetWords = target.trim().split(/\s+/).filter(function(w) { return w.length > 0; });

    if (targetWords.length === 0) return 0;

    // Completeness: how many target words were spoken
    var spkL=spokenWords.map(function(w){return w.toLowerCase();}); var tgtL=targetWords.map(function(w){return w.toLowerCase();}); var mc=0; var used={}; for(var ci=0;ci<tgtL.length;ci++){for(var cj=0;cj<spkL.length;cj++){if(!used[cj]&&spkL[cj]===tgtL[ci]){mc++;used[cj]=true;break;}}} var completeness = mc / targetWords.length;

    // Word order: check if words appear in similar order
    var orderScore = calculateWordOrder(spokenWords, targetWords);

    // Speed/Duration analysis
    var speedScore = 1.0;
    if (state.recordingStartTime) {
        var durationSec = (Date.now() - state.recordingStartTime) / 1000;
        var wordsPerMin = (spokenWords.length / durationSec) * 60;
        // Natural English speech: 120-180 wpm
        if (wordsPerMin < 40) speedScore = 0.3; else if (wordsPerMin < 60) speedScore = 0.5;
        else if (wordsPerMin < 100) speedScore = 0.8;
        else if (wordsPerMin <= 200) speedScore = 1.0;
        else speedScore = 0.85; // too fast
    }

    // Length penalty: speaking too few or too many words
    var lengthRatio = spokenWords.length / targetWords.length;
    var lengthScore = 1.0;
    if (lengthRatio < 0.3) lengthScore = 0.2; else if (lengthRatio < 0.5) lengthScore = 0.4;
    else if (lengthRatio < 0.8) lengthScore = 0.8;
    else if (lengthRatio > 1.5) lengthScore = 0.85;

    if (completeness < 0.15) return Math.round(Math.min(8, completeness * 100)); if (completeness < 0.3) { speedScore *= 0.3; lengthScore *= 0.3; orderScore *= 0.2; } else if (completeness < 0.5) { speedScore *= 0.6; lengthScore *= 0.6; orderScore *= 0.5; } var rawScore = (completeness * 40 + orderScore * 25 + speedScore * 15 + lengthScore * 20);
    return Math.round(Math.min(100, Math.max(0, rawScore)));
}

function calculateWordOrder(spoken, target) {
    // Check what fraction of adjacent word pairs in target appear in same order in spoken
    if (target.length < 2) return 1.0;
    var spokenLower = spoken.map(function(w) { return w.toLowerCase(); });
    var targetLower = target.map(function(w) { return w.toLowerCase(); });

    var correctPairs = 0;
    var totalPairs = targetLower.length - 1;

    for (var i = 0; i < totalPairs; i++) {
        var idx1 = spokenLower.indexOf(targetLower[i]);
        var idx2 = spokenLower.indexOf(targetLower[i + 1]);
        if (idx1 !== -1 && idx2 !== -1 && idx1 < idx2) {
            correctPairs++;
        }
    }

    return totalPairs > 0 ? correctPairs / totalPairs : 1.0;
}
// 5. Enhanced showFeedback with word-by-word diff highlighting
function showFeedback(result) {
    var feedbackSection = DOM.feedbackSection;
    feedbackSection.classList.add('is-visible');

    // Show spoken text (what user said)
    DOM.originalText.innerHTML = highlightDiff(result.spokenText, state.currentSentence, 'spoken');

    // Show target sentence (what they should have said) with match highlighting
    DOM.correctedText.innerHTML = highlightDiff(state.currentSentence, result.spokenText, 'target');

    // Show error details
    var errorList = DOM.errorList;
    errorList.innerHTML = '';

    // Add word-by-word comparison if available
    if (state.lastMatchDetails && state.lastMatchDetails.length > 0) {
        var diffSummary = document.createElement('div');
        diffSummary.className = 'feedback__diff-summary';
        var correctCount = 0;
        var closeCount = 0;
        var wrongCount = 0;

        for (var i = 0; i < state.lastMatchDetails.length; i++) {
            var d = state.lastMatchDetails[i];
            if (d.score >= 0.9) correctCount++;
            else if (d.score >= 0.5) closeCount++;
            else wrongCount++;
        }

        diffSummary.innerHTML = '<div style="margin-bottom:10px;padding:10px;background:rgba(255,255,255,0.05);border-radius:8px;">' +
            '<span style="color:#10B981;">\u25cf \uc815\ud655 ' + correctCount + '\uac1c</span> \u00a0 ' +
            '<span style="color:#F59E0B;">\u25cf \ube44\uc2b7 ' + closeCount + '\uac1c</span> \u00a0 ' +
            '<span style="color:#EF4444;">\u25cf \ud2c0\ub9bc ' + wrongCount + '\uac1c</span>' +
            '</div>';
        errorList.appendChild(diffSummary);
    }

    if (result.errors && result.errors.length > 0) {
        for (var i = 0; i < result.errors.length; i++) {
            var error = result.errors[i];
            var errorItem = document.createElement('div');
            errorItem.className = 'feedback__error';
            var desc = error.message || error.description || '';
            var correction = (error.replacements && error.replacements.length > 0) ? error.replacements[0].value : '';
            errorItem.innerHTML = '<span>' + escapeHtml(desc) + '</span>' +
                (correction ? '<span style="color:#10B981;"> \u2192 ' + escapeHtml(correction) + '</span>' : '');
            errorList.appendChild(errorItem);
        }
    } else {
        var noError = document.createElement('div');
        noError.className = 'feedback__error';
        noError.style.borderLeftColor = '#10B981';
        noError.style.background = 'rgba(16,185,129,0.08)';
        noError.innerHTML = '\ubb38\ubc95 \uc624\ub958\uac00 \uc5c6\uc2b5\ub2c8\ub2e4! \ud6cc\ub96d\ud574\uc694! \ud83d\udc4f';
        errorList.appendChild(noError);
    }

    DOM.recorderStatus.textContent = '\u2705 \ubd84\uc11d \uc644\ub8cc! (Attempt ' + state.currentAttempt + '/' + state.maxAttempts + ')';

    // Update scores display
    var scores = result.scores;
    updateAttemptDot(state.currentAttempt, 'done', {
        pronunciation: scores.pronunciation,
        grammar: scores.grammar,
        fluency: scores.fluency,
        average: scores.average
    });

    if (state.currentAttempt < state.maxAttempts) {
        DOM.btnNextAttempt.style.display = 'inline-block';
    } else {
        showReport();
    }

    smoothScrollTo(feedbackSection, { block: 'start' });
}
// Word diff highlighting function
function highlightDiff(text, compareWith, mode) {
    var words = text.trim().split(/\s+/);
    var compareWords = compareWith.toLowerCase().trim().split(/\s+/);
    var result = [];

    for (var i = 0; i < words.length; i++) {
        var wordLower = words[i].toLowerCase().replace(/[^a-z0-9']/g, '');
        var found = false;
        var closeMatch = false;

        // Check exact match
        for (var j = 0; j < compareWords.length; j++) {
            var cw = compareWords[j].replace(/[^a-z0-9']/g, '');
            if (wordLower === cw) { found = true; break; }
        }

        // Check fuzzy match if not exact
        if (!found) {
            for (var j = 0; j < compareWords.length; j++) {
                var cw = compareWords[j].replace(/[^a-z0-9']/g, '');
                var sim = 1 - (levenshteinDistance(wordLower, cw) / Math.max(wordLower.length, cw.length, 1));
                if (sim >= 0.6) { closeMatch = true; break; }
            }
        }

        if (found) {
            result.push('<span style="color:#10B981;">' + escapeHtml(words[i]) + '</span>');
        } else if (closeMatch) {
            result.push('<span style="color:#F59E0B;text-decoration:underline;">' + escapeHtml(words[i]) + '</span>');
        } else {
            result.push('<span style="color:#EF4444;text-decoration:line-through;">' + escapeHtml(words[i]) + '</span>');
        }
    }

    return result.join(' ');
}

// =====================
// 7. 음성합성 (TTS) - 미국 원어민 발음 (크로스브라우저)
// =====================
function listenToTarget() {
  speak(state.currentSentence);
}

function listenToCorrected() {
  var correctedText = DOM.correctedText ? DOM.correctedText.textContent : "";
  if (correctedText) speak(correctedText);
}

// 미국 원어민 음성 캐시
var cachedUSVoice = null;
var voicesReady = false;

function getUSNativeVoice() {
  if (cachedUSVoice && voicesReady) return cachedUSVoice;
  if (!window.speechSynthesis) return null;
  var voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;
  voicesReady = true;

  var preferredNames = [
    "Microsoft Aria Online (Natural)",
    "Microsoft Jenny Online (Natural)",
    "Microsoft Guy Online (Natural)",
    "Microsoft Ana Online (Natural)",
    "Google US English",
    "Samantha (Enhanced)", "Samantha",
    "Allison (Enhanced)", "Allison",
    "Ava (Enhanced)", "Ava", "Tom", "Alex",
    "Microsoft Aria", "Microsoft Jenny", "Microsoft Guy",
    "Microsoft Zira", "Zira",
    "English United States"
  ];

  var englishVoice = null;

  // 1차: 선호 이름 목록
  for (var p = 0; p < preferredNames.length; p++) {
    for (var i = 0; i < voices.length; i++) {
      if (voices[i].name.indexOf(preferredNames[p]) !== -1 && voices[i].lang.indexOf("en") === 0) {
        englishVoice = voices[i];
        break;
      }
    }
    if (englishVoice) break;
  }

  // 2차: en-US 네트워크(고품질) 음성
  if (!englishVoice) {
    for (var i = 0; i < voices.length; i++) {
      if (voices[i].lang === "en-US" && !voices[i].localService) {
        englishVoice = voices[i];
        break;
      }
    }
  }

  // 3차: en-US 로컬 음성
  if (!englishVoice) {
    for (var i = 0; i < voices.length; i++) {
      if (voices[i].lang === "en-US") {
        englishVoice = voices[i];
        break;
      }
    }
  }

  // 4차: en_US (안드로이드), en-us
  if (!englishVoice) {
    for (var i = 0; i < voices.length; i++) {
      if (voices[i].lang === "en_US" || voices[i].lang === "en-us") {
        englishVoice = voices[i];
        break;
      }
    }
  }

  // 5차: 영어 아무거나
  if (!englishVoice) {
    for (var i = 0; i < voices.length; i++) {
      if (voices[i].lang.indexOf("en") === 0) {
        englishVoice = voices[i];
        break;
      }
    }
  }

  if (englishVoice) {
    cachedUSVoice = englishVoice;
    console.log("[TTS] Selected voice:", englishVoice.name, englishVoice.lang, englishVoice.localService ? "(local)" : "(network)");
  }
  return englishVoice;
}

function speak(text) {
  if (!window.speechSynthesis) {
    alert("이 브라우저는 음성 합성(TTS)을 지원하지 욈습니다.");
    return;
  }
  window.speechSynthesis.cancel();

  var utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 0.9;
  utterance.pitch = 1;
  utterance.volume = 1;

  var voice = getUSNativeVoice();
  if (voice) {
    utterance.voice = voice;
  }

  // iOS 멈춤 버그 방지
  var resumeTimer = null;
  utterance.onstart = function () {
    resumeTimer = setInterval(function () {
      if (!window.speechSynthesis.speaking) clearInterval(resumeTimer);
      else window.speechSynthesis.resume();
    }, 3000);
  };
  utterance.onend = function () {
    if (resumeTimer) clearInterval(resumeTimer);
  };
  utterance.onerror = function (e) {
    if (resumeTimer) clearInterval(resumeTimer);
    console.warn("[TTS] Error:", e.error);
  };
  window.speechSynthesis.speak(utterance);
}

// 음성 목록 미리 로드 및 캐시
if (window.speechSynthesis) {
  window.speechSynthesis.getVoices();
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = function () {
      cachedUSVoice = null;
      voicesReady = false;
      getUSNativeVoice();
    };
  }
  // Safari 대응: 지연 후 한 번 더 시도
  setTimeout(function () {
    if (!voicesReady) {
      getUSNativeVoice();
    }
  }, 500);
}

// =====================
// 8. 시도 관리
// =====================
function nextAttempt() {
  state.currentAttempt++;
  if (DOM.feedbackSection) DOM.feedbackSection.classList.remove("is-visible");
  if (DOM.btnNextAttempt) DOM.btnNextAttempt.style.display = "none";
  if (DOM.recognizedText) {
    DOM.recognizedText.textContent = "음성 인식 결과가 여기에 표시됩니다";
    DOM.recognizedText.classList.add("recorder__text--empty");
  }
  updateAttemptUI();
  smoothScrollTo(DOM.btnRecord, "center");
}

function updateAttemptUI() {
  if (DOM.recorderStatus) {
    DOM.recorderStatus.textContent =
      "시도 " + state.currentAttempt + "/" + state.maxAttempts +
      " - 버튼을 눌러 녹음을 시작하세요";
  }
  if (DOM.attemptDots) {
    var dots = DOM.attemptDots.querySelectorAll(".recorder__dot");
    for (var d = 0; d < dots.length; d++) {
      dots[d].classList.remove("is-active", "is-done");
      if (d + 1 === state.currentAttempt) dots[d].classList.add("is-active");
      else if (d + 1 < state.currentAttempt) dots[d].classList.add("is-done");
    }
  }
}

function updateAttemptDot(attemptNumber, status) {
  if (!DOM.attemptDots) return;
  var dot = DOM.attemptDots.querySelector('[data-attempt="' + attemptNumber + '"]');
  if (dot) {
    dot.classList.remove("is-active");
    if (status === "done") dot.classList.add("is-done");
  }
}

function changeSentence() {
  var newSentence;
  var safety = 0;
  do {
    newSentence = currentLevelSentences[Math.floor(Math.random() * currentLevelSentences.length)];
    safety++;
  } while (newSentence === state.currentSentence && currentLevelSentences.length > 1 && safety < 50);
  state.currentSentence = newSentence;
  if (DOM.targetSentence) DOM.targetSentence.textContent = newSentence;
  state.currentAttempt = 1;
  state.attempts = [];
  state.isRecording = false;
  updateAttemptUI();
  if (DOM.feedbackSection) DOM.feedbackSection.classList.remove("is-visible");
  if (DOM.reportSection) DOM.reportSection.classList.remove("is-visible");
  if (DOM.btnNextAttempt) DOM.btnNextAttempt.style.display = "none";
  if (DOM.recognizedText) {
    DOM.recognizedText.textContent = "마이크 버튼을 누르고 영어로 말해보세요";
    DOM.recognizedText.classList.add("recorder__text--empty");
  }
  smoothScrollTo(DOM.targetSentence, "center");
}

function restart() {
  window.location.reload();
}

// =====================
// 9. 리포트 카드
// =====================
function showReport() {
  var bestAttempt = state.attempts[0];
  for (var a = 1; a < state.attempts.length; a++) {
    if (state.attempts[a].scores.average > bestAttempt.scores.average) {
      bestAttempt = state.attempts[a];
    }
  }

  if (DOM.scorePronunciation) DOM.scorePronunciation.textContent = safeToFixed(bestAttempt.scores.pronunciation, 1);
  if (DOM.scoreGrammar) DOM.scoreGrammar.textContent = safeToFixed(bestAttempt.scores.grammar, 1);
  if (DOM.scoreFluency) DOM.scoreFluency.textContent = safeToFixed(bestAttempt.scores.fluency, 1);
  if (DOM.scoreAverage) DOM.scoreAverage.textContent = safeToFixed(bestAttempt.scores.average, 1);

  var grade = getGrade(bestAttempt.scores.average);
  if (DOM.gradeDisplay) {
    DOM.gradeDisplay.innerHTML = '<span class="grade-badge grade-badge--' + grade["class"] + '">' + grade.label + '</span>';
  }

  if (DOM.historyTableBody) {
    DOM.historyTableBody.innerHTML = "";
    for (var h = 0; h < state.attempts.length; h++) {
      var attempt = state.attempts[h];
      var isBest = (attempt === bestAttempt);
      var row = document.createElement("tr");
      if (isBest) row.classList.add("is-best");

      var td1 = document.createElement("td");
      td1.textContent = (h + 1) + (isBest ? " (최고)" : "");
      var td2 = document.createElement("td");
      td2.textContent = safeToFixed(attempt.scores.pronunciation, 1);
      var td3 = document.createElement("td");
      td3.textContent = safeToFixed(attempt.scores.grammar, 1);
      var td4 = document.createElement("td");
      td4.textContent = safeToFixed(attempt.scores.fluency, 1);
      var td5 = document.createElement("td");
      td5.textContent = safeToFixed(attempt.scores.average, 1);
      var td6 = document.createElement("td");
      var btnDetail = document.createElement("button");
      btnDetail.className = "btn btn--secondary btn--sm detail-btn";
      btnDetail.setAttribute("data-attempt", String(h + 1));
      btnDetail.style.padding = "0.25rem 0.5rem";
      btnDetail.style.fontSize = "0.75rem";
      btnDetail.textContent = "상세보기";
      (function (att) {
        addEvent(btnDetail, "click", function () { showModal(att); });
      })(attempt);
      td6.appendChild(btnDetail);

      row.appendChild(td1);
      row.appendChild(td2);
      row.appendChild(td3);
      row.appendChild(td4);
      row.appendChild(td5);
      row.appendChild(td6);
      DOM.historyTableBody.appendChild(row);
    }
  }

  createRadarChart(bestAttempt.scores);
  buildReportComments(bestAttempt);
  if (DOM.reportSection) DOM.reportSection.classList.add("is-visible");
  smoothScrollTo(DOM.reportSection, "start");
}

function buildReportComments(bestAttempt) {
  var container = document.getElementById("reportCommentsBody");
  if (!container) return;
  container.innerHTML = "";

  for (var idx = 0; idx < state.attempts.length; idx++) {
    var attempt = state.attempts[idx];
    var isBest = (attempt === bestAttempt);
    var card = document.createElement("div");
    card.className = "comment-card" + (isBest ? " is-best" : "");

    var header = '<div class="comment-card__header"><span>Attempt ' + (idx + 1) + '</span>' +
      (isBest ? '<span class="best-tag">Best</span>' : '') + '</div>';

    var scores = '<div class="comment-card__scores">' +
      '<span class="comment-card__score">발음 <strong>' + safeToFixed(attempt.scores.pronunciation, 1) + '</strong></span>' +
      '<span class="comment-card__score">문법 <strong>' + safeToFixed(attempt.scores.grammar, 1) + '</strong></span>' +
      '<span class="comment-card__score">유창성 <strong>' + safeToFixed(attempt.scores.fluency, 1) + '</strong></span>' +
      '<span class="comment-card__score">평균 <strong>' + safeToFixed(attempt.scores.average, 1) + '</strong></span>' +
      '</div>';

    var spoken = '<div class="comment-card__row"><div class="comment-card__label">Spoken</div>' +
      '<div class="comment-card__text">' + escapeHtml(attempt.spokenText) + '</div></div>';

    var corrected = '<div class="comment-card__row"><div class="comment-card__label">Corrected</div>' +
      '<div class="comment-card__text">' + escapeHtml(attempt.correctedText) + '</div></div>';

    var errors = '';
    if (attempt.errors && attempt.errors.length > 0) {
      errors = '<div class="comment-card__errors">';
      for (var ei = 0; ei < attempt.errors.length; ei++) {
        var err = attempt.errors[ei];
        var desc = (err.rule && err.rule.description) ? err.rule.description : err.message;
        var fix = (err.replacements && err.replacements.length > 0) ? ' (수정: "' + err.replacements[0].value + '")' : '';
        errors += '<div class="comment-card__error-item">' + escapeHtml(desc + fix) + '</div>';
      }
      errors += '</div>';
    } else {
      errors = '<div class="comment-card__no-error">문법 오류가 없습니다. 잘했습니다!</div>';
    }

    card.innerHTML = header + scores + spoken + corrected + errors;
    container.appendChild(card);
  }
}

function escapeHtml(text) {
  var div = document.createElement("div");
  div.textContent = text || "";
  return div.innerHTML;
}

function getGrade(average) {
  if (average >= 9.0) return { label: "최우수", "class": "excellent" };
  if (average >= 7.0) return { label: "우수", "class": "good" };
  if (average >= 5.0) return { label: "보통", "class": "normal" };
  return { label: "미흡", "class": "poor" };
}

function createRadarChart(scores) {
  if (!DOM.radarChart) return;
  if (typeof Chart === "undefined") {
    console.warn("Chart.js가 로드되지 않았습니다.");
    return;
  }
  var ctx = DOM.radarChart.getContext("2d");
  if (state.radarChart) state.radarChart.destroy();
  state.radarChart = new Chart(ctx, {
    type: "radar",
    data: {
      labels: ["발음 (Pronunciation)", "문법 (Grammar)", "유창성 (Fluency)"],
      datasets: [{
        label: "최고 점수",
        data: [scores.pronunciation, scores.grammar, scores.fluency],
        backgroundColor: "rgba(79, 70, 229, 0.15)",
        borderColor: "#4F46E5",
        borderWidth: 2,
        pointBackgroundColor: "#4F46E5",
        pointBorderColor: "#fff",
        pointBorderWidth: 2,
        pointRadius: 6,
        pointHoverRadius: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      scales: {
        r: {
          beginAtZero: true,
          max: 10,
          min: 0,
          ticks: {
            stepSize: 2,
            font: { family: "'Inter', sans-serif", size: 11 },
            color: "#94A3B8",
            backdropColor: "transparent"
          },
          grid: { color: "rgba(148, 163, 184, 0.2)" },
          angleLines: { color: "rgba(148, 163, 184, 0.2)" },
          pointLabels: {
            font: { family: "'Pretendard', 'Noto Sans KR', sans-serif", size: 12, weight: "600" },
            color: "#1E293B"
          }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function (ctx) {
              return ctx.label + ": " + ctx.raw + "/10";
            }
          }
        }
      }
    }
  });
}

// =====================
// 10. 모달 제어
// =====================
function showModal(attempt) {
  if (DOM.modalScorePronunciation) DOM.modalScorePronunciation.textContent = safeToFixed(attempt.scores.pronunciation, 1);
  if (DOM.modalScoreGrammar) DOM.modalScoreGrammar.textContent = safeToFixed(attempt.scores.grammar, 1);
  if (DOM.modalScoreFluency) DOM.modalScoreFluency.textContent = safeToFixed(attempt.scores.fluency, 1);
  if (DOM.modalOriginalText) DOM.modalOriginalText.textContent = attempt.spokenText;
  if (DOM.modalCorrectedText) DOM.modalCorrectedText.textContent = attempt.correctedText;

  if (DOM.modalErrorList) {
    DOM.modalErrorList.innerHTML = "";
    if (attempt.errors.length > 0) {
      for (var m = 0; m < attempt.errors.length; m++) {
        var error = attempt.errors[m];
        var errorItem = document.createElement("div");
        errorItem.className = "feedback__error-item";
        var description = (error.rule && error.rule.description) ? error.rule.description : error.message;
        var correction = (error.replacements && error.replacements.length > 0)
          ? ' (수정 제안: "' + error.replacements[0].value + '")'
          : "";
        errorItem.textContent = description + correction;
        DOM.modalErrorList.appendChild(errorItem);
      }
    } else {
      var noErrDiv = document.createElement("div");
      noErrDiv.className = "feedback__error-item";
      noErrDiv.style.borderLeftColor = "#10B981";
      noErrDiv.style.background = "#ECFDF5";
      noErrDiv.style.color = "#065F46";
      noErrDiv.textContent = "문법 오류가 없습니다. 완벽합니다!";
      DOM.modalErrorList.appendChild(noErrDiv);
    }
  }

  if (DOM.feedbackModal) {
    DOM.feedbackModal.style.display = "flex";
    setTimeout(function () {
      DOM.feedbackModal.classList.add("is-visible");
    }, 10);
  }
}

function closeModal() {
  if (!DOM.feedbackModal) return;
  DOM.feedbackModal.classList.remove("is-visible");
  setTimeout(function () {
    DOM.feedbackModal.style.display = "none";
  }, 300);
}

// =====================
// 11. 데모 (테스트용)
// =====================
function showDemoReport() {
  state.attempts = [
    {
      attempt: 1,
      spokenText: "The quick brown fox jumps over the lazy dog.",
      correctedText: "The quick brown fox jumps over the lazy dog.",
      errors: [],
      scores: { pronunciation: 8.5, grammar: 10, fluency: 9.2, average: 9.2 }
    },
    {
      attempt: 2,
      spokenText: "She sell sea shell by the sea shore.",
      correctedText: "She sells seashells by the seashore.",
      errors: [{
        message: "Possible agreement error",
        replacements: [{ value: "sells" }],
        rule: { description: "주어-동사 수 일치 오류" }
      }],
      scores: { pronunciation: 7.0, grammar: 6.0, fluency: 7.5, average: 6.8 }
    },
    {
      attempt: 3,
      spokenText: "I would like to order a cup of coffee please.",
      correctedText: "I would like to order a cup of coffee, please.",
      errors: [{
        message: "Missing punctuation",
        replacements: [{ value: ", please" }],
        rule: { description: "문장 부호 오류" }
      }],
      scores: { pronunciation: 9.5, grammar: 9.0, fluency: 9.8, average: 9.4 }
    }
  ];
  state.currentAttempt = 3;
  showReport();
  setTimeout(function () {
    smoothScrollTo(DOM.reportSection, "start");
  }, 300);
}
window.showDemoReport = showDemoReport;

// =====================
// 인쇄 / PDF 저장 기능 (크로스브라우저)
// =====================
function printReport() {
  var canvas = document.getElementById("radarChart");
  var chartImg = null;
  try {
    if (canvas && canvas.style.display !== "none" && canvas.width > 0) {
      chartImg = document.createElement("img");
      chartImg.src = canvas.toDataURL("image/png");
      chartImg.style.maxWidth = "350px";
      chartImg.style.maxHeight = "350px";
      chartImg.style.margin = "0 auto";
      chartImg.style.display = "block";
      chartImg.className = "print-chart-img";
      canvas.parentNode.insertBefore(chartImg, canvas);
      canvas.style.display = "none";
    }
  } catch (e) {
    console.warn("차트 이미지 변환 실패:", e);
    chartImg = null;
  }
  if (typeof window.print === "function") {
    try {
      window.print();
    } catch (e) {
      alert("이 브라우저에서는 인쇄 기능이 지원되지 않습니다.\n브라우저 메뉴에서 '공유' > '인쇄' 또는 '페이지 인쇄'를 사용해주세요.");
    }
  } else {
    alert("이 브라우저에서는 인쇄 기능이 지원되지 욈습니다.\n브라우저 메뉴에서 '공유' > '인쇄' 또는 '페이지 인쇄'를 사용해주세요.");
  }
  setTimeout(function () {
    if (chartImg && chartImg.parentNode) chartImg.parentNode.removeChild(chartImg);
    if (canvas) canvas.style.display = "";
  }, 1000);
}
window.printReport = printReport;

// DOM 로드 후 초기화 - 크로스브라우저
if (document.readyState === "loading") {
  if (document.addEventListener) {
    document.addEventListener("DOMContentLoaded", init);
  } else if (document.attachEvent) {
    document.attachEvent("onreadystatechange", function () {
      if (document.readyState === "complete") init();
    });
  }
} else {
  init();
}
