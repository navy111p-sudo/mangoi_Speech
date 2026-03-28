// ui-enhancements.js
// Logo->dashboard, back button, speed reset

document.addEventListener("DOMContentLoaded", function () {

  // === Logo Click -> dashboard ===
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

  // === Back link (remove old yellow button, add text link) ===
  var h2s = document.querySelectorAll("h2");
  var levelH2 = null;
  for (var i = 0; i < h2s.length; i++) {
    if (h2s[i].textContent.indexOf("\ub808\ubca8") >= 0) { levelH2 = h2s[i]; break; }
  }
  if (levelH2) {
    var prev = levelH2.previousElementSibling;
    if (prev && prev.tagName === "BUTTON") { prev.remove(); }
  }
  var header = document.querySelector(".header, header, [class*=header]");
  if (header) {
    var backLink = document.createElement("a");
    backLink.href = "index.html";
    backLink.textContent = "\u2190 \ub300\uc2dc\ubcf4\ub4dc\ub85c \ub3cc\uc544\uac00\uae30";
    backLink.style.cssText = "display:block;padding:8px 20px 0;color:#cbd5e1;font-size:14px;text-decoration:none;font-weight:500;";
    backLink.addEventListener("mouseenter",function(){this.style.color="#fff";});
    backLink.addEventListener("mouseleave",function(){this.style.color="#cbd5e1";});
    header.after(backLink);
  }

  // === Speed control: remove reset btn, move label below slider ===
  var sc = document.getElementById("speedControl");
  if (sc) {
    // Remove only 원위치 button(s)
    var btns = sc.querySelectorAll("button");
    for (var j = 0; j < btns.length; j++) { btns[j].remove(); }
    // Find slider and speed label
    var sl = document.getElementById("ttsSpeedSlider");
    var lb = document.getElementById("ttsSpeedLabel");
    if (sl && lb) {
      // Make sc relative for positioning
      sc.style.position = "relative";
      sc.style.paddingBottom = "22px";
      // Move label below slider, centered
      lb.style.cssText = "position:absolute;bottom:2px;left:50%;transform:translateX(-50%);font-size:12px;color:#1565c0;font-weight:700;";
    }
  }
  // Responsive
  var rs = document.createElement("style");
  rs.textContent = "#speedControl{position:relative;padding-bottom:22px;}@media(max-width:768px){#speedControl{padding-bottom:24px;}#speedControl input[type=range]{width:100%;}}";
  document.head.appendChild(rs);
});
