/**
 * inspection-composer.js — 점검 실시(디지털 체크리스트) 모달
 *
 * 점검 종류를 선택하면 표준 체크리스트가 표시되고,
 * 항목별 결과(양호/미흡/해당없음)와 점검자 서명을 입력해 점검을 생성한다.
 */

import { escapeHtml } from './link-renderer.js';
import { toast } from './layout.js';
import { openSignaturePad } from './signature-pad.js';
import { INSPECTION_TYPES, createInspection } from '../inspections.js';

const RESULTS = [
  { key: 'good', label: '양호', on: 'bg-emerald-500 text-white' },
  { key: 'needs_improvement', label: '미흡', on: 'bg-red-500 text-white' },
  { key: 'na', label: '해당없음', on: 'bg-slate-400 text-white' },
];

/**
 * 점검 실시 모달을 연다.
 * @param {{ project, user, onSaved }} opts
 */
export function openInspectionComposer({ project, user, onSaved }) {
  let typeKey = 'weekly_safety';
  const state = {};      // { [idx]: { result, memo } }
  let signatureImage = null;

  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4';
  overlay.innerHTML = `
    <div class="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 clms-fade-in max-h-[92vh] overflow-y-auto">
      <h3 class="text-lg font-bold text-navy-dark">🦺 점검 실시</h3>
      <div class="mt-3">
        <label class="block text-sm font-semibold text-slate-700 mb-1">점검 종류</label>
        <select data-f="type" class="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy/30">
          ${Object.entries(INSPECTION_TYPES).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('')}
        </select>
      </div>
      <div class="mt-3">
        <div class="text-sm font-semibold text-slate-700 mb-1.5">점검 항목</div>
        <div data-checklist class="space-y-2"></div>
      </div>
      <div class="mt-4 border-t border-slate-100 pt-3">
        <div class="text-sm font-semibold text-slate-700 mb-1.5">점검자 서명 <span class="text-red-500">*</span></div>
        <div class="flex items-center gap-3">
          <button data-act="sign" type="button" class="px-4 py-2 rounded-lg bg-slate-100 text-navy text-sm font-semibold hover:bg-slate-200">서명하기</button>
          <span data-sign-status class="text-xs text-slate-400">미서명</span>
        </div>
      </div>
      <div class="mt-5 flex gap-2 justify-end">
        <button data-act="cancel" class="px-4 py-2 rounded-lg text-sm font-medium text-slate-500 hover:bg-slate-100">취소</button>
        <button data-act="save" class="px-5 py-2 rounded-lg text-sm font-bold text-white bg-navy hover:bg-navy-light">점검 등록</button>
      </div>
    </div>`;

  const checklistEl = overlay.querySelector('[data-checklist]');
  const typeSelect = overlay.querySelector('[data-f="type"]');

  function renderChecklist() {
    const items = INSPECTION_TYPES[typeKey].checklist;
    Object.keys(state).forEach((k) => delete state[k]);
    checklistEl.innerHTML = items.map((name, idx) => {
      state[idx] = { result: 'good', memo: '' };
      return `
        <div class="border border-slate-100 rounded-lg p-2.5" data-item="${idx}">
          <div class="text-sm font-medium text-slate-700">${idx + 1}. ${escapeHtml(name)}</div>
          <div class="flex gap-1 mt-1.5">
            ${RESULTS.map((r) => `
              <button type="button" data-result="${r.key}"
                class="flex-1 py-1.5 rounded-md text-xs font-semibold ${r.key === 'good' ? r.on : 'bg-slate-100 text-slate-500'}">${r.label}</button>`).join('')}
          </div>
          <textarea data-memo rows="2" placeholder="미흡 사항 메모 (시정조치로 자동 등록됩니다)" hidden
            class="w-full mt-2 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs resize-y focus:outline-none focus:ring-2 focus:ring-navy/30"></textarea>
        </div>`;
    }).join('');
  }
  renderChecklist();

  typeSelect.addEventListener('change', () => { typeKey = typeSelect.value; renderChecklist(); });

  checklistEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-result]');
    if (!btn) return;
    const itemEl = btn.closest('[data-item]');
    const idx = Number(itemEl.dataset.item);
    const result = btn.dataset.result;
    state[idx].result = result;
    // 버튼 하이라이트
    itemEl.querySelectorAll('[data-result]').forEach((b) => {
      const def = RESULTS.find((r) => r.key === b.dataset.result);
      const on = b.dataset.result === result;
      b.className = `flex-1 py-1.5 rounded-md text-xs font-semibold ${on ? def.on : 'bg-slate-100 text-slate-500'}`;
    });
    // 미흡 시 메모 표시
    const memo = itemEl.querySelector('[data-memo]');
    memo.hidden = result !== 'needs_improvement';
  });

  overlay.querySelector('[data-act="sign"]').addEventListener('click', async () => {
    const image = await openSignaturePad({ title: '점검자 서명' });
    if (image) {
      signatureImage = image;
      overlay.querySelector('[data-sign-status]').textContent = '서명 완료 ✓';
      overlay.querySelector('[data-sign-status]').className = 'text-xs font-semibold text-emerald-600';
    }
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.dataset.act === 'cancel') overlay.remove();
  });

  overlay.querySelector('[data-act="save"]').addEventListener('click', async () => {
    if (!signatureImage) { toast('점검자 서명을 입력해 주세요.', 'warning'); return; }
    const items = INSPECTION_TYPES[typeKey].checklist;
    const checklist = items.map((name, idx) => {
      const itemEl = checklistEl.querySelector(`[data-item="${idx}"]`);
      return {
        itemName: name,
        result: state[idx].result,
        memo: itemEl.querySelector('[data-memo]').value.trim(),
        photos: [],
      };
    });
    const missingMemo = checklist.find((i) => i.result === 'needs_improvement' && !i.memo);
    if (missingMemo) {
      toast(`'${missingMemo.itemName}' 미흡 사항 메모를 입력해 주세요.`, 'warning');
      return;
    }

    const saveBtn = overlay.querySelector('[data-act="save"]');
    saveBtn.disabled = true;
    saveBtn.textContent = '등록 중...';
    try {
      const inspection = await createInspection(project, user, { type: typeKey, checklist, signatureImage });
      const failCount = checklist.filter((i) => i.result === 'needs_improvement').length;
      toast(`점검이 등록되었습니다.${failCount ? ` 미흡 ${failCount}건은 시정조치로 등록되었습니다.` : ''}`, 'success');
      overlay.remove();
      if (onSaved) onSaved(inspection);
    } catch (err) {
      console.error(err);
      toast('점검 등록 중 오류가 발생했습니다.', 'error');
      saveBtn.disabled = false;
      saveBtn.textContent = '점검 등록';
    }
  });

  document.body.appendChild(overlay);
}
