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

  // === Back link above level heading ===
  var levelSection = document.querySelector(".practice-section, .level-select, [class*=level]") || document.querySelector("main > div");
  if (!levelSection) { var secs = document.querySelectorAll("section, .card"); if (secs.length) levelSection = secs[0]; }
  if (levelSection) {
    var backLink = document.createElement("a");
    backLink.href = "index.html";
    backLink.innerHTML = "\u2190 \ub300\uc2dc\ubcf4\ub4dc\ub85c \ub3cc\uc544\uac00\uae30";
    backLink.style.cssText = "display:inline-block;margin:12px 0 8px 0;color:#cbd5e1;font-size:14px;text-decoration:none;font-weight:500;letter-spacing:-0.3px;";
    backLink.addEventListener("mouseenter",function(){backLink.style.color="#fff";});
    backLink.addEventListener("mouseleave",function(){backLink.style.color="#cbd5e1";});
    var header = document.querySelector(".header, header, [class*=header]");
    if (header) { header.style.position = "relative"; header.appendChild(backLink); backLink.style.cssText += "position:absolute;bottom:-28px;left:20px;"; }
    else { levelSection.parentNode.insertBefore(backLink, levelSection); }
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
