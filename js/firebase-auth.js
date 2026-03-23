/**
 * ===========================
 * Firebase Authentication
 * mangoi_Speech - 인증 관리
 * ===========================
 * 이메일/비밀번호 + Google 로그인
 * ES5 호환 코드
 */

// =====================
// 1. 인증 상태 관리
// =====================
var currentUser = null;

auth.onAuthStateChanged(function (user) {
  currentUser = user;
  if (user) {
    console.log("[Auth] 로그인됨:", user.email);
    updateAuthUI(true, user);
    loadUserData(user.uid);
  } else {
    console.log("[Auth] 로그아웃 상태");
    updateAuthUI(false, null);
  }
});

// =====================
// 2. 이메일/비밀번호 회원가입
// =====================
function signUpWithEmail(email, password, displayName) {
  return auth
    .createUserWithEmailAndPassword(email, password)
    .then(function (result) {
      return result.user
        .updateProfile({ displayName: displayName || "" })
        .then(function () {
          return db.collection("users").doc(result.user.uid).set({
            email: email,
            displayName: displayName || "",
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            totalSessions: 0,
            bestScore: 0,
            currentLevel: "BTS 1"
          });
        })
        .then(function () {
          console.log("[Auth] 회원가입 완료:", email);
          return result.user;
        });
    })
    ["catch"](function (error) {
      console.error("[Auth] 회원가입 오류:", error.code, error.message);
      throw error;
    });
}

// =====================
// 3. 이메일/비밀번호 로그인
// =====================
function signInWithEmail(email, password) {
  return auth
    .signInWithEmailAndPassword(email, password)
    .then(function (result) {
      console.log("[Auth] 이메일 로그인 성공:", result.user.email);
      return result.user;
    })
    ["catch"](function (error) {
      console.error("[Auth] 로그인 오류:", error.code, error.message);
      throw error;
    });
}

// =====================
// 4. Google 로그인
// =====================
function signInWithGoogle() {
  var provider = new firebase.auth.GoogleAuthProvider();
  provider.addScope("email");
  provider.addScope("profile");

  return auth
    .signInWithPopup(provider)
    .then(function (result) {
      var user = result.user;
      var isNewUser = result.additionalUserInfo && result.additionalUserInfo.isNewUser;

      if (isNewUser) {
        return db
          .collection("users")
          .doc(user.uid)
          .set({
            email: user.email,
            displayName: user.displayName || "",
            photoURL: user.photoURL || "",
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            totalSessions: 0,
            bestScore: 0,
            currentLevel: "BTS 1"
          })
          .then(function () {
            console.log("[Auth] Google 신규 가입 완료:", user.email);
            return user;
          });
      }

      console.log("[Auth] Google 로그인 성공:", user.email);
      return user;
    })
    ["catch"](function (error) {
      if (error.code === "auth/popup-blocked") {
        console.warn("[Auth] 팝업 차단됨, 리다이렉트 방식으로 전환");
        return auth.signInWithRedirect(provider);
      }
      console.error("[Auth] Google 로그인 오류:", error.code, error.message);
      throw error;
    });
}

// =====================
// 5. 로그아웃
// =====================
function signOut() {
  return auth
    .signOut()
    .then(function () {
      console.log("[Auth] 로그아웃 완료");
      currentUser = null;
    })
    ["catch"](function (error) {
      console.error("[Auth] 로그아웃 오류:", error);
      throw error;
    });
}

// =====================
// 6. 비밀번호 재설정
// =====================
function resetPassword(email) {
  return auth
    .sendPasswordResetEmail(email)
    .then(function () {
      console.log("[Auth] 비밀번호 재설정 메일 전송:", email);
    })
    ["catch"](function (error) {
      console.error("[Auth] 비밀번호 재설정 오류:", error.code, error.message);
      throw error;
    });
}

// =====================
// 7. UI 업데이트
// =====================
function updateAuthUI(isLoggedIn, user) {
  var authSection = document.getElementById("authSection");
  var userInfo = document.getElementById("userInfo");
  var userName = document.getElementById("userName");
  var userAvatar = document.getElementById("userAvatar");

  if (isLoggedIn && user) {
    if (authSection) authSection.style.display = "none";
    if (userInfo) userInfo.style.display = "flex";
    if (userName) {
      userName.textContent = user.displayName || user.email || "사용자";
    }
    if (userAvatar && user.photoURL) {
      userAvatar.src = user.photoURL;
      userAvatar.style.display = "block";
    }
  } else {
    if (authSection) authSection.style.display = "block";
    if (userInfo) userInfo.style.display = "none";
  }
}

// =====================
// 8. Firebase 오류 메시지 한국어 변환
// =====================
function getAuthErrorMessage(errorCode) {
  var messages = {
    "auth/email-already-in-use": "이미 사용 중인 이메일입니다.",
    "auth/invalid-email": "올바른 이메일 형식이 아닙니다.",
    "auth/weak-password": "비밀번호가 너무 약합니다. 6자 이상 입력해주세요.",
    "auth/user-not-found": "등록되지 않은 이메일입니다.",
    "auth/wrong-password": "비밀번호가 올바르지 않습니다.",
    "auth/too-many-requests": "너무 많은 시도입니다. 잠시 후 다시 시도해주세요.",
    "auth/popup-closed-by-user": "로그인 팝업이 닫혔습니다.",
    "auth/network-request-failed": "네트워크 연결을 확인해주세요.",
    "auth/user-disabled": "비활성화된 계정입니다."
  };
  return messages[errorCode] || "오류가 발생했습니다. 다시 시도해주세요.";
}

// =====================
// 9. 로그인/회원가입 폼 이벤트 핸들러
// =====================
function handleLoginFormSubmit(e) {
  if (e && e.preventDefault) e.preventDefault();
  var email = document.getElementById("loginEmail").value.trim();
  var password = document.getElementById("loginPassword").value;
  var errorEl = document.getElementById("loginError");
  if (!email || !password) {
    if (errorEl) errorEl.textContent = "이메일과 비밀번호를 입력해주세요.";
    return;
  }
  if (errorEl) errorEl.textContent = "";
  signInWithEmail(email, password)["catch"](function (error) {
    if (errorEl) errorEl.textContent = getAuthErrorMessage(error.code);
  });
}

function handleSignupFormSubmit(e) {
  if (e && e.preventDefault) e.preventDefault();
  var name = document.getElementById("signupName").value.trim();
  var email = document.getElementById("signupEmail").value.trim();
  var password = document.getElementById("signupPassword").value;
  var confirmPassword = document.getElementById("signupConfirmPassword").value;
  var errorEl = document.getElementById("signupError");
  if (!email || !password) {
    if (errorEl) errorEl.textContent = "모든 필드를 입력해주세요.";
    return;
  }
  if (password !== confirmPassword) {
    if (errorEl) errorEl.textContent = "비밀번호가 일치하지 않습니다.";
    return;
  }
  if (password.length < 6) {
    if (errorEl) errorEl.textContent = "비밀번호는 6자 이상이어야 합니다.";
    return;
  }
  if (errorEl) errorEl.textContent = "";
  signUpWithEmail(email, password, name)["catch"](function (error) {
    if (errorEl) errorEl.textContent = getAuthErrorMessage(error.code);
  });
}

function handleResetPassword() {
  var email = document.getElementById("loginEmail").value.trim();
  var errorEl = document.getElementById("loginError");
  if (!email) {
    if (errorEl) errorEl.textContent = "비밀번호 재설정을 위해 이메일을 먼저 입력해주세요.";
    return;
  }
  resetPassword(email)
    .then(function () {
      if (errorEl) {
        errorEl.style.color = "#10B981";
        errorEl.textContent = "비밀번호 재설정 링크가 이메일로 전송되었습니다.";
        setTimeout(function () { errorEl.style.color = ""; }, 3000);
      }
    })
    ["catch"](function (error) {
      if (errorEl) errorEl.textContent = getAuthErrorMessage(error.code);
    });
}

function showLoginTab() {
  var loginForm = document.getElementById("loginForm");
  var signupForm = document.getElementById("signupForm");
  var loginTab = document.getElementById("loginTab");
  var signupTab = document.getElementById("signupTab");
  if (loginForm) loginForm.style.display = "block";
  if (signupForm) signupForm.style.display = "none";
  if (loginTab) loginTab.classList.add("is-active");
  if (signupTab) signupTab.classList.remove("is-active");
}

function showSignupTab() {
  var loginForm = document.getElementById("loginForm");
  var signupForm = document.getElementById("signupForm");
  var loginTab = document.getElementById("loginTab");
  var signupTab = document.getElementById("signupTab");
  if (loginForm) loginForm.style.display = "none";
  if (signupForm) signupForm.style.display = "block";
  if (loginTab) loginTab.classList.remove("is-active");
  if (signupTab) signupTab.classList.add("is-active");
}
