/**
 * post-actions.js — 게시글 작성자 액션 메뉴 (수정 · 삭제)
 *
 * - 권한 확인 후 메뉴 표시 여부 결정 (작성자 본인 또는 시스템 관리자)
 * - "수정" → onEdit 콜백 (페이지가 수정 모달을 담당)
 * - "삭제" → 확인 후 onDelete 콜백 (소프트 삭제)
 *
 * 모든 게시글(공지·지시·질의·회의록·일지 등)에서 공통 사용한다.
 */

import { confirmDialog, toast } from './layout.js';

/**
 * 사용자가 해당 게시글을 관리(수정·삭제)할 수 있는지 판단한다.
 * @param {object} post  { author: { uid } }
 * @param {object} user  { uid, role }
 */
export function canManagePost(post, user) {
  if (!post || !user) return false;
  const authorUid = post.author && post.author.uid;
  return user.uid === authorUid || user.role === 'system_admin';
}

const KEBAB_SVG =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
  '<circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>';

/**
 * 컨테이너에 게시글 액션 메뉴를 마운트한다.
 * 권한이 없으면 아무것도 렌더링하지 않는다.
 *
 * @param {HTMLElement} container
 * @param {object} options
 * @param {object} options.post          게시글 객체 ({ id, author:{uid}, deletedAt })
 * @param {object} options.currentUser   현재 사용자
 * @param {Function} options.onEdit      (post) => void  — 수정 모달 열기
 * @param {Function} options.onDelete    (post) => Promise|void — 소프트 삭제 수행
 * @returns {{ destroy: Function } | null}
 */
export function mountPostActions(container, { post, currentUser, onEdit, onDelete } = {}) {
  if (!canManagePost(post, currentUser) || (post && post.deletedAt)) {
    container.innerHTML = '';
    return null;
  }

  container.innerHTML = `
    <div class="relative inline-block" data-pa-root>
      <button type="button" data-pa="toggle" aria-label="더보기"
        class="w-8 h-8 rounded-full text-slate-400 hover:bg-slate-100 hover:text-navy flex items-center justify-center">
        ${KEBAB_SVG}
      </button>
      <div data-pa="menu" hidden
        class="absolute right-0 mt-1 w-32 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-30 clms-fade-in">
        <button type="button" data-pa="edit"
          class="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50">수정</button>
        <button type="button" data-pa="delete"
          class="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 border-t border-slate-100">삭제</button>
      </div>
    </div>`;

  const root = container.querySelector('[data-pa-root]');
  const menu = container.querySelector('[data-pa="menu"]');

  function closeMenu() {
    menu.hidden = true;
    document.removeEventListener('click', onDocClick);
  }
  function onDocClick(e) {
    if (!root.contains(e.target)) closeMenu();
  }

  container.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-pa]');
    if (!btn) return;
    const action = btn.dataset.pa;

    if (action === 'toggle') {
      if (menu.hidden) {
        menu.hidden = false;
        setTimeout(() => document.addEventListener('click', onDocClick), 0);
      } else {
        closeMenu();
      }
      return;
    }

    if (action === 'edit') {
      closeMenu();
      if (typeof onEdit === 'function') onEdit(post);
      else toast('수정 기능이 연결되지 않았습니다.', 'warning');
      return;
    }

    if (action === 'delete') {
      closeMenu();
      const ok = await confirmDialog({
        title: '게시글 삭제',
        message: '이 게시글을 삭제하시겠습니까?\n삭제된 글은 관리자가 30일 이내 복원할 수 있습니다.',
        confirmText: '삭제',
        danger: true,
      });
      if (!ok) return;
      try {
        if (typeof onDelete === 'function') await onDelete(post);
        toast('게시글이 삭제되었습니다.', 'success');
      } catch (err) {
        console.error(err);
        toast('삭제 중 오류가 발생했습니다.', 'error');
      }
    }
  });

  return { destroy: closeMenu };
}
