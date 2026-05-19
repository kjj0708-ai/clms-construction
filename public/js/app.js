/**
 * 공통 부트스트랩
 * 모든 페이지가 이 모듈을 import 하여 PWA 서비스 워커를 등록한다.
 */

import { BACKEND_MODE } from './backend.js';
import { APP_NAME } from './constants.js';

/** PWA 서비스 워커 등록 */
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js')
      .then((reg) => {
        // 새 버전 감지 시 자동 활성화 유도
        reg.addEventListener('updatefound', () => {
          const sw = reg.installing;
          if (!sw) return;
          sw.addEventListener('statechange', () => {
            if (sw.state === 'installed' && navigator.serviceWorker.controller) {
              sw.postMessage('SKIP_WAITING');
            }
          });
        });
      })
      .catch((err) => console.warn('[CLMS] 서비스 워커 등록 실패:', err));
  });
}

/** 현재 백엔드 모드를 콘솔에 표시 */
function logBootBanner() {
  const modeLabel = BACKEND_MODE === 'firebase' ? 'Firebase 연동' : '목업(localStorage)';
  console.info(
    `%c ${APP_NAME} %c ${modeLabel} 모드 `,
    'background:#1a3a5c;color:#fff;padding:2px 6px;border-radius:3px 0 0 3px;',
    'background:#c9a961;color:#12283f;padding:2px 6px;border-radius:0 3px 3px 0;font-weight:700;'
  );
}

/* ---- PWA 설치 프롬프트 ---- */
let deferredInstallPrompt = null;
const installListeners = new Set();

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  installListeners.forEach((cb) => cb(true));
});
window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  installListeners.forEach((cb) => cb(false));
});

/** 설치 가능 여부가 바뀔 때 호출될 콜백을 등록한다. */
export function onInstallAvailabilityChange(cb) {
  installListeners.add(cb);
  cb(!!deferredInstallPrompt);
  return () => installListeners.delete(cb);
}

/** PWA 설치 프롬프트를 띄운다. @returns {Promise<boolean>} 설치 수락 여부 */
export async function promptInstall() {
  if (!deferredInstallPrompt) return false;
  deferredInstallPrompt.prompt();
  const { outcome } = await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  installListeners.forEach((cb) => cb(false));
  return outcome === 'accepted';
}

registerServiceWorker();
logBootBanner();

export { BACKEND_MODE };
