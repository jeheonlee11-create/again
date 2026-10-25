/* again — offline support.

   The app shell below is precached as one versioned set and served cache-first. Files are
   never updated one at a time at runtime: app.js and core.js are ES modules that must match,
   and a half-updated cache (new app.js, old core.js) would leave a blank page. Shipping a
   change means bumping VERSION; the browser sees sw.js changed, installs the new set in the
   background, and the next launch uses it.

   Navigations to the app (with or without ?join=...) get the cached index.html, so invite
   links open offline too. Anything else same-origin (e.g. docs/) goes to the network. */
var VERSION = "again-v8";
/* The page is cached under "./" only: some hosts serve it at / and 404 on /index.html,
   and one missing file would make addAll fail and leave the app without offline support. */
var SHELL = ["./", "app.js", "core.js", "manifest.webmanifest", "icon.svg", "icon-180.png", "icon-512.png"];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(VERSION).then(function (c) {
      /* cache: "reload" skips the HTTP cache so the new set really is new; addAll is
         all-or-nothing, so a failed download keeps the previous version in charge */
      return c.addAll(SHELL.map(function (u) { return new Request(u, { cache: "reload" }); }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k.indexOf("again-") === 0 && k !== VERSION; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

function isAppNavigation(req, url) {
  if (req.mode !== "navigate") return false;
  var scope = new URL(self.registration.scope);
  var p = url.pathname;
  return p === scope.pathname || p === scope.pathname + "index.html";
}

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (isAppNavigation(req, url)) {
    e.respondWith(caches.open(VERSION).then(function (c) {
      return c.match("./").then(function (hit) { return hit || fetch(req); });
    }));
    return;
  }

  e.respondWith(caches.open(VERSION).then(function (c) {
    return c.match(req, { ignoreSearch: true }).then(function (hit) { return hit || fetch(req); });
  }));
});
