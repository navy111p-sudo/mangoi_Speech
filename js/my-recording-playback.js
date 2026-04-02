/**
 * ===========================
 * 내가 말한 음성 듣기 v8
 *
 * v8 핵심 변경:
 * - showFeedback 패치 제거 → MutationObserver로 피드백 섹션 감지
 * - 피드백 섹션이 보이면 무조건 버튼 삽입 (타이밍 문제 해결)
 * - 자동 녹음 blob이 있으면 "내 음성 듣기", 없으면 "내 발음 녹음" 표시
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

  /* ── 자동 녹음 상태 ── */
  var autoRecording = false;
  var autoRecordFailed = false;
  var blobReady = false;

  /* ── 수동 녹음 상태 ── */
  var isManualRecording = false;

  /* ── saved originals ── */
  var _origStartRecording = null;
  var _origStopRecording = null;

  /* ── 버튼 이미 삽입 여부 ── */
  var buttonInjected = false;

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

  function isRecordingSupported() {
    return (
      typeof MediaRecorder !== "undefined" &&
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === "function"
    );
  }

  /* ── stream cleanup ── */
  function cleanupStream(delay) {
    if (delay) {
      var s = audioStream;
      audioStream = null;
      setTimeout(function () {
        if (s) try { s.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
      }, delay);
    } else {
      if (audioStream) {
        try { audioStream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
        audioStream = null;
      }
    }
  }

  /* ── MediaRecorder 시작 ── */
  function startMediaRecorder(stream) {
    audioChunks = [];
    var mimeType = chooseMimeType();
    try {
      mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType: mimeType })
        : new MediaRecorder(stream);
    } catch (e) {
      try { mediaRecorder = new MediaRecorder(stream); } catch (e2) {
        console.warn("[rec-v8] MediaRecorder create fail");
        return false;
      }
    }
    mediaRecorder.ondataavailable = function (e) {
      if (e.data && e.data.size > 0) audioChunks.push(e.data);
    };
    mediaRecorder.onstop = function () {
      if (audioChunks.length > 0) {
        userAudioBlob = new Blob(audioChunks, {
          type: mediaRecorder.mimeType || "audio/webm"
        });
        userAudioURL = URL.createObjectURL(userAudioBlob);
        console.log("[rec-v8] blob ready, size=" + userAudioBlob.size);
      }
      blobReady = true;
      // blob 준비 완료 → 이미 피드백이 보이고 있으면 버튼 갱신
      tryInjectButton();
    };
    mediaRecorder.start();
    return true;
  }

  /* ── 상태 리셋 ── */
  function resetAutoState() {
    if (userAudioURL) { URL.revokeObjectURL(userAudioURL); userAudioURL = null; }
    userAudioBlob = null;
    audioChunks = [];
    if (audioPlayer) { audioPlayer.pause(); audioPlayer = null; }
    isPlaying = false;
    clearInterval(progressTimer);
    blobReady = false;
    autoRecording = false;
    autoRecordFailed = false;
    buttonInjected = false;

    // 기존 UI 제거
    var els = ["myVoicePlayBtn", "myRecordingPlayer", "myRecordingSection", "btnRecordMyVoice"];
    for (var i = 0; i < els.length; i++) {
      var el = document.getElementById(els[i]);
      if (el) el.remove();
    }
  }

  /* ══════════════════════════════════════
     A) 자동 녹음 - startRecording 패치
     ══════════════════════════════════════ */
  function patchStartRecording() {
    if (!window.startRecording) return;
    var _origStartRecording = window.startRecording;
    window.startRecording = function () {
      console.log("[rec-v10] patched startRecording (mobile-fix)");
      // 모바일 호환: getUserMedia를 먼저 호출하여 마이크 권한 확보 후 음성인식 시작
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
        }).then(function (stream) {
          console.log("[rec-v10] mic permission granted, starting recognition + recorder");
          // 마이크 권한 확보 후 음성인식 시작
          if (typeof _origStartRecording === "function") {
            _origStartRecording();
          }
          // MediaRecorder 시작
          startMediaRecorder(stream);
          autoRecording = true;
        }).catch(function (err) {
          console.warn("[rec-v10] getUserMedia failed:", err.name, err.message);
          // 마이크 권한 실패해도 음성인식은 시도
          if (typeof _origStartRecording === "function") {
            _origStartRecording();
          }
        });
      } else {
        // mediaDevices 미지원 시 원래 함수만 호출
        if (typeof _origStartRecording === "function") {
          _origStartRecording();
        }
      }
    };
    console.log("[rec-v10] startRecording patched (mobile-compatible)");
  }

  /* ══════════════════════════════════════
     stopRecording 패치
     ══════════════════════════════════════ */
  function patchStopRecording() {
    window.stopRecording = function () {
      if (autoRecording && mediaRecorder && mediaRecorder.state !== "inactive") {
        try { mediaRecorder.stop(); } catch (e) {}
        autoRecording = false;
      }
      cleanupStream(2000);
      if (typeof _origStopRecording === "function") {
        _origStopRecording();
      }
    };
  }

  /* ══════════════════════════════════════
     피드백 섹션 감지 → 버튼 삽입 (핵심 로직)
     ══════════════════════════════════════ */
  function isFeedbackVisible() {
    var fs = document.querySelector("section.feedback, #feedbackSection");
    if (!fs) return false;
    var style = window.getComputedStyle(fs);
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
    // "visible" 또는 "is-visible" 클래스 체크
    if (fs.classList.contains("visible") || fs.classList.contains("is-visible")) return true;
    // 클래스 없어도 display가 none이 아니면 보이는 것
    return true;
  }

  function tryInjectButton() {
    if (!isFeedbackVisible()) return;
    if (buttonInjected && document.getElementById("myVoicePlayBtn")) return;

    var listenBtnDiv = document.querySelector(".feedback__listen-btn");
    if (!listenBtnDiv) return;

    console.log("[rec-v8] feedback visible, injecting button | blobReady=" + blobReady +
      " | autoFailed=" + autoRecordFailed + " | hasURL=" + !!userAudioURL);

    if (userAudioURL) {
      injectPlayButton();
    } else if (autoRecordFailed || (blobReady && !userAudioURL)) {
      injectManualRecordButton();
    } else {
      // 아직 녹음 중이거나 blob 미준비 → 수동 녹음 버튼을 기본으로 표시
      // (blob 준비되메 onstop에서 다시 호출되어 재생 버튼으로 교체)
      injectManualRecordButton();
    }

    buttonInjected = true;
  }

  /* ══════════════════════════════════════
     MutationObserver: 피드백 섹션 감시
     ══════════════════════════════════════ */
  function startFeedbackObserver() {
    // 1) MutationObserver로 DOM 변화 감시
    var observer = new MutationObserver(function () {
      tryInjectButton();
    });

    // body 전체를 감시 (class, style, display 변화 모두 감지)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style", "hidden"]
    });

    // 2) 안전장치: 1초 간격으로 폴링 (Observer 놓치는 경우 대비)
    setInterval(function () {
      tryInjectButton();
    }, 1000);

    console.log("[rec-v8] feedback observer started");
  }

  /* ══════════════════════════════════════
     🎧 "내 음성 듣기" 버튼
     ══════════════════════════════════════ */
  function injectPlayButton() {
    if (!userAudioURL) return;

    // 기존 버튼/플레이어 제거
    var existing = document.getElementById("myVoicePlayBtn");
    if (existing) existing.remove();
    var existingPlayer = document.getElementById("myRecordingPlayer");
    if (existingPlayer) existingPlayer.remove();
    var existingSection = document.getElementById("myRecordingSection");
    if (existingSection) existingSection.remove();

    var listenBtnDiv = document.querySelector(".feedback__listen-btn");
    if (!listenBtnDiv) return;

    // 버튼 컨테이너를 flex로 변경하여 나란히 배치
    listenBtnDiv.style.display = "flex";
    listenBtnDiv.style.justifyContent = "center";
    listenBtnDiv.style.alignItems = "center";
    listenBtnDiv.style.gap = "10px";
    listenBtnDiv.style.flexWrap = "wrap";

    var btn = document.createElement("button");
    btn.id = "myVoicePlayBtn";
    btn.type = "button";
    btn.className = "btn btn--listen";
    btn.style.cssText =
      "background: linear-gradient(135deg, #10b981, #059669);" +
      "color: #fff; border: none; padding: 0.65rem 1.2rem; border-radius: 0.75rem;" +
      "font-size: 0.9rem; font-weight: 600; cursor: pointer; display: inline-flex;" +
      "align-items: center; gap: 6px; box-shadow: 0 2px 8px rgba(16,185,129,0.3);" +
      "transition: all 0.2s ease;";
    btn.textContent = "\uD83C\uDFA7 내 음성 듣기";

    btn.addEventListener("mouseenter", function() {
      btn.style.transform = "translateY(-1px)";
      btn.style.boxShadow = "0 4px 12px rgba(16,185,129,0.4)";
    });
    btn.addEventListener("mouseleave", function() {
      btn.style.transform = "translateY(0)";
      btn.style.boxShadow = "0 2px 8px rgba(16,185,129,0.3)";
    });

    btn.addEventListener("click", function () {
      toggleInlinePlayer();
    });

    listenBtnDiv.appendChild(btn);
    console.log("[rec-v8] play button injected");
  }

  /* ── 인라인 미니 플레이어 토글 ── */
  function toggleInlinePlayer() {
    var existing = document.getElementById("myRecordingPlayer");
    if (existing) {
      if (audioPlayer) { audioPlayer.pause(); audioPlayer = null; }
      isPlaying = false;
      clearInterval(progressTimer);
      existing.remove();
      return;
    }
    showMiniPlayer();
  }

  function showMiniPlayer() {
    if (!userAudioURL) return;

    var listenBtnDiv = document.querySelector(".feedback__listen-btn");
    if (!listenBtnDiv) return;

    var playerUI = document.createElement("div");
    playerUI.id = "myRecordingPlayer";
    playerUI.style.cssText =
      "width: 100%; max-width: 360px; margin: 10px auto 0;" +
      "background: linear-gradient(135deg, rgba(16,185,129,0.15), rgba(5,150,105,0.1));" +
      "border: 1.5px solid rgba(16,185,129,0.3); border-radius: 14px;" +
      "padding: 12px 16px; display: flex; align-items: center; gap: 10px;" +
      "animation: fadeInPlayer 0.3s ease;";

    if (!document.getElementById("recPlayerStyle")) {
      var style = document.createElement("style");
      style.id = "recPlayerStyle";
      style.textContent =
        "@keyframes fadeInPlayer{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}" +
        "@keyframes recPulse{0%,100%{opacity:1}50%{opacity:0.6}}";
      document.head.appendChild(style);
    }

    // 재생/일시정지 버튼
    var playBtn = document.createElement("button");
    playBtn.id = "btnPlayMyRec";
    playBtn.type = "button";
    playBtn.style.cssText =
      "width: 38px; height: 38px; border-radius: 50%; border: none;" +
      "background: linear-gradient(135deg, #10b981, #059669);" +
      "color: #fff; font-size: 16px; cursor: pointer; display: flex;" +
      "align-items: center; justify-content: center; flex-shrink: 0;" +
      "box-shadow: 0 2px 8px rgba(16,185,129,0.3);";
    playBtn.textContent = "\u25B6";
    playBtn.addEventListener("click", doTogglePlayback);
    playerUI.appendChild(playBtn);

    // 프로그레스 바
    var progressWrap = document.createElement("div");
    progressWrap.style.cssText =
      "flex: 1; height: 6px; background: rgba(16,185,129,0.2);" +
      "border-radius: 3px; overflow: hidden; cursor: pointer;";
    progressWrap.addEventListener("click", function (e) {
      if (audioPlayer && audioPlayer.duration) {
        var rect = progressWrap.getBoundingClientRect();
        audioPlayer.currentTime = ((e.clientX - rect.left) / rect.width) * audioPlayer.duration;
      }
    });

    var progressBar = document.createElement("div");
    progressBar.id = "myRecProgress";
    progressBar.style.cssText =
      "height: 100%; width: 0%; background: linear-gradient(90deg, #10b981, #34d399);" +
      "border-radius: 3px; transition: width 0.1s linear;";
    progressWrap.appendChild(progressBar);
    playerUI.appendChild(progressWrap);

    // 시간 표시
    var timeDisp = document.createElement("span");
    timeDisp.id = "myRecTime";
    timeDisp.style.cssText = "color: #059669; font-size: 12px; font-weight: 600; min-width: 36px; text-align: right;";
    timeDisp.textContent = "0:00";
    playerUI.appendChild(timeDisp);

    // 닫기 버튼
    var closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.style.cssText =
      "width: 24px; height: 24px; border-radius: 50%; border: none;" +
      "background: rgba(0,0,0,0.1); color: #666; font-size: 12px;" +
      "cursor: pointer; display: flex; align-items: center; justify-content: center;";
    closeBtn.textContent = "\u2715";
    closeBtn.addEventListener("click", function () {
      if (audioPlayer) { audioPlayer.pause(); audioPlayer = null; }
      isPlaying = false;
      clearInterval(progressTimer);
      playerUI.remove();
    });
    playerUI.appendChild(closeBtn);

    listenBtnDiv.parentNode.insertBefore(playerUI, listenBtnDiv.nextSibling);

    // 자동 재생 시작
    doTogglePlayback();
  }

  function formatTime(sec) {
    var m = Math.floor(sec / 60);
    var s = Math.floor(sec % 60);
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  function doTogglePlayback() {
    if (!userAudioURL) return;

    if (!audioPlayer) {
      audioPlayer = new Audio(userAudioURL);
      audioPlayer.addEventListener("ended", function () {
        isPlaying = false;
        clearInterval(progressTimer);
        var b = document.getElementById("btnPlayMyRec");
        if (b) b.textContent = "\u25B6";
        var bar = document.getElementById("myRecProgress");
        if (bar) bar.style.width = "0%";
        var t = document.getElementById("myRecTime");
        if (t && audioPlayer) t.textContent = formatTime(audioPlayer.duration || 0);
        audioPlayer = null;
      });
      audioPlayer.addEventListener("loadedmetadata", function () {
        var t = document.getElementById("myRecTime");
        if (t) t.textContent = formatTime(audioPlayer.duration || 0);
      });
    }

    if (isPlaying) {
      audioPlayer.pause();
      isPlaying = false;
      clearInterval(progressTimer);
      var b = document.getElementById("btnPlayMyRec");
      if (b) b.textContent = "\u25B6";
    } else {
      audioPlayer.play().then(function () {
        isPlaying = true;
        var b = document.getElementById("btnPlayMyRec");
        if (b) b.textContent = "\u23F8";
        progressTimer = setInterval(function () {
          if (audioPlayer && audioPlayer.duration) {
            var pct = (audioPlayer.currentTime / audioPlayer.duration) * 100;
            var bar = document.getElementById("myRecProgress");
            if (bar) bar.style.width = pct + "%";
            var t = document.getElementById("myRecTime");
            if (t) t.textContent = formatTime(audioPlayer.currentTime);
          }
        }, 100);
      }).catch(function (e) {
        console.warn("[rec-v8] play fail:", e);
      });
    }
  }

  /* ══════════════════════════════════════
     B) 수동 녹음 (모바일 fallback)
     ══════════════════════════════════════ */
  function injectManualRecordButton() {
    if (!isRecordingSupported()) return;

    var existing = document.getElementById("myVoicePlayBtn");
    if (existing) existing.remove();
    var existingSection = document.getElementById("myRecordingSection");
    if (existingSection) existingSection.remove();

    var listenBtnDiv = document.querySelector(".feedback__listen-btn");
    if (!listenBtnDiv) return;

    listenBtnDiv.style.display = "flex";
    listenBtnDiv.style.justifyContent = "center";
    listenBtnDiv.style.alignItems = "center";
    listenBtnDiv.style.gap = "10px";
    listenBtnDiv.style.flexWrap = "wrap";

    var btn = document.createElement("button");
    btn.id = "myVoicePlayBtn";
    btn.type = "button";
    btn.className = "btn btn--listen";
    btn.style.cssText =
      "background: linear-gradient(135deg, #3b82f6, #2563eb);" +
      "color: #fff; border: none; padding: 0.65rem 1.2rem; border-radius: 0.75rem;" +
      "font-size: 0.9rem; font-weight: 600; cursor: pointer; display: inline-flex;" +
      "align-items: center; gap: 6px; box-shadow: 0 2px 8px rgba(59,130,246,0.3);" +
      "transition: all 0.2s ease;";
    btn.textContent = "\uD83C\uDFA4 내 발음 녹음";

    btn.addEventListener("click", function () {
      if (isManualRecording) {
        stopManualRecording();
      } else if (userAudioURL) {
        toggleInlinePlayer();
      } else {
        startManualRecording(btn);
      }
    });

    listenBtnDiv.appendChild(btn);

    var guide = document.createElement("div");
    guide.id = "myRecordingSection";
    guide.style.cssText =
      "text-align: center; margin-top: 6px; font-size: 0.78rem;" +
      "color: #64748b; font-weight: 500;";
    guide.textContent = "\uBC84\uD2BC\uC744 \uB20C\uB7EC \uB0B4 \uBC1C\uC74C\uC744 \uB179\uC74C\uD558\uACE0 \uB4E4\uC5B4\uBCF4\uC138\uC694";
    listenBtnDiv.parentNode.insertBefore(guide, listenBtnDiv.nextSibling);

    console.log("[rec-v8] manual record button injected");
  }

  function startManualRecording(triggerBtn) {
    if (isManualRecording) return;
    if (!isRecordingSupported()) return;

    if (userAudioURL) { URL.revokeObjectURL(userAudioURL); userAudioURL = null; }
    userAudioBlob = null;
    audioChunks = [];
    if (audioPlayer) { audioPlayer.pause(); audioPlayer = null; }
    isPlaying = false;
    clearInterval(progressTimer);

    var existingPlayer = document.getElementById("myRecordingPlayer");
    if (existingPlayer) existingPlayer.remove();

    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(function (stream) {
        audioStream = stream;
        audioChunks = [];
        var mimeType = chooseMimeType();
        try {
          mediaRecorder = mimeType
            ? new MediaRecorder(stream, { mimeType: mimeType })
            : new MediaRecorder(stream);
        } catch (e) {
          try { mediaRecorder = new MediaRecorder(stream); } catch (e2) {
            cleanupStream(0);
            return;
          }
        }

        mediaRecorder.ondataavailable = function (e) {
          if (e.data && e.data.size > 0) audioChunks.push(e.data);
        };

        mediaRecorder.onstop = function () {
          cleanupStream(0);
          if (audioChunks.length > 0) {
            userAudioBlob = new Blob(audioChunks, {
              type: mediaRecorder.mimeType || "audio/webm"
            });
            userAudioURL = URL.createObjectURL(userAudioBlob);
          }
          isManualRecording = false;
          updateManualButton(false);
          if (userAudioURL) {
            showMiniPlayer();
          }
        };

        mediaRecorder.start();
        isManualRecording = true;
        updateManualButton(true);
        console.log("[rec-v8] manual recording started");
      })
      .catch(function (err) {
        console.warn("[rec-v8] manual getUserMedia fail:", err);
        cleanupStream(0);
      });
  }

  function stopManualRecording() {
    if (!isManualRecording || !mediaRecorder) return;
    if (mediaRecorder.state !== "inactive") {
      try { mediaRecorder.stop(); } catch (e) {}
    }
  }

  function updateManualButton(recording) {
    var btn = document.getElementById("myVoicePlayBtn");
    if (!btn) return;
    if (recording) {
      btn.textContent = "\u23F9 녹음 중지";
      btn.style.background = "linear-gradient(135deg, #ef4444, #dc2626)";
      btn.style.boxShadow = "0 2px 8px rgba(239,68,68,0.4)";
      btn.style.animation = "recPulse 1s infinite";

      if (!document.getElementById("recPlayerStyle")) {
        var style = document.createElement("style");
        style.id = "recPlayerStyle";
        style.textContent =
          "@keyframes fadeInPlayer{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}" +
          "@keyframes recPulse{0%,100%{opacity:1}50%{opacity:0.6}}";
        document.head.appendChild(style);
      }
    } else {
      if (userAudioURL) {
        btn.textContent = "\uD83C\uDFA7 내 음성 듣기";
        btn.style.background = "linear-gradient(135deg, #10b981, #059669)";
        btn.style.boxShadow = "0 2px 8px rgba(16,185,129,0.3)";
      } else {
        btn.textContent = "\uD83C\uDFA4 내 발음 녹음";
        btn.style.background = "linear-gradient(135deg, #3b82f6, #2563eb)";
        btn.style.boxShadow = "0 2px 8px rgba(59,130,246,0.3)";
      }
      btn.style.animation = "none";
    }
  }

  /* ══════════════════════════════════════
     초기화
     ════════════════════════════ */
  function initPatches() {
    // startRecording, stopRecording이 있으면 패치
    if (typeof window.startRecording === "function") {
      _origStartRecording = window.startRecording;
      patchStartRecording();
      console.log("[rec-v8] startRecording patched");
    }
    if (typeof window.stopRecording === "function") {
      _origStopRecording = window.stopRecording;
      patchStopRecording();
      console.log("[rec-v8] stopRecording patched");
    }
  }

  function initialize() {
    // 먼저 패치 시도
    if (typeof window.startRecording === "function" && typeof window.stopRecording === "function") {
      initPatches();
    } else {
      // 아직 main.js가 로드 안됨 → 기다림
      var retries = 0;
      var waitForFunctions = setInterval(function () {
        retries++;
        if (typeof window.startRecording === "function" && typeof window.stopRecording === "function") {
          clearInterval(waitForFunctions);
          initPatches();
        } else if (retries > 50) {
          clearInterval(waitForFunctions);
          console.warn("[rec-v8] startRecording/stopRecording not found after 5s, proceeding without patches");
        }
      }, 100);
    }

    // MutationObserver 시작 (패치와 독립적)
    startFeedbackObserver();
    console.log("[rec-v8] init OK - observer mode");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      setTimeout(initialize, 200);
    });
  } else {
    setTimeout(initialize, 200);
  }

  /* main.js에서 호출: MediaRecorder 중지 */
  window._stopMediaRecorder = function () {
    if (autoRecording && mediaRecorder && mediaRecorder.state !== "inactive") {
      try { mediaRecorder.stop(); } catch (e) {}
      autoRecording = false;
      console.log("[rec-v8] MediaRecorder stopped via _stopMediaRecorder");
    }
    cleanupStream(2000);
  };

  window._myRecordingPlayback = {
    getBlob: function () { return userAudioBlob; },
    getURL: function () { return userAudioURL; },
    isSupported: isRecordingSupported,
    version: "v10-mobile-fix",
    debug: function () {
      return {
        autoRecording: autoRecording,
        autoRecordFailed: autoRecordFailed,
        blobReady: blobReady,
        buttonInjected: buttonInjected,
        hasURL: !!userAudioURL,
        feedbackVisible: isFeedbackVisible()
      };
    }
  };
})();
