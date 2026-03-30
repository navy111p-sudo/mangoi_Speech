/**
 * audio-playback.js (v2) — 내가 말한 음성 재생 기능 (재생 UI 전용)
 *
 * 마이크 접근은 main.js의 startRecording()에서 처리합니다.
 * 이 파일은 재생 UI 삽입 + 재생 제어만 담당합니다.
 *
 * main.js가 녹음 완료 시 window._recordedAudioUrl에 URL을 저장하고
 * window._showPlaybackUI()를 호출합니다.
 */
(function () {
  "use strict";

  var playbackAudio = null;

  // ─── 재생 UI 삽입 ───
  function injectPlaybackUI() {
    var recorderSection = document.querySelector(".recorder");
    if (!recorderSection || document.getElementById("audioPlaybackSection")) return;

    var html =
      '<div id="audioPlaybackSection" style="' +
        'display:none; margin-top:1.2rem; padding:1rem 1.2rem;' +
        'background:rgba(255,255,255,0.04);' +
        'border-radius:1rem; border:1px solid rgba(255,255,255,0.08);' +
        'max-width:420px; margin-left:auto; margin-right:auto;' +
      '">' +
        '<div style="font-size:0.82rem; font-weight:700; color:#cbd5e1; margin-bottom:0.6rem; display:flex; align-items:center; gap:6px;">' +
          '🎧 내가 말한 음성 듣기' +
        '</div>' +
        '<div style="display:flex; align-items:center; gap:10px;">' +
          '<button id="playbackBtn" type="button" style="' +
            'width:38px; height:38px; border-radius:50%; border:none;' +
            'background:linear-gradient(135deg,#0ea5e9,#2563eb); color:#fff;' +
            'font-size:16px; cursor:pointer; display:flex; align-items:center;' +
            'justify-content:center; box-shadow:0 2px 8px rgba(14,165,233,0.3);' +
            'transition:transform 0.2s;' +
          '">▶</button>' +
          '<div style="flex:1; height:8px; background:rgba(255,255,255,0.06); border-radius:4px; overflow:hidden;">' +
            '<div id="playbackProgress" style="height:100%; width:0%; background:linear-gradient(90deg,#0ea5e9,#2563eb); border-radius:4px; transition:width 0.1s linear;"></div>' +
          '</div>' +
          '<span id="playbackTime" style="font-size:0.78rem; font-weight:600; color:#64748b; min-width:35px; text-align:right;">0:00</span>' +
        '</div>' +
      '</div>';

    recorderSection.insertAdjacentHTML("beforeend", html);

    var playBtn = document.getElementById("playbackBtn");
    if (playBtn) playBtn.addEventListener("click", togglePlayback);
  }

  // ─── 재생 토글 ───
  function togglePlayback() {
    if (!window._recordedAudioUrl) return;

    var btn = document.getElementById("playbackBtn");

    if (playbackAudio && !playbackAudio.paused) {
      playbackAudio.pause();
      playbackAudio.currentTime = 0;
      btn.textContent = "▶";
      document.getElementById("playbackProgress").style.width = "0%";
      return;
    }

    playbackAudio = new Audio(window._recordedAudioUrl);
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

  // ─── 재생 UI 표시 (main.js에서 호출) ───
  window._showPlaybackUI = function () {
    var el = document.getElementById("audioPlaybackSection");
    if (el) {
      el.style.display = "block";
      el.style.opacity = "0";
      el.style.transform = "translateY(8px)";
      el.style.transition = "opacity 0.3s, transform 0.3s";
      setTimeout(function () {
        el.style.opacity = "1";
        el.style.transform = "translateY(0)";
      }, 50);
    }
    // 진행바 리셋
    var prog = document.getElementById("playbackProgress");
    if (prog) prog.style.width = "0%";
    var time = document.getElementById("playbackTime");
    if (time) time.textContent = "0:00";
    var btn = document.getElementById("playbackBtn");
    if (btn) btn.textContent = "▶";
  };

  // ─── 재생 UI 숨기기 ───
  window._hidePlaybackUI = function () {
    var el = document.getElementById("audioPlaybackSection");
    if (el) el.style.display = "none";
  };

  // ─── 초기화 ───
  function init() {
    injectPlaybackUI();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
