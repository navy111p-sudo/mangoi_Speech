// Fix: DOM.targetText polyfill + category select fix
document.addEventListener("DOMContentLoaded", function() {
  // Fix 1: DOM.targetText polyfill
  if (typeof DOM !== "undefined" && DOM.targetSentence && !DOM.targetText) {
    DOM.targetText = DOM.targetSentence;
    if (typeof handleLevelChange === "function") handleLevelChange();
  }

  // Fix 2: Use event delegation to fix first-option selection after category click
  var catBtns = document.getElementById("categoryBtns");
  if (!catBtns) return;

  catBtns.addEventListener("click", function(e) {
    var btn = e.target.closest("button");
    if (!btn) return;
    // Use setTimeout to run AFTER the original onclick handler completes
    setTimeout(function() {
      var selectEl = document.getElementById("levelSelect");
      if (!selectEl) return;
      var firstOpt = selectEl.querySelector(
        'optgroup:not([style*="display: none"]):not([style*="display:none"]) option'
      );
      if (firstOpt && selectEl.value !== firstOpt.value) {
        selectEl.value = firstOpt.value;
        if (typeof handleLevelChange === "function") handleLevelChange();
      }
    }, 0);
  });
});
