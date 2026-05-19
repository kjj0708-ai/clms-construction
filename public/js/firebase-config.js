/**
 * Firebase 설정
 * ============================================================
 * ★★★ Firebase 키 입력 위치 — 이 파일 단 한 곳입니다 ★★★
 *
 * 아래 값이 "YOUR_..." placeholder 상태인 동안에는
 * 시스템이 자동으로 [목업 모드](localStorage 백엔드)로 동작합니다.
 *
 * Firebase 연동 방법:
 *  1. https://console.firebase.google.com 에서 프로젝트 생성
 *  2. 프로젝트 설정 → 내 앱 → 웹 앱 등록
 *  3. 표시되는 firebaseConfig 값을 아래에 그대로 붙여넣기
 *  4. apiKey 가 실제 값이 되는 순간 자동으로 Firebase 모드로 전환됩니다.
 * ============================================================
 */

export const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT.firebaseapp.com',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_PROJECT.appspot.com',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId: 'YOUR_APP_ID',
};

/**
 * FCM 웹 푸시 인증서(VAPID 키) — Phase 4(푸시 알림)에서 사용.
 * Firebase Console → 프로젝트 설정 → Cloud Messaging → 웹 푸시 인증서
 */
export const VAPID_KEY = 'YOUR_VAPID_KEY';

/** 설정값이 실제 키로 채워졌는지 검사한다. */
export function isFirebaseConfigured(cfg = firebaseConfig) {
  return Boolean(cfg && cfg.apiKey) && !String(cfg.apiKey).startsWith('YOUR_');
}
