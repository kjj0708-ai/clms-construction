/* CLMS 서비스 워커 — PWA 앱 셸 캐싱 + 오프라인 폴백 (심플 버전) */
'use strict';

const CACHE_VERSION = 'clms-v9';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

const APP_SHELL = [
  '/',
  '/index.html',
  '/signup-info.html',
  '/pending.html',
  '/dashboard.html',
  '/profile.html',
  '/project-new.html',
  '/project.html',
  '/admin/approvals.html',
  '/offline.html',
  '/manifest.json',
  '/css/styles.css',
  '/js/app.js',
  '/js/auth.js',
  '/js/backend.js',
  '/js/constants.js',
  '/js/projects.js',
  '/js/communication.js',
  '/js/firebase-config.js',
  '/js/tailwind-config.js',
  '/js/components/layout.js',
  '/js/components/link-renderer.js',
  '/js/components/comment-thread.js',
  '/js/components/image-viewer.js',
  '/js/components/post-actions.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => Promise.allSettled(APP_SHELL.map((url) => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(CACHE_VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // 페이지 내비게이션: 네트워크 우선 → 캐시 → 오프라인 폴백
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(RUNTIME_CACHE).then((c) => c.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/offline.html')))
    );
    return;
  }

  // 동일 출처 정적 자산: 캐시 우선 + 백그라운드 갱신
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((response) => {
            if (response && response.status === 200) {
              const copy = response.clone();
              caches.open(RUNTIME_CACHE).then((c) => c.put(request, copy));
            }
            return response;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
    return;
  }

  // 외부(CDN) 자산: 네트워크 우선 → 실패 시 캐시
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200) {
          const copy = response.clone();
          caches.open(RUNTIME_CACHE).then((c) => c.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
