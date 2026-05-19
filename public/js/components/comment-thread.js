/**
 * comment-thread.js — 2단계 중첩 댓글 스레드
 *
 * - 댓글 → 답글 (최대 1단계 중첩)
 * - 작성 / 수정 / 삭제 (본인 글 또는 관리자)
 * - 이미지 첨부 (미리보기 → 클릭 시 줌 뷰어)
 * - 삭제는 소프트 삭제 ("삭제된 댓글입니다" 표시, 답글은 유지)
 *
 * 백엔드 비의존: onCreate/onUpdate/onDelete 콜백으로 외부와 연결한다.
 * 콜백이 없거나 값을 반환하지 않으면 컴포넌트가 로컬 상태만으로 동작한다.
 */

import { escapeHtml, renderTextWithLinks } from './link-renderer.js';
import { openImageViewer } from './image-viewer.js';
import { roleBadgeClass, roleLabel } from '../constants.js';
import { confirmDialog } from './layout.js';

function formatTime(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (isNaN(date.getTime())) return '';
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60) return '방금 전';
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}일 전`;
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
}

function uid(prefix) {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/**
 * 댓글 스레드를 렌더링한다.
 * @param {HTMLElement} container
 * @param {object} options
 * @returns {{ refresh: Function, getComments: Function }}
 */
export function renderCommentThread(container, options = {}) {
  const state = {
    comments: (options.comments || []).map((c) => ({ ...c })),
    currentUser: options.currentUser || null,
    readOnly: !!options.readOnly,
    enableImages: options.enableImages !== false,
  };
  const canComment = options.canComment !== false && !!state.currentUser && !state.readOnly;

  container.classList.add('clms-comments');
  container.innerHTML = `
    <div class="flex items-center gap-2 mb-3">
      <h3 class="text-sm font-bold text-navy-dark">댓글</h3>
      <span data-count class="text-xs font-semibold text-slate-400"></span>
    </div>
    <div data-list class="space-y-3"></div>
    <div data-main-composer class="mt-4"></div>
  `;
  const listEl = container.querySelector('[data-list]');
  const mainComposerSlot = container.querySelector('[data-main-composer]');
  const countEl = container.querySelector('[data-count]');

  /* ---- 권한 ---- */
  function canManage(comment) {
    const u = state.currentUser;
    if (!u || comment.deletedAt) return false;
    return u.uid === comment.author?.uid || u.role === 'system_admin';
  }

  /* ---- 이미지 첨부 컴포저 ---- */
  function buildComposer({ mode, parentId = null, comment = null }) {
    const wrap = document.createElement('div');
    wrap._pendingImages = []; // {url, file, name}
    const isEdit = mode === 'edit';
    const placeholder = mode === 'reply' ? '답글을 입력하세요' : '댓글을 입력하세요';

    wrap.className = isEdit ? '' : 'bg-slate-50 rounded-xl p-3';
    wrap.innerHTML = `
      <textarea data-input rows="${isEdit ? 3 : 2}"
        class="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-navy/30"
        placeholder="${placeholder}">${isEdit ? escapeHtml(comment.content || '') : ''}</textarea>
      <div data-previews class="flex flex-wrap gap-2 mt-2 ${'' /* hidden when empty */}"></div>
      <div class="flex items-center justify-between mt-2">
        <div>
          ${state.enableImages ? `
            <button type="button" data-act="pick-image"
              class="text-xs text-slate-500 hover:text-navy flex items-center gap-1">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                <path d="M21 15l-5-5L5 21"/></svg>
              사진
            </button>
            <input type="file" data-file accept="image/*" multiple hidden />
          ` : ''}
        </div>
        <div class="flex gap-1.5">
          ${(isEdit || mode === 'reply') ? '<button type="button" data-act="cancel" class="px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-200 rounded-lg">취소</button>' : ''}
          <button type="button" data-act="submit"
            class="px-3.5 py-1.5 text-xs font-semibold text-white bg-navy hover:bg-navy-light rounded-lg">
            ${isEdit ? '저장' : '등록'}
          </button>
        </div>
      </div>
    `;

    const input = wrap.querySelector('[data-input]');
    const previews = wrap.querySelector('[data-previews]');
    const fileInput = wrap.querySelector('[data-file]');

    function renderPreviews() {
      previews.innerHTML = wrap._pendingImages
        .map((img, i) => `
          <div class="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-200">
            <img src="${img.url}" class="w-full h-full object-cover" alt="" />
            <button type="button" data-remove="${i}"
              class="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white text-xs leading-none">✕</button>
          </div>`)
        .join('');
    }

    if (fileInput) {
      wrap.querySelector('[data-act="pick-image"]').addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', () => {
        for (const file of fileInput.files) {
          wrap._pendingImages.push({ url: URL.createObjectURL(file), file, name: file.name });
        }
        fileInput.value = '';
        renderPreviews();
      });
    }
    previews.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-remove]');
      if (!btn) return;
      wrap._pendingImages.splice(Number(btn.dataset.remove), 1);
      renderPreviews();
    });

    wrap.querySelector('[data-act="submit"]').addEventListener('click', async () => {
      const content = input.value.trim();
      if (!content && wrap._pendingImages.length === 0) {
        input.focus();
        return;
      }
      const draft = {
        content,
        parentCommentId: parentId,
        images: wrap._pendingImages.map((img) => ({ url: img.url, file: img.file, name: img.name })),
      };
      if (isEdit) await submitEdit(comment.id, draft);
      else await submitCreate(draft);
    });

    const cancelBtn = wrap.querySelector('[data-act="cancel"]');
    if (cancelBtn) cancelBtn.addEventListener('click', () => wrap.remove());

    return wrap;
  }

  /* ---- 데이터 변경 ---- */
  async function submitCreate(draft) {
    let created;
    if (typeof options.onCreate === 'function') {
      created = await options.onCreate(draft);
    }
    if (!created) {
      created = {
        id: uid('c'),
        parentCommentId: draft.parentCommentId,
        author: {
          uid: state.currentUser.uid,
          name: state.currentUser.name,
          role: state.currentUser.role,
        },
        content: draft.content,
        images: draft.images || [],
        createdAt: new Date().toISOString(),
        updatedAt: null,
        deletedAt: null,
      };
    }
    state.comments.push(created);
    render();
  }

  async function submitEdit(id, draft) {
    if (typeof options.onUpdate === 'function') {
      await options.onUpdate(id, draft);
    }
    const target = state.comments.find((c) => c.id === id);
    if (target) {
      target.content = draft.content;
      if (draft.images && draft.images.length) target.images = draft.images;
      target.updatedAt = new Date().toISOString();
    }
    render();
  }

  async function submitDelete(id) {
    const ok = await confirmDialog({
      title: '댓글 삭제',
      message: '이 댓글을 삭제하시겠습니까?',
      confirmText: '삭제',
      danger: true,
    });
    if (!ok) return;
    if (typeof options.onDelete === 'function') {
      await options.onDelete(id);
    }
    const target = state.comments.find((c) => c.id === id);
    if (target) target.deletedAt = new Date().toISOString();
    render();
  }

  /* ---- 렌더 ---- */
  function commentImagesHtml(comment) {
    if (!comment.images || comment.images.length === 0) return '';
    return `
      <div class="flex flex-wrap gap-1.5 mt-2">
        ${comment.images.map((img, i) => `
          <img src="${img.thumbnailUrl || img.url}" data-img="${i}"
            class="w-20 h-20 object-cover rounded-lg border border-slate-200 cursor-pointer hover:opacity-90" alt="" />
        `).join('')}
      </div>`;
  }

  function commentHtml(comment, isReply) {
    const author = comment.author || {};
    const deleted = !!comment.deletedAt;
    const edited = !!comment.updatedAt && !deleted;

    if (deleted) {
      return `
        <div class="${isReply ? 'ml-9' : ''} text-xs text-slate-400 italic py-1.5">
          삭제된 댓글입니다.
        </div>`;
    }

    return `
      <div class="${isReply ? 'ml-9' : ''}" data-comment="${comment.id}">
        <div class="flex gap-2.5">
          <span class="shrink-0 w-7 h-7 rounded-full bg-navy text-white text-xs font-bold flex items-center justify-center">
            ${escapeHtml((author.name || '?').slice(0, 1))}
          </span>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="text-sm font-semibold text-navy-dark">${escapeHtml(author.name || '익명')}</span>
              ${author.role ? `<span class="text-[10px] font-bold px-1.5 py-0.5 rounded ${roleBadgeClass(author.role)}">${escapeHtml(roleLabel(author.role))}</span>` : ''}
              <span class="text-xs text-slate-400">${formatTime(comment.createdAt)}</span>
              ${edited ? '<span class="text-[10px] text-slate-400">(수정됨)</span>' : ''}
            </div>
            <div class="text-sm text-slate-700 mt-0.5 break-words" data-content>${renderTextWithLinks(comment.content)}</div>
            ${commentImagesHtml(comment)}
            <div class="flex items-center gap-3 mt-1.5 text-xs">
              ${(!isReply && canComment) ? `<button data-act="reply" class="text-slate-400 hover:text-navy font-medium">답글</button>` : ''}
              ${canManage(comment) ? `
                <button data-act="edit" class="text-slate-400 hover:text-navy font-medium">수정</button>
                <button data-act="delete" class="text-slate-400 hover:text-red-600 font-medium">삭제</button>
              ` : ''}
            </div>
            <div data-reply-slot></div>
          </div>
        </div>
      </div>`;
  }

  function render() {
    const visibleCount = state.comments.filter((c) => !c.deletedAt).length;
    countEl.textContent = visibleCount > 0 ? String(visibleCount) : '';

    const roots = state.comments.filter((c) => !c.parentCommentId);
    if (roots.length === 0) {
      listEl.innerHTML = '<p class="text-sm text-slate-400 py-2">첫 댓글을 남겨보세요.</p>';
    } else {
      listEl.innerHTML = roots.map((root) => {
        const replies = state.comments.filter((c) => c.parentCommentId === root.id);
        return `
          <div class="border-b border-slate-100 pb-3 last:border-0">
            ${commentHtml(root, false)}
            ${replies.map((r) => commentHtml(r, true)).join('')}
          </div>`;
      }).join('');
    }

    // 메인 컴포저
    mainComposerSlot.innerHTML = '';
    if (canComment) {
      mainComposerSlot.appendChild(buildComposer({ mode: 'create' }));
    } else if (!state.currentUser) {
      mainComposerSlot.innerHTML = '<p class="text-xs text-slate-400">댓글을 작성하려면 로그인이 필요합니다.</p>';
    }
  }

  /* ---- 이벤트 위임 ---- */
  listEl.addEventListener('click', (e) => {
    const commentEl = e.target.closest('[data-comment]');
    if (!commentEl) return;
    const id = commentEl.dataset.comment;
    const comment = state.comments.find((c) => c.id === id);
    if (!comment) return;

    const imgEl = e.target.closest('[data-img]');
    if (imgEl) {
      openImageViewer(comment.images.map((i) => i.url), { index: Number(imgEl.dataset.img) });
      return;
    }

    const actBtn = e.target.closest('[data-act]');
    if (!actBtn) return;
    const act = actBtn.dataset.act;

    if (act === 'reply') {
      const slot = commentEl.querySelector('[data-reply-slot]');
      if (slot.firstChild) { slot.innerHTML = ''; return; }
      slot.innerHTML = '';
      slot.appendChild(buildComposer({ mode: 'reply', parentId: id }));
      slot.querySelector('[data-input]').focus();
    } else if (act === 'edit') {
      const contentEl = commentEl.querySelector('[data-content]');
      if (contentEl.dataset.editing) return;
      contentEl.dataset.editing = '1';
      const editor = buildComposer({ mode: 'edit', comment });
      contentEl.style.display = 'none';
      contentEl.after(editor);
    } else if (act === 'delete') {
      submitDelete(id);
    }
  });

  render();

  return {
    refresh(comments) {
      if (comments) state.comments = comments.map((c) => ({ ...c }));
      render();
    },
    getComments() {
      return state.comments;
    },
  };
}
