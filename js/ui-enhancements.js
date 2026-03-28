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

  // === Speed reset button ("원위치") on slider ===
  var sc = document.querySelector(".speed-control");
  if (sc) {
    var sr = sc.querySelector('input[type="range"]');
    if (sr) {
      var wrap = sr.parentElement;
      wrap.style.position = "relative";
      var rb = document.createElement("button");
      rb.textContent = "원위치";
      rb.title = "속도 초기화";
      rb.style.cssText = "position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:none;color:#888;border:none;padding:0;font-size:10px;cursor:pointer;font-weight:bold;z-index:2;line-height:1;letter-spacing:1px;";
      rb.addEventListener("mouseenter", function () { rb.style.color = "#333"; });
      rb.addEventListener("mouseleave", function () { rb.style.color = "#888"; });
      rb.addEventListener("click", function () {
        sr.value = 1;
        sr.dispatchEvent(new Event("input", { bubbles: true }));
      });
      wrap.appendChild(rb);
    }
  }

});
