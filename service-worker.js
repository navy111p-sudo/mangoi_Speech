var CACHE_NAME = "mangoi-speech-v3";
var STATIC_ASSETS = [
  "/", "/index.html", "/css/style.css", "/js/sentences.js", "/js/main.js",
  "/js/firebase-config.js", "/js/firebase-auth.js", "/js/firebase-db.js", "/manifest.json"
];

self.addEventListener("install", function (event) {
  console.log("[SW] Install - 캐시 생성:", CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(STATIC_ASSETS).catch(function (error) {
        console.warn("[SW] 일부 자산 캐시 실패:", error);
        return Promise.all(
          STATIC_ASSETS.map(function (url) {
            return cache.add(url).catch(function () { console.warn("[SW] 캐시 실패:", url); });
          })
        );
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  console.log("[SW] Activate - 이전 캐시 정리");
  event.waitUntil(
    caches.keys().then(function (cacheNames) {
      return Promise.all(
        cacheNames.filter(function (name) { return name !== CACHE_NAME; })
          .map(function (name) { console.log("[SW] 삭제할 캐시:", name); return caches.delete(name); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", function (event) {
  var request = event.request;
  if (request.url.indexOf("firebaseapp.com") !== -1 ||
      request.url.indexOf("googleapis.com") !== -1 ||
      request.url.indexOf("languagetool.org") !== -1 ||
      request.method !== "GET") { return; }
  event.respondWith(
    fetch(request).then(function (response) {
      if (response && response.status === 200) {
        var responseClone = response.clone();
        caches.open(CACHE_NAME).then(function (cache) { cache.put(request, responseClone); });
      }
      return response;
    }).catch(function () {
      return caches.match(request).then(function (cached) {
        if (cached) return cached;
        if (request.headers.get("accept").indexOf("text/html") !== -1) {
          return caches.match("/index.html");
        }
      });
    })
  );
});
