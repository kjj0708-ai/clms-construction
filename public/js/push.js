/**
 * push.js — 모바일 푸시 알림 (FCM) 클라이언트
 *
 * - 브라우저 알림 권한 요청 (mock/firebase 공통)
 * - Firebase 모드: FCM 토큰 발급 후 사용자 문서에 저장
 *
 * 실제 푸시 발송은 서버(Cloud Functions)에서 FCM 토큰으로 전송한다.
 * 목업 모드에서는 인앱 알림(notifications.js)만 동작한다.
 */

import { Db, isMock } from './backend.js';
import { getCurrentUser } from './auth.js';
import { firebaseConfig, VAPID_KEY } from './firebase-config.js';

const FB_SDK = 'https://www.gstatic.com/firebasejs/10.12.2';

/** 이 브라우저가 푸시 알림을 지원하는지 */
export function isPushSupported() {
  return 'Notification' in window && 'serviceWorker' in navigator;
}

/** 현재 알림 권한 상태 — 'granted' | 'denied' | 'default' | 'unsupported' */
export function getPermissionStatus() {
  return isPushSupported() ? Notification.permission : 'unsupported';
}

/**
 * 알림 권한을 요청한다. 허용 시 Firebase 모드에서는 FCM 토큰을 등록한다.
 * @returns {Promise<string>} 권한 결과
 */
export async function requestPermission() {
  if (!isPushSupported()) return 'unsupported';
  const result = await Notification.requestPermission();
  if (result === 'granted' && !isMock) {
    try {
      await registerFcmToken();
    } catch (err) {
      console.warn('[CLMS] FCM 토큰 등록 실패:', err);
    }
  }
  return result;
}

/** Firebase 모드: FCM 토큰을 발급받아 사용자 문서에 저장 */
async function registerFcmToken() {
  const [appMod, msgMod] = await Promise.all([
    import(`${FB_SDK}/firebase-app.js`),
    import(`${FB_SDK}/firebase-messaging.js`),
  ]);
  const app = appMod.getApps().length ? appMod.getApp() : appMod.initializeApp(firebaseConfig);
  const messaging = msgMod.getMessaging(app);

  const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
  const token = await msgMod.getToken(messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: swReg,
  });

  const user = await getCurrentUser();
  if (user && token) {
    await Db.updateUser(user.uid, { fcmToken: token, fcmUpdatedAt: new Date().toISOString() });
  }

  // 앱이 열려 있을 때(포그라운드) 도착하는 메시지 처리
  msgMod.onMessage(messaging, (payload) => {
    const n = (payload && payload.notification) || {};
    if (Notification.permission === 'granted' && n.title) {
      new Notification(n.title, { body: n.body || '', icon: '/icons/icon-192.png' });
    }
  });

  return token;
}
