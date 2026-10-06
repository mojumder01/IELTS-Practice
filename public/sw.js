// IELTS Practice service worker (SPEC section 10, Phase 10): the app works offline for a test
// already opened once. Firestore keeps its own offline copy of the test and attempts; this file
// keeps the app's files and the media.
//
// - Pages: network first, so a deploy shows at once; offline, the cached app.
// - /assets/* (content-hashed) and /media/*: cache first, then the network.
// - Audio arrives as byte ranges; the whole file is cached once and ranges are cut from it.
// Everything else, Firebase included, goes straight to the network.

const CACHE = 'ielts-app-v1';
const SHELL = '/index.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // The shell and the files it loads, so the first visit is enough to work offline.
      const response = await fetch(SHELL, { cache: 'no-cache' });
      if (!response.ok) return;
      const html = await response.clone().text();
      await cache.put(SHELL, response);
      const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
      await Promise.all(assets.map((url) => cache.add(url).catch(() => undefined)));
    })(),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(page(request));
  } else if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(request));
  } else if (url.pathname.startsWith('/media/')) {
    event.respondWith(request.headers.has('range') ? range(request) : cacheFirst(request));
  }
});

async function page(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) await cache.put(SHELL, response.clone());
    return response;
  } catch {
    return (await cache.match(SHELL)) ?? Response.error();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request, { ignoreSearch: true });
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok && response.status === 200) await cache.put(request, response.clone());
  return response;
}

/** A byte range of a media file, from the cached whole file (fetched whole the first time). */
async function range(request) {
  const cache = await caches.open(CACHE);
  const path = new URL(request.url).pathname;
  let whole = await cache.match(path);
  if (!whole) {
    try {
      const response = await fetch(path);
      if (!response.ok) return fetch(request);
      await cache.put(path, response.clone());
      whole = response;
    } catch {
      return Response.error();
    }
  }
  const bytes = await whole.arrayBuffer();
  const match = /bytes=(\d*)-(\d*)/.exec(request.headers.get('range') ?? '');
  const start = match && match[1] ? Number(match[1]) : 0;
  const end =
    match && match[2] ? Math.min(Number(match[2]), bytes.byteLength - 1) : bytes.byteLength - 1;
  return new Response(bytes.slice(start, end + 1), {
    status: 206,
    headers: {
      'Content-Type': whole.headers.get('Content-Type') ?? 'audio/mpeg',
      'Content-Range': `bytes ${start}-${end}/${bytes.byteLength}`,
      'Content-Length': String(end - start + 1),
      'Accept-Ranges': 'bytes',
    },
  });
}
