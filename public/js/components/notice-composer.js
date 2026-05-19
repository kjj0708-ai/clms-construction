/**
 * notice-composer.js — 공지사항 작성·수정 모달
 *
 * 제목·내용·중요도·이미지 첨부를 입력받아 공지를 생성/수정한다.
 * 이미지는 자동 압축(image-compressor) 후 저장된다.
 */

import { escapeHtml } from './link-renderer.js';
import { toast } from './layout.js';
import { openImageViewer } from './image-viewer.js';
import { createNotice, updateNotice, resolveDraftImages } from '../notices.js';
import { NOTICE_PRIORITIES } from '../constants.js';

/**
 * 공지 작성/수정 모달을 연다.
 * @param {object} opts
 * @param {object} opts.project  대상 사업
 * @param {object} opts.user     작성자(현재 사용자)
 * @param {object|null} opts.notice  수정 시 기존 공지, 신규 작성이면 null
 * @param {Function} opts.onSaved   (notice) => void
 */
export function openNoticeComposer({ project, user, notice = null, onSaved }) {
  const editing = !!notice;
  const pendingImages = editing ? (notice.images || []).map((i) => ({ ...i })) : [];

  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4';
  overlay.innerHTML = `
    <div class="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 clms-fade-in max-h-[92vh] overflow-y-auto">
      <h3 class="text-lg font-bold text-navy-dark">${editing ? '공지 수정' : '공지 작성'}</h3>
      <div class="space-y-3 mt-3">
        <input data-f="title" type="text" placeholder="제목" value="${editing ? escapeHtml(notice.title) : ''}"
          class="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30" />
        <select data-f="priority"
          class="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy/30">
          ${Object.entries(NOTICE_PRIORITIES).map(([k, v]) =>
            `<option value="${k}" ${editing && notice.priority === k ? 'selected' : (!editing && k === 'normal' ? 'selected' : '')}>중요도: ${v.label}</option>`).join('')}
        </select>
        <textarea data-f="content" rows="6" placeholder="내용을 입력하세요. 본문 내 URL은 자동으로 링크 처리됩니다."
          class="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-navy/30">${editing ? escapeHtml(notice.content) : ''}</textarea>
        <div>
          <button data-act="pick" type="button"
            class="text-xs font-semibold text-slate-500 hover:text-navy flex items-center gap-1">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
            이미지 첨부 (자동 500KB 압축)
          </button>
          <input data-f="file" type="file" accept="image/*" multiple hidden />
          <div data-previews class="flex flex-wrap gap-2 mt-2"></div>
        </div>
        <p class="text-[11px] text-slate-400">등록 시 사업 참여자 전원에게 알림이 발송됩니다.</p>
      </div>
      <div class="mt-5 flex gap-2 justify-end">
        <button data-act="cancel" class="px-4 py-2 rounded-lg text-sm font-medium text-slate-500 hover:bg-slate-100">취소</button>
        <button data-act="save" class="px-5 py-2 rounded-lg text-sm font-bold text-white bg-navy hover:bg-navy-light">
          ${editing ? '수정' : '등록'}
        </button>
      </div>
    </div>`;

  const titleEl = overlay.querySelector('[data-f="title"]');
  const contentEl = overlay.querySelector('[data-f="content"]');
  const priorityEl = overlay.querySelector('[data-f="priority"]');
  const fileEl = overlay.querySelector('[data-f="file"]');
  const previewsEl = overlay.querySelector('[data-previews]');
  const saveBtn = overlay.querySelector('[data-act="save"]');

  function renderPreviews() {
    previewsEl.innerHTML = pendingImages.map((img, i) => `
      <div class="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-200">
        <img src="${img.thumbnailUrl || img.url}" data-view="${i}" class="w-full h-full object-cover cursor-pointer" alt="" />
        <button type="button" data-remove="${i}"
          class="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white text-xs leading-none">✕</button>
      </div>`).join('');
  }
  renderPreviews();

  function close() { overlay.remove(); }

  overlay.querySelector('[data-act="pick"]').addEventListener('click', () => fileEl.click());
  fileEl.addEventListener('change', () => {
    for (const file of fileEl.files) {
      pendingImages.push({ file, url: URL.createObjectURL(file), name: file.name });
    }
    fileEl.value = '';
    renderPreviews();
  });

  previewsEl.addEventListener('click', (e) => {
    const removeBtn = e.target.closest('[data-remove]');
    if (removeBtn) {
      pendingImages.splice(Number(removeBtn.dataset.remove), 1);
      renderPreviews();
      return;
    }
    const viewBtn = e.target.closest('[data-view]');
    if (viewBtn) {
      const img = pendingImages[Number(viewBtn.dataset.view)];
      openImageViewer(img.url);
    }
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.dataset.act === 'cancel') close();
  });

  saveBtn.addEventListener('click', async () => {
    const title = titleEl.value.trim();
    const content = contentEl.value.trim();
    if (!title) { toast('제목을 입력해 주세요.', 'warning'); titleEl.focus(); return; }
    if (!content) { toast('내용을 입력해 주세요.', 'warning'); contentEl.focus(); return; }

    saveBtn.disabled = true;
    saveBtn.textContent = '저장 중...';
    try {
      const images = await resolveDraftImages(pendingImages, `projects/${project.projectId}/notices`);
      const draft = { title, content, priority: priorityEl.value, images };
      const result = editing
        ? await updateNotice(project, notice, draft, user)
        : await createNotice(project, user, draft);
      toast(editing ? '공지가 수정되었습니다.' : '공지가 등록되었습니다.', 'success');
      close();
      if (typeof onSaved === 'function') onSaved(result);
    } catch (err) {
      console.error(err);
      toast('저장 중 오류가 발생했습니다. ' + (err.message || ''), 'error');
      saveBtn.disabled = false;
      saveBtn.textContent = editing ? '수정' : '등록';
    }
  });

  document.body.appendChild(overlay);
  titleEl.focus();
}
