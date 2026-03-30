/**
 * ===========================
 * 내가 말한 음성 듣기 v4
 * 핵심 변경:
 * - 동시 녹음 완전 포기 → 순차 녹음 방식
 * - SpeechRecognition 완료 후 피드백 화면에서
 *   "🎤 내 발음 녹음하기" 버튼 제공
 * - 버튼 누르면 getUserMedia로 녹음 시작
 *   (SpeechRecognition 미사용 → 마이크 충돌 없음)
 * - 녹음 완료 후 재생 플레이어 표시
 * PC + 모바일(iOS/Android) 완전 호환
 * ===========================
 */
(function () {
  "use strict";

  /* ── state ── */
  var mediaRecorder = null;
  var audioChunks = [];
  var userAudioBlob = null;
  var userAudioURL = null;
  var audioPlayer = null;
  var audioStream = null;
  var isPlaying = false;
  var progressTimer = null;
  var isRecordingUser = false;
  var currentSentence = "";

  /* ── saved originals ── */
  var _origShowFeedback = null;

  /* ── MIME type selection ── */
  function chooseMimeType() {
    if (typeof MediaRecorder === "undefined") return "";
    if (typeof MediaRecorder.isTypeSupported !== "function") return "";
    var types = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
      "audio/ogg;codecs=opus",
      "audio/ogg",
      ""
    ];
    for (var i = 0; i < types.length; i++) {
      if (!types[i] || MediaRecorder.isTypeSupported(types[i])) return types[i];
    }
    return "";
  }

  /* ── 녹음 가능 여부 체크 ── */
  function isRecordingSupported() {
    return (
      typeof MediaRecorder !== "undefined" &&
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === "function"
    );
  }

  /* ── stream cleanup ── */
  function cleanupStream() {
    if (audioStream) {
      try {
        audioStream.getTracks().forEach(function (t) { t.stop(); });
      } catch (e) {}
      audioStream = null;
    }
  }

  /* ── 녹음 시작 (버튼 클릭 시) ── */
  function startUserRecording() {
    if (isRecordingUser) return;
    if (!isRecordingSupported()) return;

    /* 이전 녹음 정리 */
    if (userAudioURL) {
      URL.revokeObjectURL(userAudioURL);
      userAudioURL = null;
    }
    userAudioBlob = null;
    audioChunks = [];
    if (audioPlayer) {
      audioPlayer.pause();
      audioPlayer = null;
    }
    isPlaying = false;
    clearInterval(progressTimer);

    /* 기존 플레이어 제거 */
    var existingPlayer = document.getElementById("myRecordingPlayer");
    if (existingPlayer) existingPlayer.remove();

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then(function (stream) {
        audioStream = stream;
        audioChunks = [];
        var mimeType = chooseMimeType();
        try {
          var opts = mimeType ? { mimeType: mimeType } : {};
          mediaRecorder = new MediaRecorder(stream, opts);
        } catch (e1) {
          try {
            mediaRecorder = new MediaRecorder(stream);
          } catch (e2) {
            console.warn("[rec-v4] MediaRecorder fail:", e2);
            cleanupStream();
            return;
          }
        }

        mediaRecorder.ondataavailable = function (e) {
          if (e.data && e.data.size > 0) audioChunks.push(e.data);
        };

        mediaRecorder.onstop = function () {
          cleanupStream();
          if (audioChunks.length > 0) {
            userAudioBlob = new Blob(audioChunks, {
              type: mediaRecorder.mimeType || "audio/webm"
            });
            userAudioURL = URL.createObjectURL(userAudioBlob);
            console.log("[rec-v4] blob ready");
            injectPlayer();
          }
          isRecordingUser = false;
          updateRecordButton(false);
        };

        mediaRecorder.start();
        isRecordingUser = true;
        updateRecordButton(true);
        console.log("[rec-v4] recording started");
      })
      .catch(function (err) {
        console.warn("[rec-v4] getUserMedia fail:", err);
        cleanupStream();
      });
  }

  /* ── 녹음 중지 ── */
  function stopUserRecording() {
    if (!isRecordingUser || !mediaRecorder) return;
    if (mediaRecorder.state !== "inactive") {
      try {
        mediaRecorder.stop();
      } catch (e) {}
    }
  }

  /* ── 녹음 버튼 상태 업데이트 ── */
  function updateRecordButton(recording) {
    var btn = document.getElementById("btnRecordMyVoice");
    if (!btn) return;
    if (recording) {
      btn.textContent = "\u23F9 녹음 중지";
      btn.style.background = "#f44336";
      btn.style.animation = "recPulse 1s infinite";
    } else {
      btn.textContent = "\uD83C\uDFA4 내 발음 녹음하기";
      btn.style.background = "#2196F3";
      btn.style.animation = "none";
    }
  }

  /* ── 녹음 버튼 + 안내 UI 생성 ── */
  function createRecordUI() {
    var container = document.createElement("div");
    container.id = "myRecordingSection";
    container.style.cssText =
      "background:rgba(30,30,60,0.92);border-radius:16px;padding:14px 18px;" +
      "margin:14px auto;max-width:340px;display:flex;flex-direction:column;" +
      "align-items:center;gap:10px;box-shadow:0 2px 16px rgba(0,0,0,0.25);";

    /* 타이틀 */
    var title = document.createElement("div");
    title.style.cssText =
      "color:#c8c8ff;font-size:13px;font-weight:600;text-align:center;width:100%;";
    title.textContent = "\uD83C\uDFA7 내 발음을 녹음하고 들어보세요";
    container.appendChild(title);

    /* 안내 문구 */
    var guide = document.createElement("div");
    guide.style.cssText =
      "color:#aaa;font-size:12px;text-align:center;line-height:1.4;";
    guide.textContent = "아래 버튼을 누르고 문장을 다시 읽어보세요";
    container.appendChild(guide);

    /* 녹음 버튼 */
    var btn = document.createElement("button");
    btn.id = "btnRecordMyVoice";
    btn.type = "button";
    btn.style.cssText =
      "padding:10px 24px;border-radius:25px;border:none;background:#2196F3;" +
      "color:#fff;font-size:15px;font-weight:600;cursor:pointer;" +
      "-webkit-tap-highlight-color:transparent;outline:none;" +
      "display:flex;align-items:center;gap:6px;";
    btn.textContent = "\uD83C\uDFA4 내 발음 녹음하기";
    btn.addEventListener("click", function () {
      if (isRecordingUser) {
        stopUserRecording();
      } else {
        startUserRecording();
      }
    });
    container.appendChild(btn);

    /* pulse animation */
    if (!document.getElementById("recPulseStyle")) {
      var style = document.createElement("style");
      style.id = "recPulseStyle";
      style.textContent =
        "@keyframes recPulse{0%,100%{opacity:1}50%{opacity:0.6}}";
      document.head.appendChild(style);
    }

    return container;
  }

  /* ── 플레이어 UI ── */
  function createPlayerUI() {
    var existing = document.getElementById("myRecordingPlayer");
    if (existing) existing.remove();

    var container = document.createElement("div");
    container.id = "myRecordingPlayer";
    container.style.cssText =
      "background:rgba(20,60,20,0.92);border-radius:16px;padding:14px 18px;" +
      "margin:10px auto 0;max-width:340px;display:flex;flex-direction:column;" +
      "align-items:center;gap:8px;box-shadow:0 2px 16px rgba(0,0,0,0.25);";

    var title = document.createElement("div");
    title.style.cssText =
      "color:#a8e6a8;font-size:13px;font-weight:600;display:flex;" +
      "align-items:center;gap:6px;width:100%;";
    title.textContent = "\u25B6 내가 녹음한 발음 듣기";
    container.appendChild(title);

    var row = document.createElement("div");
    row.style.cssText = "display:flex;align-items:center;gap:10px;width:100%;";

    /* 재생 버튼 */
    var playBtn = document.createElement("button");
    playBtn.id = "btnPlayMyRecording";
    playBtn.type = "button";
    playBtn.style.cssText =
      "width:42px;height:42px;border-radius:50%;border:none;background:#4CAF50;" +
      "color:#fff;font-size:18px;cursor:pointer;display:flex;align-items:center;" +
      "justify-content:center;flex-shrink:0;-webkit-tap-highlight-color:transparent;outline:none;";
    playBtn.textContent = "\u25B6";
    playBtn.addEventListener("click", togglePlayback);
    row.appendChild(playBtn);

    /* 프로그레스 바 */
    var progressWrap = document.createElement("div");
    progressWrap.style.cssText =
      "flex:1;height:6px;background:rgba(255,255,255,0.2);border-radius:3px;" +
      "overflow:hidden;position:relative;cursor:pointer;";
    progressWrap.addEventListener("click", function (e) {
      if (audioPlayer && audioPlayer.duration) {
        var rect = progressWrap.getBoundingClientRect();
        var pct = (e.clientX - rect.left) / rect.width;
        audioPlayer.currentTime = pct * audioPlayer.duration;
      }
    });

    var progressBar = document.createElement("div");
    progressBar.id = "myRecordingProgress";
    progressBar.style.cssText =
      "height:100%;width:0%;background:#4CAF50;border-radius:3px;" +
      "transition:width 0.1s linear;";
    progressWrap.appendChild(progressBar);
    row.appendChild(progressWrap);

    /* 시간 표시 */
    var timeDisplay = document.createElement("span");
    timeDisplay.id = "myRecordingTime";
    timeDisplay.style.cssText =
      "color:#aaa;font-size:12px;min-width:36px;text-align:right;";
    timeDisplay.textContent = "0:00";
    row.appendChild(timeDisplay);

    container.appendChild(row);

    /* 다시 녹음 버튼 */
    var reRecordRow = document.createElement("div");
    reRecordRow.style.cssText = "width:100%;text-align:center;margin-top:4px;";
    var reBtn = document.createElement("button");
    reBtn.type = "button";
    reBtn.style.cssText =
      "background:none;border:1px solid rgba(255,255,255,0.3);color:#ccc;" +
      "font-size:12px;padding:4px 14px;border-radius:12px;cursor:pointer;" +
      "-webkit-tap-highlight-color:transparent;outline:none;";
    reBtn.textContent = "\uD83D\uDD04 다시 녹음";
    reBtn.addEventListener("click", function () {
      var player = document.getElementById("myRecordingPlayer");
      if (player) player.remove();
      if (audioPlayer) {
        audioPlayer.pause();
        audioPlayer = null;
      }
      clearInterval(progressTimer);
      isPlaying = false;
      startUserRecording();
    });
    reRecordRow.appendChild(reBtn);
    container.appendChild(reRecordRow);

    return container;
  }

  function formatTime(sec) {
    var m = Math.floor(sec / 60);
    var s = Math.floor(sec % 60);
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  /* ── 재생 토글 ── */
  function togglePlayback() {
    if (!userAudioURL) return;
    if (!audioPlayer) {
      audioPlayer = new Audio(userAudioURL);
      audioPlayer.addEventListener("ended", function () {
        isPlaying = false;
        clearInterval(progressTimer);
        var btn = document.getElementById("btnPlayMyRecording");
        if (btn) btn.textContent = "\u25B6";
        var bar = document.getElementById("myRecordingProgress");
        if (bar) bar.style.width = "0%";
        var time = document.getElementById("myRecordingTime");
        if (time && audioPlayer) time.textContent = formatTime(audioPlayer.duration || 0);
        audioPlayer = null;
      });
      audioPlayer.addEventListener("loadedmetadata", function () {
        var time = document.getElementById("myRecordingTime");
        if (time) time.textContent = formatTime(audioPlayer.duration || 0);
      });
    }
    if (isPlaying) {
      audioPlayer.pause();
      isPlaying = false;
      clearInterval(progressTimer);
      var btn = document.getElementById("btnPlayMyRecording");
      if (btn) btn.textContent = "\u25B6";
    } else {
      audioPlayer.play().then(function () {
        isPlaying = true;
        var btn = document.getElementById("btnPlayMyRecording");
        if (btn) btn.textContent = "\u23F8";
        progressTimer = setInterval(function () {
          if (audioPlayer && audioPlayer.duration) {
            var pct = (audioPlayer.currentTime / audioPlayer.duration) * 100;
            var bar = document.getElementById("myRecordingProgress");
            if (bar) bar.style.width = pct + "%";
            var time = document.getElementById("myRecordingTime");
            if (time) time.textContent = formatTime(audioPlayer.currentTime);
          }
        }, 100);
      }).catch(function (e) {
        console.warn("[rec-v4] play fail:", e);
      });
    }
  }

  /* ── 녹음 섹션 주입 (피드백 표시 후) ── */
  function injectRecordSection() {
    if (!isRecordingSupported()) {
      console.log("[rec-v4] recording not supported, skip");
      return;
    }

    setTimeout(function () {
      var feedbackSection = document.querySelector("section.feedback");
      if (!feedbackSection) {
        console.log("[rec-v4] no feedback section");
        return;
      }

      /* 이전 UI 제거 */
      var existingSection = document.getElementById("myRecordingSection");
      if (existingSection) existingSection.remove();
      var existingPlayer = document.getElementById("myRecordingPlayer");
      if (existingPlayer) existingPlayer.remove();

      /* 이전 녹음 정리 */
      if (isRecordingUser) stopUserRecording();
      if (userAudioURL) {
        URL.revokeObjectURL(userAudioURL);
        userAudioURL = null;
      }
      userAudioBlob = null;
      if (audioPlayer) {
        audioPlayer.pause();
        audioPlayer = null;
      }

      var recordUI = createRecordUI();

      /* feedback__comparison 다음에 삽입 */
      var comparison = feedbackSection.querySelector(".feedback__comparison");
      if (comparison) {
        comparison.parentNode.insertBefore(recordUI, comparison.nextSibling);
      } else {
        var ttl = feedbackSection.querySelector(".feedback__title");
        if (ttl) {
          ttl.parentNode.insertBefore(recordUI, ttl.nextSibling);
        } else {
          feedbackSection.appendChild(recordUI);
        }
      }
      console.log("[rec-v4] record section injected!");
    }, 300);
  }

  /* ── 플레이어 주입 (녹음 완료 후) ── */
  function injectPlayer() {
    if (!userAudioURL) return;

    var section = document.getElementById("myRecordingSection");
    if (!section) {
      var feedbackSection = document.querySelector("section.feedback");
      if (!feedbackSection) return;
      section = feedbackSection;
    }

    var existingPlayer = document.getElementById("myRecordingPlayer");
    if (existingPlayer) existingPlayer.remove();

    var playerUI = createPlayerUI();
    section.parentNode.insertBefore(playerUI, section.nextSibling);
    console.log("[rec-v4] player injected!");

    /* 녹음 버튼 완료 표시 */
    var recordBtn = document.getElementById("btnRecordMyVoice");
    if (recordBtn) {
      recordBtn.textContent = "\u2705 녹음 완료!";
      recordBtn.style.background = "#4CAF50";
      setTimeout(function () {
        updateRecordButton(false);
      }, 2000);
    }
  }

  /* ── 핵심: showFeedback 패치 ── */
  function patchFunctions() {
    _origShowFeedback = window.showFeedback;

    if (typeof _origShowFeedback === "function") {
      window.showFeedback = function () {
        /* 녹음 중이면 중지 */
        if (isRecordingUser) stopUserRecording();

        /* 원래 showFeedback 실행 */
        _origShowFeedback.apply(this, arguments);

        /* 녹음 섹션 주입 */
        console.log("[rec-v4] showFeedback called, injecting record section");
        injectRecordSection();
      };
    }

    console.log("[rec-v4] init OK - sequential recording mode");
  }

  /* ── 초기화 ── */
  function initialize() {
    if (typeof window.showFeedback === "function") {
      patchFunctions();
    } else {
      setTimeout(initialize, 100);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      setTimeout(initialize, 200);
    });
  } else {
    setTimeout(initialize, 200);
  }

  /* ── public API ── */
  window._myRecordingPlayback = {
    getBlob: function () { return userAudioBlob; },
    getURL: function () { return userAudioURL; },
    isSupported: isRecordingSupported,
    startRecording: startUserRecording,
    stopRecording: stopUserRecording,
    injectRecordSection: injectRecordSection
  };
})();
