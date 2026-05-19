/**
 * post-composer.js — 협업 게시글 작성·수정 모달 (범용)
 *
 * post-types.js 의 유형 정의에 따라 제목·내용·유형별 추가 필드·이미지를
 * 입력받아 게시글을 생성/수정한다.
 */

import { escapeHtml } from './link-renderer.js';
import { toast } from './layout.js';
import { openImageViewer } from './image-viewer.js';
import { createPost, updatePost, resolveDraftImages } from '../board.js';
import { getPostType } from '../post-types.js';

const INPUT_CLS =
  'w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30';

function renderExtraField(field, value) {
  const v = value != null ? value : '';
  if (field.type === 'textarea') {
    return `<textarea data-x="${field.key}" rows="3" class="${INPUT_CLS} resize-y">${escapeHtml(v)}</textarea>`;
  }
  if (field.type === 'select') {
    return `<select data-x="${field.key}" class="${INPUT_CLS} bg-white">
      <option value="">선택하세요</option>
      ${field.options.map((o) => `<option value="${escapeHtml(o)}" ${o === v ? 'selected' : ''}>${escapeHtml(o)}</option>`).join('')}
    </select>`;
  }
  return `<input data-x="${field.key}" type="${field.type}" value="${escapeHtml(v)}" class="${INPUT_CLS}" />`;
}

/**
 * 게시글 작성/수정 모달을 연다.
 * @param {object} opts { typeKey, project, user, post(null=신규), onSaved }
 */
export function openPostComposer({ typeKey, project, user, post = null, onSaved }) {
  const t = getPostType(typeKey);
  if (!t) return;
  const editing = !!post;
  const pendingImages = editing ? (post.images || []).map((i) => ({ ...i })) : [];
  const extra = editing ? (post.extra || {}) : {};

  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4';
  overlay.innerHTML = `
    <div class="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 clms-fade-in max-h-[92vh] overflow-y-auto">
      <h3 class="text-lg font-bold text-navy-dark">${t.icon} ${t.label} ${editing ? '수정' : '작성'}</h3>
      <div class="space-y-3 mt-3">
        <div>
          <label class="block text-sm font-semibold text-slate-700 mb-1">${t.titleLabel} <span class="text-red-500">*</span></label>
          <input data-f="title" type="text" value="${editing ? escapeHtml(post.title) : ''}" class="${INPUT_CLS}" />
        </div>
        ${t.extraFields.map((f) => `
          <div>
            <label class="block text-sm font-semibold text-slate-700 mb-1">${f.label} ${f.required ? '<span class="text-red-500">*</span>' : ''}</label>
            ${renderExtraField(f, extra[f.key])}
          </div>`).join('')}
        <div>
          <label class="block text-sm font-semibold text-slate-700 mb-1">내용 <span class="text-red-500">*</span></label>
          <textarea data-f="content" rows="5" placeholder="내용을 입력하세요. 본문 내 URL은 자동으로 링크 처리됩니다."
            class="${INPUT_CLS} resize-y">${editing ? escapeHtml(post.content) : ''}</textarea>
        </div>
        <div>
          <button data-act="pick" type="button" class="text-xs font-semibold text-slate-500 hover:text-navy flex items-center gap-1">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
            이미지 첨부 (자동 500KB 압축)
          </button>
          <input data-f="file" type="file" accept="image/*" multiple hidden />
          <div data-previews class="flex flex-wrap gap-2 mt-2"></div>
        </div>
        <p class="text-[11px] text-slate-400">등록 시 사업 참여자에게 알림이 발송됩니다.</p>
      </div>
      <div class="mt-5 flex gap-2 justify-end">
        <button data-act="cancel" class="px-4 py-2 rounded-lg text-sm font-medium text-slate-500 hover:bg-slate-100">취소</button>
        <button data-act="save" class="px-5 py-2 rounded-lg text-sm font-bold text-white bg-navy hover:bg-navy-light">${editing ? '수정' : '등록'}</button>
      </div>
    </div>`;

  const fileEl = overlay.querySelector('[data-f="file"]');
  const previewsEl = overlay.querySelector('[data-previews]');
  const saveBtn = overlay.querySelector('[data-act="save"]');

  function renderPreviews() {
    previewsEl.innerHTML = pendingImages.map((img, i) => `
      <div class="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-200">
        <img src="${img.thumbnailUrl || img.url}" data-view="${i}" class="w-full h-full object-cover cursor-pointer" alt="" />
        <button type="button" data-remove="${i}" class="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white text-xs leading-none">✕</button>
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
    const rm = e.target.closest('[data-remove]');
    if (rm) { pendingImages.splice(Number(rm.dataset.remove), 1); renderPreviews(); return; }
    const vw = e.target.closest('[data-view]');
    if (vw) openImageViewer(pendingImages[Number(vw.dataset.view)].url);
  });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.dataset.act === 'cancel') close();
  });

  saveBtn.addEventListener('click', async () => {
    const title = overlay.querySelector('[data-f="title"]').value.trim();
    const content = overlay.querySelector('[data-f="content"]').value.trim();
    if (!title) { toast(`${t.titleLabel}을(를) 입력해 주세요.`, 'warning'); return; }
    if (!content) { toast('내용을 입력해 주세요.', 'warning'); return; }

    const extraValues = {};
    for (const f of t.extraFields) {
      const el = overlay.querySelector(`[data-x="${f.key}"]`);
      const val = el ? el.value.trim() : '';
      if (f.required && !val) { toast(`${f.label}을(를) 입력해 주세요.`, 'warning'); el && el.focus(); return; }
      extraValues[f.key] = val;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = '저장 중...';
    try {
      const images = await resolveDraftImages(pendingImages, `projects/${project.projectId}/${t.collection}`);
      const draft = { title, content, extra: extraValues, images };
      const result = editing
        ? await updatePost(typeKey, project, post, draft, user)
        : await createPost(typeKey, project, user, draft);
      toast(editing ? `${t.label}이(가) 수정되었습니다.` : `${t.label}이(가) 등록되었습니다.`, 'success');
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
  overlay.querySelector('[data-f="title"]').focus();
}
