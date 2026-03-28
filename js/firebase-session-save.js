/**
 * firebase-session-save.js
 * Hooks into evaluateSpeech and showReport to save practice data to Firebase.
 * Must be loaded AFTER main.js and firebase-db.js.
 */
(function() {
  // Storage for attempt data captured from evaluateSpeech
  var capturedAttempts = [];
  var sessionBestScore = 0;

  // Wrap evaluateSpeech to capture each attempt result
  var _origEval = window.evaluateSpeech;
  window.evaluateSpeech = function(spokenText) {
    _origEval(spokenText);
    // After original runs, read scores from the DOM feedback area
    setTimeout(function() {
      try {
        var fb = document.getElementById("feedbackSection");
        if (!fb) return;
        // Extract scores from feedback text
        var text = fb.innerText || "";
        var pMatch = text.match(/\b(\d+)\s*%/g);
        var scores = [];
        if (pMatch) {
          for (var i = 0; i < pMatch.length; i++) {
            scores.push(parseInt(pMatch[i]));
          }
        }
        var pron = scores[0] || 0;
        var gram = scores[1] || 0;
        var flu = scores[2] || 0;
        var avg = scores.length ? Math.round((pron + gram + flu) / 3) : 0;

        var target = document.getElementById("targetSentence");
        var targetText = target ? target.textContent.trim() : "";

        var attemptData = {
          spokenText: spokenText || "",
          correctedText: targetText,
          errorCount: 0,
          scores: { pronunciation: pron, grammar: gram, fluency: flu, average: avg }
        };
        capturedAttempts.push(attemptData);
        if (avg > sessionBestScore) sessionBestScore = avg;
      } catch(e) { console.log("capture error:", e); }
    }, 500);
  };

  // Wrap showReport to save session to Firebase when report is displayed
  var _origReport = window.showReport;
  window.showReport = function() {
    _origReport();
    // Save to Firebase
    setTimeout(function() {
      try {
        if (capturedAttempts.length === 0) {
          // Fallback: read from report modal DOM
          var reportEl = document.getElementById("reportSection");
          if (reportEl) {
            var nums = reportEl.innerText.match(/\b(\d+)\s*%/g);
            if (nums && nums.length >= 3) {
              var p = parseInt(nums[0]);
              var g = parseInt(nums[1]);
              var f = parseInt(nums[2]);
              var a = Math.round((p + g + f) / 3);
              capturedAttempts.push({
                spokenText: "", correctedText: "",
                errorCount: 0,
                scores: { pronunciation: p, grammar: g, fluency: f, average: a }
              });
              sessionBestScore = a;
            }
          }
        }

        // Get current level from select
        var levelSel = document.getElementById("levelSelect");
        var level = levelSel ? levelSel.options[levelSel.selectedIndex].text : "Unknown";

        // Get target sentence
        var target = document.getElementById("targetSentence");
        var targetText = target ? target.textContent.trim() : "";

        // Check auth
        if (typeof firebase === "undefined" || !firebase.auth) return;
        var user = firebase.auth().currentUser;
        if (!user) {
          console.log("Not logged in - session not saved");
          return;
        }

        // Build session data matching firebase-db.js saveSession format
        var db = firebase.firestore();
        var sessionData = {
          uid: user.uid,
          level: level,
          targetSentence: targetText,
          attempts: capturedAttempts,
          bestScore: sessionBestScore,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        db.collection("sessions").add(sessionData).then(function() {
          console.log("Session saved to Firebase!");
          // Update user stats
          var userRef = db.collection("users").doc(user.uid);
          userRef.get().then(function(doc) {
            if (doc.exists) {
              var data = doc.data();
              var newTotal = (data.totalSessions || 0) + 1;
              var newBest = Math.max(data.bestScore || 0, sessionBestScore);
              userRef.update({
                totalSessions: newTotal,
                bestScore: newBest,
                lastActiveAt: firebase.firestore.FieldValue.serverTimestamp()
              });
            } else {
              userRef.set({
                totalSessions: 1,
                bestScore: sessionBestScore,
                lastActiveAt: firebase.firestore.FieldValue.serverTimestamp(),
                currentLevel: level
              });
            }
          });
        }).catch(function(e) { console.log("Save error:", e); });

        // Reset for next session
        capturedAttempts = [];
        sessionBestScore = 0;
      } catch(e) { console.log("showReport save error:", e); }
    }, 1000);
  };

  console.log("Firebase session save hooks loaded.");
})();
