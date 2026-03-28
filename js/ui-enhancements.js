// ui-enhancements.js
// Logo->dashboard, back button, speed reset

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

  // === Back button left of level heading ===
  var h2s = document.querySelectorAll("h2");
  var lh = null;
  for (var i = 0; i < h2s.length; i++) {
    if (h2s[i].textContent.indexOf("레벨") > -1) { lh = h2s[i]; break; }
  }
  if (lh) {
    var w = document.createElement("div");
    w.style.cssText = "display:flex;align-items:center;gap:12px;justify-content:center;";
    var b = document.createElement("button");
    b.innerHTML = "←";
    b.title = "대시보드로 돌아가기";
    b.style.cssText = "background:#e6a800;color:#fff;border:none;border-radius:50%;width:36px;height:36px;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.15);";
    b.addEventListener("click", function () { window.location.href = "index.html"; });
    lh.parentNode.insertBefore(w, lh);
    w.appendChild(b);
    w.appendChild(lh);
  }

  // === Speed reset (red circle, blue text) ===
  var sc = document.getElementById("speedControl");
  var sl = document.getElementById("ttsSpeedSlider");
  var lb = document.getElementById("ttsSpeedLabel");
  if (sc && sl) {
    var ex = sc.querySelectorAll("button, .reset-label");
    for (var j = 0; j < ex.length; j++) { ex[j].remove(); }

    sc.style.position = "relative";

    var rb = document.createElement("span");
    rb.className = "reset-label";
    rb.textContent = "원위치";
    rb.style.cssText = "position:absolute;top:-18px;left:50%;transform:translateX(-50%);background:#fff;border:2px solid #e53935;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;color:#1565c0;font-size:9px;cursor:pointer;font-weight:700;z-index:2;line-height:1;box-shadow:0 1px 3px rgba(0,0,0,0.12);";
    rb.addEventListener("click", function () {
      sl.value = 1;
      if (lb) lb.textContent = "1.0x";
      sl.dispatchEvent(new Event("input"));
    });
    sc.appendChild(rb);
  }
});

