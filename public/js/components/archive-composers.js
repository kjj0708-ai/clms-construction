/**
 * archive-composers.js — 현장 아카이브 입력 모달
 *
 * 작업일지 작성·수정, 사진 업로드, 도면 업로드 모달을 제공한다.
 */

import { escapeHtml } from './link-renderer.js';
import { toast } from './layout.js';
import { openImageViewer } from './image-viewer.js';
import { PROCESS_OPTIONS, DRAWING_CATEGORIES } from '../constants.js';
import {
  createDailyLog, updateDailyLog, mockWeather, resolveDraftImages,
  preparePhoto, createPhoto, createDrawing,
} from '../archive.js';

const INPUT = 'w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-navy/30';

function buildOverlay(innerHTML) {
  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4';
  overlay.innerHTML = `<div class="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 clms-fade-in max-h-[92vh] overflow-y-auto">${innerHTML}</div>`;
  document.body.appendChild(overlay);
  return overlay;
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/* ============================================================
 * 작업일지 작성/수정
 * ============================================================ */

export function openDailyLogComposer({ project, user, log = null, onSaved }) {
  const editing = !!log;
  const pendingImages = editing ? (log.images || []).map((i) => ({ ...i })) : [];

  const processOptions = PROCESS_OPTIONS
    .map((p) => `<option value="${p}" ${editing && log.process === p ? 'selected' : ''}>${p}</option>`).join('');

  const overlay = buildOverlay(`
    <h3 class="text-lg font-bold text-navy-dark">작업일지 ${editing ? '수정' : '작성'}</h3>
    <div class="space-y-3 mt-3">
      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="block text-sm font-semibold text-slate-700 mb-1">작업일자 <span class="text-red-500">*</span></label>
          <input data-f="date" type="date" value="${editing ? log.date : todayStr()}" ${editing ? 'disabled' : ''} class="${INPUT} disabled:bg-slate-100" />
        </div>
        <div>
          <label class="block text-sm font-semibold text-slate-700 mb-1">날씨</label>
          <div class="flex gap-1">
            <input data-f="weather" type="text" value="${editing ? escapeHtml(log.weather || '') : ''}" placeholder="맑음, 18°C" class="${INPUT}" />
            <button data-act="weather" type="button" class="shrink-0 px-2 rounded-lg bg-slate-100 text-navy text-xs font-semibold hover:bg-slate-200">자동</button>
          </div>
        </div>
      </div>
      <div>
        <label class="block text-sm font-semibold text-slate-700 mb-1">공정</label>
        <select data-f="process" class="${INPUT} bg-white"><option value="">선택</option>${processOptions}</select>
      </div>
      <div>
        <label class="block text-sm font-semibold text-slate-700 mb-1">작업 내용 <span class="text-red-500">*</span></label>
        <textarea data-f="workContent" rows="3" class="${INPUT} resize-y">${editing ? escapeHtml(log.workContent || '') : ''}</textarea>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="block text-sm font-semibold text-slate-700 mb-1">투입 인원(명)</label>
          <input data-f="workforce" type="number" min="0" value="${editing ? (log.workforce || '') : ''}" class="${INPUT}" />
        </div>
        <div>
          <label class="block text-sm font-semibold text-slate-700 mb-1">진척률(%)</label>
          <input data-f="progress" type="number" min="0" max="100" value="${editing ? (log.progress || '') : ''}" class="${INPUT}" />
        </div>
      </div>
      <div>
        <label class="block text-sm font-semibold text-slate-700 mb-1">투입 장비</label>
        <input data-f="equipment" type="text" value="${editing ? escapeHtml(log.equipment || '') : ''}" placeholder="굴착기 1, 덤프트럭 2" class="${INPUT}" />
      </div>
      <div>
        <label class="block text-sm font-semibold text-slate-700 mb-1">자재 사용</label>
        <input data-f="materials" type="text" value="${editing ? escapeHtml(log.materials || '') : ''}" placeholder="레미콘 30㎥, 철근 2t" class="${INPUT}" />
      </div>
      <div>
        <label class="block text-sm font-semibold text-slate-700 mb-1">안전 사항</label>
        <textarea data-f="safetyNotes" rows="2" class="${INPUT} resize-y">${editing ? escapeHtml(log.safetyNotes || '') : ''}</textarea>
      </div>
      <div>
        <button data-act="pick" type="button" class="text-xs font-semibold text-slate-500 hover:text-navy">📷 현장 사진 첨부</button>
        <input data-f="file" type="file" accept="image/*" multiple hidden />
        <div data-previews class="flex flex-wrap gap-2 mt-2"></div>
      </div>
    </div>
    <div class="mt-5 flex gap-2 justify-end">
      <button data-act="cancel" class="px-4 py-2 rounded-lg text-sm font-medium text-slate-500 hover:bg-slate-100">취소</button>
      <button data-act="save" class="px-5 py-2 rounded-lg text-sm font-bold text-white bg-navy hover:bg-navy-light">${editing ? '수정' : '등록'}</button>
    </div>`);

  const q = (sel) => overlay.querySelector(sel);
  const previewsEl = q('[data-previews]');
  function renderPreviews() {
    previewsEl.innerHTML = pendingImages.map((img, i) => `
      <div class="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-200">
        <img src="${img.thumbnailUrl || img.url}" data-view="${i}" class="w-full h-full object-cover cursor-pointer" alt="" />
        <button type="button" data-remove="${i}" class="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white text-xs leading-none">✕</button>
      </div>`).join('');
  }
  renderPreviews();

  q('[data-act="weather"]').addEventListener('click', () => { q('[data-f="weather"]').value = mockWeather(); });
  q('[data-act="pick"]').addEventListener('click', () => q('[data-f="file"]').click());
  q('[data-f="file"]').addEventListener('change', (e) => {
    for (const file of e.target.files) pendingImages.push({ file, url: URL.createObjectURL(file), name: file.name });
    e.target.value = '';
    renderPreviews();
  });
  previewsEl.addEventListener('click', (e) => {
    const rm = e.target.closest('[data-remove]');
    if (rm) { pendingImages.splice(Number(rm.dataset.remove), 1); renderPreviews(); return; }
    const vw = e.target.closest('[data-view]');
    if (vw) openImageViewer(pendingImages[Number(vw.dataset.view)].url);
  });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.dataset.act === 'cancel') overlay.remove();
  });

  q('[data-act="save"]').addEventListener('click', async () => {
    const get = (f) => q(`[data-f="${f}"]`).value.trim();
    const draft = {
      date: get('date'), weather: get('weather'), process: get('process'),
      workContent: get('workContent'), workforce: get('workforce'),
      equipment: get('equipment'), materials: get('materials'),
      progress: get('progress'), safetyNotes: get('safetyNotes'),
    };
    if (!draft.date) { toast('작업일자를 입력해 주세요.', 'warning'); return; }
    if (!draft.workContent) { toast('작업 내용을 입력해 주세요.', 'warning'); return; }

    const saveBtn = q('[data-act="save"]');
    saveBtn.disabled = true;
    saveBtn.textContent = '저장 중...';
    try {
      draft.images = await resolveDraftImages(pendingImages, `projects/${project.projectId}/dailyLogs`);
      const result = editing
        ? await updateDailyLog(project, log, draft, user)
        : await createDailyLog(project, user, draft);
      toast(editing ? '작업일지가 수정되었습니다.' : '작업일지가 등록되었습니다.', 'success');
      overlay.remove();
      if (onSaved) onSaved(result);
    } catch (err) {
      console.error(err);
      toast('저장 중 오류가 발생했습니다.', 'error');
      saveBtn.disabled = false;
      saveBtn.textContent = editing ? '수정' : '등록';
    }
  });
}

/* ============================================================
 * 사진 업로드 (일괄)
 * ============================================================ */

export function openPhotoUploader({ project, user, onSaved }) {
  let files = [];
  const processOptions = PROCESS_OPTIONS.map((p) => `<option value="${p}">${p}</option>`).join('');

  const overlay = buildOverlay(`
    <h3 class="text-lg font-bold text-navy-dark">현장 사진 업로드</h3>
    <p class="text-xs text-slate-500 mt-1">선택한 사진은 자동으로 500KB 압축 + 워터마크(사업명·일시) 처리됩니다.</p>
    <div class="space-y-3 mt-3">
      <button data-act="pick" type="button" class="w-full py-6 rounded-xl border-2 border-dashed border-slate-300 text-slate-500 hover:border-navy hover:text-navy text-sm font-semibold">
        📷 사진 선택 (여러 장 가능)
      </button>
      <input data-f="file" type="file" accept="image/*" multiple capture="environment" hidden />
      <div data-previews class="grid grid-cols-4 gap-2"></div>
      <div>
        <label class="block text-sm font-semibold text-slate-700 mb-1">공정</label>
        <select data-f="process" class="${INPUT} bg-white"><option value="">선택</option>${processOptions}</select>
      </div>
      <div>
        <label class="block text-sm font-semibold text-slate-700 mb-1">위치</label>
        <input data-f="location" type="text" placeholder="예: 1구간 교각 P-3" class="${INPUT}" />
      </div>
      <div>
        <label class="block text-sm font-semibold text-slate-700 mb-1">설명</label>
        <input data-f="description" type="text" placeholder="사진 설명 (선택)" class="${INPUT}" />
      </div>
      <div data-progress class="text-xs text-slate-400" hidden></div>
    </div>
    <div class="mt-5 flex gap-2 justify-end">
      <button data-act="cancel" class="px-4 py-2 rounded-lg text-sm font-medium text-slate-500 hover:bg-slate-100">취소</button>
      <button data-act="save" class="px-5 py-2 rounded-lg text-sm font-bold text-white bg-navy hover:bg-navy-light">업로드</button>
    </div>`);

  const q = (sel) => overlay.querySelector(sel);
  const previewsEl = q('[data-previews]');
  function renderPreviews() {
    previewsEl.innerHTML = files.map((f, i) => `
      <div class="relative aspect-square rounded-lg overflow-hidden border border-slate-200">
        <img src="${f._url}" class="w-full h-full object-cover" alt="" />
        <button type="button" data-remove="${i}" class="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/60 text-white text-xs leading-none">✕</button>
      </div>`).join('');
  }

  q('[data-act="pick"]').addEventListener('click', () => q('[data-f="file"]').click());
  q('[data-f="file"]').addEventListener('change', (e) => {
    for (const file of e.target.files) { file._url = URL.createObjectURL(file); files.push(file); }
    e.target.value = '';
    renderPreviews();
  });
  previewsEl.addEventListener('click', (e) => {
    const rm = e.target.closest('[data-remove]');
    if (rm) { files.splice(Number(rm.dataset.remove), 1); renderPreviews(); }
  });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.dataset.act === 'cancel') overlay.remove();
  });

  q('[data-act="save"]').addEventListener('click', async () => {
    if (files.length === 0) { toast('사진을 선택해 주세요.', 'warning'); return; }
    const meta = {
      process: q('[data-f="process"]').value,
      locationDesc: q('[data-f="location"]').value.trim(),
      description: q('[data-f="description"]').value.trim(),
    };
    const saveBtn = q('[data-act="save"]');
    const progressEl = q('[data-progress]');
    saveBtn.disabled = true;
    progressEl.hidden = false;
    try {
      for (let i = 0; i < files.length; i++) {
        progressEl.textContent = `처리 중... (${i + 1}/${files.length})`;
        const image = await preparePhoto(files[i], project);
        await createPhoto(project, user, { image, ...meta });
      }
      toast(`사진 ${files.length}장이 업로드되었습니다.`, 'success');
      overlay.remove();
      if (onSaved) onSaved();
    } catch (err) {
      console.error(err);
      toast('업로드 중 오류가 발생했습니다.', 'error');
      saveBtn.disabled = false;
      progressEl.hidden = true;
    }
  });
}

/* ============================================================
 * 도면 업로드
 * ============================================================ */

export function openDrawingUploader({ project, user, onSaved }) {
  let file = null;
  const categoryOptions = DRAWING_CATEGORIES.map((c) => `<option value="${c}">${c}</option>`).join('');

  const overlay = buildOverlay(`
    <h3 class="text-lg font-bold text-navy-dark">도면 업로드</h3>
    <div class="space-y-3 mt-3">
      <div>
        <label class="block text-sm font-semibold text-slate-700 mb-1">도면명 <span class="text-red-500">*</span></label>
        <input data-f="title" type="text" placeholder="예: 1층 평면도" class="${INPUT}" />
      </div>
      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="block text-sm font-semibold text-slate-700 mb-1">분류</label>
          <select data-f="category" class="${INPUT} bg-white">${categoryOptions}</select>
        </div>
        <div>
          <label class="block text-sm font-semibold text-slate-700 mb-1">버전</label>
          <input data-f="version" type="number" min="1" value="1" class="${INPUT}" />
        </div>
      </div>
      <div>
        <label class="block text-sm font-semibold text-slate-700 mb-1">변경 사유</label>
        <input data-f="changeReason" type="text" placeholder="설계변경 등 (선택)" class="${INPUT}" />
      </div>
      <div>
        <button data-act="pick" type="button" class="w-full py-4 rounded-xl border-2 border-dashed border-slate-300 text-slate-500 hover:border-navy hover:text-navy text-sm font-semibold">
          📐 도면 파일 선택 (PDF)
        </button>
        <input data-f="file" type="file" accept=".pdf,.dwg,application/pdf" hidden />
        <div data-filename class="text-xs text-slate-500 mt-1.5"></div>
      </div>
    </div>
    <div class="mt-5 flex gap-2 justify-end">
      <button data-act="cancel" class="px-4 py-2 rounded-lg text-sm font-medium text-slate-500 hover:bg-slate-100">취소</button>
      <button data-act="save" class="px-5 py-2 rounded-lg text-sm font-bold text-white bg-navy hover:bg-navy-light">업로드</button>
    </div>`);

  const q = (sel) => overlay.querySelector(sel);
  q('[data-act="pick"]').addEventListener('click', () => q('[data-f="file"]').click());
  q('[data-f="file"]').addEventListener('change', (e) => {
    file = e.target.files[0] || null;
    q('[data-filename]').textContent = file ? `선택됨: ${file.name}` : '';
  });
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.dataset.act === 'cancel') overlay.remove();
  });

  q('[data-act="save"]').addEventListener('click', async () => {
    const title = q('[data-f="title"]').value.trim();
    if (!title) { toast('도면명을 입력해 주세요.', 'warning'); return; }
    if (!file) { toast('도면 파일을 선택해 주세요.', 'warning'); return; }

    const saveBtn = q('[data-act="save"]');
    saveBtn.disabled = true;
    saveBtn.textContent = '업로드 중...';
    try {
      await createDrawing(project, user, {
        title,
        category: q('[data-f="category"]').value,
        version: q('[data-f="version"]').value,
        changeReason: q('[data-f="changeReason"]').value.trim(),
        fileName: file.name, fileSize: file.size, fileType: file.type, fileBlob: file,
      });
      toast('도면이 업로드되었습니다.', 'success');
      overlay.remove();
      if (onSaved) onSaved();
    } catch (err) {
      console.error(err);
      toast('업로드 중 오류가 발생했습니다.', 'error');
      saveBtn.disabled = false;
      saveBtn.textContent = '업로드';
    }
  });
}
