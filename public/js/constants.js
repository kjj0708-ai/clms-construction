/** CLMS 공통 상수 — 전 모듈 공유 (심플 버전) */

export const APP_NAME = '공사관리시스템';
export const APP_SHORT = 'CMS';

/**
 * 사용자 역할(Role) 정의.
 * 인증·승인 흐름은 유지하되, 실무에서는 공무원/시공사/감리 3그룹이 핵심.
 */
export const ROLES = {
  system_admin:      { label: '시스템 관리자', group: 'admin',      badge: 'bg-slate-700 text-white' },
  national_director: { label: '국장',          group: 'officer',    badge: 'bg-navy text-white' },
  department_head:   { label: '과장',          group: 'officer',    badge: 'bg-navy text-white' },
  manager:           { label: '감독공무원',    group: 'officer',    badge: 'bg-navy-light text-white' },
  officer:           { label: '감독공무원',    group: 'officer',    badge: 'bg-navy-light text-white' },
  contractor_chief:  { label: '시공사(현장소장)', group: 'contractor', badge: 'bg-amber-600 text-white' },
  contractor_staff:  { label: '시공사',        group: 'contractor', badge: 'bg-amber-500 text-white' },
  supervisor_chief:  { label: '책임감리',      group: 'supervisor', badge: 'bg-emerald-700 text-white' },
  supervisor_staff:  { label: '감리',          group: 'supervisor', badge: 'bg-emerald-600 text-white' },
  external_viewer:   { label: '열람자',        group: 'external',   badge: 'bg-slate-500 text-white' },
  pending:           { label: '승인 대기',     group: 'pending',    badge: 'bg-amber-400 text-navy-dark' },
};

export function roleLabel(roleKey) {
  return (ROLES[roleKey] && ROLES[roleKey].label) || '미지정';
}
export function roleBadgeClass(roleKey) {
  return (ROLES[roleKey] && ROLES[roleKey].badge) || 'bg-slate-400 text-white';
}
export function roleGroup(roleKey) {
  return (ROLES[roleKey] && ROLES[roleKey].group) || 'officer';
}

/** 가입 시 선택하는 사용자 유형 */
export const USER_TYPES = {
  officer:     '공무원',
  contractor:  '시공사',
  supervisor:  '감리',
  other:       '기타',
};

/** 계정 상태 */
export const USER_STATUS = {
  pending:  '승인 대기',
  active:   '활성',
  inactive: '비활성',
};

/** 사업 유형 */
export const PROJECT_TYPES = ['도로공사', '건축공사', '조경공사', '토목공사', '상하수도', '기타'];

/** 사업 상태 */
export const PROJECT_STATUS = {
  active:    { label: '진행 중', badge: 'bg-blue-100 text-blue-700' },
  completed: { label: '완료',    badge: 'bg-emerald-100 text-emerald-700' },
  suspended: { label: '중단',    badge: 'bg-slate-200 text-slate-600' },
};

/** 사업 등록·진행상황 관리 권한 (감독공무원 그룹) */
export const PROJECT_EDITOR_ROLES = [
  'system_admin', 'national_director', 'department_head', 'manager', 'officer',
];

/* ============================================================
 * 진행상황(절차별 날짜) — 핵심 1
 * ============================================================ */

export const PROGRESS_STATUS = {
  planned:     { label: '예정',   badge: 'bg-slate-100 text-slate-500', dot: 'bg-slate-300' },
  in_progress: { label: '진행 중', badge: 'bg-blue-100 text-blue-700',   dot: 'bg-blue-500' },
  done:        { label: '완료',   badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
};

/** 표준 12단계 템플릿 (진행상황 일괄 추가용 — 날짜는 비워둠) */
export const STAGE_TEMPLATE = [
  '예산편성', '설계용역', '일상감사', '품의', '발주공고', '입찰·낙찰',
  '계약', '착공', '시공', '준공검사', '준공·정산', '하자보수',
];

/* ============================================================
 * 3자 소통 — 핵심 2 (공지 · 질의 · 지시)
 * ============================================================ */

export const COMMUNICATION_CATEGORIES = {
  notice: {
    key: 'notice', label: '공지', icon: '📢',
    desc: '발주처 공지사항',
    post: 'officer',            // 작성 가능: 감독공무원
    badge: 'bg-navy text-white',
  },
  inquiry: {
    key: 'inquiry', label: '질의', icon: '❓',
    desc: '시공사·감리 질의 / 발주처 답변',
    post: 'all',               // 작성 가능: 모든 참여자
    badge: 'bg-amber-500 text-white',
  },
  instruction: {
    key: 'instruction', label: '지시', icon: '📋',
    desc: '발주처 지시사항',
    post: 'officer',           // 작성 가능: 감독공무원
    badge: 'bg-emerald-700 text-white',
  },
};
export const CATEGORY_ORDER = ['notice', 'inquiry', 'instruction'];
