/**
 * ===========================
 * Firebase Configuration
 * mangoi_Speech - Firebase 초기화
 * ===========================
 * CDN 방식 (ES5 호환, 모듈 미사용)
 * index.html에서 Firebase SDK CDN 스크립트 로드 후 사용
 */

// Firebase 설정값
var firebaseConfig = {
  apiKey: "AIzaSyDiI4w386XVuhuGx7tmFTIArkOkglWMhAA",
  authDomain: "my-web-app-78bc6.firebaseapp.com",
  projectId: "my-web-app-78bc6",
  storageBucket: "my-web-app-78bc6.firebasestorage.app",
  messagingSenderId: "83466256528",
  appId: "1:83466256528:web:304771075b5e58a09f5815"
};

// Firebase 초기화
firebase.initializeApp(firebaseConfig);

// 전역 Firebase 서비스 참조
var auth = firebase.auth();
var db = firebase.firestore();

// Auth 언어 설정 (한국어)
auth.languageCode = "ko";

console.log("[Firebase] 초기화 완료 - Project:", firebaseConfig.projectId);
