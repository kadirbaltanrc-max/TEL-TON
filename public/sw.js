const CACHE_NAME = "tel-ton-pwa-v1";

const BASE_URL = new URL(
  "./",
  self.location.href,
).pathname;

const coreFiles = [
  BASE_URL,
  `${BASE_URL}manifest.webmanifest`,
  `${BASE_URL}icons/icon-192.png`,
  `${BASE_URL}icons/icon-512.png`,
  `${BASE_URL}icons/icon-maskable-512.png`,
  `${BASE_URL}icons/apple-touch-icon.png`,
  `${BASE_URL}instruments/classical-guitar.png`,
  `${BASE_URL}instruments/baglama.png`,
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      const pageResponse = await fetch(BASE_URL, {
        cache: "reload",
      });

      await cache.put(
        BASE_URL,
        pageResponse.clone(),
      );

      const html = await pageResponse.text();

      const discovered = Array.from(
        html.matchAll(/(?:src|href)="([^"]+)"/g),
      )
        .map(
          (match) =>
            new URL(
              match[1],
              self.location.origin + BASE_URL,
            ),
        )
        .filter(
          (url) =>
            url.origin === self.location.origin,
        )
        .map((url) => url.pathname);

      await cache.addAll(
        Array.from(
          new Set([
            ...coreFiles.slice(1),
            ...discovered,
          ]),
        ),
      );

      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();

      await Promise.all(
        names
          .filter(
            (name) =>
              name.startsWith("tel-ton-pwa-") &&
              name !== CACHE_NAME,
          )
          .map((name) => caches.delete(name)),
      );

      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  if (
    url.origin !== self.location.origin ||
    !url.pathname.startsWith(BASE_URL)
  ) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          const cache = await caches.open(CACHE_NAME);

          await cache.put(
            BASE_URL,
            response.clone(),
          );

          return response;
        } catch {
          return (
            (await caches.match(BASE_URL)) ||
            Response.error()
          );
        }
      })(),
    );

    return;
  }

  event.respondWith(
    (async () => {
      const cached = await caches.match(request);

      const network = fetch(request)
        .then(async (response) => {
          if (response.ok) {
            const cache =
              await caches.open(CACHE_NAME);

            await cache.put(
              request,
              response.clone(),
            );
          }

          return response;
        })
        .catch(() => cached || Response.error());

      return cached || network;
    })(),
  );
});