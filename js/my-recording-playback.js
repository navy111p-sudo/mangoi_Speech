/**
 * ===========================
 * 내가 말한 음성 듣기 v3
 * 핵심 변경:
 * 1) SpeechRecognition 먼저 → getUserMedia 병렬 (모바일 호환)
 * 2) blob 생성 대기 후 플레이어 주입 (레이스컨디션 해결)
 * 3) 스트림 정리를 피드백 표시 후로 지연
 * PC + 모바일(iOS/Android) 호환
 * ===========================
 */
(function () {
  "use strict";

  /* state */
  var mediaRecorder = null;
  var audioChunks = [];
  var userAudioBlob = null;
  var userAudioURL = null;
  var audioPlayer = null;
  var audioStream = null;
  var isPlaying = false;
  var progressTimer = null;
  var recordingSupported = true;
  var blobReady = false;
  var feedbackShown = false;

  /* saved originals */
  var _origStartRecording = null;
  var _origStopRecording = null;
  var _origShowFeedback = null;

  /* MIME type selection */
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

  /* MediaRecorder start */
  function startMediaRecorder(stream) {
    audioChunks = [];
    var mimeType = chooseMimeType();
    try {
      var opts = mimeType ? { mimeType: mimeType } : {};
      mediaRecorder = new MediaRecorder(stream, opts);
    } catch (e1) {
      try {
        mediaRecorder = new MediaRecorder(stream);
      } catch (e2) {
        console.warn("[rec-v3] MediaRecorder fail:", e2);
        recordingSupported = false;
        return;
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
      }
      blobReady = true;
      console.log("[rec-v3] blob ready:", !!userAudioURL);
      if (feedbackShown) {
        injectPlayer();
      }
    };
    mediaRecorder.start();
    console.log("[rec-v3] MediaRecorder started");
  }

  /* stream cleanup */
  function cleanupStream() {
    if (audioStream) {
      try {
        audioStream.getTracks().forEach(function (t) { t.stop(); });
      } catch (e) {}
      audioStream = null;
    }
  }

  /* stop MediaRecorder */
  function stopMediaRecorder() {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      try {
        mediaRecorder.stop();
      } catch (e) {}
    }
    setTimeout(cleanupStream, 2000);
  }

  /* patch functions */
  function patchFunctions() {
    _origStartRecording = window.startRecording;
    _origStopRecording = window.stopRecording;
    _origShowFeedback = window.showFeedback;

    /* startRecording patch */
    window.startRecording = function () {
      audioChunks = [];
      userAudioBlob = null;
      blobReady = false;
      feedbackShown = false;
      if (userAudioURL) {
        URL.revokeObjectURL(userAudioURL);
        userAudioURL = null;
      }
      audioPlayer = null;
      isPlaying = false;

      var existing = document.getElementById("myRecordingPlayer");
      if (existing) existing.remove();

      /* 1) SpeechRecognition first */
      if (typeof _origStartRecording === "function") {
        _origStartRecording();
      }

      /* 2) getUserMedia + MediaRecorder parallel */
      if (
        recordingSupported &&
        typeof MediaRecorder !== "undefined" &&
        navigator.mediaDevices &&
        navigator.mediaDevices.getUserMedia
      ) {
        navigator.mediaDevices
          .getUserMedia({ audio: true })
          .then(function (stream) {
            audioStream = stream;
            startMediaRecorder(stream);
          })
          .catch(function (err) {
            console.warn("[rec-v3] getUserMedia fail:", err);
            recordingSupported = false;
            blobReady = true;
          });
      } else {
        blobReady = true;
      }
    };

    /* stopRecording patch */
    window.stopRecording = function () {
      stopMediaRecorder();
      if (typeof _origStopRecording === "function") {
        _origStopRecording();
      }
    };

    /* showFeedback patch */
    if (typeof _origShowFeedback === "function") {
      window.showFeedback = function () {
        _origShowFeedback.apply(this, arguments);
        feedbackShown = true;
        console.log("[rec-v3] showFeedback called, blobReady:", blobReady);
        if (blobReady) {
          injectPlayer();
        }
      };
    }
  }

  /* player UI */
  function createPlayerUI() {
    var existing = document.getElementById("myRecordingPlayer");
    if (existing) existing.remove();

    var container = document.createElement("div");
    container.id = "myRecordingPlayer";
    container.style.cssText =
      "background:rgba(30,30,60,0.92);border-radius:16px;padding:14px 18px;" +
      "margin:14px auto;max-width:340px;display:flex;flex-direction:column;" +
      "align-items:center;gap:8px;box-shadow:0 2px 16px rgba(0,0,0,0.25);";

    var title = document.createElement("div");
    title.style.cssText =
      "color:#c8c8ff;font-size:14px;font-weight:600;display:flex;" +
      "align-items:center;gap:6px;width:100%;";
    title.textContent = "\uD83C\uDFA7 \uB0B4\uAC00 \uB9D0\uD55C \uC74C\uC131 \uB4E3\uAE30";
    container.appendChild(title);

    var row = document.createElement("div");
    row.style.cssText = "display:flex;align-items:center;gap:10px;width:100%;";

    var playBtn = document.createElement("button");
    playBtn.id = "btnPlayMyRecording";
    playBtn.type = "button";
    playBtn.style.cssText =
      "width:42px;height:42px;border-radius:50%;border:none;background:#2196F3;" +
      "color:#fff;font-size:18px;cursor:pointer;display:flex;align-items:center;" +
      "justify-content:center;flex-shrink:0;-webkit-tap-highlight-color:transparent;outline:none;";
    playBtn.textContent = "\u25B6";
    playBtn.addEventListener("click", togglePlayback);
    row.appendChild(playBtn);

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
      "height:100%;width:0%;background:#2196F3;border-radius:3px;" +
      "transition:width 0.1s linear;";
    progressWrap.appendChild(progressBar);
    row.appendChild(progressWrap);

    var timeDisplay = document.createElement("span");
    timeDisplay.id = "myRecordingTime";
    timeDisplay.style.cssText =
      "color:#aaa;font-size:12px;min-width:36px;text-align:right;";
    timeDisplay.textContent = "0:00";
    row.appendChild(timeDisplay);

    container.appendChild(row);
    return container;
  }

  function formatTime(sec) {
    var m = Math.floor(sec / 60);
    var s = Math.floor(sec % 60);
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  /* toggle playback */
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
        console.warn("[rec-v3] play fail:", e);
      });
    }
  }

  /* inject player */
  function injectPlayer() {
    if (!userAudioURL) {
      console.log("[rec-v3] injectPlayer: no audioURL, skip");
      return;
    }
    setTimeout(function () {
      if (!userAudioURL) return;
      var feedbackSection = document.querySelector("section.feedback");
      if (!feedbackSection) {
        console.log("[rec-v3] injectPlayer: no feedback section");
        return;
      }
      var existing = document.getElementById("myRecordingPlayer");
      if (existing) existing.remove();

      var playerUI = createPlayerUI();

      var comparison = feedbackSection.querySelector(".feedback__comparison");
      if (comparison) {
        comparison.parentNode.insertBefore(playerUI, comparison.nextSibling);
      } else {
        var ttl = feedbackSection.querySelector(".feedback__title");
        if (ttl) {
          ttl.parentNode.insertBefore(playerUI, ttl.nextSibling);
        } else {
          feedbackSection.appendChild(playerUI);
        }
      }
      console.log("[rec-v3] player injected!");
    }, 300);
  }

  /* initialize */
  function initialize() {
    if (
      typeof window.startRecording === "function" &&
      typeof window.stopRecording === "function"
    ) {
      patchFunctions();
      console.log("[rec-v3] init OK - SpeechRecognition first, then getUserMedia");
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

  /* public API */
  window._myRecordingPlayback = {
    getBlob: function () { return userAudioBlob; },
    getURL: function () { return userAudioURL; },
    isSupported: function () { return recordingSupported; },
    injectPlayer: injectPlayer
  };
})();
