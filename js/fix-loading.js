// Fix: DOM.targetText polyfill + category select fix
// Runs after DOMContentLoaded to ensure DOM and main.js are ready
document.addEventListener("DOMContentLoaded", function() {
  // Fix 1: DOM.targetText polyfill
  if (typeof DOM !== "undefined" && DOM.targetSentence && !DOM.targetText) {
    DOM.targetText = DOM.targetSentence;
    if (typeof handleLevelChange === "function") handleLevelChange();
  }

  // Fix 2: Patch category buttons to properly select first visible option
  var catBtns = document.getElementById("categoryBtns");
  var selectEl = document.getElementById("levelSelect");
  if (!catBtns || !selectEl) return;

  var buttons = catBtns.querySelectorAll("button");
  for (var i = 0; i < buttons.length; i++) {
    (function(btn) {
      var origClick = btn.onclick;
      btn.onclick = function() {
        if (origClick) origClick.call(this);
        // Re-select first visible option after category change
        var firstOpt = selectEl.querySelector(
          'optgroup:not([style*="display: none"]):not([style*="display:none"]) option'
        );
        if (firstOpt && selectEl.value !== firstOpt.value) {
          selectEl.value = firstOpt.value;
          if (typeof handleLevelChange === "function") handleLevelChange();
        }
      };
    })(buttons[i]);
  }
});
