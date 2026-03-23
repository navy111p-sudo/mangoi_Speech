/**
 * ===========================
 * Firebase Firestore Database
 * mangoi_Speech - 데이터 관리
 * ===========================
 * 학습 기록, 점수, 사용자 설정 저장
 * ES5 호환 코드
 */

// =====================
// 1. 사용자 데이터 로드
// =====================
function loadUserData(uid) {
  if (!uid) return;
  db.collection("users").doc(uid).get()
    .then(function (doc) {
      if (doc.exists) {
        var data = doc.data();
        console.log("[DB] 사용자 데이터 로드:", data);
        if (data.currentLevel && DOM.levelSelect) {
          DOM.levelSelect.value = data.currentLevel;
          handleLevelChange();
        }
      } else {
        console.log("[DB] 신규 사용자, 기본 데이터 생성");
      }
    })
    ["catch"](function (error) {
      console.error("[DB] 사용자 데이터 로드 오류:", error);
    });
}

// =====================
// 2. 학습 세션 저장
// =====================
function saveSession() {
  if (!currentUser) {
    console.warn("[DB] 로그인 필요 - 세션 저장 건너뜀");
    return Promise.resolve(null);
  }
  var uid = currentUser.uid;
  var record = {
    uid: uid,
    level: currentLevelKey || "전체",
    targetSentence: state.currentSentence,
    attempts: [],
    bestScore: 0,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  for (var i = 0; i < state.attempts.length; i++) {
    var attempt = state.attempts[i];
    record.attempts.push({
      attempt: attempt.attempt,
      spokenText: attempt.spokenText,
      correctedText: attempt.correctedText,
      errorCount: attempt.errors ? attempt.errors.length : 0,
      scores: {
        pronunciation: attempt.scores.pronunciation,
        grammar: attempt.scores.grammar,
        fluency: attempt.scores.fluency,
        average: attempt.scores.average
      }
    });
    if (attempt.scores.average > record.bestScore) {
      record.bestScore = attempt.scores.average;
    }
  }
  return db.collection("sessions").add(record)
    .then(function (docRef) {
      console.log("[DB] 세션 저장 완료:", docRef.id);
      return updateUserStats(uid, record.bestScore);
    })
    ["catch"](function (error) {
      console.error("[DB] 세션 저장 오류:", error);
    });
}

// =====================
// 3. 사용자 통계 업데이트
// =====================
function updateUserStats(uid, sessionBestScore) {
  var userRef = db.collection("users").doc(uid);
  return db.runTransaction(function (transaction) {
    return transaction.get(userRef).then(function (doc) {
      if (!doc.exists) return;
      var data = doc.data();
      var updateData = {
        totalSessions: (data.totalSessions || 0) + 1,
        bestScore: Math.max(data.bestScore || 0, sessionBestScore),
        lastActiveAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      if (currentLevelKey) updateData.currentLevel = currentLevelKey;
      transaction.update(userRef, updateData);
    });
  })
  .then(function () { console.log("[DB] 사용자 통계 업데이트 완료"); })
  ["catch"](function (error) { console.error("[DB] 통계 업데이트 오류:", error); });
}

// =====================
// 4. 학습 기록 조회
// =====================
function getSessionHistory(limit) {
  if (!currentUser) return Promise.resolve([]);
  return db.collection("sessions")
    .where("uid", "==", currentUser.uid)
    .orderBy("createdAt", "desc")
    .limit(limit || 20)
    .get()
    .then(function (snapshot) {
      var sessions = [];
      snapshot.forEach(function (doc) {
        var data = doc.data();
        data.id = doc.id;
        sessions.push(data);
      });
      console.log("[DB] 학습 기록 조회:", sessions.length, "건");
      return sessions;
    })
    ["catch"](function (error) {
      console.error("[DB] 학습 기록 조회 오류:", error);
      return [];
    });
}

// =====================
// 5. 레벨별 통계 조회
// =====================
function getLevelStats() {
  if (!currentUser) return Promise.resolve({});
  return db.collection("sessions")
    .where("uid", "==", currentUser.uid)
    .get()
    .then(function (snapshot) {
      var stats = {};
      snapshot.forEach(function (doc) {
        var data = doc.data();
        var level = data.level || "기타";
        if (!stats[level]) { stats[level] = { sessions: 0, totalScore: 0, bestScore: 0 }; }
        stats[level].sessions++;
        stats[level].totalScore += data.bestScore || 0;
        if ((data.bestScore || 0) > stats[level].bestScore) stats[level].bestScore = data.bestScore;
      });
      var keys = Object.keys(stats);
      for (var k = 0; k < keys.length; k++) {
        stats[keys[k]].avgScore = Math.round((stats[keys[k]].totalScore / stats[keys[k]].sessions) * 10) / 10;
      }
      return stats;
    })
    ["catch"](function (error) { console.error("[DB] 레벨별 통계 오류:", error); return {}; });
}

// =====================
// 6. showReport 확장 - 자동 저장
// =====================
function initFirebaseReportSave() {
  if (typeof showReport !== "function") return;
  var originalShowReport = showReport;
  showReport = function () {
    originalShowReport();
    if (currentUser) {
      saveSession()
        .then(function () { showSaveNotification("학습 기록이 저장되었습니다!"); })
        ["catch"](function () { console.warn("[DB] 자동 저장 실패"); });
    }
  };
}

function showSaveNotification(message) {
  var n = document.getElementById("saveNotification");
  if (!n) {
    n = document.createElement("div");
    n.id = "saveNotification";
    n.style.cssText = "position:fixed;bottom:20px;right:20px;background:#10B981;color:#fff;padding:12px 20px;border-radius:8px;font-size:14px;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,0.15);transition:opacity 0.3s;";
    document.body.appendChild(n);
  }
  n.textContent = message;
  n.style.opacity = "1";
  n.style.display = "block";
  setTimeout(function () {
    n.style.opacity = "0";
    setTimeout(function () { n.style.display = "none"; }, 300);
  }, 2500);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", function () { setTimeout(initFirebaseReportSave, 100); });
} else {
  setTimeout(initFirebaseReportSave, 100);
}
