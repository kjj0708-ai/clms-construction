/**
 * link-renderer.js — 본문 텍스트 내 URL 자동 링크화
 *
 * - 본문 내 http(s):// 또는 www. URL 을 <a> 태그로 변환
 * - 외부 링크는 target="_blank" + rel="noopener noreferrer" (보안)
 * - 외부 링크 아이콘 표시
 * - XSS 방지를 위해 URL 외 텍스트는 모두 이스케이프
 */

const URL_RE = /(?:https?:\/\/|www\.)[^\s<>"']+/gi;

const EXTERNAL_ICON =
  '<svg class="inline-block w-3 h-3 ml-0.5 -translate-y-px opacity-60" viewBox="0 0 24 24" ' +
  'fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>' +
  '<polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>';

/** HTML 특수문자를 이스케이프한다. (XSS 방지) */
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** URL 끝에 붙은 문장부호( . , ! ? ; : ) ] } )를 떼어낸다. */
function trimTrailingPunctuation(url) {
  const match = url.match(/[.,!?;:)\]}'"]+$/);
  return match ? url.slice(0, -match[0].length) : url;
}

/**
 * 텍스트를 HTML 문자열로 변환한다.
 * URL 은 새 창으로 열리는 외부 링크로, 줄바꿈은 <br>로 처리한다.
 * @param {string} text
 * @returns {string} 안전하게 이스케이프된 HTML
 */
export function renderTextWithLinks(text) {
  const src = String(text ?? '');
  let html = '';
  let cursor = 0;

  for (const match of src.matchAll(URL_RE)) {
    const offset = match.index;
    const url = trimTrailingPunctuation(match[0]);
    if (!url) continue;

    html += escapeHtml(src.slice(cursor, offset));

    const href = /^https?:\/\//i.test(url) ? url : 'https://' + url;
    html +=
      `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" ` +
      'class="text-navy font-medium underline decoration-navy/30 hover:decoration-navy break-all">' +
      `${escapeHtml(url)}${EXTERNAL_ICON}</a>`;

    cursor = offset + url.length; // 떼어낸 문장부호는 다음 텍스트로 흘려보냄
  }
  html += escapeHtml(src.slice(cursor));

  return html.replace(/\r\n|\r|\n/g, '<br>');
}

/**
 * 컨테이너 요소의 텍스트를 링크가 적용된 HTML 로 교체한다.
 * @param {HTMLElement} el
 * @param {string} text
 */
export function renderLinkedTextInto(el, text) {
  el.innerHTML = renderTextWithLinks(text);
}

/** 외부 링크 미리보기 카드 HTML (Phase 4 게시글 externalLinks 용) */
export function renderLinkCard({ url, title, description } = {}) {
  if (!url) return '';
  const href = /^https?:\/\//i.test(url) ? url : 'https://' + url;
  let host = url;
  try { host = new URL(href).hostname; } catch { /* noop */ }
  return `
    <a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer"
       class="block border border-slate-200 rounded-lg p-3 hover:bg-slate-50 transition-colors">
      <div class="flex items-center gap-1.5 text-xs text-slate-400">${EXTERNAL_ICON}<span>${escapeHtml(host)}</span></div>
      <div class="mt-1 font-semibold text-navy-dark text-sm">${escapeHtml(title || href)}</div>
      ${description ? `<div class="mt-0.5 text-xs text-slate-500 clms-clamp-2">${escapeHtml(description)}</div>` : ''}
    </a>`;
}
