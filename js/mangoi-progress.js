/**
 * ═══════════════════════════════════════════════════════════════
 * mangoi-progress.js — 학습 기록 저장소 (v1, 2026-07-28)
 *
 * 왜 만들었나
 *   결과 보기가 전부 0으로 나오던 원인은 집계 코드가 아니라 저장 자체였다.
 *   기록을 Firebase(Firestore)에만 넣게 돼 있었는데 그 프로젝트의 보안 규칙이
 *   읽기·쓰기를 모두 막고 있어(permission-denied) 단 한 건도 저장된 적이 없었다.
 *   외부 콘솔 설정에 서비스가 볼모로 잡히지 않도록 저장처를 옮긴다.
 *
 * 어떻게 저장하나 (2중)
 *   1) 이 기기(localStorage) — 항상 성공. 로그인도 서버도 필요 없다.
 *      결과 보기는 이걸 읽으므로 누구에게나 즉시 동작한다.
 *   2) 망고아이 서버(/api/voice/coach) — 망고아이에서 들어와 신원이 확인된
 *      학생만. 학부모·강사 화면과 통계에 같이 잡히고 기기가 바뀌어도 남는다.
 *      실패해도 1)이 이미 끝나 있으므로 학생 화면은 영향받지 않는다.
 *
 * 신원(uid/토큰)은 URL 에 담지 않는다
 *   uid·이름은 기존 관리자 연동 규약대로 URL 파라미터로 받지만, 인증 토큰은
 *   주소창·기록에 남지 않도록 부모창과의 postMessage 로만 주고받는다.
 * ═══════════════════════════════════════════════════════════════
 */
(function (global) {
  "use strict";

  var REC_KEY = "mangoi_speech_records_v1";
  var ID_KEY = "mangoi_speech_identity_v1";
  var MAX_RECORDS = 800;   // 한 기기에 남기는 최대 기록 수 (오래된 것부터 버림)
  var API_BASE = "https://webrtc-unified-platform.navy111p.workers.dev";
  /* 망고아이 정식 출처만 신뢰 — 아무 페이지나 토큰을 건네받지 못하게 */
  var TRUSTED = /^https:\/\/([a-z0-9-]+\.)*(mango-i\.com|mangoi\.co\.kr|navy111p\.workers\.dev)$/i;

  /* ── 저장소 기본 ── */
  function readAll() {
    try {
      var raw = localStorage.getItem(REC_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Object.prototype.toString.call(arr) === "[object Array]" ? arr : [];
    } catch (e) { return []; }
  }
  function writeAll(arr) {
    try {
      if (arr.length > MAX_RECORDS) arr = arr.slice(arr.length - MAX_RECORDS);
      localStorage.setItem(REC_KEY, JSON.stringify(arr));
      return true;
    } catch (e) { return false; }   // 용량 초과 등 — 화면 흐름은 막지 않는다
  }

  /* ── 신원 ── */
  function readIdentity() {
    try {
      var o = JSON.parse(localStorage.getItem(ID_KEY) || "null");
      if (o && o.exp && o.exp < Date.now()) return null;
      return o;
    } catch (e) { return null; }
  }
  function saveIdentity(o) {
    try { localStorage.setItem(ID_KEY, JSON.stringify(o)); } catch (e) {}
  }

  function qs(name) {
    try {
      var m = new RegExp("[?&]" + name + "=([^&]*)").exec(location.search);
      return m ? decodeURIComponent(m[1].replace(/\+/g, " ")) : "";
    } catch (e) { return ""; }
  }

  /* URL 로 넘어온 uid/이름(관리자·학생홈 연동 규약) 흡수 — 토큰은 여기 없다 */
  (function absorbUrlIdentity() {
    var uid = qs("uid");
    if (!uid) return;
    var cur = readIdentity() || {};
    cur.uid = uid;
    cur.name = qs("name") || cur.name || "";
    cur.callbackOrigin = qs("callback_origin") || cur.callbackOrigin || "";
    cur.exp = Date.now() + 30 * 86400 * 1000;
    saveIdentity(cur);
  })();

  /* 부모창에 토큰을 요청한다(같은 창으로 열렸으면 opener 가 있다).
     부모는 신뢰 출처일 때만 응답하고, 우리도 신뢰 출처의 응답만 받는다. */
  function requestTokenFromOpener() {
    var opener = null;
    try { opener = global.opener; } catch (e) {}
    if (!opener) return;
    var target = "";
    try {
      var ref = document.referrer || "";
      if (ref) target = new URL(ref).origin;
    } catch (e) {}
    if (!target || !TRUSTED.test(target)) return;
    try { opener.postMessage({ type: "mangoi_speech_auth_request" }, target); } catch (e) {}
  }

  global.addEventListener("message", function (ev) {
    if (!ev || !ev.origin || !TRUSTED.test(ev.origin)) return;
    var d = ev.data;
    if (!d || typeof d !== "object" || d.type !== "mangoi_speech_auth") return;
    var cur = readIdentity() || {};
    if (d.uid) cur.uid = String(d.uid);
    if (d.name) cur.name = String(d.name);
    if (d.token) cur.token = String(d.token);
    cur.callbackOrigin = cur.callbackOrigin || ev.origin;
    cur.exp = Date.now() + 30 * 86400 * 1000;
    saveIdentity(cur);
    flushQueue();   // 토큰이 생겼으니 밀린 기록을 서버로
  });

  /* ── 서버 동기화 ── */
  function syncToServer(rec) {
    var id = readIdentity();
    if (!id || !id.uid || !id.token) return;   // 신원이 없으면 이 기기에만 남긴다
    var body = {
      target: rec.target, spoken: rec.spoken,
      student_uid: id.uid, student_name: id.name || "", token: id.token
    };
    if (!global.fetch) return;
    global.fetch(API_BASE + "/api/voice/coach", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (j && j.ok) { rec.synced = 1; writeAll(readAll().map(function (x) { return x.id === rec.id ? rec : x; })); }
    })["catch"](function () { /* 오프라인 — 다음 기회에 flushQueue 가 재시도 */ });
  }
  function flushQueue() {
    var id = readIdentity();
    if (!id || !id.token) return;
    var all = readAll(), pending = [];
    for (var i = 0; i < all.length; i++) if (!all[i].synced) pending.push(all[i]);
    pending = pending.slice(-20);   // 한 번에 몰아치지 않게
    for (var j = 0; j < pending.length; j++) syncToServer(pending[j]);
  }

  /* 관리자 화면(평가서 자동기록)이 기다리는 결과 통보 — 기존 규약 그대로 */
  function notifyOpener(rec) {
    var id = readIdentity();
    var origin = (id && id.callbackOrigin) || "";
    if (!origin || !TRUSTED.test(origin)) return;
    var opener = null;
    try { opener = global.opener; } catch (e) {}
    if (!opener) return;
    try {
      opener.postMessage({
        type: "pronunciation_result",
        score: Math.round(rec.avg),
        score_speaking: Math.round(rec.pron),
        level: rec.level || "",
        comment: "🎯 발음연습 자동 기록 — " + (rec.level ? rec.level + " · " : "") +
                 '"' + String(rec.target || "").slice(0, 40) + '" 정확도 ' + Math.round(rec.avg) + "점"
      }, origin);
    } catch (e) {}
  }

  /* ── 공개 API ── */
  var MangoiProgress = {
    /** 시도 1건 기록 — 저장 실패해도 절대 예외를 던지지 않는다(연습 흐름 보호) */
    record: function (r) {
      try {
        var rec = {
          id: String(Date.now()) + "-" + Math.round(Math.random() * 1e6),
          t: Date.now(),
          target: String(r.target || ""),
          spoken: String(r.spoken || ""),
          pron: Number(r.pronunciation) || 0,
          gram: Number(r.grammar) || 0,
          flu: Number(r.fluency) || 0,
          avg: Number(r.average) || 0,
          level: String(r.level || ""),
          synced: 0
        };
        var all = readAll();
        all.push(rec);
        writeAll(all);
        syncToServer(rec);
        notifyOpener(rec);
        return rec;
      } catch (e) { return null; }
    },

    /** 결과 화면이 그대로 쓸 수 있는 세션 목록(최신순).
        기존 렌더 코드가 Firestore 문서를 기대하므로 createdAt.toDate() 까지 흉내낸다. */
    sessions: function () {
      var all = readAll().slice().sort(function (a, b) { return b.t - a.t; });
      return all.map(function (r) {
        return {
          id: r.id,
          bestScore: r.avg,
          level: r.level,
          targetSentence: r.target,
          attempts: [{ spokenText: r.spoken, correctedText: r.target, errorCount: 0,
            scores: { pronunciation: r.pron, grammar: r.gram, fluency: r.flu, average: r.avg } }],
          createdAt: (function (ts) { return { toDate: function () { return new Date(ts); } }; })(r.t)
        };
      });
    },

    count: function () { return readAll().length; },
    identity: readIdentity,
    /** 진단용 — 콘솔에서 상태 확인 */
    debug: function () {
      var id = readIdentity(), all = readAll(), unsynced = 0;
      for (var i = 0; i < all.length; i++) if (!all[i].synced) unsynced++;
      return { records: all.length, unsynced: unsynced,
               uid: (id && id.uid) || null, hasToken: !!(id && id.token) };
    }
  };

  global.MangoiProgress = MangoiProgress;
  requestTokenFromOpener();
  flushQueue();

  /* main.js 의 showFeedback(시도 1건 채점 완료)에 물려 자동 기록.
     main.js 가 아직 안 실려 있을 수 있어 준비될 때까지 잠깐 기다린다. */
  (function hookFeedback() {
    var tries = 0;
    var timer = setInterval(function () {
      if (typeof global.showFeedback === "function") {
        clearInterval(timer);
        var orig = global.showFeedback;
        global.showFeedback = function (attemptResult) {
          try {
            var s = (attemptResult && attemptResult.scores) || {};
            var levelSel = document.getElementById("levelSelect");
            var level = "";
            try { level = levelSel && levelSel.options[levelSel.selectedIndex] ? levelSel.options[levelSel.selectedIndex].text : ""; } catch (e) {}
            MangoiProgress.record({
              target: attemptResult.correctedText || "",
              spoken: attemptResult.spokenText || "",
              pronunciation: s.pronunciation, grammar: s.grammar,
              fluency: s.fluency, average: s.average, level: level
            });
          } catch (e) { /* 기록 실패가 채점 화면을 막지 않게 */ }
          return orig.apply(this, arguments);
        };
      } else if (++tries > 60) { clearInterval(timer); }
    }, 100);
  })();
})(window);
