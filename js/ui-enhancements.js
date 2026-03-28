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

  // === Back button left of level heading ===
  var h2s = document.querySelectorAll("h2");
  var lh = null;
  for (var i = 0; i < h2s.length; i++) {
    if (h2s[i].textContent.indexOf("레벨") > -1) { lh = h2s[i]; break; }
  }
  if (lh) {
    lh.style.position = "relative";
    var bb = document.createElement("button");
    bb.textContent = "\u25C0";
    bb.title = "뒤로가기";
    bb.style.cssText = "position:absolute;left:-36px;top:50%;transform:translateY(-50%);background:none;border:none;font-size:20px;cursor:pointer;color:#555;padding:4px 8px;";
    bb.addEventListener("mouseenter", function () { bb.style.color = "#000"; });
    bb.addEventListener("mouseleave", function () { bb.style.color = "#555"; });
    bb.addEventListener("click", function () { window.history.back(); });
    lh.appendChild(bb);
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
