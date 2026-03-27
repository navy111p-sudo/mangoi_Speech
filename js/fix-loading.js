// Fix: DOM.targetText polyfill - runs after DOMContentLoaded
// Ensures handleLevelChange can update the sentence display
document.addEventListener("DOMContentLoaded", function() {
  if (typeof DOM !== "undefined" && DOM.targetSentence && !DOM.targetText) {
    DOM.targetText = DOM.targetSentence;
    if (typeof handleLevelChange === "function") handleLevelChange();
  }
});
