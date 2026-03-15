/**
 * ===========================
 * Mangoi Speech Coach - main.js
 * 영어 발음 교정 학습 도구
 * BTS 레벨별 회화 문장 + 미국 원어민 TTS
 * ===========================
 */

// =====================
// 1. 전역 변수 및 설정
// =====================

// 현재 선택된 레벨의 문장 (sentences.js에서 로드)
let currentLevelKey = null;
let currentLevelSentences = [];

// 현재 상태 관리 객체
const state = {
  currentSentence: "",
  currentAttempt: 1,
  maxAttempts: 3,
  isRecording: false,
  attempts: [],
  recognition: null,
  recordingStartTime: null,
  radarChart: null,
};

// =====================
// 2. DOM 요소 참조
// =====================
const DOM = {
  // 레벨 선택
  levelSelect: document.getElementById("levelSelect"),
  levelInfo: document.getElementById("levelInfo"),
  // 연습 세션
  targetSentence: document.getElementById("targetSentence"),
  btnChangeSentence: document.getElementById("btnChangeSentence"),
  btnListenTarget: document.getElementById("btnListenTarget"),
  // 녹음 세션
  btnRecord: document.getElementById("btnRecord"),
  recorderStatus: document.getElementById("recorderStatus"),
  attemptDots: document.getElementById("attemptDots"),
  waveAnimation: document.getElementById("waveAnimation"),
  recognizedText: document.getElementById("recognizedText"),
  // 피드백 세션
  feedbackSection: document.getElementById("feedbackSection"),
  originalText: document.getElementById("originalText"),
  correctedText: document.getElementById("correctedText"),
  errorList: document.getElementById("errorList"),
  btnListenCorrected: document.getElementById("btnListenCorrected"),
  btnNextAttempt: document.getElementById("btnNextAttempt"),
  // 리포트 섹션
  reportSection: document.getElementById("reportSection"),
  scorePronunciation: document.getElementById("scorePronunciation"),
  scoreGrammar: document.getElementById("scoreGrammar"),
  scoreFluency: document.getElementById("scoreFluency"),
  scoreAverage: document.getElementById("scoreAverage"),
  gradeDisplay: document.getElementById("gradeDisplay"),
  radarChart: document.getElementById("radarChart"),
  historyTableBody: document.getElementById("historyTableBody"),
  btnRestart: document.getElementById("btnRestart"),
  // 기타
  browserSupport: document.getElementById("browserSupport"),
  // 모달
  feedbackModal: document.getElementById("feedbackModal"),
  btnCloseModal: document.getElementById("btnCloseModal"),
  modalScorePronunciation: document.getElementById("modalScorePronunciation"),
  modalScoreGrammar: document.getElementById("modalScoreGrammar"),
  modalScoreFluency: document.getElementById("modalScoreFluency"),
  modalOriginalText: document.getElementById("modalOriginalText"),
  modalCorrectedText: document.getElementById("modalCorrectedText"),
  modalErrorList: document.getElementById("modalErrorList"),
  btnPlayCorrectedModal: document.getElementById("btnPlayCorrectedModal"),
};

// =====================
// 3. 초기화
// =====================
function init() {
  if (!checkBrowserSupport()) return;

  // 레벨 선택 드롭다운 초기화
  initLevelSelect();

  setupSpeechRecognition();
  bindEvents();
  updateAttemptUI();

  window.addEventListener("click", (e) => {
    if (e.target === DOM.feedbackModal) closeModal();
  });
}

/**
 * 레벨 선택 드롭다운 초기화
 */
function initLevelSelect() {
  if (!DOM.levelSelect) return;

  // BTS_SENTENCES에서 레벨 옵션 생성
  Object.keys(BTS_SENTENCES).forEach((key) => {
    const level = BTS_SENTENCES[key];
    const option = document.createElement("option");
    option.value = key;
    option.textContent = `${key} - ${level.title}`;
    DOM.levelSelect.appendChild(option);
  });

  // 레벨 변경 이벤트
  DOM.levelSelect.addEventListener("change", handleLevelChange);

  // 기본 레벨 설정 (BTS 1)
  DOM.levelSelect.value = "BTS 1";
  handleLevelChange();
}

/**
 * 레벨 변경 처리
 */
function handleLevelChange() {
  const selectedKey = DOM.levelSelect.value;

  if (!selectedKey || !BTS_SENTENCES[selectedKey]) {
    // "전체 랜덤" 선택 시
    currentLevelKey = null;
    currentLevelSentences = ALL_SENTENCES;
    if (DOM.levelInfo) {
      DOM.levelInfo.textContent = "전체 BTS 레벨에서 랜덤 출제";
    }
  } else {
    currentLevelKey = selectedKey;
    const level = BTS_SENTENCES[selectedKey];
    currentLevelSentences = level.sentences;
    if (DOM.levelInfo) {
      DOM.levelInfo.textContent = `${level.topic} (${level.sentences.length}문장)`;
    }
  }

  // 새 문장 선택 및 초기화
  const randomSentence =
    currentLevelSentences[
      Math.floor(Math.random() * currentLevelSentences.length)
    ];
  state.currentSentence = randomSentence;
  DOM.targetSentence.textContent = randomSentence;

  // 상태 초기화
  state.currentAttempt = 1;
  state.attempts = [];
  state.isRecording = false;
  updateAttemptUI();
  DOM.feedbackSection.classList.remove("is-visible");
  DOM.reportSection.classList.remove("is-visible");
  DOM.btnNextAttempt.style.display = "none";
  DOM.recognizedText.textContent = "마이크 버튼을 누르고 영어로 말해보세요";
  DOM.recognizedText.classList.add("recorder__text--empty");
}

function checkBrowserSupport() {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    DOM.browserSupport.textContent = "미지원 브라우저";
    DOM.browserSupport.style.background = "rgba(239, 68, 68, 0.3)";
    DOM.btnRecord.disabled = true;
    DOM.recorderStatus.textContent =
      "이 브라우저는 음성인식을 지원하지 않습니다. Chrome을 사용해주세요.";
    return false;
  }
  DOM.browserSupport.textContent = "지원됨";
  DOM.browserSupport.style.background = "rgba(16, 185, 129, 0.3)";
  return true;
}

function setupSpeechRecognition() {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;
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
  DOM.btnRecord.addEventListener("click", toggleRecording);
  DOM.btnChangeSentence.addEventListener("click", changeSentence);
  DOM.btnListenTarget.addEventListener("click", listenToTarget);
  DOM.btnListenCorrected.addEventListener("click", listenToCorrected);
  DOM.btnNextAttempt.addEventListener("click", nextAttempt);
  DOM.btnRestart.addEventListener("click", restart);
  DOM.btnCloseModal.addEventListener("click", closeModal);
  DOM.btnPlayCorrectedModal.addEventListener("click", () => {
    const text = DOM.modalCorrectedText.textContent;
    if (text) speak(text);
  });
}

// =====================
// 4. 음성인식 (Speech-to-Text)
// =====================
function toggleRecording() {
  if (state.isRecording) {
    stopRecording();
  } else {
    startRecording();
  }
}

function startRecording() {
  state.isRecording = true;
  DOM.btnRecord.classList.add("is-recording");
  DOM.waveAnimation.classList.add("is-active");
  DOM.recorderStatus.textContent = "듣고 있어요... 영어로 말해주세요";
  DOM.recognizedText.textContent = "";
  DOM.recognizedText.classList.remove("recorder__text--empty");
  DOM.feedbackSection.classList.remove("is-visible");
  try {
    state.recognition.start();
  } catch (e) {
    console.warn("음성인식 시작 에러:", e);
  }
}

function stopRecording() {
  state.isRecording = false;
  DOM.btnRecord.classList.remove("is-recording");
  DOM.waveAnimation.classList.remove("is-active");
  state.recognition.stop();
}

function handleRecognitionResult(event) {
  let interimTranscript = "";
  let finalTranscript = "";

  for (let i = event.resultIndex; i < event.results.length; i++) {
    const result = event.results[i];
    if (result.isFinal) {
      finalTranscript += result[0].transcript;
    } else {
      interimTranscript += result[0].transcript;
    }
  }

  if (finalTranscript) {
    DOM.recognizedText.textContent = finalTranscript;
  } else {
    DOM.recognizedText.textContent = interimTranscript;
    DOM.recognizedText.style.opacity = "0.6";
  }
}

function handleRecognitionEnd() {
  state.isRecording = false;
  DOM.btnRecord.classList.remove("is-recording");
  DOM.waveAnimation.classList.remove("is-active");
  DOM.recognizedText.style.opacity = "1";

  const spokenText = DOM.recognizedText.textContent.trim();
  if (
    spokenText &&
    spokenText !== "음성 인식 결과가 여기에 표시됩니다"
  ) {
    DOM.recorderStatus.textContent = "분석 중...";
    evaluateSpeech(spokenText);
  } else {
    DOM.recorderStatus.textContent = `시도 ${state.currentAttempt}/${state.maxAttempts} - 음성이 인시되지 않았습니다. 다시 시도해주세요.`;
    DOM.recognizedText.textContent = "음성 인식 결과가 여기에 표시됩니다";
    DOM.recognizedText.classList.add("recorder__text--empty");
  }
}

function handleRecognitionError(event) {
  state.isRecording = false;
  DOM.btnRecord.classList.remove("is-recording");
  DOM.waveAnimation.classList.remove("is-active");

  let errorMessage = "";
  switch (event.error) {
    case "no-speech":
      errorMessage = "음성이 감지되지 않았습니다. 마이크에 대고 말해주세요.";
      break;
    case "audio-capture":
      errorMessage = "마이크를 찾을 수 없습니다. 마이크를 연결해주세요.";
      break;
    case "not-allowed":
      errorMessage =
        "마이크 권한이 거부되었습니다. 브라우저 설정에서 마이크를 허용해주세요.";
      break;
    default:
      errorMessage = `음성인식 오류가 발생했습니다: ${event.error}`;
  }
  DOM.recorderStatus.textContent = errorMessage;
}

// =====================
// 5. 평가 시스템
// =====================
async function evaluateSpeech(spokenText) {
  try {
    const grammarResult = await checkGrammar(spokenText);
    const pronunciationScore = calculatePronunciationScore(
      spokenText,
      state.currentSentence
    );
    const grammarScore = calculateGrammarScore(grammarResult.matches);
    const fluencyScore = calculateFluencyScore(
      spokenText,
      state.currentSentence
    );
    const averageScore =
      Math.round(
        ((pronunciationScore + grammarScore + fluencyScore) / 3) * 10
      ) / 10;
    const correctedSentence = applyCorrestions(
      spokenText,
      grammarResult.matches
    );

    const attemptResult = {
      attempt: state.currentAttempt,
      spokenText: spokenText,
      correctedText: correctedSentence,
      errors: grammarResult.matches,
      scores: {
        pronunciation: pronunciationScore,
        grammar: grammarScore,
        fluency: fluencyScore,
        average: averageScore,
      },
    };

    state.attempts.push(attemptResult);
    showFeedback(attemptResult);
  } catch (error) {
    console.error("평가 중 오류:", error);
    DOM.recorderStatus.textContent =
      "평가 중 오류가 발생했습니다. 다시 시도해주세요.";
  }
}

async function checkGrammar(text) {
  try {
    const response = await fetch("https://api.languagetool.org/v2/check", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        text: text,
        language: "en-US",
        enabledOnly: "false",
      }),
    });
    if (!response.ok) throw new Error(`API 응답 오류: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.warn("LanguageTool API 호출 실패:", error);
    return { matches: performBasicGrammarCheck(text) };
  }
}

function performBasicGrammarCheck(text) {
  const errors = [];
  if (text.length > 0 && text[0] !== text[0].toUpperCase()) {
    errors.push({
      message: "This sentence does not start with an uppercase letter.",
      shortMessage: "Capitalization",
      offset: 0,
      length: 1,
      replacements: [{ value: text[0].toUpperCase() }],
      rule: { id: "UPPERCASE_SENTENCE_START", description: "문장은 대문자로 시작해야 합니다." },
    });
  }
  const lastChar = text.trim().slice(-1);
  if (![".", "!", "?"].includes(lastChar)) {
    errors.push({
      message: "This sentence does not end with proper punctuation.",
      shortMessage: "Punctuation",
      offset: text.length - 1,
      length: 1,
      replacements: [{ value: text.trim() + "." }],
      rule: { id: "SENTENCE_END_PUNCT", description: "문장은 마침표, 물음표, 느낼표로 끝나야 합니다." },
    });
  }
  if (/ +/.test(text)) {
    errors.push({
      message: "There are multiple spaces in a row.",
      shortMessage: "Extra space",
      offset: text.indexOf("  "),
      length: 2,
      replacements: [{ value: " " }],
      rule: { id: "DOUBLE_SPACE", description: "불필요한 공백이 있습니다." },
    });
  }
  return errors;
}

function calculatePronunciationScore(spoken, target) {
  const spokenClean = spoken.toLowerCase().replace(/[^\w\s]/g, "").trim();
  const targetClean = target.toLowerCase().replace(/[^\w\s]/g, "").trim();
  const spokenWords = spokenClean.split(/\s+/);
  const targetWords = targetClean.split(/\s+/);

  let matchCount = 0;
  targetWords.forEach((tw) => {
    if (spokenWords.includes(tw)) matchCount++;
  });

  const matchRate = targetWords.length > 0 ? matchCount / targetWords.length : 0;
  const similarity = calculateSimilarity(spokenClean, targetClean);
  const rawScore = (matchRate * 0.6 + similarity * 0.4) * 10;
  return Math.round(Math.min(10, Math.max(0, rawScore)) * 10) / 10;
}

function calculateSimilarity(str1, str2) {
  const len1 = str1.length;
  const len2 = str2.length;
  if (len1 === 0 && len2 === 0) return 1;
  if (len1 === 0 || len2 === 0) return 0;
  const matrix = [];
  for (let i = 0; i <= len1; i++) matrix[i] = [i];
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return 1 - matrix[len1][len2] / Math.max(len1, len2);
}

function calculateGrammarScore(matches) {
  return Math.round(Math.max(0, 10 - matches.length * 2) * 10) / 10;
}

function calculateFluencyScore(spoken, target) {
  const spokenWords = spoken.trim().split(/\s+/).length;
  const targetWords = target.trim().split(/\s+/).length;
  const completeness = Math.min(1, spokenWords / targetWords);

  let speedScore = 1;
  if (state.recordingStartTime) {
    const durationSec = (Date.now() - state.recordingStartTime) / 1000;
    const wpm = (spokenWords / durationSec) * 60;
    if (wpm >= 80 && wpm <= 160) speedScore = 1;
    else if (wpm >= 60 && wpm < 80) speedScore = 0.8;
    else if (wpm > 160 && wpm <= 200) speedScore = 0.8;
    else speedScore = 0.5;
  }

  const wordLengths = spoken.split(/\s+/).map((w) => w.length);
  const avgLength = wordLengths.reduce((a, b) => a + b, 0) / wordLengths.length;
  const naturalness = avgLength >= 2 && avgLength <= 8 ? 1 : 0.7;
  const rawScore = (completeness * 0.5 + speedScore * 0.3 + naturalness * 0.2) * 10;
  return Math.round(Math.min(10, Math.max(0, rawScore)) * 10) / 10;
}

function applyCorrestions(text, matches) {
  if (matches.length === 0) return text;
  const sorted = [...matches].sort((a, b) => b.offset - a.offset);
  let corrected = text;
  sorted.forEach((match) => {
    if (match.replacements && match.replacements.length > 0) {
      const before = corrected.substring(0, match.offset);
      const after = corrected.substring(match.offset + match.length);
      corrected = before + match.replacements[0].value + after;
    }
  });
  return corrected;
}

// =====================
// 6. 피드백 표시
// =====================
function showFeedback(result) {
  DOM.feedbackSection.classList.add("is-visible");
  DOM.originalText.textContent = result.spokenText;
  DOM.correctedText.textContent = result.correctedText;

  DOM.errorList.innerHTML = "";
  if (result.errors.length > 0) {
    result.errors.forEach((error) => {
      const errorItem = document.createElement("div");
      errorItem.className = "feedback__error-item";
      const description = error.rule && error.rule.description ? error.rule.description : error.message;
      const correction = error.replacements && error.replacements.length > 0
        ? ` (수정 제안: "${error.replacements[0].value}")`
        : "";
      errorItem.textContent = `${description}${correction}`;
      DOM.errorList.appendChild(errorItem);
    });
  } else {
    const noError = document.createElement("div");
    noError.className = "feedback__error-item";
    noError.style.borderLeftColor = "#10B981";
    noError.style.background = "rgba(16, 185, 129, 0.08)";
    noError.textContent = "문법 오류가 없습니다. 잘하셨습니다!";
    DOM.errorList.appendChild(noError);
  }

  DOM.recorderStatus.textContent =
    `시도 ${state.currentAttempt}/${state.maxAttempts} 완료 | ` +
    `발음: ${result.scores.pronunciation} | 문법: ${result.scores.grammar} | ` +
    `유창성: ${result.scores.fluency} | 평균: ${result.scores.average}`;

  updateAttemptDot(state.currentAttempt, "done");

  if (state.currentAttempt < state.maxAttempts) {
    DOM.btnNextAttempt.style.display = "inline-flex";
    DOM.btnNextAttempt.textContent = `다음 시도하기 (${state.currentAttempt + 1}/${state.maxAttempts})`;
  } else {
    DOM.btnNextAttempt.style.display = "none";
    showReport();
  }
  DOM.feedbackSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

// =====================
// 7. 음성합성 (TTS) - 미국 원어민 발음
// =====================
function listenToTarget() {
  speak(state.currentSentence);
}

function listenToCorrected() {
  const correctedText = DOM.correctedText.textContent;
  if (correctedText) speak(correctedText);
}

/**
 * 미국 원어민 발음 TTS
 * - en-US 여성 음성 우선 (Google US English, Samantha 등)
 * - 학습자 배려 앍간 느린 속도 (0.85)
 */
// 미국 원어민 음성 캐시
var cachedUSVoice = null;
var voicesReady = false;

function getUSNativeVoice() {
  if (cachedUSVoice && voicesReady) return cachedUSVoice;

  var voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;

  voicesReady = true;

  // 미국 원어민 고품질 음성 우선순위 (Natural/Enhanced 우선)
  var preferredNames = [
    // Natural/Enhanced 음성 (최고 품질)
    "Microsoft Aria Online (Natural)",
    "Microsoft Jenny Online (Natural)",
    "Microsoft Guy Online (Natural)",
    "Microsoft Ana Online (Natural)",
    "Google US English",
    // macOS/iOS 고품질 음성
    "Samantha (Enhanced)",
    "Samantha",
    "Allison (Enhanced)",
    "Allison",
    "Ava (Enhanced)",
    "Ava",
    "Tom",
    "Alex",
    // Windows/Edge 음성
    "Microsoft Aria",
    "Microsoft Jenny",
    "Microsoft Guy",
    "Microsoft Zira",
    "Zira",
    // Android 음성
    "English United States",
  ];

  var englishVoice = null;

  // 1차: 선호 이름 목록에서 검색
  for (var p = 0; p < preferredNames.length; p++) {
    for (var i = 0; i < voices.length; i++) {
      if (voices[i].name.indexOf(preferredNames[p]) !== -1 && voices[i].lang.indexOf("en") === 0) {
        englishVoice = voices[i];
        break;
      }
    }
    if (englishVoice) break;
  }

  // 2차: en-US + 네트워크(고품질) 음성 우선
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

  // 4차: en_US (안드로이드 형식)
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
  window.speechSynthesis.cancel();

  var doSpeak = function () {
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
      }, 5000);
    };
    utterance.onend = function () { if (resumeTimer) clearInterval(resumeTimer); };
    utterance.onerror = function () { if (resumeTimer) clearInterval(resumeTimer); };

    window.speechSynthesis.speak(utterance);
  };

  // voices가 아직 로드 안 됐으면 기다림
  var voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) {
    var waited = 0;
    var waitInterval = setInterval(function () {
      voices = window.speechSynthesis.getVoices();
      waited += 50;
      if ((voices && voices.length > 0) || waited > 2000) {
        clearInterval(waitInterval);
        setTimeout(doSpeak, 100);
      }
    }, 50);
  } else {
    setTimeout(doSpeak, 100);
  }
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
}

// =====================
// 8. 시도 관리
// =====================
function nextAttempt() {
  state.currentAttempt++;
  DOM.feedbackSection.classList.remove("is-visible");
  DOM.btnNextAttempt.style.display = "none";
  DOM.recognizedText.textContent = "음성 인식 결과가 여기에 표시됩니다";
  DOM.recognizedText.classList.add("recorder__text--empty");
  updateAttemptUI();
  DOM.btnRecord.scrollIntoView({ behavior: "smooth", block: "center" });
}

function updateAttemptUI() {
  DOM.recorderStatus.textContent = `시도 ${state.currentAttempt}/${state.maxAttempts} - 버튼을 눌러 녹음을 시작하세요`;
  const dots = DOM.attemptDots.querySelectorAll(".recorder__dot");
  dots.forEach((dot, index) => {
    dot.classList.remove("is-active", "is-done");
    if (index + 1 === state.currentAttempt) dot.classList.add("is-active");
    else if (index + 1 < state.currentAttempt) dot.classList.add("is-done");
  });
}

function updateAttemptDot(attemptNumber, status) {
  const dot = DOM.attemptDots.querySelector(`[data-attempt="${attemptNumber}"]`);
  if (dot) {
    dot.classList.remove("is-active");
    if (status === "done") dot.classList.add("is-done");
  }
}

function changeSentence() {
  let newSentence;
  do {
    newSentence = currentLevelSentences[Math.floor(Math.random() * currentLevelSentences.length)];
  } while (newSentence === state.currentSentence && currentLevelSentences.length > 1);

  state.currentSentence = newSentence;
  DOM.targetSentence.textContent = newSentence;

  state.currentAttempt = 1;
  state.attempts = [];
  state.isRecording = false;
  updateAttemptUI();
  DOM.feedbackSection.classList.remove("is-visible");
  DOM.reportSection.classList.remove("is-visible");
  DOM.btnNextAttempt.style.display = "none";
  DOM.recognizedText.textContent = "마이크 버튼을 누러고 영어로 말해보세요";
  DOM.recognizedText.classList.add("recorder__text--empty");
  DOM.targetSentence.scrollIntoView({ behavior: "smooth", block: "center" });
}

function restart() {
  window.location.reload();
}

// =====================
// 9. 리포트 카드
// =====================
function showReport() {
  const bestAttempt = state.attempts.reduce((best, current) =>
    current.scores.average > best.scores.average ? current : best
  );

  DOM.scorePronunciation.textContent = bestAttempt.scores.pronunciation.toFixed(1);
  DOM.scoreGrammar.textContent = bestAttempt.scores.grammar.toFixed(1);
  DOM.scoreFluency.textContent = bestAttempt.scores.fluency.toFixed(1);
  DOM.scoreAverage.textContent = bestAttempt.scores.average.toFixed(1);

  const grade = getGrade(bestAttempt.scores.average);
  DOM.gradeDisplay.innerHTML = `<span class="grade-badge grade-badge--${grade.class}">${grade.label}</span>`;

  DOM.historyTableBody.innerHTML = "";
  state.attempts.forEach((attempt, index) => {
    const isBest = attempt === bestAttempt;
    const row = document.createElement("tr");
    if (isBest) row.classList.add("is-best");
    row.innerHTML = `
      <td>${index + 1}${isBest ? " (최고)" : ""}</td>
      <td>${attempt.scores.pronunciation.toFixed(1)}</td>
      <td>${attempt.scores.grammar.toFixed(1)}</td>
      <td>${attempt.scores.fluency.toFixed(1)}</td>
      <td>${attempt.scores.average.toFixed(1)}</td>
      <td>
        <button class="btn btn--secondary btn--sm detail-btn" data-attempt="${index + 1}" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;">
          상세보기
        </button>
      </td>
    `;
    const btnDetail = row.querySelector(".detail-btn");
    btnDetail.addEventListener("click", () => showModal(attempt));
    DOM.historyTableBody.appendChild(row);
  });

  createRadarChart(bestAttempt.scores);
  buildReportComments(bestAttempt);
  DOM.reportSection.classList.add("is-visible");
  DOM.reportSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

/**
 * 리포트 하단 코멘트 섹션 자동 생성
 * - 각 시도별 상세보기 내용을 자동으로 입력
 */
function buildReportComments(bestAttempt) {
  var container = document.getElementById("reportCommentsBody");
  if (!container) return;
  container.innerHTML = "";

  state.attempts.forEach(function (attempt, index) {
    var isBest = attempt === bestAttempt;
    var card = document.createElement("div");
    card.className = "comment-card" + (isBest ? " is-best" : "");

    // 헤더 (시도 번호 + 최고 태그)
    var header = '<div class="comment-card__header">' +
      '<span>Attempt ' + (index + 1) + '</span>' +
      (isBest ? '<span class="best-tag">Best</span>' : '') +
      '</div>';

    // 점수 바
    var scores = '<div class="comment-card__scores">' +
      '<span class="comment-card__score">발음 <strong>' + attempt.scores.pronunciation.toFixed(1) + '</strong></span>' +
      '<span class="comment-card__score">문법 <strong>' + attempt.scores.grammar.toFixed(1) + '</strong></span>' +
      '<span class="comment-card__score">유창성 <strong>' + attempt.scores.fluency.toFixed(1) + '</strong></span>' +
      '<span class="comment-card__score">평김 <strong>' + attempt.scores.average.toFixed(1) + '</strong></span>' +
      '</div>';

    // 인식된 텍스트
    var spoken = '<div class="comment-card__row">' +
      '<div class="comment-card__label">Spoken</div>' +
      '<div class="comment-card__text">' + escapeHtml(attempt.spokenText) + '</div>' +
      '</div>';

    // 교정된 텍스트
    var corrected = '<div class="comment-card__row">' +
      '<div class="comment-card__label">Corrected</div>' +
      '<div class="comment-card__text">' + escapeHtml(attempt.correctedText) + '</div>' +
      '</div>';

    // 오류 목록
    var errors = '';
    if (attempt.errors && attempt.errors.length > 0) {
      errors = '<div class="comment-card__errors">';
      attempt.errors.forEach(function (err) {
        var desc = (err.rule && err.rule.description) ? err.rule.description : err.message;
        var fix = (err.replacements && err.replacements.length > 0)
          ? ' (수정: "' + err.replacements[0].value + '")'
          : '';
        errors += '<div class="comment-card__error-item">' + escapeHtml(desc + fix) + '</div>';
      });
      errors += '</div>';
    } else {
      errors = '<div class="comment-card__no-error">문법 오류가 없습니다. 잘했습니다!</div>';
    }

    card.innerHTML = header + scores + spoken + corrected + errors;
    container.appendChild(card);
  });
}

function escapeHtml(text) {
  var div = document.createElement("div");
  div.textContent = text || "";
  return div.innerHTML;
}

function getGrade(average) {
  if (average >= 9.0) return { label: "최우수", class: "excellent" };
  else if (average >= 7.0) return { label: "우수", class: "good" };
  else if (average >= 5.0) return { label: "보통", class: "normal" };
  else return { label: "미흡", class: "poor" };
}

function createRadarChart(scores) {
  const ctx = DOM.radarChart.getContext("2d");
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
        pointHoverRadius: 8,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      scales: {
        r: {
          beginAtZero: true, max: 10, min: 0,
          ticks: { stepSize: 2, font: { family: "'Inter', sans-serif", size: 11 }, color: "#94A3B8", backdropColor: "transparent" },
          grid: { color: "rgba(148, 163, 184, 0.2)" },
          angleLines: { color: "rgba(148, 163, 184, 0.2)" },
          pointLabels: { font: { family: "'Pretendard', 'Noto Sans KR', sans-serif", size: 12, weight: "600" }, color: "#1E293B" },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${ctx.raw}/10` } },
      },
    },
  });
}

// =====================
// 10. 모달 제어
// =====================
function showModal(attempt) {
  DOM.modalScorePronunciation.textContent = attempt.scores.pronunciation.toFixed(1);
  DOM.modalScoreGrammar.textContent = attempt.scores.grammar.toFixed(1);
  DOM.modalScoreFluency.textContent = attempt.scores.fluency.toFixed(1);
  DOM.modalOriginalText.textContent = attempt.spokenText;
  DOM.modalCorrectedText.textContent = attempt.correctedText;

  DOM.modalErrorList.innerHTML = "";
  if (attempt.errors.length > 0) {
    attempt.errors.forEach((error) => {
      const errorItem = document.createElement("div");
      errorItem.className = "feedback__error-item";
      const description = error.rule && error.rule.description ? error.rule.description : error.message;
      const correction = error.replacements && error.replacements.length > 0
        ? ` (수정 제안: "${error.replacements[0].value}")`
        : "";
      errorItem.textContent = `${description}${correction}`;
      DOM.modalErrorList.appendChild(errorItem);
    });
  } else {
    DOM.modalErrorList.innerHTML = `<div class="feedback__error-item" style="border-left-color: #10B981; background: #ECFDF5; color: #065F46;">문법 오류가 없습니다. 완벽합니다!</div>`;
  }

  DOM.feedbackModal.style.display = "flex";
  setTimeout(() => DOM.feedbackModal.classList.add("is-visible"), 10);
}

function closeModal() {
  DOM.feedbackModal.classList.remove("is-visible");
  setTimeout(() => { DOM.feedbackModal.style.display = "none"; }, 300);
}

// =====================
// 11. 데모 (테스트용)
// =====================
function showDemoReport() {
  state.attempts = [
    { attempt: 1, spokenText: "The quick brown fox jumps over the lazy dog.", correctedText: "The quick brown fox jumps over the lazy dog.", errors: [], scores: { pronunciation: 8.5, grammar: 10, fluency: 9.2, average: 9.2 } },
    { attempt: 2, spokenText: "She sell sea shell by the sea shore.", correctedText: "She sells seashells by the seashore.", errors: [{ message: "Possible agreement error", replacements: [{ value: "sells" }], rule: { description: "주어-동사 수 일치 오류" } }], scores: { pronunciation: 7.0, grammar: 6.0, fluency: 7.5, average: 6.8 } },
    { attempt: 3, spokenText: "I would like to order a cup of coffee please.", correctedText: "I would like to order a cup of coffee, please.", errors: [{ message: "Missing punctuation", replacements: [{ value: ", please" }], rule: { description: "문장 부호 오류" } }], scores: { pronunciation: 9.5, grammar: 9.0, fluency: 9.8, average: 9.4 } },
  ];
  state.currentAttempt = 3;
  showReport();
  setTimeout(function () { DOM.reportSection.scrollIntoView({ behavior: "smooth", block: "start" }); }, 300);
}
window.showDemoReport = showDemoReport;

// =====================
// 인쇄 / PDF 저장 기능
// =====================
function printReport() {
  // Canvas(차트)를 이미지로 변환해서 인쇄 시에도 보이게 처리
  var canvas = document.getElementById("radarChart");
  var chartImg = null;
  if (canvas && canvas.style.display !== "none") {
    try {
      chartImg = document.createElement("img");
      chartImg.src = canvas.toDataURL("image/png");
      chartImg.style.maxWidth = "350px";
      chartImg.style.maxHeight = "350px";
      chartImg.style.margin = "0 auto";
      chartImg.style.display = "block";
      chartImg.className = "print-chart-img";
      canvas.parentNode.insertBefore(chartImg, canvas);
      canvas.style.display = "none";
    } catch (e) {
      console.warn("차트 이미지 변환 실패:", e);
    }
  }

  window.print();

  // 인쇄 후 원래 Canvas 복원
  setTimeout(function () {
    if (chartImg && chartImg.parentNode) {
      chartImg.parentNode.removeChild(chartImg);
    }
    if (canvas) {
      canvas.style.display = "";
    }
  }, 1000);
}
window.printReport = printReport;

// DOM 로드 후 초기화
document.addEventListener("DOMContentLoaded", init);
