/**
 * Minimal offline shell for Dompet.
 *
 * All user data lives in localStorage, so the service worker only needs to keep
 * the app *reachable* offline — it never caches or syncs financial records.
 *
 * Bump CACHE when you ship a release so old assets get cleaned up.
 */
const CACHE = "dompet-v2";
const OFFLINE_URL = "/";
const PRECACHE = [
  "/",
  "/anggaran",
  "/tabungan",
  "/riwayat",
  // Pengaturan memuat Backup & Pulihkan — justru yang paling dibutuhkan
  // saat sedang offline atau saat pengguna panik kehilangan data.
  "/pengaturan",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // A single failed URL shouldn't abort the whole install.
      .then((cache) => Promise.allSettled(PRECACHE.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      /*
       * Berkas JS dan CSS Next.js bernama berdasarkan isinya, jadi setiap rilis
       * menghasilkan nama baru dan yang lama tidak akan pernah diminta lagi.
       * Tanpa pembersihan ini cache terus menumpuk sisa rilis lama sampai
       * browser membuangnya paksa — dan yang ikut terbuang bisa jadi data
       * pengguna. Aset yang masih dipakai akan ter-cache lagi sendiri saat
       * pertama diminta.
       */
      .then(() => caches.open(CACHE))
      .then((cache) =>
        cache.keys().then((reqs) =>
          Promise.all(
            reqs
              .filter((req) => !PRECACHE.some((url) => new URL(req.url).pathname === url))
              .map((req) => cache.delete(req)),
          ),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigations: network first, fall back to the cached shell when offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((hit) => hit ?? caches.match(OFFLINE_URL))),
    );
    return;
  }

  // Static assets: cache first, refresh in the background.
  event.respondWith(
    caches.match(request).then((hit) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => hit);
      return hit ?? network;
    }),
  );
});
