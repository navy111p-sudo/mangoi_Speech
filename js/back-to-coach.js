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

  /* 들어온 자리 기억 — 망고아이에서 온 경우에만.
     ⚠️ 다른 도메인으로 이동하면 브라우저가 referrer 를 "도메인까지만" 보낸다
        (Referrer-Policy: strict-origin-when-cross-origin — 기본값).
        그래서 경로가 "/" 로만 오는데, 그대로 쓰면 망고아이 '홈'으로 가버린다.
        사장님 요청은 '측정 직전 화면(발음 연습)'이므로 경로가 없으면 음성코치로 채운다. */
  var COACH_PATH = "/speech-coach.html";
  (function remember() {
    try {
      var ref = document.referrer || "";
      if (!ref) return;
      var o = new URL(ref);
      if (!TRUSTED.test(o.origin)) return;
      var path = (o.pathname && o.pathname !== "/") ? (o.pathname + o.search) : COACH_PATH;
      localStorage.setItem(KEY, o.origin + path);
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
    /* ⚠️ replace 로 이동한다(href 아님). href 로 가면 방문 기록이 하나 늘어,
       도착한 음성코치 화면의 ← 가 history.back() 으로 다시 연습앱으로 돌아와
       두 화면을 왔다갔다 하게 된다. replace 면 기록이 늘지 않아
       "← 한 번 = 음성코치, 거기서 또 = 홈페이지" 가 성립한다. */
    /* #from-practice 표시를 붙여 보낸다 — 음성코치 화면이 이 표시를 보면 자기 ← 를
       "홈페이지로" 로 바꾼다. 방문 기록 상태(새 탭이냐 아니냐)에 좌우되지 않게 하려는 것.
       → 결과: ← 한 번이면 음성코치, 거기서 또 누르면 홈페이지. */
    if (u) { global.location.replace(u.split("#")[0] + "#from-practice"); return; }
    if (global.history && global.history.length > 1) { global.history.back(); return; }
    global.location.replace(COACH_FALLBACK + "#from-practice");
  }
  global.mangoiGoBack = goBack;

  var HOME_URL = "https://webrtc-unified-platform-prod.navy111p.workers.dev/";

  function isEn() {
    try { return localStorage.getItem("mangoi_speech_lang") === "en"; } catch (e) { return false; }
  }
  function label() { return isEn() ? "Back" : "이전으로"; }
  function homeLabel() { return isEn() ? "Home" : "홈페이지"; }

  document.addEventListener("DOMContentLoaded", function () {
    /* ① 화면 왼쪽 위 고정 바로가기 — 「←」 + 바로 옆 「🏠」
          (2026-08-04 사장님 지시) 연습 화면 상단은 이 두 개만 남긴다.
          우측의 [🌐 EN]·[🏠 홈페이지]는 practice.html 에서 제거했다.
          · 글자 없이 아이콘만 — 폰에서 문장·마이크 영역을 가리지 않게 작게
          · 반투명(배경 0.28) — 뒤 배경이 비치도록
          · gap 으로 사이를 벌려 서로 겹치지 않게 */
    if (!document.getElementById("ms-top-left-actions")) {
      var DOT =
        "width:30px;height:30px;padding:0;" +
        "background:rgba(15,23,42,0.28);backdrop-filter:blur(6px);" +
        "-webkit-backdrop-filter:blur(6px);" +
        "border:1px solid rgba(255,255,255,0.16);color:#e8eefc;" +
        "border-radius:50%;font-size:14px;font-weight:700;line-height:1;" +
        "cursor:pointer;display:inline-flex;align-items:center;" +
        "justify-content:center;flex:0 0 auto;" +
        "text-decoration:none;font-family:'Noto Sans KR',sans-serif;" +
        "box-shadow:0 2px 8px rgba(0,0,0,0.22);" +
        "-webkit-tap-highlight-color:transparent";

      var wrap = document.createElement("div");
      wrap.id = "ms-top-left-actions";
      wrap.style.cssText =
        "position:fixed;top:10px;left:10px;z-index:99999;" +
        "display:flex;gap:8px;align-items:center";

      var b = document.createElement("button");
      b.id = "ms-back-btn";
      b.type = "button";
      b.title = "바로 전 화면(발음 연습)으로";
      b.setAttribute("aria-label", label());   /* 글자를 뺐으므로 읽어주기용 이름은 남긴다 */
      b.textContent = "←";
      b.style.cssText = DOT;
      b.addEventListener("click", goBack);
      wrap.appendChild(b);

      /* 🏠 학생 홈페이지 (사장님 지시 2026-07-28) */
      var h = document.createElement("a");
      h.id = "ms-home-btn-left";
      h.href = HOME_URL;
      h.title = "학생 홈페이지로";
      h.setAttribute("aria-label", homeLabel());
      h.textContent = "🏠";
      h.style.cssText = DOT;
      wrap.appendChild(h);

      document.body.appendChild(wrap);
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
