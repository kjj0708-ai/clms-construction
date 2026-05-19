/* CLMS 서비스 워커 — PWA 앱 셸 캐싱 + 오프라인 폴백
 * Phase 1: 정적 자산 프리캐시, 네트워크 우선(내비게이션) / 캐시 우선(자산)
 * Phase 4에서 FCM 백그라운드 메시지(firebase-messaging-sw.js)와 연동된다.
 */
'use strict';

const CACHE_VERSION = 'clms-v8';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

// 설치 시 미리 캐싱할 앱 셸
const APP_SHELL = [
  '/',
  '/index.html',
  '/signup-info.html',
  '/pending.html',
  '/dashboard.html',
  '/profile.html',
  '/projects.html',
  '/project-new.html',
  '/project-detail.html',
  '/notice.html',
  '/post.html',
  '/daily-log.html',
  '/inspection.html',
  '/corrective-action.html',
  '/notifications.html',
  '/settings/notifications.html',
  '/admin/approvals.html',
  '/admin/data-management.html',
  '/test-components.html',
  '/offline.html',
  '/manifest.json',
  '/css/styles.css',
  '/js/app.js',
  '/js/backend.js',
  '/js/auth.js',
  '/js/constants.js',
  '/js/stages.js',
  '/js/projects.js',
  '/js/notices.js',
  '/js/notifications.js',
  '/js/board.js',
  '/js/post-types.js',
  '/js/archive.js',
  '/js/inspections.js',
  '/js/reports.js',
  '/js/data-io.js',
  '/js/push.js',
  '/js/firebase-config.js',
  '/js/tailwind-config.js',
  '/js/components/exif-reader.js',
  '/js/components/image-compressor.js',
  '/js/components/image-viewer.js',
  '/js/components/link-renderer.js',
  '/js/components/comment-thread.js',
  '/js/components/post-actions.js',
  '/js/components/notice-composer.js',
  '/js/components/post-composer.js',
  '/js/components/archive-composers.js',
  '/js/components/signature-pad.js',
  '/js/components/inspection-composer.js',
  '/js/components/layout.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      // 일부 자산이 누락돼도 설치가 실패하지 않도록 개별 캐싱
      .then((cache) => Promise.allSettled(APP_SHELL.map((url) => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => !k.startsWith(CACHE_VERSION)).map((k) => caches.delete(k))
      ))
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

  // 동일 출처 정적 자산: 캐시 우선 + 백그라운드 갱신(stale-while-revalidate)
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

// 클라이언트가 즉시 갱신을 요청할 때
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
