/**
 * ═══════════════════════════════════════════════════════════════
 * back-to-coach.js — "뒤로 가기"를 들어온 자리로 (v1, 2026-07-28)
 *
 * 무엇을 고치나
 *   연습 화면의 ← 링크가 이 앱 자체 대시보드(index.html)로 가서, 망고아이
 *   AI 음성코치(발음 연습)에서 들어온 학생이 엉뚱한 곳으로 튕겼다.
 *   Phonics·BTS·SIU 가 모두 이 한 화면(practice.html)을 쓰므로 여기 한 곳만
 *   고치면 전부 적용된다.
 *
 * 어디로 보내나 (우선순위)
 *   1) 망고아이에서 들어왔으면 그 페이지로 (들어올 때 기억해 둔다)
 *   2) 앱 안에서 이동해 온 경우엔 브라우저 뒤로가기
 *   3) 둘 다 아니면 망고아이 음성코치 페이지
 *
 * 망고아이 정식 출처만 기억한다 — 아무 사이트나 돌아갈 곳으로 심지 못하게.
 * ═══════════════════════════════════════════════════════════════
 */
(function (global) {
  "use strict";

  var KEY = "mangoi_speech_return_url";
  var COACH_FALLBACK = "https://webrtc-unified-platform-prod.navy111p.workers.dev/speech-coach.html";
  var TRUSTED = /^https:\/\/([a-z0-9-]+\.)*(mango-i\.com|mangoi\.co\.kr|navy111p\.workers\.dev)$/i;

  /* 들어온 자리 기억 — 망고아이에서 온 경우에만 */
  (function remember() {
    try {
      var ref = document.referrer || "";
      if (!ref) return;
      var o = new URL(ref);
      if (!TRUSTED.test(o.origin)) return;
      localStorage.setItem(KEY, ref);
    } catch (e) {}
  })();

  function returnUrl() {
    try {
      var u = localStorage.getItem(KEY);
      if (!u) return "";
      return TRUSTED.test(new URL(u).origin) ? u : "";   // 저장값도 한 번 더 검증
    } catch (e) { return ""; }
  }

  function goBack(ev) {
    if (ev && ev.preventDefault) ev.preventDefault();
    var u = returnUrl();
    if (u) { global.location.href = u; return; }
    if (global.history && global.history.length > 1) { global.history.back(); return; }
    global.location.href = COACH_FALLBACK;
  }
  global.mangoiGoBack = goBack;

  function label() {
    var en = false;
    try { en = localStorage.getItem("mangoi_speech_lang") === "en"; } catch (e) {}
    return en ? "Back" : "이전으로";
  }

  document.addEventListener("DOMContentLoaded", function () {
    /* ① 화면 왼쪽 위 고정 바로가기 (오른쪽 위 홈/EN 묶음과 같은 모양) */
    if (!document.getElementById("ms-back-btn")) {
      var b = document.createElement("button");
      b.id = "ms-back-btn";
      b.type = "button";
      b.title = "바로 전 화면(발음 연습)으로";
      b.innerHTML = '← <span id="ms-back-label">' + label() + "</span>";
      b.style.cssText =
        "position:fixed;top:14px;left:14px;z-index:99999;" +
        "background:rgba(20,28,48,0.65);backdrop-filter:blur(10px);" +
        "border:1px solid rgba(255,255,255,0.18);color:#f1f5ff;" +
        "padding:9px 15px;border-radius:99px;font-size:13px;font-weight:800;" +
        "cursor:pointer;display:inline-flex;align-items:center;gap:5px;" +
        "font-family:'Noto Sans KR',sans-serif;box-shadow:0 6px 18px rgba(0,0,0,0.3)";
      b.addEventListener("click", goBack);
      document.body.appendChild(b);
    }

    /* ② 기존 '← 대시보드로 돌아가기' 링크도 같은 곳으로.
          ui-enhancements.js 가 DOMContentLoaded 에서 뒤늦게 넣으므로 잠깐 기다린다. */
    var tries = 0;
    var timer = setInterval(function () {
      var links = document.querySelectorAll("a");
      var found = false;
      for (var i = 0; i < links.length; i++) {
        var t = (links[i].textContent || "");
        if (t.indexOf("대시보드로 돌아가기") > -1 || t.indexOf("Back to Dashboard") > -1) {
          links[i].textContent = "← " + label();
          links[i].setAttribute("href", "#");
          links[i].onclick = goBack;
          found = true;
        }
      }
      if (found || ++tries > 40) clearInterval(timer);
    }, 100);
  });
})(window);
