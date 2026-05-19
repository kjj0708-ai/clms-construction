/**
 * signature-pad.js — 캔버스 기반 디지털 서명 패드
 *
 * openSignaturePad() 를 호출하면 서명 모달이 열리고,
 * 서명 완료 시 PNG data URL 을, 취소 시 null 을 반환한다.
 */

import { escapeHtml } from './link-renderer.js';
import { toast } from './layout.js';

/**
 * 서명 패드 모달을 연다.
 * @param {{ title?: string }} [opts]
 * @returns {Promise<string|null>} 서명 이미지 data URL 또는 null(취소)
 */
export function openSignaturePad({ title = '디지털 서명' } = {}) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4';
    overlay.innerHTML = `
      <div class="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 clms-fade-in">
        <h3 class="font-bold text-navy-dark">${escapeHtml(title)}</h3>
        <p class="text-xs text-slate-400 mt-0.5">아래 영역에 손가락 또는 마우스로 서명해 주세요.</p>
        <canvas data-pad width="600" height="220"
          class="w-full mt-3 border-2 border-dashed border-slate-300 rounded-lg bg-white" style="touch-action:none;"></canvas>
        <div class="mt-3 flex gap-2">
          <button data-act="clear" class="flex-1 py-2.5 rounded-xl font-medium text-slate-500 bg-slate-100 hover:bg-slate-200">지우기</button>
          <button data-act="cancel" class="flex-1 py-2.5 rounded-xl font-medium text-slate-500 bg-slate-100 hover:bg-slate-200">취소</button>
          <button data-act="ok" class="flex-[1.4] py-2.5 rounded-xl font-bold text-white bg-navy hover:bg-navy-light">서명 완료</button>
        </div>
      </div>`;

    const canvas = overlay.querySelector('[data-pad]');
    const ctx = canvas.getContext('2d');
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1a3a5c';

    let drawing = false;
    let hasInk = false;
    let last = null;

    function pointAt(e) {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left) * (canvas.width / rect.width),
        y: (e.clientY - rect.top) * (canvas.height / rect.height),
      };
    }
    canvas.addEventListener('pointerdown', (e) => {
      drawing = true;
      last = pointAt(e);
      try { canvas.setPointerCapture(e.pointerId); } catch { /* noop */ }
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!drawing) return;
      const p = pointAt(e);
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      last = p;
      hasInk = true;
    });
    const stop = () => { drawing = false; };
    canvas.addEventListener('pointerup', stop);
    canvas.addEventListener('pointercancel', stop);
    canvas.addEventListener('pointerleave', stop);

    function close(result) {
      overlay.remove();
      resolve(result);
    }

    overlay.addEventListener('click', (e) => {
      const act = e.target.dataset.act;
      if (e.target === overlay || act === 'cancel') { close(null); return; }
      if (act === 'clear') {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        hasInk = false;
        return;
      }
      if (act === 'ok') {
        if (!hasInk) { toast('서명을 입력해 주세요.', 'warning'); return; }
        const out = document.createElement('canvas');
        out.width = canvas.width;
        out.height = canvas.height;
        const octx = out.getContext('2d');
        octx.fillStyle = '#ffffff';
        octx.fillRect(0, 0, out.width, out.height);
        octx.drawImage(canvas, 0, 0);
        close(out.toDataURL('image/png'));
      }
    });

    document.body.appendChild(overlay);
  });
}
