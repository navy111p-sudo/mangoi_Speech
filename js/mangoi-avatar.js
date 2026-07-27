/* 👩‍🏫 mangoi-avatar.js — Speech Coach(Phonics·BTS·SIU) 강사 아바타 + 원어민 발음 업그레이드
 * (2026-07-27, mangoiweb speech-coach.html 의 검증된 아바타를 이식)
 *
 * 하는 일 두 가지:
 *  1) 강사 아바타 표시 — 초록 배경 영상을 <canvas>에 그리며 초록을 픽셀 단위로 제거(진짜 투명).
 *     말할 때 실제 음성의 크기(RMS)에 맞춰 입을 여닫는다(소리↑=벌림·공백=닫힘). 넓은 화면에선
 *     왼쪽에 크게 고정, 좁은 화면에선 문장 카드 위에 작게.
 *  2) window.speak() 교체 — 원어민 발음을 브라우저 합성 대신 망고아이 서버 원어민 TTS
 *     (Deepgram Aura, CORS 허용 확인됨)로 재생. 음성 신호를 분석할 수 있어 입모양이 소리와
 *     맞고, 모든 기기에서 같은 원어민 음성이 난다. 서버 실패 시에만 브라우저 합성으로 폴백
 *     (이때 영어 보이스가 없으면 침묵 — 한국어 기본 보이스가 영어를 읽는 사고 방지).
 *
 * 왜 문장별 정밀 립싱크 클립이 아닌가: 이 앱은 코스당 문장이 수백 개(동적)라 사전 렌더가
 * 불가능하다. 음량 기반이 실용 한계 내 최선이며, 고정 5문장인 mangoiweb 음성코치만
 * 문장별 Wav2Lip 클립을 쓴다.
 */
(function () {
  'use strict';
  var TTS_URL = 'https://webrtc-unified-platform.navy111p.workers.dev/api/voice/tts';
  var A = 'assets/avatar/';

  /* ── 1. 스타일 + 마크업 주입 ─────────────────────────────────────────── */
  var css = ''
    + '.mgv-wrap{display:flex;flex-direction:column;align-items:center;gap:8px;margin:0 auto 14px;}'
    + '.mgv-ring{position:relative;width:150px;height:187px;border-radius:22px;padding:4px;'
    + '  background:conic-gradient(from 180deg,#a78bfa,#38bdf8,#fbbf24,#a78bfa);'
    + '  box-shadow:0 12px 34px -10px rgba(74,144,217,.55);}'
    + '.mgv-canvas{position:relative;z-index:2;width:100%;height:100%;border-radius:18px;display:block;}'
    + '.mgv-video{position:absolute;inset:4px;width:calc(100% - 8px);height:calc(100% - 8px);'
    + '  border-radius:18px;opacity:0;z-index:1;pointer-events:none;object-fit:cover;}'
    + '.mgv-label{font-size:12px;font-weight:800;color:#94a3c8;padding:4px 13px;border-radius:99px;'
    + '  background:rgba(99,102,241,.12);border:1px solid rgba(99,102,241,.3);}'
    + '.mgv-wrap.speaking .mgv-ring{animation:mgvPulse 1.1s ease-in-out infinite;}'
    + '.mgv-wrap.speaking .mgv-label{color:#fff;background:rgba(99,102,241,.5);}'
    + '@keyframes mgvPulse{0%,100%{transform:scale(1);}50%{transform:scale(1.03);}}'
    /* 넓은 화면: 왼쪽 빈 공간에 크게 고정(문장·결과를 스크롤해도 얼굴이 계속 보임) */
    + '@media (min-width:1400px){'
    + '  .mgv-wrap{position:fixed;left:48px;top:170px;z-index:40;margin:0;}'
    + '  .mgv-ring{width:250px;height:312px;}'
    + '}';
  var st = document.createElement('style');
  st.textContent = css;
  document.head.appendChild(st);

  function buildMarkup() {
    var wrap = document.createElement('div');
    wrap.className = 'mgv-wrap';
    wrap.id = 'mgvWrap';
    wrap.innerHTML =
      '<div class="mgv-ring">' +
      '  <canvas class="mgv-canvas" id="mgvCanvas" width="320" height="400" aria-label="원어민 강사"></canvas>' +
      '  <video class="mgv-video" id="mgvVideo" muted loop playsinline preload="auto">' +
      '    <source src="' + A + 'teacher-avatar.webm" type="video/webm">' +
      '    <source src="' + A + 'teacher-avatar.mp4" type="video/mp4">' +
      '  </video>' +
      '</div>' +
      '<div class="mgv-label" id="mgvLabel">함께 연습해요</div>';
    // 연습 섹션(문장 카드) 바로 앞에 삽입 — 좁은 화면에선 문장 위, 넓은 화면에선 fixed 로 빠짐
    var target = document.querySelector('.practice');
    if (target && target.parentNode) target.parentNode.insertBefore(wrap, target);
    else document.body.appendChild(wrap);
    return wrap;
  }

  /* ── 2. 아바타 엔진 (speech-coach 검증본: 캔버스 크로마키 + 음량 립싱크) ── */
  function buildAvatar() {
    var wrap = buildMarkup();
    var video = document.getElementById('mgvVideo');
    var canvas = document.getElementById('mgvCanvas');
    var label = document.getElementById('mgvLabel');
    var ctx = canvas.getContext('2d', { willReadFrequently: true });
    var W = canvas.width, H = canvas.height;
    var raf = 0, drawing = false;
    // 얼굴+어깨 상반신 크롭(teacher-avatar.png alpha 실측값 — speech-coach 와 동일)
    var CROP = { l: 67 / 512, t: 40 / 512, r: 445 / 512, b: 1 };

    var actx = null, analyser = null, lipData = null, boundEl = null, audioFailed = false;
    function ensureCtx() {
      if (actx) return true; if (audioFailed) return false;
      try {
        var AC = window.AudioContext || window.webkitAudioContext; if (!AC) throw 0;
        actx = new AC(); analyser = actx.createAnalyser(); analyser.fftSize = 512;
        lipData = new Uint8Array(analyser.fftSize); return true;
      } catch (e) { audioFailed = true; return false; }
    }
    function rms() {
      if (!analyser) return 0;
      analyser.getByteTimeDomainData(lipData);
      var s = 0; for (var i = 0; i < lipData.length; i++) { var v = (lipData[i] - 128) / 128; s += v * v; }
      return Math.sqrt(s / lipData.length);
    }
    function keyFrame() {
      if (video.readyState < 2) return;
      var vw = video.videoWidth || W, vh = video.videoHeight || H;
      var sx = Math.round(vw * CROP.l), sy = Math.round(vh * CROP.t);
      var sw = Math.round(vw * (CROP.r - CROP.l)), sh = Math.round(vh * (CROP.b - CROP.t));
      try { ctx.drawImage(video, sx, sy, sw, sh, 0, 0, W, H); } catch (e) { return; }
      var im; try { im = ctx.getImageData(0, 0, W, H); } catch (e) { return; }
      var d = im.data;
      for (var i = 0; i < d.length; i += 4) {
        var r = d[i], g = d[i + 1], b = d[i + 2];
        var mx = r > b ? r : b, diff = g - mx;
        if (diff > 38) { d[i + 3] = 0; }
        else if (diff > 10) { d[i + 3] = ((38 - diff) * 255 / 28) | 0; d[i + 1] = mx; }
        else if (diff > 0) { d[i + 1] = mx; }
      }
      ctx.putImageData(im, 0, 0);
    }
    function loop() {
      if (!drawing) { raf = 0; return; }
      if (boundEl && analyser && !boundEl.paused && !boundEl.ended) {
        var level = rms();
        if (level > 0.04) { if (video.paused) { try { video.play(); } catch (e) {} } try { video.playbackRate = 0.75 + level * 1.2; } catch (e) {} }
        else { if (!video.paused) { try { video.pause(); } catch (e) {} } }
      } else if (boundEl) {
        if (!video.paused) { try { video.pause(); } catch (e) {} }   // 대기/종료 = 입 정지
      } else {
        if (video.paused) { try { video.playbackRate = 1; video.play(); } catch (e) {} }
      }
      keyFrame();
      raf = requestAnimationFrame(loop);
    }
    function startDraw() { drawing = true; if (!raf) raf = requestAnimationFrame(loop); }
    function stopDraw() { drawing = false; if (raf) { try { cancelAnimationFrame(raf); } catch (e) {} raf = 0; } }
    function still() { keyFrame(); }
    function setSpeaking(on) {
      wrap.classList.toggle('speaking', !!on);
      label.textContent = on ? '말하는 중…' : '함께 연습해요';
    }
    video.addEventListener('loadeddata', function () { if (!drawing) still(); });
    video.addEventListener('seeked', function () { if (!drawing) still(); });
    (function () { try { var im = new Image(); im.onload = function () { if (!drawing) { try {
      var iw = im.naturalWidth || 512, ih = im.naturalHeight || 512;
      var sx = Math.round(iw * CROP.l), sy = Math.round(ih * CROP.t), sw = Math.round(iw * (CROP.r - CROP.l)), sh = Math.round(ih * (CROP.b - CROP.t));
      ctx.clearRect(0, 0, W, H); ctx.drawImage(im, sx, sy, sw, sh, 0, 0, W, H);
    } catch (e) {} } }; im.src = A + 'teacher-avatar.png'; } catch (e) {} })();

    return {
      attach: function (audioEl) {
        if (!audioEl || audioEl === boundEl) return;
        if (!ensureCtx()) return;
        try {
          var src = actx.createMediaElementSource(audioEl);
          src.connect(actx.destination);        // 소리 경로 필수(안 하면 음소거)
          src.connect(analyser);
          boundEl = audioEl;
          try { if (actx.state === 'suspended') actx.resume(); } catch (e) {}
        } catch (e) { /* 이미 물렸거나 실패 → 연속 재생 폴백 */ }
      },
      plainStart: function () { setSpeaking(true); try { if (actx && actx.state === 'suspended') actx.resume(); } catch (e) {} startDraw(); },
      plainStop: function () { setSpeaking(false); stopDraw(); try { video.pause(); } catch (e) {} still(); }
    };
  }

  /* ── 3. window.speak 교체 — 서버 원어민 TTS 우선(+속도 슬라이더 존중) ──── */
  function install() {
    var avatar = buildAvatar();
    window.MangoAvatar = avatar;   // 다른 스크립트에서 재사용 가능
    var ttsAudio = null;
    var cache = {};

    function stopAll() {
      try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (e) {}
      try { if (ttsAudio) ttsAudio.pause(); } catch (e) {}
      avatar.plainStop();
    }

    function synthFallback(text) {
      try {
        if (!window.speechSynthesis) return;
        var voices = window.speechSynthesis.getVoices();
        var v = null;
        for (var i = 0; i < voices.length; i++) { if (voices[i].lang && voices[i].lang.toLowerCase().indexOf('en') === 0) { v = voices[i]; break; } }
        // 영어 보이스가 없으면 침묵 — 한국어 기본 보이스가 영어 문장을 "아이 러브…" 식으로
        // 읽는 사고(speech-coach 에서 실제 발생) 방지. 침묵이 오독보다 낫다.
        if (!v) return;
        var u = new SpeechSynthesisUtterance(text);
        u.voice = v; u.lang = 'en-US';
        u.rate = window.ttsRate || 0.9; u.pitch = 1; u.volume = 1;
        u.onstart = function () { avatar.plainStart(); };
        u.onend = function () { avatar.plainStop(); };
        u.onerror = function () { avatar.plainStop(); };
        window.speechSynthesis.speak(u);
      } catch (e) {}
    }

    function mangoSpeak(text) {
      text = String(text || '').trim();
      if (!text) return;
      stopAll();
      var key = text;
      var playUrl = function (u) {
        try {
          if (!ttsAudio) {
            ttsAudio = new Audio();
            ttsAudio.preload = 'auto';
            avatar.attach(ttsAudio);
            ttsAudio.addEventListener('playing', function () { avatar.plainStart(); });
            var stop = function () { avatar.plainStop(); };
            ttsAudio.addEventListener('ended', stop);
            ttsAudio.addEventListener('pause', stop);
            ttsAudio.addEventListener('error', stop);
          }
          ttsAudio.src = u;
          ttsAudio.playbackRate = window.ttsRate || 0.9;   // 기존 속도 슬라이더 그대로 존중
          try { ttsAudio.preservesPitch = true; ttsAudio.webkitPreservesPitch = true; } catch (e2) {}
          ttsAudio.play().catch(function () { synthFallback(text); });
        } catch (e) { synthFallback(text); }
      };
      if (cache[key]) { playUrl(cache[key]); return; }
      fetch(TTS_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text, lang: 'en' })
      }).then(function (r) {
        var ct = r.headers.get('content-type') || '';
        if (!r.ok || ct.indexOf('audio') < 0) throw new Error('tts');
        return r.blob();
      }).then(function (b) {
        if (b.size < 200) throw new Error('tts_empty');
        var u = URL.createObjectURL(b);
        cache[key] = u;
        playUrl(u);
      }).catch(function () { synthFallback(text); });
    }

    // practice.html 의 속도 슬라이더 래퍼(300ms 인터벌)와의 로드 순서 경쟁을 이기기 위해
    // 3초 동안 주기적으로 재확정 — 마지막에 남는 speak 는 항상 이 함수다.
    window._speakWrapped = true;   // 기존 래퍼가 덮어쓰지 않게 선점
    window.speak = mangoSpeak;
    var n = 0;
    var t = setInterval(function () {
      if (window.speak !== mangoSpeak) window.speak = mangoSpeak;
      if (++n >= 12) clearInterval(t);
    }, 250);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();
