/**
 * ===========================
 * English Speech Coach - main.js
 * 영어 발음 교정 학습 도구
 * ===========================
 *
 * 핵심 기능:
 * 1. 음성인식 (Web Speech API - SpeechRecognition)
 * 2. 문법 교정 (LanguageTool API)
 * 3. 점수 산정 (발음, 문법, 유창성 각 10점)
 * 4. 음성합성 (Web Speech API - SpeechSynthesis)
 * 5. 리포트 카드 (Chart.js 레이다 차트)
 * 6. 3회 시도 시스템
 */

// =====================
// 1. 전역 변수 및 설정
// =====================

// 연습 문장 목록
const SENTENCES = [
  "The quick brown fox jumps over the lazy dog.",
  "She sells seashells by the seashore.",
  "How much wood would a woodchuck chuck if a woodchuck could chuck wood?",
  "I would like to order a cup of coffee, please.",
  "The weather is beautiful today, isn't it?",
  "Can you tell me how to get to the nearest subway station?",
  "I have been studying English for three years.",
  "Would you mind opening the window for me?",
  "The children are playing happily in the park.",
  "I'm looking forward to meeting you next week.",
  "Could you please speak a little more slowly?",
  "What time does the train arrive at the station?",
  "I think we should take a different approach to this problem.",
  "The restaurant was so crowded that we had to wait for a table.",
  "Learning a new language requires patience and dedication.",
  "Excuse me, could you recommend a good place to eat around here?",
  "I accidentally left my umbrella on the bus this morning.",
  "The more you practice, the better you will become at speaking English.",
  "Would it be possible to reschedule our meeting to next Friday?",
  "I really enjoyed the movie we watched last night.",
];

// 현재 상태 관리 객체
const state = {
  currentSentence: SENTENCES[0], // 현재 연습 문장
  currentAttempt: 1, // 현재 시도 번호 (1~3)
  maxAttempts: 3, // 최대 시도 횟수
  isRecording: false, // 녹음 중 여부
  attempts: [], // 각 시도의 결과 저장 배열
  recognition: null, // SpeechRecognition 인스턴스
  recordingStartTime: null, // 녹음 시작 시간 (유창성 계산용)
  radarChart: null, // Chart.js 레이다 차트 인스턴스
};

// =====================
// 2. DOM 요소 참조
// =====================

const DOM = {
  // 연습 섹션
  targetSentence: document.getElementById("targetSentence"),
  btnChangeSentence: document.getElementById("btnChangeSentence"),
  btnListenTarget: document.getElementById("btnListenTarget"),

  // 녹음 섹션
  btnRecord: document.getElementById("btnRecord"),
  recorderStatus: document.getElementById("recorderStatus"),
  attemptDots: document.getElementById("attemptDots"),
  waveAnimation: document.getElementById("waveAnimation"),
  recognizedText: document.getElementById("recognizedText"),

  // 피드백 섹션
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

/**
 * 앱 시작 시 호출되는 초기화 함수
 * - 브라우저 지원 확인
 * - 이벤트 리스너 등록
 * - SpeechRecognition 설정
 */
function init() {
  // 3-1. Web Speech API 지원 확인
  if (!checkBrowserSupport()) {
    return; // 미지원 브라우저면 중단
  }

  // 3-2. SpeechRecognition 인스턴스 생성
  setupSpeechRecognition();

  // 3-3. 이벤트 리스너 바인딩
  bindEvents();

  // 3-4. 시도 상태 초기화
  updateAttemptUI();

  // 모달 외부 클릭 시 닫기
  window.addEventListener("click", (e) => {
    if (e.target === DOM.feedbackModal) {
      closeModal();
    }
  });
}

/**
 * 브라우저가 Web Speech API를 지원하는지 확인
 * Chrome에서 가장 안정적으로 동작합니다.
 */
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

/**
 * SpeechRecognition(음성인식) 설정
 *
 * 왜 이렇게 설정하나요?
 * - lang: 'en-US' -> 영어 인식을 위해 미국 영어로 설정
 * - interimResults: true -> 말하는 중간에도 결과를 보여줘서 사용자가 진행 상황을 볼 수 있음
 * - maxAlternatives: 1 -> 가장 정확한 결과 1개만 받음 (성능 최적화)
 * - continuous: false -> 한 문장 말하면 자동 종료 (학습 도구 특성에 맞춤)
 */
function setupSpeechRecognition() {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;
  state.recognition = new SpeechRecognition();

  state.recognition.lang = "en-US"; // 영어 인식
  state.recognition.interimResults = true; // 중간 결과 표시
  state.recognition.maxAlternatives = 1; // 결과 1개
  state.recognition.continuous = false; // 한 번에 한 문장

  // 3-2a. 인식 결과를 받았을 때
  state.recognition.onresult = handleRecognitionResult;

  // 3-2b. 인식이 끝났을 때
  state.recognition.onend = handleRecognitionEnd;

  // 3-2c. 에러 발생 시
  state.recognition.onerror = handleRecognitionError;

  // 3-2d. 인식 시작 시
  state.recognition.onstart = function () {
    state.recordingStartTime = Date.now();
  };
}

/**
 * 모든 버튼에 이벤트 리스너 연결
 */
function bindEvents() {
  DOM.btnRecord.addEventListener("click", toggleRecording);
  DOM.btnChangeSentence.addEventListener("click", changeSentence);
  DOM.btnListenTarget.addEventListener("click", listenToTarget);
  DOM.btnListenCorrected.addEventListener("click", listenToCorrected);
  DOM.btnNextAttempt.addEventListener("click", nextAttempt);
  DOM.btnRestart.addEventListener("click", restart);

  // 모달 관련 이벤트
  DOM.btnCloseModal.addEventListener("click", closeModal);
  DOM.btnPlayCorrectedModal.addEventListener("click", () => {
    const text = DOM.modalCorrectedText.textContent;
    if (text) speak(text);
  });
}

// =====================
// 4. 음성인식 (Speech-to-Text)
// =====================

/**
 * 녹음 시작/중지 토글
 *
 * 왜 토글 방식인가요?
 * - 같은 버튼으로 시작과 중지를 모두 할 수 있어서 사용하기 편합니다.
 * - 녹음 중일 때 다시 누르면 중지, 아닐 때 누르면 시작합니다.
 */
function toggleRecording() {
  if (state.isRecording) {
    stopRecording();
  } else {
    startRecording();
  }
}

/**
 * 녹음 시작
 */
function startRecording() {
  state.isRecording = true;

  // UI 업데이트: 녹음 중 상태 표시
  DOM.btnRecord.classList.add("is-recording");
  DOM.waveAnimation.classList.add("is-active");
  DOM.recorderStatus.textContent = "듣고 있어요... 영어로 말해주세요";
  DOM.recognizedText.textContent = "";
  DOM.recognizedText.classList.remove("recorder__text--empty");

  // 피드백 섹션 숨기기 (새 녹음 시작이므로)
  DOM.feedbackSection.classList.remove("is-visible");

  // 음성인식 시작
  try {
    state.recognition.start();
  } catch (e) {
    // 이미 인식 중인 경우 에러 방지
    console.warn("음성인식 시작 에러:", e);
  }
}

/**
 * 녹음 중지
 */
function stopRecording() {
  state.isRecording = false;

  // UI 업데이트
  DOM.btnRecord.classList.remove("is-recording");
  DOM.waveAnimation.classList.remove("is-active");

  // 음성인식 중지
  state.recognition.stop();
}

/**
 * 음성인식 결과 처리
 *
 * event.results 구조 설명:
 * - results[i][0].transcript: 인식된 텍스트
 * - results[i][0].confidence: 신뢰도 (0~1 사이 숫자)
 * - results[i].isFinal: 최종 결과인지 중간 결과인지
 *
 * 왜 confidence를 발음 점수에 사용하나요?
 * - Web Speech API는 음성이 얼마나 명확하게 인식되었는지를 0~1 사이 값으로 알려줍니다.
 * - 발음이 정확할수록 confidence가 높고, 부정확하면 낮습니다.
 * - 이 값을 10점 만점으로 변환하면 발음 점수로 활용할 수 있습니다.
 */
function handleRecognitionResult(event) {
  let interimTranscript = "";
  let finalTranscript = "";
  let confidence = 0;

  for (let i = event.resultIndex; i < event.results.length; i++) {
    const result = event.results[i];

    if (result.isFinal) {
      // isFinal이 true면 음성인식이 완료된 최종 텍스트
      finalTranscript += result[0].transcript;
      confidence = result[0].confidence;
    } else {
      // 아직 말하는 중인 중간 텍스트 (실시간 표시용)
      interimTranscript += result[0].transcript;
    }
  }

  // 화면에 실시간으로 표시
  if (finalTranscript) {
    DOM.recognizedText.textContent = finalTranscript;
  } else {
    DOM.recognizedText.textContent = interimTranscript;
    DOM.recognizedText.style.opacity = "0.6"; // 중간 결과는 반투명하게
  }
}

/**
 * 음성인식 종료 시 호출
 * - 인식된 텍스트를 가지고 평가를 시작합니다.
 */
function handleRecognitionEnd() {
  state.isRecording = false;
  DOM.btnRecord.classList.remove("is-recording");
  DOM.waveAnimation.classList.remove("is-active");
  DOM.recognizedText.style.opacity = "1";

  const spokenText = DOM.recognizedText.textContent.trim();

  if (spokenText && spokenText !== "음성 인식 결과가 여기에 표시됩니다") {
    DOM.recorderStatus.textContent = "분석 중...";
    // 인식된 텍스트로 평가 시작
    evaluateSpeech(spokenText);
  } else {
    DOM.recorderStatus.textContent = `시도 ${state.currentAttempt}/${state.maxAttempts} - 음성이 인식되지 않았습니다. 다시 시도해주세요.`;
    DOM.recognizedText.textContent = "음성 인식 결과가 여기에 표시됩니다";
    DOM.recognizedText.classList.add("recorder__text--empty");
  }
}

/**
 * 음성인식 에러 처리
 */
function handleRecognitionError(event) {
  state.isRecording = false;
  DOM.btnRecord.classList.remove("is-recording");
  DOM.waveAnimation.classList.remove("is-active");

  let errorMessage = "";

  // 에러 유형별 안내 메시지
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

/**
 * 학생이 말한 텍스트를 종합 평가
 *
 * 평가 흐름:
 * 1. LanguageTool API로 문법 검사
 * 2. 문법 오류 수에 따라 문법 점수 계산
 * 3. Web Speech API confidence로 발음 점수 계산
 * 4. 말하기 속도 및 문장 유사도로 유창성 점수 계산
 * 5. 피드백 표시 + 교정 문장 TTS
 *
 * @param {string} spokenText - 음성인식으로 받은 텍스트
 */
async function evaluateSpeech(spokenText) {
  try {
    // 5-1. LanguageTool API로 문법 검사
    const grammarResult = await checkGrammar(spokenText);

    // 5-2. 각 영역 점수 계산
    const pronunciationScore = calculatePronunciationScore(
      spokenText,
      state.currentSentence,
    );
    const grammarScore = calculateGrammarScore(grammarResult.matches);
    const fluencyScore = calculateFluencyScore(
      spokenText,
      state.currentSentence,
    );

    // 5-3. 평균 점수 계산
    const averageScore =
      Math.round(
        ((pronunciationScore + grammarScore + fluencyScore) / 3) * 10,
      ) / 10;

    // 5-4. 교정된 문장 생성
    const correctedSentence = applyCorrestions(
      spokenText,
      grammarResult.matches,
    );

    // 5-5. 결과 저장
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

    // 5-6. 피드백 UI 표시
    showFeedback(attemptResult);
  } catch (error) {
    console.error("평가 중 오류:", error);
    DOM.recorderStatus.textContent =
      "평가 중 오류가 발생했습니다. 다시 시도해주세요.";
  }
}

/**
 * LanguageTool API로 문법 검사
 *
 * 왜 LanguageTool을 사용하나요?
 * - 무료 공개 API로, 별도의 API 키 없이 사용할 수 있습니다.
 * - 영어 문법 오류를 자동으로 감지하고, 교정 제안을 해줍니다.
 * - 서버가 없어도 클라이언트에서 직접 호출할 수 있습니다.
 *
 * @param {string} text - 검사할 텍스트
 * @returns {Object} - 문법 검사 결과 (matches 배열 포함)
 */
async function checkGrammar(text) {
  try {
    const response = await fetch("https://api.languagetool.org/v2/check", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        text: text,
        language: "en-US",
        enabledOnly: "false",
      }),
    });

    if (!response.ok) {
      throw new Error(`API 응답 오류: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.warn("LanguageTool API 호출 실패, 기본 문법 검사 사용:", error);
    // API 실패 시 기본적인 문법 검사 로직 사용
    return { matches: performBasicGrammarCheck(text) };
  }
}

/**
 * API 실패 시 사용하는 기본 문법 검사
 *
 * 왜 기본 검사가 필요한가요?
 * - 인터넷이 안 되거나 API 서버가 다운되어도 앱이 동작해야 합니다.
 * - 간단한 규칙 기반으로 자주 하는 실수를 잡아줍니다.
 *
 * @param {string} text - 검사할 텍스트
 * @returns {Array} - 오류 배열
 */
function performBasicGrammarCheck(text) {
  const errors = [];

  // 규칙 1: 문장 첫 글자가 대문자인지 확인
  if (text.length > 0 && text[0] !== text[0].toUpperCase()) {
    errors.push({
      message: "This sentence does not start with an uppercase letter.",
      shortMessage: "Capitalization",
      offset: 0,
      length: 1,
      replacements: [{ value: text[0].toUpperCase() }],
      rule: {
        id: "UPPERCASE_SENTENCE_START",
        description: "문장은 대문자로 시작해야 합니다.",
      },
    });
  }

  // 규칙 2: 문장 끝에 마침표가 있는지 확인
  const lastChar = text.trim().slice(-1);
  if (![".", "!", "?"].includes(lastChar)) {
    errors.push({
      message: "This sentence does not end with proper punctuation.",
      shortMessage: "Punctuation",
      offset: text.length - 1,
      length: 1,
      replacements: [{ value: text.trim() + "." }],
      rule: {
        id: "SENTENCE_END_PUNCT",
        description: "문장은 마침표, 물음표, 느낌표로 끝나야 합니다.",
      },
    });
  }

  // 규칙 3: 이중 공백 체크
  if (/  +/.test(text)) {
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

/**
 * 발음 점수 계산 (0~10점)
 *
 * 계산 방식:
 * 1. 텍스트 유사도 - 목표 문장과 인식된 텍스트가 얼마나 비슷한지 (Levenshtein Distance)
 * 2. 단어 매칭률 - 올바르게 인식된 단어의 비율
 *
 * 왜 이렇게 계산하나요?
 * - Web Speech API의 confidence는 내부 알고리즘에 의해 결정되지만,
 *   실제로 목표 문장과 비교하는 것이 더 정확한 발음 평가가 됩니다.
 * - 발음이 좋으면 음성인식이 정확하게 텍스트로 변환하고,
 *   나쁘면 다른 단어로 인식하기 때문입니다.
 *
 * @param {string} spoken - 인식된 텍스트
 * @param {string} target - 목표 문장
 * @returns {number} - 발음 점수 (0~10)
 */
function calculatePronunciationScore(spoken, target) {
  // 소문자로 통일하고 구두점 제거 후 비교
  const spokenClean = spoken
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .trim();
  const targetClean = target
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .trim();

  // 단어 단위로 비교
  const spokenWords = spokenClean.split(/\s+/);
  const targetWords = targetClean.split(/\s+/);

  let matchCount = 0;

  // 각 목표 단어가 인식된 텍스트에 있는지 확인
  targetWords.forEach((targetWord) => {
    // 정확히 같은 단어가 있으면 매칭
    if (spokenWords.includes(targetWord)) {
      matchCount++;
    }
  });

  // 단어 매칭률을 10점 만점으로 변환
  const matchRate =
    targetWords.length > 0 ? matchCount / targetWords.length : 0;

  // 텍스트 유사도 (편집 거리 기반)
  const similarity = calculateSimilarity(spokenClean, targetClean);

  // 두 지표를 혼합 (매칭률 60% + 유사도 40%)
  const rawScore = (matchRate * 0.6 + similarity * 0.4) * 10;

  // 0~10 사이로 클램핑하고 소수점 1자리까지
  return Math.round(Math.min(10, Math.max(0, rawScore)) * 10) / 10;
}

/**
 * 두 문자열의 유사도 계산 (0~1)
 * Levenshtein Distance 기반
 *
 * 왜 Levenshtein Distance를 사용하나요?
 * - 두 문자열이 얼마나 다른지를 "편집 횟수"로 측정합니다.
 * - 삽입, 삭제, 교체 연산이 몇 번 필요한지 세고,
 *   이를 문자열 길이로 나눠서 0~1 사이의 유사도로 변환합니다.
 */
function calculateSimilarity(str1, str2) {
  const len1 = str1.length;
  const len2 = str2.length;

  if (len1 === 0 && len2 === 0) return 1;
  if (len1 === 0 || len2 === 0) return 0;

  // 편집 거리 계산 (DP 방식)
  const matrix = [];

  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // 삭제
        matrix[i][j - 1] + 1, // 삽입
        matrix[i - 1][j - 1] + cost, // 교체
      );
    }
  }

  const distance = matrix[len1][len2];
  const maxLen = Math.max(len1, len2);

  // 1 - (편집거리/최대길이) = 유사도
  return 1 - distance / maxLen;
}

/**
 * 문법 점수 계산 (0~10점)
 *
 * 감점 방식:
 * - 오류 0개 = 10점 (만점)
 * - 오류 1개당 2점 감점
 * - 최소 0점
 *
 * 왜 감점 방식인가요?
 * - 문법 오류는 명확하게 개수를 셀 수 있어서 감점 방식이 직관적입니다.
 * - 오류가 많을수록 점수가 낮아지는 것이 자연스럽습니다.
 *
 * @param {Array} matches - LanguageTool API의 오류 배열
 * @returns {number} - 문법 점수 (0~10)
 */
function calculateGrammarScore(matches) {
  const errorCount = matches.length;
  const score = Math.max(0, 10 - errorCount * 2);
  return Math.round(score * 10) / 10;
}

/**
 * 유창성 점수 계산 (0~10점)
 *
 * 평가 기준:
 * 1. 문장 완성도 - 목표 문장을 얼마나 완전하게 말했는지 (50%)
 * 2. 말하기 속도 - 적절한 속도로 말했는지 (30%)
 * 3. 자연스러움 - 문장의 구조가 자연스러운지 (20%)
 *
 * 왜 이 3가지 기준인가요?
 * - 유창성은 단순히 빠르게 말하는 것이 아닙니다.
 * - 완전한 문장을 적절한 속도로, 자연스럽게 말하는 것이 유창함입니다.
 *
 * @param {string} spoken - 인식된 텍스트
 * @param {string} target - 목표 문장
 * @returns {number} - 유창성 점수 (0~10)
 */
function calculateFluencyScore(spoken, target) {
  // 1. 문장 완성도 (단어 수 비교)
  const spokenWords = spoken.trim().split(/\s+/).length;
  const targetWords = target.trim().split(/\s+/).length;
  const completeness = Math.min(1, spokenWords / targetWords);

  // 2. 말하기 속도 평가
  let speedScore = 1;
  if (state.recordingStartTime) {
    const durationSec = (Date.now() - state.recordingStartTime) / 1000;
    // 분당 단어 수 (WPM) 계산
    // 원어민 평균: 120~150 WPM, 학습자: 80~120 WPM이 적절
    const wpm = (spokenWords / durationSec) * 60;

    if (wpm >= 80 && wpm <= 160) {
      speedScore = 1; // 적절한 속도
    } else if (wpm >= 60 && wpm < 80) {
      speedScore = 0.8; // 약간 느림
    } else if (wpm > 160 && wpm <= 200) {
      speedScore = 0.8; // 약간 빠름
    } else if (wpm < 60) {
      speedScore = 0.5; // 너무 느림
    } else {
      speedScore = 0.5; // 너무 빠름
    }
  }

  // 3. 자연스러움 (단어 길이의 일관성)
  const wordLengths = spoken.split(/\s+/).map((w) => w.length);
  const avgLength = wordLengths.reduce((a, b) => a + b, 0) / wordLengths.length;
  const naturalness = avgLength >= 2 && avgLength <= 8 ? 1 : 0.7;

  // 종합 유창성 점수
  const rawScore =
    (completeness * 0.5 + speedScore * 0.3 + naturalness * 0.2) * 10;
  return Math.round(Math.min(10, Math.max(0, rawScore)) * 10) / 10;
}

/**
 * 문법 교정 적용
 * LanguageTool의 교정 제안을 원본 텍스트에 적용합니다.
 *
 * @param {string} text - 원본 텍스트
 * @param {Array} matches - 오류 배열
 * @returns {string} - 교정된 텍스트
 */
function applyCorrestions(text, matches) {
  if (matches.length === 0) return text;

  // 뒤에서부터 교체해야 offset이 꼬이지 않습니다
  // 왜? 앞에서부터 바꾸면 문자열 길이가 변해서 뒤쪽 offset이 틀려지기 때문
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

/**
 * 평가 결과를 화면에 피드백으로 표시
 *
 * @param {Object} result - 평가 결과 객체
 */
function showFeedback(result) {
  // 피드백 섹션 보이기
  DOM.feedbackSection.classList.add("is-visible");

  // 원본 vs 교정 텍스트 표시
  DOM.originalText.textContent = result.spokenText;
  DOM.correctedText.textContent = result.correctedText;

  // 오류 목록 생성
  DOM.errorList.innerHTML = "";

  if (result.errors.length > 0) {
    result.errors.forEach((error) => {
      const errorItem = document.createElement("div");
      errorItem.className = "feedback__error-item";

      // 오류 설명 (한국어로 번역된 규칙 설명 또는 영어 메시지)
      const description =
        error.rule && error.rule.description
          ? error.rule.description
          : error.message;

      const correction =
        error.replacements && error.replacements.length > 0
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

  // 현재 시도의 점수 표시
  DOM.recorderStatus.textContent =
    `시도 ${state.currentAttempt}/${state.maxAttempts} 완료 | ` +
    `발음: ${result.scores.pronunciation} | 문법: ${result.scores.grammar} | ` +
    `유창성: ${result.scores.fluency} | 평균: ${result.scores.average}`;

  // 시도 dot 업데이트
  updateAttemptDot(state.currentAttempt, "done");

  // 다음 시도 또는 리포트 표시
  if (state.currentAttempt < state.maxAttempts) {
    DOM.btnNextAttempt.style.display = "inline-flex";
    DOM.btnNextAttempt.textContent = `다음 시도하기 (${state.currentAttempt + 1}/${state.maxAttempts})`;
  } else {
    // 3회 모두 완료: 리포트 카드 표시
    DOM.btnNextAttempt.style.display = "none";
    showReport();
  }

  // 피드백 섹션으로 스크롤
  DOM.feedbackSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

// =====================
// 7. 음성합성 (Text-to-Speech)
// =====================

/**
 * 목표 문장을 영어 TTS로 읽어주기
 *
 * 왜 SpeechSynthesis를 사용하나요?
 * - 브라우저 내장 API라서 외부 서비스 없이도 동작합니다.
 * - 영어 음성을 사용해서 학생이 정확한 발음을 들을 수 있습니다.
 */
function listenToTarget() {
  speak(state.currentSentence);
}

/**
 * 교정된 문장을 영어 TTS로 읽어주기
 */
function listenToCorrected() {
  const correctedText = DOM.correctedText.textContent;
  if (correctedText) {
    speak(correctedText);
  }
}

/**
 * TTS로 텍스트 읽기
 *
 * @param {string} text - 읽을 텍스트
 */
function speak(text) {
  // 이미 말하고 있으면 중지
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US"; // 미국 영어
  utterance.rate = 0.9; // 약간 느린 속도 (학습자 배려)
  utterance.pitch = 1; // 기본 피치
  utterance.volume = 1; // 최대 음량

  // 영어 음성 선택 (가능한 경우)
  const voices = window.speechSynthesis.getVoices();
  const englishVoice =
    voices.find((v) => v.lang.startsWith("en") && v.name.includes("Google")) ||
    voices.find((v) => v.lang.startsWith("en"));

  if (englishVoice) {
    utterance.voice = englishVoice;
  }

  window.speechSynthesis.speak(utterance);
}

// 음성 목록이 비동기로 로드되므로 미리 로드
if (window.speechSynthesis) {
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    window.speechSynthesis.getVoices();
  };
}

// =====================
// 8. 시도 관리
// =====================

/**
 * 다음 시도로 넘어가기
 */
function nextAttempt() {
  state.currentAttempt++;

  // UI 초기화
  DOM.feedbackSection.classList.remove("is-visible");
  DOM.btnNextAttempt.style.display = "none";
  DOM.recognizedText.textContent = "음성 인식 결과가 여기에 표시됩니다";
  DOM.recognizedText.classList.add("recorder__text--empty");

  // 시도 상태 업데이트
  updateAttemptUI();

  // 녹음 섹션으로 스크롤
  DOM.btnRecord.scrollIntoView({ behavior: "smooth", block: "center" });
}

/**
 * 시도 횟수 UI 업데이트
 */
function updateAttemptUI() {
  DOM.recorderStatus.textContent = `시도 ${state.currentAttempt}/${state.maxAttempts} - 버튼을 눌러 녹음을 시작하세요`;

  // 모든 dot 초기화
  const dots = DOM.attemptDots.querySelectorAll(".recorder__dot");
  dots.forEach((dot, index) => {
    dot.classList.remove("is-active", "is-done");
    if (index + 1 === state.currentAttempt) {
      dot.classList.add("is-active");
    } else if (index + 1 < state.currentAttempt) {
      dot.classList.add("is-done");
    }
  });
}

/**
 * 특정 시도의 dot 상태 변경
 */
function updateAttemptDot(attemptNumber, status) {
  const dot = DOM.attemptDots.querySelector(
    `[data-attempt="${attemptNumber}"]`,
  );
  if (dot) {
    dot.classList.remove("is-active");
    if (status === "done") {
      dot.classList.add("is-done");
    }
  }
}

/**
 * 다른 문장으로 변경
 *
 * 왜 restart()를 호출하지 않나요?
 * - restart()는 window.location.reload()로 페이지를 새로고침합니다.
 * - 새로고침하면 JavaScript 메모리(state)가 모두 초기화되어
 *   방금 바꾼 문장도 사라지고 첫 번째 문장으로 돌아갑니다.
 * - 그래서 페이지 새로고침 없이 상태만 직접 초기화합니다.
 */
function changeSentence() {
  // 현재 문장과 다른 랜덤 문장 선택
  let newSentence;
  do {
    newSentence = SENTENCES[Math.floor(Math.random() * SENTENCES.length)];
  } while (newSentence === state.currentSentence && SENTENCES.length > 1);

  // 새 문장 적용
  state.currentSentence = newSentence;
  DOM.targetSentence.textContent = newSentence;

  // 시도 상태 초기화 (페이지 새로고침 없이)
  state.currentAttempt = 1;
  state.attempts = [];
  state.isRecording = false;

  // UI 초기화
  updateAttemptUI();
  DOM.feedbackSection.classList.remove("is-visible");
  DOM.reportSection.classList.remove("is-visible");
  DOM.btnNextAttempt.style.display = "none";
  DOM.recognizedText.textContent = "마이크 버튼을 누르고 영어로 말해보세요";
  DOM.recognizedText.classList.add("recorder__text--empty");

  // 연습 섹션으로 스크롤
  DOM.targetSentence.scrollIntoView({ behavior: "smooth", block: "center" });
}

/**
 * 처음부터 다시 시작
 */
function restart() {
  // 가장 확실한 초기화를 위해 페이지를 새로고침합니다.
  window.location.reload();
}

// =====================
// 9. 리포트 카드
// =====================

/**
 * 3회 시도 완료 후 리포트 카드 표시
 *
 * 최고 점수 기준으로 리포트를 생성합니다.
 * 왜 최고 점수인가요?
 * - 학습의 목적은 향상이므로, 가장 잘한 결과를 보여주는 것이
 *   학생에게 동기 부여가 됩니다.
 */
function showReport() {
  // 9-1. 최고 평균 점수의 시도 찾기
  const bestAttempt = state.attempts.reduce((best, current) =>
    current.scores.average > best.scores.average ? current : best,
  );

  // 9-2. 점수 표시
  DOM.scorePronunciation.textContent =
    bestAttempt.scores.pronunciation.toFixed(1);
  DOM.scoreGrammar.textContent = bestAttempt.scores.grammar.toFixed(1);
  DOM.scoreFluency.textContent = bestAttempt.scores.fluency.toFixed(1);
  DOM.scoreAverage.textContent = bestAttempt.scores.average.toFixed(1);

  // 9-3. 등급 표시
  const grade = getGrade(bestAttempt.scores.average);
  DOM.gradeDisplay.innerHTML = `<span class="grade-badge grade-badge--${grade.class}">${grade.label}</span>`;

  // 9-4. 시도 기록 테이블 생성
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

    // 상세 보기 버튼 이벤트 리스너
    const btnDetail = row.querySelector(".detail-btn");
    btnDetail.addEventListener("click", () => {
      showModal(attempt);
    });

    DOM.historyTableBody.appendChild(row);
  });

  // 9-5. 레이다 차트 생성
  createRadarChart(bestAttempt.scores);

  // 9-6. 리포트 섹션 보이기
  DOM.reportSection.classList.add("is-visible");

  // 리포트 섹션으로 스크롤
  DOM.reportSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

/**
 * 등급 결정
 *
 * | 평균 점수 | 등급 | CSS 클래스 |
 * |-----------|------|------------|
 * | 9.0~10.0  | 최우수 | excellent |
 * | 7.0~8.9   | 우수   | good      |
 * | 5.0~6.9   | 보통   | normal    |
 * | 0~4.9     | 미흡   | poor      |
 *
 * @param {number} average - 평균 점수
 * @returns {Object} - { label, class }
 */
function getGrade(average) {
  if (average >= 9.0) {
    return { label: "최우수", class: "excellent" };
  } else if (average >= 7.0) {
    return { label: "우수", class: "good" };
  } else if (average >= 5.0) {
    return { label: "보통", class: "normal" };
  } else {
    return { label: "미흡", class: "poor" };
  }
}

/**
 * Chart.js 레이다 차트 생성
 *
 * 왜 레이다(방사형) 차트인가요?
 * - 발음, 문법, 유창성 3가지 영역을 한눈에 비교할 수 있습니다.
 * - 어떤 영역이 강하고 약한지 시각적으로 바로 파악됩니다.
 *
 * @param {Object} scores - { pronunciation, grammar, fluency }
 */
function createRadarChart(scores) {
  const ctx = DOM.radarChart.getContext("2d");

  // 기존 차트가 있으면 파괴 (중복 방지)
  if (state.radarChart) {
    state.radarChart.destroy();
  }

  state.radarChart = new Chart(ctx, {
    type: "radar",
    data: {
      labels: ["발음 (Pronunciation)", "문법 (Grammar)", "유창성 (Fluency)"],
      datasets: [
        {
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
        },
      ],
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
            font: {
              family: "'Inter', sans-serif",
              size: 11,
            },
            color: "#94A3B8",
            backdropColor: "transparent",
          },
          grid: {
            color: "rgba(148, 163, 184, 0.2)",
          },
          angleLines: {
            color: "rgba(148, 163, 184, 0.2)",
          },
          pointLabels: {
            font: {
              family: "'Pretendard', 'Noto Sans KR', sans-serif",
              size: 12,
              weight: "600",
            },
            color: "#1E293B",
          },
        },
      },
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              return `${context.label}: ${context.raw}/10`;
            },
          },
        },
      },
    },
  });
}

// =====================
// 10. 모달 제어
// =====================

/**
 * 모달 표시 함수
 * @param {Object} attempt - 시도 데이터
 */
function showModal(attempt) {
  // 모달 데이터 채우기
  DOM.modalScorePronunciation.textContent =
    attempt.scores.pronunciation.toFixed(1);
  DOM.modalScoreGrammar.textContent = attempt.scores.grammar.toFixed(1);
  DOM.modalScoreFluency.textContent = attempt.scores.fluency.toFixed(1);

  DOM.modalOriginalText.textContent = attempt.spokenText;
  DOM.modalCorrectedText.textContent = attempt.correctedText;

  // 오류 목록 렌더링
  DOM.modalErrorList.innerHTML = "";
  if (attempt.errors.length > 0) {
    attempt.errors.forEach((error) => {
      const errorItem = document.createElement("div");
      errorItem.className = "feedback__error-item";

      const description =
        error.rule && error.rule.description
          ? error.rule.description
          : error.message;

      const correction =
        error.replacements && error.replacements.length > 0
          ? ` (수정 제안: "${error.replacements[0].value}")`
          : "";

      errorItem.textContent = `${description}${correction}`;
      DOM.modalErrorList.appendChild(errorItem);
    });
  } else {
    DOM.modalErrorList.innerHTML = `
      <div class="feedback__error-item" style="border-left-color: #10B981; background: #ECFDF5; color: #065F46;">
        문법 오류가 없습니다. 완벽합니다!
      </div>
    `;
  }

  // 모달 표시
  DOM.feedbackModal.style.display = "flex";
  // 약간의 지연 후 opacity 변경 (트랜지션 효과)
  setTimeout(() => {
    DOM.feedbackModal.classList.add("is-visible");
  }, 10);
}

/**
 * 모달 닫기 함수
 */
function closeModal() {
  DOM.feedbackModal.classList.remove("is-visible");
  setTimeout(() => {
    DOM.feedbackModal.style.display = "none";
  }, 300); // 트랜지션 시간과 일치
}

// =====================
// 11. 앱 시작
// =====================

// =====================
// 12. 데모 (테스트용)
// =====================

/**
 * 데모 리포트 보여주기
 * 마이크 없이 결과를 확인하고 싶을 때 사용
 */
function showDemoReport() {
  state.attempts = [
    {
      attempt: 1,
      spokenText: "The quick brown fox jumps over the lazy dog.",
      correctedText: "The quick brown fox jumps over the lazy dog.",
      errors: [],
      scores: { pronunciation: 8.5, grammar: 10, fluency: 9.2, average: 9.2 },
    },
    {
      attempt: 2,
      spokenText: "She sell sea shell by the sea shore.",
      correctedText: "She sells seashells by the seashore.",
      errors: [
        {
          message: "Possible agreement error",
          replacements: [{ value: "sells" }],
          rule: { description: "주어-동사 수 일치 오류" },
        },
        {
          message: "Misspelled",
          replacements: [{ value: "seashells" }],
          rule: { description: "단어 철자 오류" },
        },
      ],
      scores: { pronunciation: 7.0, grammar: 6.0, fluency: 7.5, average: 6.8 },
    },
    {
      attempt: 3,
      spokenText: "I would like to order a cup of coffee please.",
      correctedText: "I would like to order a cup of coffee, please.",
      errors: [
        {
          message: "Missing punctuation",
          replacements: [{ value: ", please" }],
          rule: { description: "문장 부호 오류" },
        },
      ],
      scores: { pronunciation: 9.5, grammar: 9.0, fluency: 9.8, average: 9.4 },
    },
  ];

  // 최고 점수 계산 로직이 showReport에 있으므로 그냥 호출
  state.currentAttempt = 3;
  showReport();

  // 알림
  alert("데모 데이터가 로드되었습니다. 리포트 카드를 확인하세요.");
}

// 전역 공개
window.showDemoReport = showDemoReport;

// DOM이 완전히 로드된 후 초기화
document.addEventListener("DOMContentLoaded", init);
