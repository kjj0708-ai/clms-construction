/* 실제 Firebase 설정 백업 (gitignored). 컷오버 시 firebase-config.js 로 복사한다. */
export const firebaseConfig = {
  apiKey: 'AIzaSyAkWhlmYJxz5jFQH22-O03xniA-dhSYTrY',
  authDomain: 'clms-construction.firebaseapp.com',
  projectId: 'clms-construction',
  storageBucket: 'clms-construction.firebasestorage.app',
  messagingSenderId: '112915200946',
  appId: '1:112915200946:web:c0f6f1b6d0eac162d9c2ab',
};
export const VAPID_KEY = 'YOUR_VAPID_KEY';
export function isFirebaseConfigured(cfg = firebaseConfig) {
  return Boolean(cfg && cfg.apiKey) && !String(cfg.apiKey).startsWith('YOUR_');
}
