/* CLMS FCM 백그라운드 메시지 서비스 워커
 * ============================================================
 * 앱이 닫혀 있을 때 도착하는 푸시 알림을 표시한다.
 * Firebase 모드에서만 사용된다. (목업 모드는 인앱 알림 사용)
 *
 * ★ 사용 전 아래 firebaseConfig 를 public/js/firebase-config.js 와
 *   동일한 값으로 교체하세요. (서비스 워커는 ES 모듈을 import 할 수 없어
 *   설정값을 여기에 별도로 둡니다.)
 * ============================================================ */

importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT.firebaseapp.com',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_PROJECT.appspot.com',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId: 'YOUR_APP_ID',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const notification = payload.notification || {};
  const data = payload.data || {};
  self.registration.showNotification(notification.title || 'CLMS 알림', {
    body: notification.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    data: { link: data.link || '/notifications.html' },
  });
});

// 알림 클릭 → 해당 화면으로 이동
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || '/notifications.html';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const win of wins) {
        if ('focus' in win) { win.navigate(link); return win.focus(); }
      }
      return clients.openWindow(link);
    })
  );
});
