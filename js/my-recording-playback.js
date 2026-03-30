/**
 * ===========================
 * ë´ê° ë§í ìì± ë£ê¸° v5 (íì´ë¸ë¦¬ë)
 *
 * ì ëµ:
 * A) ìë ë¹ì (PC/ì¼ë¶ ëª¨ë°ì¼):
 *    startRecording ì getUserMediaë¥¼ í¨ê» ìë
 *    â ì±ê³µíë©´ SpeechRecognitionê³¼ ëì ë¹ì
 *    â í¼ëë°± ì ìëì¼ë¡ íë ì´ì´ íì
 *
 * B) ìë ë¹ì fallback (ëª¨ë°ì¼ Chrome ë±):
 *    getUserMedia ì¤í¨ ì autoRecordFailed = true
 *    â í¼ëë°± í "ë´ ë°ì ë¹ìíê¸°" ë²í¼ íì
 *    â ë²í¼ ëë¥´ë© ë³ë ë¹ì (ë§ì´í¬ ì¶©ë ìì)
 *
 * PC + ëª¨ë°ì¼(iOS/Android) ìì  í¸í
 * ===========================
 */
(function () {
  "use strict";

  /* ââ state ââ */
  var mediaRecorder = null;
  var audioChunks = [];
  var userAudioBlob = null;
  var userAudioURL = null;
  var audioPlayer = null;
  var audioStream = null;
  var isPlaying = false;
  var progressTimer = null;

  /* ââ ìë ë¹ì ìí ââ */
  var autoRecording = false;      // ìë ë¹ì ì§í ì¤
  var autoRecordFailed = false;   // ìë ë¹ì ì¤í¨ â fallback íì
  var blobReady = false;          // blob ìì± ìë£
  var feedbackShown = false;      // showFeedback í¸ì¶ë¨

  /* ââ ìë ë¹ì ìí ââ */
  var isManualRecording = false;

  /* ââ saved originals ââ */
  var _origStartRecording = null;
  var _origStopRecording = null;
  var _origShowFeedback = null;

  /* ââ MIME type selection ââ */
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

  /* ââ stream cleanup (ì§ì° ê°ë¥) ââ */
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

  /* ââ MediaRecorder ìì ââ */
  function startMediaRecorder(stream) {
    audioChunks = [];
    var mimeType = chooseMimeType();
    try {
      mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType: mimeType })
        : new MediaRecorder(stream);
    } catch (e) {
      try { mediaRecorder = new MediaRecorder(stream); } catch (e2) {
        console.warn("[rec-v5] MediaRecorder create fail");
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
        console.log("[rec-v5] blob ready");
      }
      blobReady = true;
      /* í¼ëë°±ì´ ì´ë¯¸ íìëì¼ë©´ íë ì´ì´ ì£¼ì */
      if (feedbackShown && userAudioURL) {
        injectAutoPlayer();
      }
    };
    mediaRecorder.start();
    return true;
  }

  /* ââ ìë ë¹ì ì ë¦¬ ââ */
  function resetAutoState() {
    if (userAudioURL) {
      URL.revokeObjectURL(userAudioURL);
      userAudioURL = null;
    }
    userAudioBlob = null;
    audioChunks = [];
    if (audioPlayer) { audioPlayer.pause(); audioPlayer = null; }
    isPlaying = false;
    clearInterval(progressTimer);
    blobReady = false;
    feedbackShown = false;
    autoRecording = false;
    autoRecordFailed = false;

    var el1 = document.getElementById("myRecordingPlayer");
    if (el1) el1.remove();
    var el2 = document.getElementById("myRecordingSection");
    if (el2) el2.remove();
  }

  /* ââââââââââââââââââââââââââââââââââââ
     A) ìë ë¹ì - startRecording í¨ì¹
     ââââââââââââââââââââââââââââââââââââ */
  function patchStartRecording() {
    window.startRecording = function () {
      resetAutoState();

      /* 1) ìë¥ startRecording ë¨¼ì  (SpeechRecognition ìì) */
      if (typeof _origStartRecording === "function") {
        _origStartRecording();
      }

      /* 2) getUserMediaë¥¼ ë³ë ¬ë¡ ìë */
      if (isRecordingSupported()) {
        navigator.mediaDevices.getUserMedia({ audio: true })
          .then(function (stream) {
            audioStream = stream;
            if (startMediaRecorder(stream)) {
              autoRecording = true;
              console.log("[rec-v5] auto recording started (parallel)");
            } else {
              autoRecordFailed = true;
              blobReady = true;
              cleanupStream(0);
            }
          })
          .catch(function (err) {
            console.log("[rec-v5] getUserMedia failed (expected on mobile):", err.name);
            autoRecordFailed = true;
            blobReady = true;
          });
      } else {
        autoRecordFailed = true;
        blobReady = true;
      }
    };
  }

  /* ââââââââââââââââââââââââââââââââââââ
     stopRecording í¨ì¹
     ââââââââââââââââââââââââââââââââââââ */
  function patchStopRecording() {
    window.stopRecording = function () {
      /* ìë ë¹ì ì¤ì´ë©´ MediaRecorder ì¤ì§ */
      if (autoRecording && mediaRecorder && mediaRecorder.state !== "inactive") {
        try { mediaRecorder.stop(); } catch (e) {}
        autoRecording = false;
      }
      /* ì¤í¸ë¦¼ì 2ì° í ì ë¦¬ (SpeechRecognition ê²°ê³¼ ìì  ëê¸°) */
      cleanupStream(2000);

      /* ìë¥ stopRecording ì¤í */
      if (typeof _origStopRecording === "function") {
        _origStopRecording();
      }
    };
  }

  /* ââââââââââââââââââââââââââââââââââââ
     showFeedback í¨ì¹
     ââââââââââââââââââââââââââââââââââââ */
  function patchShowFeedback() {
    window.showFeedback = function () {
      /* ìë ë¹ì ì¤ì´ë©´ ì¤ì§ */
      if (isManualRecording) stopManualRecording();

      /* ìë showFeedback ì¤í (try-catchë¡ scrollIntoView ë± ìë¬ ë°©ì´) */
      try {
        _origShowFeedback.apply(this, arguments);
      } catch (e) {
        console.warn("[rec-v5] origShowFeedback error (non-fatal):", e.message);
      }

      /* CSS í´ëì¤ ë¶ì¼ì¹ ë³´ì : main.jsë 'visible' ì¶ê°, CSSë 'is-visible' íìí  ì ìì */
      var fs = document.querySelector("section.feedback");
      if (fs) {
        if (fs.classList.contains("visible") && !fs.classList.contains("is-visible")) {
          fs.classList.add("is-visible");
        }
        /* ë§ì½ ë ë¤ ìì¼ë© ê°ì  íì */
        if (getComputedStyle(fs).display === "none") {
          fs.style.display = "block";
        }
      }

      feedbackShown = true;

      console.log("[rec-v5] feedback shown | blobReady=" + blobReady +
        " | autoFailed=" + autoRecordFailed + " | hasURL=" + !!userAudioURL);

      if (autoRecordFailed) {
        /* B) ëª¨ë°ì¼ fallback: ìë ë¹ì ë²í¼ íì */
        setTimeout(injectManualRecordSection, 300);
      } else if (blobReady && userAudioURL) {
        /* A) ìë ë¹ì ì±ê³µ: ë°ë¡ íë ì´ì´ íì */
        setTimeout(injectAutoPlayer, 300);
      }
      /* else: blob ìì§ ì¤ë¹ ìë¨ â onstopìì injectAutoPlayer í¸ì¶ ìì  */
    };
  }

  /* ââââââââââââââââââââââââââââââââââââ
     ìë ë¹ì â íë ì´ì´ UI
     ââââââââââââââââââââââââââââââââââââ */
  function injectAutoPlayer() {
    if (!userAudioURL) return;

    var feedbackSection = document.querySelector("section.feedback");
    if (!feedbackSection) return;

    var existing = document.getElementById("myRecordingPlayer");
    if (existing) existing.remove();

    var playerUI = createPlayerUI("\uD83C\uDFA7 ë´ê° ë§í ìì± ë£ê¸°");
    var comparison = feedbackSection.querySelector(".feedback__comparison");
    if (comparison) {
      comparison.parentNode.insertBefore(playerUI, comparison.nextSibling);
    } else {
      feedbackSection.appendChild(playerUI);
    }
    console.log("[rec-v5] auto player injected!");
  }

  /* ââââââââââââââââââââââââââââââââââââ
     B) ìë ë¹ì (ëª¨ë°ì¼ fallback)
     ââââââââââââââââââââââââââââââââââââ */
  function startManualRecording() {
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
            cleanupStream(0); return;
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
            injectManualPlayer();
          }
          isManualRecording = false;
          updateManualBtn(false);
        };
        mediaRecorder.start();
        isManualRecording = true;
        updateManualBtn(true);
        console.log("[rec-v5] manual recording started");
      })
      .catch(function (err) {
        console.warn("[rec-v5] manual getUserMedia fail:", err);
        cleanupStream(0);
      });
  }

  function stopManualRecording() {
    if (!isManualRecording || !mediaRecorder) return;
    if (mediaRecorder.state !== "inactive") {
      try { mediaRecorder.stop(); } catch (e) {}
    }
  }

  function updateManualBtn(recording) {
    var btn = document.getElementById("btnRecordMyVoice");
    if (!btn) return;
    if (recording) {
      btn.textContent = "\u23F9 ë¹ì ì¤ì§";
      btn.style.background = "#f44336";
      btn.style.animation = "recPulse 1s infinite";
    } else {
      btn.textContent = "\uD83C\uDFA4 ë´ ë°ì ë¹ìíê¸°";
      btn.style.background = "#2196F3";
      btn.style.animation = "none";
    }
  }

  /* ââ ìë ë¹ì UI ì£¼ì ââ */
  function injectManualRecordSection() {
    if (!isRecordingSupported()) return;
    var feedbackSection = document.querySelector("section.feedback");
    if (!feedbackSection) return;

    var existing = document.getElementById("myRecordingSection");
    if (existing) existing.remove();
    var existingPlayer = document.getElementById("myRecordingPlayer");
    if (existingPlayer) existingPlayer.remove();

    var container = document.createElement("div");
    container.id = "myRecordingSection";
    container.style.cssText =
      "background:rgba(30,30,60,0.92);border-radius:16px;padding:14px 18px;" +
      "margin:14px auto;max-width:340px;display:flex;flex-direction:column;" +
      "align-items:center;gap:10px;box-shadow:0 2px 16px rgba(0,0,0,0.25);";

    var title = document.createElement("div");
    title.style.cssText = "color:#c8c8ff;font-size:13px;font-weight:600;text-align:center;width:100%;";
    title.textContent = "\uD83C\uDFA7 ë´ ë°ìì ë¹ìíê³  ë¤ì´ë³´ì¸ì";
    container.appendChild(title);

    var guide = document.createElement("div");
    guide.style.cssText = "color:#aaa;font-size:12px;text-align:center;line-height:1.4;";
    guide.textContent = "ìë ë²í¼ì ëë¥´ê³  ë¬¸ì¥ì ë¤ì ì½ì´ë³´ì¸ì";
    container.appendChild(guide);

    var btn = document.createElement("button");
    btn.id = "btnRecordMyVoice";
    btn.type = "button";
    btn.style.cssText =
      "padding:10px 24px;border-radius:25px;border:none;background:#2196F3;" +
      "color:#fff;font-size:15px;font-weight:600;cursor:pointer;" +
      "-webkit-tap-highlight-color:transparent;outline:none;" +
      "display:flex;align-items:center;gap:6px;";
    btn.textContent = "\uD83C\uDFA4 ë´ ë°ì ë¹ìíê¸°";
    btn.addEventListener("click", function () {
      if (isManualRecording) stopManualRecording();
      else startManualRecording();
    });
    container.appendChild(btn);

    if (!document.getElementById("recPulseStyle")) {
      var style = document.createElement("style");
      style.id = "recPulseStyle";
      style.textContent = "@keyframes recPulse{0%,100%{opacity:1}50%{opacity:0.6}}";
      document.head.appendChild(style);
    }

    var comparison = feedbackSection.querySelector(".feedback__comparison");
    if (comparison) {
      comparison.parentNode.insertBefore(container, comparison.nextSibling);
    } else {
      feedbackSection.appendChild(container);
    }
    console.log("[rec-v5] manual record section injected");
  }

  /* ââ ìë ë¹ì ìë£ â íë ì´ì´ ì£¼ì ââ */
  function injectManualPlayer() {
    if (!userAudioURL) return;
    var section = document.getElementById("myRecordingSection");
    if (!section) return;

    var existing = document.getElementById("myRecordingPlayer");
    if (existing) existing.remove();

    var playerUI = createPlayerUI("\u25B6 ë´ê° ë¹ìí ë°ì ë£ê¸°");

    /* ë¤ì ë¹ì ë²í¼ ì¶ê° */
    var reRow = document.createElement("div");
    reRow.style.cssText = "width:100%;text-align:center;margin-top:4px;";
    var reBtn = document.createElement("button");
    reBtn.type = "button";
    reBtn.style.cssText =
      "background:none;border:1px solid rgba(255,255,255,0.3);color:#ccc;" +
      "font-size:12px;padding:4px 14px;border-radius:12px;cursor:pointer;outline:none;";
    reBtn.textContent = "\uD83D\uDD04 ë¤ì ë¹ì";
    reBtn.addEventListener("click", function () {
      var p = document.getElementById("myRecordingPlayer"); if (p) p.remove();
      if (audioPlayer) { audioPlayer.pause(); audioPlayer = null; }
      clearInterval(progressTimer); isPlaying = false;
      startManualRecording();
    });
    reRow.appendChild(reBtn);
    playerUI.appendChild(reRow);

    section.parentNode.insertBefore(playerUI, section.nextSibling);

    var recordBtn = document.getElementById("btnRecordMyVoice");
    if (recordBtn) {
      recordBtn.textContent = "\u2705 ë¹ì ìë£!";
      recordBtn.style.background = "#4CAF50";
      setTimeout(function () { updateManualBtn(false); }, 2000);
    }
    console.log("[rec-v5] manual player injected");
  }

  /* ââââââââââââââââââââââââââââââââââââ
     ê³µíµ íë ì´ì´ UI
     ââââââââââââââââââââââââââââââââââââ */
  function createPlayerUI(titleText) {
    var existing = document.getElementById("myRecordingPlayer");
    if (existing) existing.remove();

    var container = document.createElement("div");
    container.id = "myRecordingPlayer";
    container.style.cssText =
      "background:rgba(20,60,20,0.92);border-radius:16px;padding:14px 18px;" +
      "margin:10px auto 0;max-width:340px;display:flex;flex-direction:column;" +
      "align-items:center;gap:8px;box-shadow:0 2px 16px rgba(0,0,0,0.25);";

    var ttl = document.createElement("div");
    ttl.style.cssText =
      "color:#a8e6a8;font-size:13px;font-weight:600;display:flex;" +
      "align-items:center;gap:6px;width:100%;";
    ttl.textContent = titleText || "\uD83C\uDFA7 ë´ê° ë§í ìì± ë£ê¸°";
    container.appendChild(ttl);

    var row = document.createElement("div");
    row.style.cssText = "display:flex;align-items:center;gap:10px;width:100%;";

    var playBtn = document.createElement("button");
    playBtn.id = "btnPlayMyRecording";
    playBtn.type = "button";
    playBtn.style.cssText =
      "width:42px;height:42px;border-radius:50%;border:none;background:#4CAF50;" +
      "color:#fff;font-size:18px;cursor:pointer;display:flex;align-items:center;" +
      "justify-content:center;flex-shrink:0;outline:none;";
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
        audioPlayer.currentTime = ((e.clientX - rect.left) / rect.width) * audioPlayer.duration;
      }
    });
    var progressBar = document.createElement("div");
    progressBar.id = "myRecordingProgress";
    progressBar.style.cssText =
      "height:100%;width:0%;background:#4CAF50;border-radius:3px;transition:width 0.1s linear;";
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
        isPlaying = false; clearInterval(progressTimer);
        var b = document.getElementById("btnPlayMyRecording"); if (b) b.textContent = "\u25B6";
        var bar = document.getElementById("myRecordingProgress"); if (bar) bar.style.width = "0%";
        var t = document.getElementById("myRecordingTime");
        if (t && audioPlayer) t.textContent = formatTime(audioPlayer.duration || 0);
        audioPlayer = null;
      });
      audioPlayer.addEventListener("loadedmetadata", function () {
        var t = document.getElementById("myRecordingTime");
        if (t) t.textContent = formatTime(audioPlayer.duration || 0);
      });
    }
    if (isPlaying) {
      audioPlayer.pause(); isPlaying = false; clearInterval(progressTimer);
      var b = document.getElementById("btnPlayMyRecording"); if (b) b.textContent = "\u25B6";
    } else {
      audioPlayer.play().then(function () {
        isPlaying = true;
        var b = document.getElementById("btnPlayMyRecording"); if (b) b.textContent = "\u23F8";
        progressTimer = setInterval(function () {
          if (audioPlayer && audioPlayer.duration) {
            var pct = (audioPlayer.currentTime / audioPlayer.duration) * 100;
            var bar = document.getElementById("myRecordingProgress"); if (bar) bar.style.width = pct + "%";
            var t = document.getElementById("myRecordingTime"); if (t) t.textContent = formatTime(audioPlayer.currentTime);
          }
        }, 100);
      }).catch(function (e) { console.warn("[rec-v5] play fail:", e); });
    }
  }

  /* ââââââââââââââââââââââââââââââââââââ
     ì´ê¸°í
     ââââââââââââââââââââââââââââââââââââ */
  function patchAll() {
    _origStartRecording = window.startRecording;
    _origStopRecording = window.stopRecording;
    _origShowFeedback = window.showFeedback;

    patchStartRecording();
    patchStopRecording();
    if (typeof _origShowFeedback === "function") {
      patchShowFeedback();
    }
    console.log("[rec-v5] init OK - hybrid mode (auto + manual fallback)");
  }

  function initialize() {
    if (typeof window.startRecording === "function" &&
        typeof window.stopRecording === "function" &&
        typeof window.showFeedback === "function") {
      patchAll();
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
    isSupported: isRecordingSupported,
    version: "v5-hybrid"
  };
})();
