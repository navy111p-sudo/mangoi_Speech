/**
 * firebase-session-save.js
 * Hooks into evaluateSpeech and showReport to save practice data to Firebase.
 * Auto signs in anonymously if no user is logged in.
 * Must be loaded AFTER main.js and firebase-db.js.
 */
(function() {
  var capturedAttempts = [];
  var sessionBestScore = 0;

  // Auto anonymous sign-in on load
  function ensureAuth(callback) {
    if (!firebase || !firebase.auth) return;
    var user = firebase.auth().currentUser;
    if (user) { callback(user); return; }
    firebase.auth().signInAnonymously().then(function(cred) {
      console.log("Signed in anonymously:", cred.user.uid);
      // Create user doc if needed
      var db = firebase.firestore();
      db.collection("users").doc(cred.user.uid).get().then(function(doc) {
        if (!doc.exists) {
          db.collection("users").doc(cred.user.uid).set({
            totalSessions: 0, bestScore: 0,
            lastActiveAt: firebase.firestore.FieldValue.serverTimestamp(),
            currentLevel: "BTS 1"
          });
        }
      });
      callback(cred.user);
    }).catch(function(e) { console.log("Anon auth error:", e); });
  }

  // Sign in on page load
  if (typeof firebase !== "undefined" && firebase.auth) {
    firebase.auth().onAuthStateChanged(function(user) {
      if (!user) { ensureAuth(function() {}); }
    });
  }

  // Wrap evaluateSpeech to capture attempt data
  var _origEval = window.evaluateSpeech;
  window.evaluateSpeech = function(spokenText) {
    _origEval(spokenText);
    setTimeout(function() {
      try {
        var fb = document.getElementById("feedbackSection");
        if (!fb) return;
        var text = fb.innerText || "";
        var pMatch = text.match(/\b(\d+)\s*%/g);
        var scores = [];
        if (pMatch) {
          for (var i = 0; i < pMatch.length; i++) scores.push(parseInt(pMatch[i]));
        }
        var pron = scores[0] || 0;
        var gram = scores[1] || 0;
        var flu = scores[2] || 0;
        var avg = scores.length >= 3 ? Math.round((pron + gram + flu) / 3) : (scores[0] || 0);
        var target = document.getElementById("targetSentence");
        var targetText = target ? target.textContent.trim() : "";
        capturedAttempts.push({
          spokenText: spokenText || "",
          correctedText: targetText,
          errorCount: 0,
          scores: { pronunciation: pron, grammar: gram, fluency: flu, average: avg }
        });
        if (avg > sessionBestScore) sessionBestScore = avg;
      } catch(e) { console.log("capture error:", e); }
    }, 500);
  };

  // Wrap showReport to save to Firebase
  var _origReport = window.showReport;
  window.showReport = function() {
    _origReport();
    setTimeout(function() {
      try {
        if (capturedAttempts.length === 0) {
          var rpt = document.getElementById("reportSection");
          if (rpt) {
            var nums = rpt.innerText.match(/\b(\d+)\s*%/g);
            if (nums && nums.length >= 3) {
              var p = parseInt(nums[0]), g = parseInt(nums[1]), f = parseInt(nums[2]);
              capturedAttempts.push({
                spokenText: "", correctedText: "",
                errorCount: 0,
                scores: { pronunciation: p, grammar: g, fluency: f, average: Math.round((p+g+f)/3) }
              });
              sessionBestScore = Math.round((p+g+f)/3);
            }
          }
        }
        var levelSel = document.getElementById("levelSelect");
        var level = levelSel ? levelSel.options[levelSel.selectedIndex].text : "Unknown";
        var target = document.getElementById("targetSentence");
        var targetText = target ? target.textContent.trim() : "";

        ensureAuth(function(user) {
          var db = firebase.firestore();
          db.collection("sessions").add({
            uid: user.uid,
            level: level,
            targetSentence: targetText,
            attempts: capturedAttempts,
            bestScore: sessionBestScore,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          }).then(function() {
            console.log("Session saved! Score:", sessionBestScore);
            var userRef = db.collection("users").doc(user.uid);
            userRef.get().then(function(doc) {
              if (doc.exists) {
                var d = doc.data();
                userRef.update({
                  totalSessions: (d.totalSessions || 0) + 1,
                  bestScore: Math.max(d.bestScore || 0, sessionBestScore),
                  lastActiveAt: firebase.firestore.FieldValue.serverTimestamp()
                });
              } else {
                userRef.set({
                  totalSessions: 1, bestScore: sessionBestScore,
                  lastActiveAt: firebase.firestore.FieldValue.serverTimestamp(),
                  currentLevel: level
                });
              }
            });
          }).catch(function(e) { console.log("Save error:", e); });
          capturedAttempts = [];
          sessionBestScore = 0;
        });
      } catch(e) { console.log("Report save error:", e); }
    }, 1000);
  };

  console.log("Firebase session save hooks loaded.");
})();
