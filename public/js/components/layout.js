/**
 * 공통 레이아웃 컴포넌트 — 헤더 · 푸터 · 토스트 · 확인 대화상자
 * 모든 페이지에서 재사용한다.
 */

import { APP_NAME, APP_SHORT, roleLabel, roleBadgeClass } from '../constants.js';
import { isMock, Db } from '../backend.js';
import { logout } from '../auth.js';
import { unreadCount } from '../communication.js';
import { escapeHtml } from './link-renderer.js';

/* ============================================================
 * 로고
 * ============================================================ */

/** CLMS 스카이라인 로고 SVG 문자열 */
export function logoSvg(size = 32, color = '#c9a961') {
  return `<img src="/icons/icon.png" width="${size}" height="${size}" alt="로고" style="object-fit: contain;" />`;
}

/* ============================================================
 * 토스트
 * ============================================================ */

const TOAST_STYLES = {
  info:    'bg-navy text-white',
  success: 'bg-emerald-600 text-white',
  error:   'bg-red-600 text-white',
  warning: 'bg-amber-500 text-navy-dark',
};

/** 화면 하단 토스트 알림 */
export function toast(message, type = 'info', duration = 3000) {
  let root = document.getElementById('clms-toast-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'clms-toast-root';
    document.body.appendChild(root);
  }
  const el = document.createElement('div');
  el.className =
    `${TOAST_STYLES[type] || TOAST_STYLES.info} ` +
    'px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium max-w-[88vw] ' +
    'transition-all duration-300 translate-y-2 opacity-0';
  el.style.pointerEvents = 'auto';
  el.textContent = message;
  root.appendChild(el);

  requestAnimationFrame(() => {
    el.classList.remove('translate-y-2', 'opacity-0');
  });
  setTimeout(() => {
    el.classList.add('translate-y-2', 'opacity-0');
    setTimeout(() => el.remove(), 300);
  }, duration);
}

/* ============================================================
 * 확인 대화상자
 * ============================================================ */

/** 확인/취소 모달. Promise<boolean> 반환. */
export function confirmDialog({
  title = '확인',
  message = '',
  confirmText = '확인',
  cancelText = '취소',
  danger = false,
} = {}) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className =
      'fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4';
    overlay.innerHTML = `
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 clms-fade-in" role="dialog" aria-modal="true">
        <h3 class="text-lg font-bold text-navy-dark">${escapeHtml(title)}</h3>
        <p class="mt-2 text-sm text-slate-600 whitespace-pre-line">${escapeHtml(message)}</p>
        <div class="mt-6 flex gap-2 justify-end">
          <button data-act="cancel"
            class="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100">
            ${escapeHtml(cancelText)}
          </button>
          <button data-act="ok"
            class="px-4 py-2 rounded-lg text-sm font-semibold text-white ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-navy hover:bg-navy-light'}">
            ${escapeHtml(confirmText)}
          </button>
        </div>
      </div>`;

    function close(result) {
      document.removeEventListener('keydown', onKey);
      overlay.remove();
      resolve(result);
    }
    function onKey(e) {
      if (e.key === 'Escape') close(false);
      if (e.key === 'Enter') close(true);
    }

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close(false);
      const act = e.target.closest('[data-act]');
      if (act) close(act.dataset.act === 'ok');
    });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);
    overlay.querySelector('[data-act="ok"]').focus();
  });
}

/* ============================================================
 * 헤더
 * ============================================================ */

/** 인증 화면(로그인·가입·승인대기)용 미니멀 헤더 */
export function mountAuthHeader(el) {
  el.innerHTML = `
    <header class="py-5 flex flex-col items-center text-center">
      <div class="flex items-center gap-2">
        ${logoSvg(40)}
        <span class="text-xl font-extrabold text-navy-dark tracking-tight">${APP_SHORT}</span>
      </div>
      <h1 class="mt-1.5 text-sm font-semibold text-slate-500">${escapeHtml(APP_NAME)}</h1>
    </header>`;
}

/** 대시보드/내부 화면용 전체 헤더 (사용자 메뉴 포함) */
export function mountAppHeader(el, { user = null } = {}) {
  const name = (user && user.name) ? String(user.name) : '게스트';
  const role = (user && user.role) ? user.role : 'pending';

  el.innerHTML = `
    <header class="bg-navy text-white shadow-md sticky top-0 z-40">
      <div class="max-w-5xl mx-auto h-14 px-3 sm:px-4 flex items-center justify-between">
        <a href="/dashboard.html" class="flex items-center gap-2 min-w-0">
          ${logoSvg(30)}
          <span class="font-extrabold tracking-tight">${APP_SHORT}</span>
          <span class="hidden sm:inline text-xs text-white/60 truncate">${escapeHtml(APP_NAME)}</span>
        </a>
        <div class="flex items-center gap-1.5 sm:gap-2">
          ${isMock ? '<span class="hidden sm:inline text-[11px] font-bold px-2 py-0.5 rounded bg-gold text-navy-dark">목업 모드</span>' : ''}
          <div class="relative" data-bell-root>
            <button data-act="bell"
              class="relative w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center"
              aria-label="알림">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
              <span data-bell-badge hidden
                class="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center"></span>
            </button>
            <div data-bell-panel hidden
              class="absolute right-0 mt-2 w-72 bg-white text-slate-700 rounded-xl shadow-xl overflow-hidden clms-fade-in">
              <div class="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
                <span class="text-sm font-bold text-navy-dark">알림</span>
                <button data-act="bell-readall" class="text-xs text-slate-400 hover:text-navy">모두 읽음</button>
              </div>
              <div data-bell-list class="max-h-80 overflow-y-auto"></div>
            </div>
          </div>
          <div class="relative" data-menu-root>
            <button data-act="menu"
              class="relative flex items-center gap-2 pl-1.5 pr-2 py-1 rounded-full hover:bg-white/10">
              <span class="w-7 h-7 rounded-full bg-gold text-navy-dark text-xs font-bold flex items-center justify-center">
                ${escapeHtml(name.slice(0, 1))}
              </span>
              <span class="hidden sm:flex flex-col items-start leading-tight">
                <span class="text-sm font-semibold">${escapeHtml(name)}</span>
              </span>
              <span class="text-[10px] font-bold px-1.5 py-0.5 rounded ${roleBadgeClass(role)}">${escapeHtml(roleLabel(role))}</span>
              <span data-admin-badge hidden class="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-navy"></span>
            </button>
            <div data-menu hidden
              class="absolute right-0 mt-2 w-48 bg-white text-slate-700 rounded-xl shadow-xl overflow-hidden clms-fade-in">
              <div class="px-4 py-3 border-b border-slate-100">
                <div class="text-sm font-bold text-navy-dark">${escapeHtml(name)}</div>
                <div class="text-xs text-slate-400">${escapeHtml(user ? (user.department || '') : '')}</div>
              </div>
              ${(role === 'system_admin' || role === 'project_manager') ? `<button data-act="approvals" class="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 flex justify-between items-center">
                사용자 승인 관리
                <span data-admin-badge-count hidden class="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full"></span>
              </button>` : ''}
              <button data-act="profile" class="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50">내 정보 수정</button>
              <button data-act="logout" class="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 border-t border-slate-100">로그아웃</button>
            </div>
          </div>
        </div>
      </div>
    </header>`;

  const menu = el.querySelector('[data-menu]');
  const menuRoot = el.querySelector('[data-menu-root]');
  const bellRoot = el.querySelector('[data-bell-root]');
  const bellPanel = el.querySelector('[data-bell-panel]');
  const bellList = el.querySelector('[data-bell-list]');

  function fmtAgo(iso) {
    const d = new Date(iso); if (isNaN(d)) return '';
    const s = (Date.now() - d.getTime()) / 1000;
    if (s < 60) return '방금'; if (s < 3600) return Math.floor(s / 60) + '분 전';
    if (s < 86400) return Math.floor(s / 3600) + '시간 전'; return Math.floor(s / 86400) + '일 전';
  }
  async function renderBell() {
    if (!user || !user.uid) return;
    bellList.innerHTML = '<div class="py-6 text-center text-xs text-slate-400">불러오는 중...</div>';
    let items = [];
    try { items = await Db.listNotifications(user.uid); } catch { items = []; }
    items = items.slice(0, 20);
    bellList.innerHTML = items.length === 0
      ? '<div class="py-6 text-center text-xs text-slate-400">알림이 없습니다.</div>'
      : items.map((n) => `
        <a href="${escapeHtml(n.link || '#')}" class="block px-4 py-2.5 border-b border-slate-50 hover:bg-slate-50 ${n.read ? '' : 'bg-blue-50/50'}">
          <div class="text-sm font-medium text-navy-dark truncate">${escapeHtml(n.title || '')}</div>
          ${n.body ? `<div class="text-xs text-slate-500 truncate">${escapeHtml(n.body)}</div>` : ''}
          <div class="text-[10px] text-slate-400 mt-0.5">${fmtAgo(n.createdAt)}</div>
        </a>`).join('');
  }
  function closeBell() { bellPanel.hidden = true; document.removeEventListener('click', onBellDoc); }
  function onBellDoc(e) { if (!bellRoot.contains(e.target)) closeBell(); }

  function closeMenu() {
    menu.hidden = true;
    document.removeEventListener('click', onDocClick);
  }
  function onDocClick(e) {
    if (!menuRoot.contains(e.target)) closeMenu();
  }

  el.addEventListener('click', async (e) => {
    const act = e.target.closest('[data-act]');
    if (!act) return;
    switch (act.dataset.act) {
      case 'menu':
        if (menu.hidden) {
          menu.hidden = false;
          setTimeout(() => document.addEventListener('click', onDocClick), 0);
        } else {
          closeMenu();
        }
        break;
      case 'bell':
        if (bellPanel.hidden) {
          bellPanel.hidden = false;
          renderBell();
          setTimeout(() => document.addEventListener('click', onBellDoc), 0);
        } else { closeBell(); }
        break;
      case 'bell-readall':
        if (user && user.uid) {
          await Db.markAllNotificationsRead(user.uid);
          const badge = el.querySelector('[data-bell-badge]');
          if (badge) badge.hidden = true;
          renderBell();
        }
        break;
      case 'profile':
        closeMenu();
        window.location.href = '/profile.html';
        break;
      case 'approvals':
        closeMenu();
        window.location.href = '/admin/approvals.html';
        break;
      case 'logout':
        closeMenu();
        confirmDialog({
          title: '로그아웃',
          message: '로그아웃 하시겠습니까?',
          confirmText: '로그아웃',
          danger: true,
        }).then((ok) => { if (ok) logout(); });
        break;
    }
  });

  // 안 읽음 알림 배지
  if (user && user.uid) {
    unreadCount(user.uid)
      .then((count) => {
        const badge = el.querySelector('[data-bell-badge]');
        if (badge && count > 0) {
          badge.textContent = count > 99 ? '99+' : String(count);
          badge.hidden = false;
        }
      })
      .catch(() => { /* noop */ });
      
    // 관리자 전용: 승인 대기 알림 배지
    if (role === 'system_admin' || role === 'project_manager') {
      Promise.all([Db.listApprovalRequests({ status: 'pending' }), Db.listProjects()]).then(([reqs, projs]) => {
        let count = 0;
        if (role === 'system_admin') {
          count = reqs.length;
        } else {
          const myProjIds = projs.filter(p => p.createdBy === user.uid || (p.members && p.members.officer && p.members.officer.uid === user.uid)).map(p => p.projectId);
          count = reqs.filter(r => r.userInfo && r.userInfo.userType !== 'officer' && myProjIds.includes(r.userInfo.requestedProjectId)).length;
        }
        
        if (count > 0) {
          const adminBadge = el.querySelector('[data-admin-badge]');
          const adminBadgeCount = el.querySelector('[data-admin-badge-count]');
          if (adminBadge) adminBadge.hidden = false;
          if (adminBadgeCount) {
            adminBadgeCount.textContent = count > 99 ? '99+' : count;
            adminBadgeCount.hidden = false;
          }
        }
      })
      .catch(() => { /* noop */ });
    }
  }
}

/* ============================================================
 * 푸터
 * ============================================================ */

export function mountFooter(el, { version = '심플 버전' } = {}) {
  const year = new Date().getFullYear();
  el.innerHTML = `
    <footer class="mt-10 py-6 text-center text-xs text-slate-400">
      <div class="font-semibold text-slate-500">${escapeHtml(APP_NAME)}</div>
      <div class="mt-1">© ${year} 도시주택국 · ${escapeHtml(version)}</div>
    </footer>`;
}
