// remove-preview.js
// 1) Remove preview button and badge
// 2) Hide Final Report section
// 3) Override showReport to save to Firebase then redirect to results.html

// --- 1. Remove preview button + badge (on DOMContentLoaded) ---
document.addEventListener("DOMContentLoaded", function () {
  var previewBtn = document.querySelector('button[onclick="showDemoReport()"]');
  if (previewBtn && previewBtn.parentElement) {
    previewBtn.parentElement.remove();
  }

  // Hide reportSection
  var reportSection = document.getElementById("reportSection");
  if (reportSection) {
    reportSection.style.display = "none";
    reportSection.setAttribute("aria-hidden", "true");
  }

  // Disable showDemoReport
  if (typeof showDemoReport === "function") {
    window.showDemoReport = function () {};
  }
});

// --- 2. Override showReport AFTER all DOMContentLoaded handlers ---
// Use window.load to ensure firebase-db.js has already wrapped showReport
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
