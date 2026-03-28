// remove-preview.js
// UI enhancements for practice page

document.addEventListener("DOMContentLoaded", function () {

  // === 1. Remove preview button + badge ===
  var previewBtn = document.querySelector('button[onclick="showDemoReport()"]');
  if (previewBtn && previewBtn.parentElement) {
    previewBtn.parentElement.remove();
  }

  // === 2. Hide reportSection (Final Report) ===
  var reportSection = document.getElementById("reportSection");
  if (reportSection) {
    reportSection.style.display = "none";
    reportSection.setAttribute("aria-hidden", "true");
  }

  // === 3. Disable showDemoReport ===
  if (typeof showDemoReport === "function") {
    window.showDemoReport = function () {};
  }

  // === 4. Logo click -> dashboard ===
  var logo = document.querySelector(".header__logo");
  if (logo) {
    logo.style.cursor = "pointer";
    logo.addEventListener("click", function () {
      window.location.href = "index.html";
    });
  }
  // Also make the header title clickable
  var headerInner = document.querySelector(".header__inner");
  if (headerInner && headerInner.children[0]) {
    headerInner.children[0].style.cursor = "pointer";
    headerInner.children[0].addEventListener("click", function () {
      window.location.href = "index.html";
    });
  }

  // === 5. Add back-to-dashboard button left of level heading ===
  var levelHeading = null;
  document.querySelectorAll("h2").forEach(function (h) {
    if (h.textContent.includes("\ub808\ubca8 \uc120\ud0dd")) levelHeading = h;
  });
  if (levelHeading) {
    var wrapper = document.createElement("div");
    wrapper.style.cssText = "display:flex;align-items:center;gap:12px;justify-content:center;";
    var backBtn = document.createElement("button");
    backBtn.innerHTML = "\u2190";
    backBtn.title = "\ub300\uc2dc\ubcf4\ub4dc\ub85c \ub3cc\uc544\uac00\uae30";
    backBtn.style.cssText = "background:#e6a800;color:#fff;border:none;border-radius:50%;width:36px;height:36px;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.15);";
    backBtn.addEventListener("click", function () {
      window.location.href = "index.html";
    });
    levelHeading.parentNode.insertBefore(wrapper, levelHeading);
    wrapper.appendChild(backBtn);
    wrapper.appendChild(levelHeading);
  }

  // === 6. Add reset button between slow/fast labels ===
  var speedControl = document.getElementById("speedControl");
  var slider = document.getElementById("ttsSpeedSlider");
  var speedLabel = document.getElementById("ttsSpeedLabel");
  if (speedControl && slider) {
    var resetBtn = document.createElement("button");
    resetBtn.textContent = "\uc6d0\uc704\uce58";
    resetBtn.style.cssText = "background:#e6a800;color:#fff;border:none;border-radius:12px;padding:2px 10px;font-size:12px;cursor:pointer;font-weight:bold;";
    resetBtn.addEventListener("click", function () {
      slider.value = 1;
      if (speedLabel) speedLabel.textContent = "1.0x";
      slider.dispatchEvent(new Event("input"));
    });
    // Insert after the slider (before the fast label)
    var fastLabel = speedControl.children[2]; // "\ube60\ub974\uac8c" span
    speedControl.insertBefore(resetBtn, fastLabel);
  }
});

// === 7. Override showReport AFTER all DOMContentLoaded handlers ===
window.addEventListener("load", function () {
  showReport = function () {
    if (typeof currentUser !== "undefined" && currentUser && typeof saveSession === "function") {
      saveSession()
        .then(function () {
          window.location.href = "results.html";
        })
        .catch(function (err) {
          console.warn("[DB] save failed:", err);
          window.location.href = "results.html";
        });
    } else {
      window.location.href = "results.html";
    }
  };
});
