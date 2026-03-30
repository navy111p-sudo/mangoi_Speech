/**
 * audio-playback.js (v1) — 내가 말한 음성 재생 기능
 *
 * 기존 녹음 버튼(#btnRecord)에 MediaRecorder를 연결하여
 * 사용자가 말한 음성을 저장하고 다시 들을 수 있게 합니다.
 *
 * practice.html의 recorder 섹션 아래에 재생 UI를 자동 삽입합니다.
 */
(function () {
  "use strict";

  var mediaRecorder = null;
  var audioChunks = [];
  var recordedBlob = null;
  var recordedAudioUrl = null;
  var playbackAudio = null;
  var isRecordingAudio = false;
  var audioStream = null;

  // ─── 재생 UI 삽입 ───
  function injectPlaybackUI() {
    var recorderSection = document.querySelector(".recorder");
    if (!recorderSection) return;

    // 이미 삽입되었으면 무시
    if (document.getElementById("audioPlaybackSection")) return;

    var playbackHTML =
      '<div id="audioPlaybackSection" style="' +
        'display:none; margin-top:1.2rem; padding:1rem 1.2rem;' +
        'background:linear-gradient(135deg,#f0f4ff 0%,#e8eeff 100%);' +
        'border-radius:1rem; border:1.5px solid rgba(74,144,217,0.2);' +
        'max-width:420px; margin-left:auto; margin-right:auto;' +
      '">' +
        '<div style="font-size:0.82rem; font-weight:700; color:#334155; margin-bottom:0.6rem; display:flex; align-items:center; gap:6px;">' +
          '🎧 내가 말한 음성 듣기' +
        '</div>' +
        '<div style="display:flex; align-items:center; gap:10px;">' +
          '<button id="playbackBtn" type="button" style="' +
            'width:38px; height:38px; border-radius:50%; border:none;' +
            'background:linear-gradient(135deg,#4a90d9,#6366f1); color:#fff;' +
            'font-size:16px; cursor:pointer; display:flex; align-items:center;' +
            'justify-content:center; box-shadow:0 2px 8px rgba(74,144,217,0.3);' +
            'transition:transform 0.2s;' +
          '">▶</button>' +
          '<div style="flex:1; height:8px; background:#dde4f0; border-radius:4px; overflow:hidden; position:relative;">' +
            '<div id="playbackProgress" style="height:100%; width:0%; background:linear-gradient(90deg,#4a90d9,#6366f1); border-radius:4px; transition:width 0.1s linear;"></div>' +
          '</div>' +
          '<span id="playbackTime" style="font-size:0.78rem; font-weight:600; color:#6b7b94; min-width:35px; text-align:right;">0:00</span>' +
        '</div>' +
      '</div>';

    recorderSection.insertAdjacentHTML("beforeend", playbackHTML);

    // 재생 버튼 이벤트
    var playBtn = document.getElementById("playbackBtn");
    if (playBtn) {
      playBtn.addEventListener("click", togglePlayback);
    }
  }

  // ─── 재생 토글 ───
  function togglePlayback() {
    if (!recordedAudioUrl) return;

    var btn = document.getElementById("playbackBtn");

    if (playbackAudio && !playbackAudio.paused) {
      playbackAudio.pause();
      playbackAudio.currentTime = 0;
      btn.textContent = "▶";
      document.getElementById("playbackProgress").style.width = "0%";
      return;
    }

    playbackAudio = new Audio(recordedAudioUrl);
    btn.textContent = "⏸";

    playbackAudio.ontimeupdate = function () {
      if (playbackAudio.duration && isFinite(playbackAudio.duration)) {
        var pct = (playbackAudio.currentTime / playbackAudio.duration) * 100;
        document.getElementById("playbackProgress").style.width = pct + "%";
        var sec = Math.floor(playbackAudio.currentTime);
        document.getElementById("playbackTime").textContent =
          "0:" + (sec < 10 ? "0" + sec : sec);
      }
    };

    playbackAudio.onended = function () {
      btn.textContent = "▶";
      document.getElementById("playbackProgress").style.width = "0%";
      document.getElementById("playbackTime").textContent = "0:00";
    };

    playbackAudio.play().catch(function (err) {
      console.warn("재생 실패:", err);
      btn.textContent = "▶";
    });
  }

  // ─── 재생 UI 표시/숨기기 ───
  function showPlaybackUI() {
    var el = document.getElementById("audioPlaybackSection");
    if (el) {
      el.style.display = "block";
      // 부드러운 등장
      el.style.opacity = "0";
      el.style.transform = "translateY(8px)";
      el.style.transition = "opacity 0.3s, transform 0.3s";
      setTimeout(function () {
        el.style.opacity = "1";
        el.style.transform = "translateY(0)";
      }, 50);
    }
  }

  function hidePlaybackUI() {
    var el = document.getElementById("audioPlaybackSection");
    if (el) el.style.display = "none";
    // 진행바 리셋
    var prog = document.getElementById("playbackProgress");
    if (prog) prog.style.width = "0%";
    var time = document.getElementById("playbackTime");
    if (time) time.textContent = "0:00";
    var btn = document.getElementById("playbackBtn");
    if (btn) btn.textContent = "▶";
  }

  // ─── MediaRecorder 시작 ───
  function startAudioCapture() {
    audioChunks = [];

    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(function (stream) {
        audioStream = stream;
        mediaRecorder = new MediaRecorder(stream);

        mediaRecorder.ondataavailable = function (e) {
          if (e.data.size > 0) audioChunks.push(e.data);
        };

        mediaRecorder.onstop = function () {
          recordedBlob = new Blob(audioChunks, { type: "audio/webm" });
          if (recordedAudioUrl) URL.revokeObjectURL(recordedAudioUrl);
          recordedAudioUrl = URL.createObjectURL(recordedBlob);
          showPlaybackUI();

          // 스트림 정리
          if (audioStream) {
            audioStream.getTracks().forEach(function (t) { t.stop(); });
          }
        };

        mediaRecorder.start();
        isRecordingAudio = true;
      })
      .catch(function (err) {
        console.warn("마이크 접근 실패 (audio-playback):", err);
      });
  }

  // ─── MediaRecorder 중지 ───
  function stopAudioCapture() {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }
    isRecordingAudio = false;
  }

  // ─── 기존 녹음 버튼에 훅 걸기 ───
  function hookRecordButton() {
    var btnRecord = document.getElementById("btnRecord");
    if (!btnRecord) return;

    // 기존 click 핸들러가 있으므로 추가 리스너로 연결
    btnRecord.addEventListener("click", function () {
      // 녹음 시작/종료 판별:
      // 기존 main.js가 버튼 상태를 바꾸므로, 약간의 딜레이 후 상태 확인
      setTimeout(function () {
        var isActive =
          btnRecord.classList.contains("is-recording") ||
          btnRecord.classList.contains("recording") ||
          btnRecord.getAttribute("data-recording") === "true" ||
          btnRecord.style.backgroundColor === "red" ||
          btnRecord.textContent.indexOf("⏹") >= 0;

        if (isActive && !isRecordingAudio) {
          // 녹음 시작
          hidePlaybackUI();
          startAudioCapture();
        } else if (!isActive && isRecordingAudio) {
          // 녹음 종료
          stopAudioCapture();
        }
      }, 150);
    });

    // MutationObserver로 버튼 변화 감지 (fallback)
    var observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        if (m.type === "attributes") {
          var isActive =
            btnRecord.classList.contains("is-recording") ||
            btnRecord.classList.contains("recording");

          if (isActive && !isRecordingAudio) {
            hidePlaybackUI();
            startAudioCapture();
          } else if (!isActive && isRecordingAudio) {
            stopAudioCapture();
          }
        }
      });
    });

    observer.observe(btnRecord, {
      attributes: true,
      attributeFilter: ["class", "data-recording"]
    });
  }

  // ─── 초기화 ───
  function init() {
    injectPlaybackUI();
    hookRecordButton();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
