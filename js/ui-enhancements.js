// ui-enhancements.js
// Back link, speed control, auto-advance attempt
document.addEventListener("DOMContentLoaded", function () {
  // === Logo click -> dashboard ===
  var logo = document.querySelector(".header__logo");
  if (logo) {
    logo.style.cursor = "pointer";
    logo.addEventListener("click", function () {
      window.location.href = "index.html";
    });
  }

  var hInner = document.querySelector(".header__inner");
  if (hInner && hInner.children[0]) {
    hInner.children[0].style.cursor = "pointer";
    hInner.children[0].addEventListener("click", function () {
      window.location.href = "index.html";
    });
  }

  // === Remove yellow circle back button, add text link ===
  var h2s = document.querySelectorAll("h2");
  var lh = null;
  for (var i = 0; i < h2s.length; i++) {
    if (h2s[i].textContent.indexOf("\ub808\ubca8") > -1) {
      lh = h2s[i]; break;
    }
  }
  if (lh) {
    var prev = lh.previousElementSibling;
    if (prev && prev.tagName === "BUTTON") { prev.remove(); }
    var backLink = document.createElement("a");
    backLink.href = "index.html";
    backLink.textContent = "\u2190 \ub300\uc2dc\ubcf4\ub4dc\ub85c \ub3cc\uc544\uac00\uae30";
    backLink.style.cssText = "display:block;text-align:center;margin-bottom:8px;color:#4a7cff;font-size:14px;text-decoration:none;font-weight:600;";
    lh.parentNode.insertBefore(backLink, lh);
  }

  // === Speed control: remove buttons only, move label below slider ===
  var sc = document.getElementById("speedControl");
  if (sc) {
    var btns = sc.querySelectorAll("button");
    for (var j = 0; j < btns.length; j++) { btns[j].remove(); }
    var sl = document.getElementById("ttsSpeedSlider");
    var lb = document.getElementById("ttsSpeedLabel");
    if (sl && lb) {
      sc.style.position = "relative";
      sc.style.paddingBottom = "22px";
      lb.style.cssText = "position:absolute;bottom:2px;left:50%;transform:translateX(-50%);font-size:12px;color:#1565c0;font-weight:700;";
    }
  }
  var rs = document.createElement("style");
  rs.textContent = "#speedControl{position:relative;padding-bottom:22px;}@media(max-width:768px){#speedControl{padding-bottom:24px;}#speedControl input[type=range]{width:100%;}}";
  document.head.appendChild(rs);

  // === Auto-advance attempt: capture click on btnRecord BEFORE main.js handler ===
  document.addEventListener("click", function (e) {
    var btn = e.target.closest ? e.target.closest("#btnRecord") : null;
    if (!btn && e.target.id === "btnRecord") btn = e.target;
    if (!btn) return;
    var btnNext = document.getElementById("btnNextAttempt");
    if (btnNext && btnNext.style.display !== "none" && typeof nextAttempt === "function") {
      nextAttempt();
    }
  }, true);
});
