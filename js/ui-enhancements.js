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

  // === Speed reset button (center of slider) ===
  var sc = document.getElementById("speedControl");
  var sl = document.getElementById("ttsSpeedSlider");
  var lb = document.getElementById("ttsSpeedLabel");
  if (sc && sl) {
    // Remove any existing 원위치 buttons first
    var existing = sc.querySelectorAll("button");
    for (var j = 0; j < existing.length; j++) { existing[j].remove(); }

    // Create a wrapper div for slider + reset button
    var sliderWrap = document.createElement("div");
    sliderWrap.style.cssText = "display:flex;align-items:center;gap:6px;flex:1;";

    // Move slider into wrapper
    var sliderParent = sl.parentNode;
    sliderWrap.appendChild(sl);

    // Create reset button
    var rb = document.createElement("button");
    rb.textContent = "원위치";
    rb.style.cssText = "background:#e6a800;color:#fff;border:none;border-radius:12px;padding:2px 10px;font-size:11px;cursor:pointer;font-weight:bold;white-space:nowrap;";
    rb.addEventListener("click", function () {
      sl.value = 1;
      if (lb) lb.textContent = "1.0x";
      sl.dispatchEvent(new Event("input"));
    });
    sliderWrap.appendChild(rb);

    // Insert wrapper where slider was (after 느리게, before 빠르게)
    var slow = sc.querySelector("span");
    if (slow && slow.nextSibling) {
      sc.insertBefore(sliderWrap, slow.nextSibling);
    } else {
      sc.insertBefore(sliderWrap, sc.children[1]);
    }
  }
});
