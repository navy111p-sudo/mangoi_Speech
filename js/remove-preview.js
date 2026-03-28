// remove-preview.js
// 1) Remove preview button and badge
// 2) Hide Final Report section  
// 3) Override showReport to save results to Firebase then redirect to results.html

document.addEventListener("DOMContentLoaded", function () {

  // --- 1. Remove preview button + badge ---
  var previewBtn = document.querySelector('button[onclick="showDemoReport()"]');
  if (previewBtn) {
    var parentDiv = previewBtn.parentElement;
    if (parentDiv) parentDiv.remove();
  }

  // --- 2. Hide reportSection (Final Report) ---
  var reportSection = document.getElementById("reportSection");
  if (reportSection) {
    reportSection.style.display = "none";
    reportSection.setAttribute("aria-hidden", "true");
  }

  // --- 3. Override showReport ---
  if (typeof showReport === "function") {
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
  }

  // --- 4. Disable showDemoReport ---
  if (typeof showDemoReport === "function") {
    window.showDemoReport = function () {};
  }
});
