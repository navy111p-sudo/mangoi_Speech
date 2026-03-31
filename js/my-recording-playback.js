/**
 * ===========================
 * ë´ê° ë§í ìì± ë£ê¸° v7
 *
 * ì ëµ:
 * A) ìë ë¹ì (PC/ì¼ë¶ ëª¨ë°ì¼):
 *    startRecording ì getUserMediaë¥¼ í¨ê» ìë
 *    â ì±ê³µíë©´ SpeechRecognitionê³¼ ëì ë¹ì
 *    â í¼ëë°± ì "ð§ ë´ ìì± ë£ê¸°" ë²í¼ì "êµì ë ë¬¸ì¥ ë£ê¸°" ìì íì
 *
 * B) ìë ë¹ì fallback (ëª¨ë°ì¼ Chrome ë±):
 *    getUserMedia ì¤í¨ ì autoRecordFailed = true
 *    â í¼ëë°± í "ë´ ë°ì ë¹ìíê¸°" ë²í¼ íì
 *    â ë²í¼ ëë¥´ë©´ ë³ë ë¹ì (ë§ì´í¬ ì¶©ë ìì´)
 *
 * v7 ë³ê²½ì¬í­:
 * - "ð§ ë´ ìì± ë£ê¸°" ë²í¼ì "êµì ë ë¬¸ì¥ ë£ê¸°" ìì ë°°ì¹
 * - í´ë¦­ ì ì¸ë¼ì¸ ë¯¸ë íë ì´ì´ íì
 * - PC + ëª¨ë°ì¼(iOS/Android) ìì  í¸í
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
  var autoRecording = false;
  var autoRecordFailed = false;
  var blobReady = false;
  var feedbackShown = false;

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

  /* ââ stream cleanup ââ */
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
        console.warn("[rec-v7] MediaRecorder create fail");
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
        console.log("[rec-v7] blob ready, size=" + userAudioBlob.size);
      }
      blobReady = true;
      if (feedbackShown && userAudioURL) {
        injectPlayButton();
      }
    };
    mediaRecorder.start();
    return true;
  }

  /* ââ ìí ë¦¬ì ââ */
  function resetAutoState() {
    if (userAudioURL) { URL.revokeObjectURL(userAudioURL); userAudioURL = null; }
    userAudioBlob = null;
    audioChunks = [];
    if (audioPlayer) { audioPlayer.pause(); audioPlayer = null; }
    isPlaying = false;
    clearInterval(progressTimer);
    blobReady = false;
    feedbackShown = false;
    autoRecording = false;
    autoRecordFailed = false;

    // ê¸°ì¡´ UI ì ê±°
    var els = ["myVoicePlayBtn", "myRecordingPlayer", "myRecordingSection", "btnRecordMyVoice"];
    for (var i = 0; i < els.length; i++) {
      var el = document.getElementById(els[i]);
      if (el) el.remove();
    }
  }

  /* ââââââââââââââââââââââââââââââââââââââ
     A) ìë ë¹ì - startRecording í¨ì¹
     ââââââââââââââââââââââââââââââââââââââ */
  function patchStartRecording() {
    window.startRecording = function () {
      resetAutoState();
      if (typeof _origStartRecording === "function") {
        _origStartRecording();
      }
      if (isRecordingSupported()) {
        navigator.mediaDevices.getUserMedia({ audio: true })
          .then(function (stream) {
            audioStream = stream;
            if (startMediaRecorder(stream)) {
              autoRecording = true;
              console.log("[rec-v7] auto recording started");
            } else {
              autoRecordFailed = true;
              blobReady = true;
              cleanupStream(0);
            }
          })
          .catch(function (err) {
            console.log("[rec-v7] getUserMedia failed:", err.name);
            autoRecordFailed = true;
            blobReady = true;
          });
      } else {
        autoRecordFailed = true;
        blobReady = true;
      }
    };
  }

  /* ââââââââââââââââââââââââââââââââââââââ
     stopRecording í¨ì¹
     ââââââââââââââââââââââââââââââââââââââ */
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

  /* ââââââââââââââââââââââââââââââââââââââ
     showFeedback í¨ì¹
     ââââââââââââââââââââââââââââââââââââââ */
  function patchShowFeedback() {
    window.showFeedback = function () {
      if (isManualRecording) stopManualRecording();

      try {
        _origShowFeedback.apply(this, arguments);
      } catch (e) {
        console.warn("[rec-v7] origShowFeedback error:", e.message);
      }

      var fs = document.querySelector("section.feedback");
      if (fs) {
        if (fs.classList.contains("visible") && !fs.classList.contains("is-visible")) {
          fs.classList.add("is-visible");
        }
        if (getComputedStyle(fs).display === "none") {
          fs.style.display = "block";
        }
      }

      feedbackShown = true;
      console.log("[rec-v7] feedback shown | blobReady=" + blobReady +
        " | autoFailed=" + autoRecordFailed + " | hasURL=" + !!userAudioURL);

      if (autoRecordFailed) {
        setTimeout(injectManualRecordButton, 300);
      } else if (blobReady && userAudioURL) {
        setTimeout(injectPlayButton, 300);
      }
      /* else: blob ìì§ ì¤ë¹ ìë¨ â onstopìì injectPlayButton í¸ì¶ ìì  */
    };
  }

  /* ââââââââââââââââââââââââââââââââââââââ
     ð§ "ë´ ìì± ë£ê¸°" ë²í¼ - êµì ë ë¬¸ì¥ ë£ê¸° ìì ë°°ì¹
     ââââââââââââââââââââââââââââââââââââââ */
  function injectPlayButton() {
    if (!userAudioURL) return;

    // ê¸°ì¡´ ë²í¼/íë ì´ì´ ì ê±°
    var existing = document.getElementById("myVoicePlayBtn");
    if (existing) existing.remove();
    var existingPlayer = document.getElementById("myRecordingPlayer");
    if (existingPlayer) existingPlayer.remove();

    // "êµì ë ë¬¸ì¥ ë£ê¸°" ë²í¼ì´ ìë ì»¨íì´ë ì°¾ê¸°
    var listenBtnDiv = document.querySelector(".feedback__listen-btn");
    if (!listenBtnDiv) {
      // fallback: feedbackSection ììì ì°¾ê¸°
      var feedbackSection = document.querySelector("section.feedback");
      if (!feedbackSection) return;
      listenBtnDiv = feedbackSection;
    }

    // ë²í¼ ì»¨íì´ëë¥¼ flexë¡ ë³ê²½íì¬ ëëí ë°°ì¹
    listenBtnDiv.style.display = "flex";
    listenBtnDiv.style.justifyContent = "center";
    listenBtnDiv.style.alignItems = "center";
    listenBtnDiv.style.gap = "10px";
    listenBtnDiv.style.flexWrap = "wrap";

    // "ð§ ë´ ìì± ë£ê¸°" ë²í¼ ìì±
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
    btn.innerHTML = "&#x1F3A7; &#xB0B4; &#xC74C;&#xC131; &#xB4E3;&#xAE30;";
    btn.textContent = "\uD83C\uDFA7 ë´ ìì± ë£ê¸°";

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
    console.log("[rec-v7] play button injected next to corrected-listen button");
  }

  /* ââ ì¸ë¼ì¸ ë¯¸ë íë ì´ì´ í ê¸ ââ */
  function toggleInlinePlayer() {
    var existing = document.getElementById("myRecordingPlayer");
    if (existing) {
      // ì´ë¯¸ íì ì¤ì´ë©´ ì¨ê¸°ê¸°
      if (audioPlayer) { audioPlayer.pause(); audioPlayer = null; }
      isPlaying = false;
      clearInterval(progressTimer);
      existing.remove();
      return;
    }
    // íë ì´ì´ ìì± & íì
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

    // ì¤íì¼ ì ëë©ì´ì ì¶ê°
    if (!document.getElementById("recPlayerStyle")) {
      var style = document.createElement("style");
      style.id = "recPlayerStyle";
      style.textContent =
        "@keyframes fadeInPlayer{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}" +
        "@keyframes recPulse{0%,100%{opacity:1}50%{opacity:0.6}}";
      document.head.appendChild(style);
    }

    // ì¬ì/ì¼ìì ì§ ë²í¼
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

    // íë¡ê·¸ë ì¤ ë°
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

    // ìê° íì
    var timeDisp = document.createElement("span");
    timeDisp.id = "myRecTime";
    timeDisp.style.cssText = "color: #059669; font-size: 12px; font-weight: 600; min-width: 36px; text-align: right;";
    timeDisp.textContent = "0:00";
    playerUI.appendChild(timeDisp);

    // ë«ê¸° ë²í¼
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

    // ì½ì ìì¹: listen-btn ë°ë¡ ìë
    listenBtnDiv.parentNode.insertBefore(playerUI, listenBtnDiv.nextSibling);

    // ìë ì¬ì ìì
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
        console.warn("[rec-v7] play fail:", e);
      });
    }
  }

  /* ââââââââââââââââââââââââââââââââââââââ
     B) ìë ë¹ì (ëª¨ë°ì¼ fallback)
     - "êµì ë ë¬¸ì¥ ë£ê¸°" ìì ë¹ì ë²í¼ ë°°ì¹
     ââââââââââââââââââââââââââââââââââââââ */
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
    btn.textContent = "\uD83C\uDFA4 ë´ ë°ì ë¹ì";

    btn.addEventListener("click", function () {
      if (isManualRecording) {
        stopManualRecording();
      } else if (userAudioURL) {
        // ì´ë¯¸ ë¹ì ìë£ â ì¬ì
        toggleInlinePlayer();
      } else {
        startManualRecording(btn);
      }
    });

    listenBtnDiv.appendChild(btn);

    // ìë´ íì¤í¸
    var guide = document.createElement("div");
    guide.id = "myRecordingSection";
    guide.style.cssText =
      "text-align: center; margin-top: 6px; font-size: 0.78rem;" +
      "color: #64748b; font-weight: 500;";
    guide.textContent = "ë²í¼ì ëë¬ ë´ ë°ìì ë¹ìíê³  ë¤ì´ë³´ì¸ì";
    listenBtnDiv.parentNode.insertBefore(guide, listenBtnDiv.nextSibling);

    console.log("[rec-v7] manual record button injected");
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
        console.log("[rec-v7] manual recording started");
      })
      .catch(function (err) {
        console.warn("[rec-v7] manual getUserMedia fail:", err);
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
      btn.textContent = "\u23F9 ë¹ì ì¤ì§";
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
        btn.textContent = "\uD83C\uDFA7 ë´ ìì± ë£ê¸°";
        btn.style.background = "linear-gradient(135deg, #10b981, #059669)";
        btn.style.boxShadow = "0 2px 8px rgba(16,185,129,0.3)";
      } else {
        btn.textContent = "\uD83C\uDFA4 ë´ ë°ì ë¹ì";
        btn.style.background = "linear-gradient(135deg, #3b82f6, #2563eb)";
        btn.style.boxShadow = "0 2px 8px rgba(59,130,246,0.3)";
      }
      btn.style.animation = "none";
    }
  }

  /* ââââââââââââââââââââââââââââââââââââââ
     ì´ê¸°í
     ââââââââââââââââââââââââââââââââââââââ */
  function patchAll() {
    _origStartRecording = window.startRecording;
    _origStopRecording = window.stopRecording;
    _origShowFeedback = window.showFeedback;

    patchStartRecording();
    patchStopRecording();
    if (typeof _origShowFeedback === "function") {
      patchShowFeedback();
    }
    console.log("[rec-v7] init OK - hybrid mode");
  }

  function initialize() {
    if (
      typeof window.startRecording === "function" &&
      typeof window.stopRecording === "function" &&
      typeof window.showFeedback === "function"
    ) {
      patchAll();
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

  window._myRecordingPlayback = {
    getBlob: function () { return userAudioBlob; },
    getURL: function () { return userAudioURL; },
    isSupported: isRecordingSupported,
    version: "v7-inline"
  };
})();
