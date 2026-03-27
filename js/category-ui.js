/**
 * Category UI - Adds Phonics/BTS/SIU category selection menu
 * Also fixes DOM.targetText bug (should be DOM.targetSentence)
 * This file should be loaded AFTER main.js
 */
(function() {
  // === Bug Fix: DOM.targetText is undefined, should be DOM.targetSentence ===
  if (typeof DOM !== "undefined" && DOM.targetSentence && !DOM.targetText) {
    DOM.targetText = DOM.targetSentence;
  }

  // === Category Menu UI ===
  var h2 = document.querySelector("section.practice h2");
  if (!h2) return;

  // Change header text from "BTS" to generic
  var span = h2.querySelector("span");
  h2.innerHTML = "";
  if (span) h2.appendChild(span);
  h2.appendChild(document.createTextNode(" \ub808\ubca8 \uc120\ud0dd"));

  var selectEl = document.getElementById("levelSelect");
  var levelInfo = document.getElementById("levelInfo");
  if (!selectEl) return;

  var parentDiv = selectEl.parentElement;

  // Create category buttons
  var btnContainer = document.createElement("div");
  btnContainer.id = "categoryBtns";
  btnContainer.style.cssText = "display:flex; gap:0.5rem; flex-wrap:wrap; justify-content:center; width:100%; max-width:500px;";

  var categories = [
    {id: "cat-phonics", label: "Phonics", groups: ["Phonics"], color: "#10b981"},
    {id: "cat-bts", label: "BTS", groups: ["BTS"], color: "#e6a800"},
    {id: "cat-siu", label: "SIU", groups: ["SIU Basic", "SIU Advance"], color: "#6366f1"}
  ];

  var optgroups = selectEl.querySelectorAll("optgroup");

  function selectCategory(cat) {
    // Update button styles
    var btns = btnContainer.querySelectorAll("button");
    for (var b = 0; b < btns.length; b++) {
      var thisCat = categories[b];
      if (thisCat.id === cat.id) {
        btns[b].style.background = thisCat.color;
        btns[b].style.color = "white";
        btns[b].style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
        btns[b].setAttribute("data-active", "1");
      } else {
        btns[b].style.background = "white";
        btns[b].style.color = thisCat.color;
        btns[b].style.boxShadow = "none";
        btns[b].removeAttribute("data-active");
      }
    }

    // Show/hide optgroups
    for (var i = 0; i < optgroups.length; i++) {
      var show = false;
      for (var g = 0; g < cat.groups.length; g++) {
        if (optgroups[i].label === cat.groups[g]) { show = true; break; }
      }
      optgroups[i].style.display = show ? "" : "none";
    }

    // Show select and info
    selectEl.style.display = "";
    if (levelInfo) levelInfo.style.display = "";

    // Update header accent color
    if (span) span.style.background = cat.color;

    // Update select border color
    selectEl.style.borderColor = cat.color.replace(")", ",0.3)").replace("rgb", "rgba");

    // Select first visible option
    var visibleGroups = selectEl.querySelectorAll('optgroup');
    var firstOpt = null;
    for (var i = 0; i < visibleGroups.length; i++) {
      if (visibleGroups[i].style.display !== "none" && visibleGroups[i].options.length > 0) {
        firstOpt = visibleGroups[i].options[0];
        break;
      }
    }
    if (firstOpt) {
      selectEl.value = firstOpt.value;
      if (typeof handleLevelChange === "function") handleLevelChange();
    }
  }

  // Create buttons
  for (var c = 0; c < categories.length; c++) {
    (function(cat) {
      var btn = document.createElement("button");
      btn.id = cat.id;
      btn.textContent = cat.label;
      btn.style.cssText = "flex:1; min-width:80px; padding:0.75rem 1rem; border:2px solid " + cat.color + "; border-radius:1rem; font-size:1rem; font-weight:700; background:white; color:" + cat.color + "; cursor:pointer; transition:all 0.2s; font-family:Pretendard,Noto Sans KR,sans-serif;";
      btn.onmouseenter = function() {
        if (!this.getAttribute("data-active")) { this.style.background = cat.color; this.style.color = "white"; }
      };
      btn.onmouseleave = function() {
        if (!this.getAttribute("data-active")) { this.style.background = "white"; this.style.color = cat.color; }
      };
      btn.onclick = function() { selectCategory(cat); };
      btnContainer.appendChild(btn);
    })(categories[c]);
  }

  parentDiv.insertBefore(btnContainer, selectEl);

  // Initially hide level select and info until category is chosen
  selectEl.style.display = "none";
  if (levelInfo) levelInfo.style.display = "none";
})();
