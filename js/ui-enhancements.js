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

  // === Speed display: remove reset btn, center label below slider ===
  var sc = document.querySelector(".speed-control");
  if (sc) {
    // Remove any existing reset buttons/labels
    var resets = sc.querySelectorAll("button, .reset-label");
    for (var j = 0; j < resets.length; j++) { resets[j].remove(); }
    // Find slider and label
    var sl = sc.querySelector('input[type="range"]');
    var lb = document.getElementById("ttsSpeedLabel") || sc.querySelector("span");
    if (sl && lb) {
      // Wrap slider in a relative container
      var wrap = sl.parentElement;
      wrap.style.position = "relative";
      // Style the label: centered below the slider bar
      lb.style.cssText = "position:absolute;bottom:-18px;left:50%;transform:translateX(-50%);font-size:11px;color:#1565c0;font-weight:700;pointer-events:none;";
      // Move label inside the wrap if not already
      if (lb.parentElement !== wrap) { wrap.appendChild(lb); }
    }
  }
  // === Responsive: speed control padding for mobile/tablet ===
  var style = document.createElement("style");
  style.textContent = "@media(max-width:768px){.speed-control{padding-bottom:22px !important;margin-bottom:8px !important;}}";
  document.head.appendChild(style);
});
