(function bootstrapAssetServiceWorker() {
  "use strict";

  var ASSETS_CACHE = "z3cz-bootstrap-assets:v1";

  self.addEventListener("install", function () {
    self.skipWaiting();
  });

  self.addEventListener("activate", function (event) {
    event.waitUntil(self.clients.claim());
  });

  self.addEventListener("fetch", function (event) {
    var request = event.request;
    if (request.method !== "GET") {
      return;
    }

    var url = new URL(request.url);
    // R2 public URLs can share the /landing/ path; only cache same-origin page requests.
    if (url.origin !== self.location.origin) {
      return;
    }

    var pathname = url.pathname;
    if (
      pathname.indexOf("/assets/") !== 0 &&
      pathname.indexOf("/landing/") !== 0
    ) {
      return;
    }

    event.respondWith(
      caches.open(ASSETS_CACHE).then(function (cache) {
        return cache.match(request.url).then(function (cached) {
          if (cached) {
            return cached;
          }
          return fetch(request);
        });
      })
    );
  });
})();
