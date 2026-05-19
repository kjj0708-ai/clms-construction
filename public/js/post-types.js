/**
 * post-types.js — 협업 게시판 게시글 유형 정의 (Phase 5-1)
 *
 * 공사지시서·질의응답·회의록·설계변경을 하나의 공통 게시글 모델로 다룬다.
 * 각 유형은 컬렉션명, 작성 권한, 유형별 추가 필드, 상태 흐름을 갖는다.
 */

import { PROJECT_EDITOR_ROLES } from './constants.js';

/** 발주처(공무원) 역할 */
export const OFFICER_ROLES = PROJECT_EDITOR_ROLES;
/** 시공사 역할 */
export const CONTRACTOR_ROLES = ['contractor_chief', 'contractor_staff'];
/** 감리 역할 */
export const SUPERVISOR_ROLES = ['supervisor_chief', 'supervisor_staff'];

export const POST_TYPES = {
  instruction: {
    key: 'instruction', collection: 'instructions',
    label: '공사지시서', icon: '📋', titleLabel: '지시 제목',
    authorRoles: OFFICER_ROLES,
    extraFields: [
      { key: 'deadline', label: '이행 기한', type: 'date', required: true },
    ],
    initialStatus: 'issued',
    statuses: {
      issued:       { label: '발행',     badge: 'bg-blue-100 text-blue-700' },
      acknowledged: { label: '수신확인', badge: 'bg-amber-100 text-amber-700' },
      completed:    { label: '이행완료', badge: 'bg-emerald-100 text-emerald-700' },
    },
    transitions: [
      { from: 'issued',       to: 'acknowledged', label: '수신 확인',      roles: CONTRACTOR_ROLES },
      { from: 'acknowledged', to: 'completed',    label: '이행 완료 보고', roles: CONTRACTOR_ROLES },
    ],
  },

  inquiry: {
    key: 'inquiry', collection: 'inquiries',
    label: '질의응답', icon: '❓', titleLabel: '질의 제목',
    authorRoles: [...CONTRACTOR_ROLES, ...SUPERVISOR_ROLES, 'system_admin'],
    extraFields: [
      { key: 'category', label: '분류', type: 'select', options: ['설계해석', '시공방법', '자재', '기타'], required: true },
    ],
    initialStatus: 'open',
    statuses: {
      open:     { label: '답변대기', badge: 'bg-amber-100 text-amber-700' },
      answered: { label: '답변완료', badge: 'bg-blue-100 text-blue-700' },
      closed:   { label: '종결',     badge: 'bg-slate-200 text-slate-600' },
    },
    transitions: [
      { from: 'open',     to: 'answered', label: '답변 완료 처리', roles: OFFICER_ROLES },
      { from: 'answered', to: 'closed',   label: '종결',          roles: [...OFFICER_ROLES, 'author'] },
    ],
  },

  meeting: {
    key: 'meeting', collection: 'meetings',
    label: '회의록', icon: '📝', titleLabel: '회의명',
    authorRoles: OFFICER_ROLES,
    extraFields: [
      { key: 'meetingDate', label: '회의 일시', type: 'datetime-local', required: true },
      { key: 'location', label: '장소', type: 'text' },
    ],
    initialStatus: 'recorded',
    statuses: {
      recorded:  { label: '기록', badge: 'bg-blue-100 text-blue-700' },
      confirmed: { label: '확정', badge: 'bg-emerald-100 text-emerald-700' },
    },
    transitions: [
      { from: 'recorded', to: 'confirmed', label: '회의록 확정', roles: [...OFFICER_ROLES, 'author'] },
    ],
  },

  change: {
    key: 'change', collection: 'changeRequests',
    label: '설계변경', icon: '🔧', titleLabel: '변경 제목',
    authorRoles: [...CONTRACTOR_ROLES, 'system_admin'],
    extraFields: [
      { key: 'reason', label: '변경 사유', type: 'textarea', required: true },
      { key: 'costImpact', label: '공사비 증감(원)', type: 'number' },
      { key: 'scheduleImpact', label: '공기 증감(일)', type: 'number' },
    ],
    initialStatus: 'requested',
    statuses: {
      requested: { label: '요청',   badge: 'bg-amber-100 text-amber-700' },
      reviewing: { label: '검토중', badge: 'bg-blue-100 text-blue-700' },
      approved:  { label: '승인',   badge: 'bg-emerald-100 text-emerald-700' },
      rejected:  { label: '반려',   badge: 'bg-red-100 text-red-700' },
    },
    transitions: [
      { from: 'requested', to: 'reviewing', label: '검토 시작', roles: [...SUPERVISOR_ROLES, ...OFFICER_ROLES] },
      { from: 'reviewing', to: 'approved',  label: '승인',      roles: OFFICER_ROLES },
      { from: 'reviewing', to: 'rejected',  label: '반려',      roles: OFFICER_ROLES },
    ],
  },
};

/** 협업 탭에 노출되는 순서 */
export const POST_TYPE_ORDER = ['instruction', 'inquiry', 'change', 'meeting'];

export function getPostType(key) {
  return POST_TYPES[key] || null;
}

export function statusInfo(typeKey, status) {
  const t = POST_TYPES[typeKey];
  return (t && t.statuses[status]) || { label: status || '-', badge: 'bg-slate-100 text-slate-600' };
}
