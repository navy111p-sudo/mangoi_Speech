/**
 * ===========================
 * 내가 말한 음성 듣기 기능 v2
 * 모바일 Chrome 호환 해결:
 *   getUserMedia를 먼저 열고 → SpeechRecognition을 나중에 시작
 *   SpeechRecognition 실패 시 → 녹음 없이 기존 방식으로 fallback
 * PC + 모바일(iOS/Android) 호환
 * ===========================
 */
(function () {
  "use strict";

  var mediaRecorder = null;
  var audioChunks = [];
  var userAudioBlob = null;
  var userAudioURL = null;
  var audioPlayer = null;
  var audioStream = null;
  var isPlaying = false;
  var progressTimer = null;
  var recordingSupported = true;

  var _origStartRecording = null;
  var _origStopRecording = null;
  var _origShowFeedback = null;
  var _origToggleRecording = null;

  function chooseMimeType() {
    if (typeof MediaRecorder === "undefined") return "";
    if (typeof MediaRecorder.isTypeSupported !== "function") return "";
    var types = ["audio/webm;codecs=opus","audio/webm","audio/mp4","audio/ogg;codecs=opus","audio/ogg",""];
    for (var i = 0; i < types.length; i++) {
      if (!types[i] || MediaRecorder.isTypeSupported(types[i])) return types[i];
    }
    return "";
  }

  function startMediaRecorder(stream) {
    audioChunks = [];
    userAudioBlob = null;
    if (userAudioURL) { URL.revokeObjectURL(userAudioURL); userAudioURL = null; }
    audioPlayer = null;
    var mimeType = chooseMimeType();
    try {
      var opts = mimeType ? { mimeType: mimeType } : {};
      mediaRecorder = new MediaRecorder(stream, opts);
    } catch (e1) {
      try { mediaRecorder = new MediaRecorder(stream); } catch (e2) {
        console.warn("[rec] MediaRecorder fail:", e2);
        recordingSupported = false;
        return;
      }
    }
    mediaRecorder.ondataavailable = function (e) {
      if (e.data && e.data.size > 0) audioChunks.push(e.data);
    };
    mediaRecorder.onstop = function () {
      if (audioChunks.length > 0) {
        userAudioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType || "audio/webm" });
        userAudioURL = URL.createObjectURL(userAudioBlob);
      }
    };
    mediaRecorder.start();
  }

  function cleanupStream() {
    if (audioStream) {
      try { audioStream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
      audioStream = null;
    }
  }

  function stopMediaRecorder() {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      try { mediaRecorder.stop(); } catch (e) {}
    }
    setTimeout(cleanupStream, 200);
  }

  function patchToggleRecording() {
    _origToggleRecording = window.toggleRecording;
    _origStartRecording = window.startRecording;
    _origStopRecording = window.stopRecording;
    _origShowFeedback = window.showFeedback;

    window.startRecording = function () {
      audioChunks = [];
      userAudioBlob = null;
      if (userAudioURL) { URL.revokeObjectURL(userAudioURL); userAudioURL = null; }
      audioPlayer = null;

      if (recordingSupported && typeof MediaRecorder !== "undefined" && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
          audioStream = stream;
          startMediaRecorder(stream);
          setTimeout(function () {
            try {
              if (typeof _origStartRecording === "function") _origStartRecording();
            } catch (e) {
              console.warn("[rec] SpeechRecognition start fail, recording only:", e);
            }
          }, 50);
        }).catch(function (err) {
          console.warn("[rec] getUserMedia fail, fallback:", err);
          recordingSupported = false;
          if (typeof _origStartRecording === "function") _origStartRecording();
        });
      } else {
        if (typeof _origStartRecording === "function") _origStartRecording();
      }
    };

    window.stopRecording = function () {
      stopMediaRecorder();
      if (typeof _origStopRecording === "function") _origStopRecording();
    };

    if (typeof _origShowFeedback === "function") {
      window.showFeedback = function () {
        _origShowFeedback.apply(this, arguments);
        injectPlayer();
      };
    }
  }

  function createPlayerUI() {
    var existing = document.getElementById("myRecordingPlayer");
    if (existing) existing.remove();
    var container = document.createElement("div");
    container.id = "myRecordingPlayer";
    container.style.cssText = "background:rgba(30,30,60,0.85);border-radius:16px;padding:14px 18px;margin:12px auto;max-width:340px;display:flex;flex-direction:column;align-items:center;gap:8px;box-shadow:0 2px 12px rgba(0,0,0,0.2);";

    var title = document.createElement("div");
    title.style.cssText = "color:#c8c8ff;font-size:14px;font-weight:600;display:flex;align-items:center;gap:6px;";
    title.innerHTML = "&#x1F3A7; 내가 말한 음성 듣기";
    container.appendChild(title);

    var row = document.createElement("div");
    row.style.cssText = "display:flex;align-items:center;gap:10px;width:100%;";

    var playBtn = document.createElement("button");
    playBtn.id = "btnPlayMyRecording";
    playBtn.type = "button";
    playBtn.style.cssText = "width:40px;height:40px;border-radius:50%;border:none;background:#2196F3;color:#fff;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;-webkit-tap-highlight-color:transparent;outline:none;";
    playBtn.innerHTML = "&#9654;";
    playBtn.addEventListener("click", togglePlayback);
    row.appendChild(playBtn);

    var progressWrap = document.createElement("div");
    progressWrap.style.cssText = "flex:1;height:6px;background:rgba(255,255,255,0.2);border-radius:3px;overflow:hidden;position:relative;cursor:pointer;";
    progressWrap.addEventListener("click", function (e) {
      if (audioPlayer && audioPlayer.duration) {
        var rect = progressWrap.getBoundingClientRect();
        var pct = (e.clientX - rect.left) / rect.width;
        audioPlayer.currentTime = pct * audioPlayer.duration;
      }
    });
    var progressBar = document.createElement("div");
    progressBar.id = "myRecordingProgress";
    progressBar.style.cssText = "height:100%;width:0%;background:#2196F3;border-radius:3px;transition:width 0.1s linear;";
    progressWrap.appendChild(progressBar);
    row.appendChild(progressWrap);

    var timeDisplay = document.createElement("span");
    timeDisplay.id = "myRecordingTime";
    timeDisplay.style.cssText = "color:#aaa;font-size:12px;min-width:36px;text-align:right;";
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

  function togglePlayback() {
    if (!userAudioURL) return;
    if (!audioPlayer) {
      audioPlayer = new Audio(userAudioURL);
      audioPlayer.addEventListener("ended", function () {
        isPlaying = false;
        clearInterval(progressTimer);
        var btn = document.getElementById("btnPlayMyRecording");
        if (btn) btn.innerHTML = "&#9654;";
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
      if (btn) btn.innerHTML = "&#9654;";
    } else {
      audioPlayer.play().then(function () {
        isPlaying = true;
        var btn = document.getElementById("btnPlayMyRecording");
        if (btn) btn.innerHTML = "&#10074;&#10074;";
        progressTimer = setInterval(function () {
          if (audioPlayer && audioPlayer.duration) {
            var pct = (audioPlayer.currentTime / audioPlayer.duration) * 100;
            var bar = document.getElementById("myRecordingProgress");
            if (bar) bar.style.width = pct + "%";
            var time = document.getElementById("myRecordingTime");
            if (time) time.textContent = formatTime(audioPlayer.currentTime);
          }
        }, 100);
      }).catch(function (e) { console.warn("[rec] play fail:", e); });
    }
  }

  function injectPlayer() {
    if (!userAudioURL && !userAudioBlob) return;
    setTimeout(function () {
      if (!userAudioURL) return;
      var feedbackSection = document.querySelector("section.feedback");
      if (!feedbackSection) return;
      var existing = document.getElementById("myRecordingPlayer");
      if (existing) existing.remove();
      var playerUI = createPlayerUI();
      var comparison = feedbackSection.querySelector(".feedback__comparison");
      if (comparison && comparison.nextSibling) {
        feedbackSection.insertBefore(playerUI, comparison.nextSibling);
      } else {
        var ttl = feedbackSection.querySelector(".feedback__title");
        if (ttl && ttl.nextSibling) {
          feedbackSection.insertBefore(playerUI, ttl.nextSibling);
        } else {
          feedbackSection.appendChild(playerUI);
        }
      }
    }, 400);
  }

  function setupObserver() {
    var fb = document.querySelector("section.feedback");
    if (!fb) return;
    var observer = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        if (mutations[i].attributeName === "style" || mutations[i].attributeName === "class") {
          if (fb.style.display !== "none" && userAudioURL) {
            if (!document.getElementById("myRecordingPlayer")) injectPlayer();
          }
        }
      }
    });
    observer.observe(fb, { attributes: true, attributeFilter: ["style", "class"] });
  }

  function initialize() {
    if (typeof window.startRecording === "function" && typeof window.stopRecording === "function") {
      patchToggleRecording();
      setupObserver();
      console.log("[rec] v2 init - mobile compat mode");
    } else {
      setTimeout(initialize, 100);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { setTimeout(initialize, 200); });
  } else {
    setTimeout(initialize, 200);
  }

  window._myRecordingPlayback = {
    getBlob: function () { return userAudioBlob; },
    getURL: function () { return userAudioURL; },
    isSupported: function () { return recordingSupported; },
    injectPlayer: injectPlayer
  };
})();
