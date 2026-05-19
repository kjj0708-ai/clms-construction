/**
 * image-viewer.js — 풀스크린 이미지 뷰어 모달
 *
 * - 검정 배경 오버레이 (z-index 9999)
 * - 마우스 휠 / 핀치로 줌 인·아웃, 드래그로 이동
 * - 이미지(또는 배경)를 한 번 더 누르면 닫힘
 * - ESC 키로도 닫힘
 * - 다중 이미지: 좌우 화살표 / 키보드로 이동
 * - 페이드 인·아웃 애니메이션
 */

const MIN_SCALE = 1;
const MAX_SCALE = 6;
const TAP_MOVE_THRESHOLD = 10; // px — 이보다 작게 움직이면 '탭'으로 간주
const TAP_TIME_THRESHOLD = 500; // ms

let styleInjected = false;

function injectStyle() {
  if (styleInjected) return;
  styleInjected = true;
  const style = document.createElement('style');
  style.id = 'clms-image-viewer-style';
  style.textContent = `
    .clms-viewer { position: fixed; inset: 0; z-index: 9999;
      background: rgba(0,0,0,.92); display: flex; align-items: center; justify-content: center;
      opacity: 0; transition: opacity .22s ease; touch-action: none; overflow: hidden; }
    .clms-viewer.is-open { opacity: 1; }
    .clms-viewer img { max-width: 100%; max-height: 100%; object-fit: contain;
      user-select: none; -webkit-user-drag: none; will-change: transform; }
    .clms-viewer__btn { position: absolute; border: 0; cursor: pointer; color: #fff;
      background: rgba(255,255,255,.14); backdrop-filter: blur(4px);
      display: flex; align-items: center; justify-content: center; }
    .clms-viewer__btn:hover { background: rgba(255,255,255,.26); }
    .clms-viewer__close { top: 14px; right: 14px; width: 44px; height: 44px;
      border-radius: 50%; font-size: 20px; }
    .clms-viewer__nav { top: 50%; transform: translateY(-50%); width: 46px; height: 46px;
      border-radius: 50%; font-size: 26px; line-height: 1; }
    .clms-viewer__prev { left: 12px; }
    .clms-viewer__next { right: 12px; }
    .clms-viewer__count { position: absolute; top: 20px; left: 50%; transform: translateX(-50%);
      color: rgba(255,255,255,.85); font-size: 13px; font-weight: 600; }
    .clms-viewer__hint { position: absolute; left: 0; right: 0;
      bottom: calc(18px + env(safe-area-inset-bottom, 0px)); text-align: center;
      color: rgba(255,255,255,.62); font-size: 12px; pointer-events: none; padding: 0 16px; }
  `;
  document.head.appendChild(style);
}

/** 입력값을 URL 문자열 배열로 정규화 */
function normalize(images) {
  const arr = Array.isArray(images) ? images : [images];
  return arr
    .map((item) => {
      if (!item) return null;
      if (typeof item === 'string') return item;
      return item.url || item.storageUrl || item.src || item.thumbnailUrl || null;
    })
    .filter(Boolean);
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * 이미지 뷰어를 연다.
 * @param {string|string[]|object[]} images  URL 문자열, 배열, 또는 {url} 객체 배열
 * @param {{ index?: number, alt?: string }} [options]
 */
export function openImageViewer(images, options = {}) {
  injectStyle();
  const list = normalize(images);
  if (list.length === 0) return null;

  let index = clamp(options.index || 0, 0, list.length - 1);
  const multi = list.length > 1;

  const overlay = document.createElement('div');
  overlay.className = 'clms-viewer';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.innerHTML = `
    ${multi ? '<div class="clms-viewer__count"></div>' : ''}
    <button class="clms-viewer__btn clms-viewer__close" aria-label="닫기">✕</button>
    ${multi ? '<button class="clms-viewer__btn clms-viewer__nav clms-viewer__prev" aria-label="이전 이미지">‹</button>' : ''}
    ${multi ? '<button class="clms-viewer__btn clms-viewer__nav clms-viewer__next" aria-label="다음 이미지">›</button>' : ''}
    <img alt="${(options.alt || '이미지').replace(/"/g, '')}" draggable="false" />
    <div class="clms-viewer__hint">이미지를 누르면 닫힙니다 · 휠/핀치로 확대, 드래그로 이동</div>
  `;

  const img = overlay.querySelector('img');
  const countEl = overlay.querySelector('.clms-viewer__count');

  let scale = MIN_SCALE;
  let tx = 0;
  let ty = 0;

  function applyTransform() {
    img.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
    img.style.cursor = scale > MIN_SCALE ? 'grab' : 'zoom-out';
  }

  function resetTransform() {
    scale = MIN_SCALE;
    tx = 0;
    ty = 0;
    applyTransform();
  }

  function showImage(nextIndex) {
    index = (nextIndex + list.length) % list.length;
    img.src = list[index];
    if (countEl) countEl.textContent = `${index + 1} / ${list.length}`;
    resetTransform();
  }

  function close() {
    overlay.classList.remove('is-open');
    document.removeEventListener('keydown', onKeydown);
    document.body.style.overflow = bodyOverflow;
    setTimeout(() => overlay.remove(), 220);
  }

  function onKeydown(e) {
    if (e.key === 'Escape') close();
    else if (multi && e.key === 'ArrowLeft') showImage(index - 1);
    else if (multi && e.key === 'ArrowRight') showImage(index + 1);
  }

  // ---- 줌 (마우스 휠) ----
  overlay.addEventListener('wheel', (e) => {
    e.preventDefault();
    const previous = scale;
    const factor = e.deltaY < 0 ? 1.2 : 1 / 1.2;
    scale = clamp(scale * factor, MIN_SCALE, MAX_SCALE);

    // 커서 지점을 기준으로 줌
    const rect = img.getBoundingClientRect();
    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 2);
    tx -= (dx / previous) * (scale - previous);
    ty -= (dy / previous) * (scale - previous);

    if (scale <= MIN_SCALE) { tx = 0; ty = 0; }
    applyTransform();
  }, { passive: false });

  // ---- 포인터 (드래그 이동 / 핀치 줌 / 탭으로 닫기) ----
  const pointers = new Map();
  let tap = null;
  let panStart = null;
  let pinchStartDist = 0;
  let pinchStartScale = 1;

  overlay.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return; // 컨트롤 버튼은 자체 처리
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.size === 1) {
      tap = { x: e.clientX, y: e.clientY, time: Date.now(), moved: false };
      panStart = { x: e.clientX, y: e.clientY, tx, ty };
    } else if (pointers.size === 2) {
      const pts = [...pointers.values()];
      pinchStartDist = distance(pts[0], pts[1]);
      pinchStartScale = scale;
      tap = null;
    }
  });

  overlay.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.values()];

    if (pts.length >= 2 && pinchStartDist > 0) {
      scale = clamp(pinchStartScale * (distance(pts[0], pts[1]) / pinchStartDist), MIN_SCALE, MAX_SCALE);
      if (scale <= MIN_SCALE) { tx = 0; ty = 0; }
      applyTransform();
    } else if (pts.length === 1 && panStart) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      if (tap && Math.hypot(dx, dy) > TAP_MOVE_THRESHOLD) tap.moved = true;
      if (scale > MIN_SCALE) {
        tx = panStart.tx + dx;
        ty = panStart.ty + dy;
        applyTransform();
      }
    }
  });

  function endPointer(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);

    if (pointers.size === 0) {
      // 탭(거의 움직이지 않은 짧은 누름) → 닫기
      if (tap && !tap.moved && Date.now() - tap.time < TAP_TIME_THRESHOLD) {
        close();
      }
      tap = null;
      panStart = null;
    } else if (pointers.size === 1) {
      // 핀치 → 드래그로 전환
      const remaining = [...pointers.values()][0];
      panStart = { x: remaining.x, y: remaining.y, tx, ty };
      tap = null;
    }
  }
  overlay.addEventListener('pointerup', endPointer);
  overlay.addEventListener('pointercancel', endPointer);

  // ---- 컨트롤 버튼 ----
  overlay.querySelector('.clms-viewer__close').addEventListener('click', close);
  if (multi) {
    overlay.querySelector('.clms-viewer__prev').addEventListener('click', () => showImage(index - 1));
    overlay.querySelector('.clms-viewer__next').addEventListener('click', () => showImage(index + 1));
  }

  // ---- 표시 ----
  const bodyOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  document.body.appendChild(overlay);
  document.addEventListener('keydown', onKeydown);
  showImage(index);
  requestAnimationFrame(() => overlay.classList.add('is-open'));

  return { close, next: () => showImage(index + 1), prev: () => showImage(index - 1) };
}

/**
 * 컨테이너 내부의 모든 [data-viewer-src] 썸네일에 클릭 시 뷰어 열기를 연결한다.
 * @param {HTMLElement} container
 */
export function bindThumbnails(container) {
  container.addEventListener('click', (e) => {
    const thumb = e.target.closest('[data-viewer-src]');
    if (!thumb) return;
    const all = [...container.querySelectorAll('[data-viewer-src]')];
    const sources = all.map((el) => el.dataset.viewerSrc);
    openImageViewer(sources, { index: all.indexOf(thumb) });
  });
}
