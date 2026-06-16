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
  project_manager:   { label: '사업관리자',    group: 'officer',    badge: 'bg-purple-600 text-white' },
  manager:           { label: '감독공무원(팀장)', group: 'officer',  badge: 'bg-navy-light text-white' },
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
  service:     '용역사',
  other:       '기타',
};

/** 계정 상태 */
export const USER_STATUS = {
  pending:  '승인 대기',
  active:   '활성',
  inactive: '비활성',
};

/** 사업 구분 */
export const PROJECT_CATEGORY = {
  공사: '공사',
  용역: '용역',
};

/** 사업 유형 (공사) */
export const PROJECT_TYPES_공사 = ['도로공사', '건축공사', '조경공사', '토목공사', '상하수도', '기타공사'];

/** 사업 유형 (용역) */
export const PROJECT_TYPES_용역 = ['설계용역', '감리용역', '측량용역', '조사용역', '연구용역', '기타용역'];

/** 사업 유형 전체 목록 (하위 호환) */
export const PROJECT_TYPES = [...PROJECT_TYPES_공사, ...PROJECT_TYPES_용역];

/** 해당 사업 유형이 용역인지 여부 */
export function isServiceType(type) {
  return PROJECT_TYPES_용역.includes(type);
}

/** 사업 상태 */
export const PROJECT_STATUS = {
  active:    { label: '진행 중', badge: 'bg-blue-100 text-blue-700' },
  completed: { label: '완료',    badge: 'bg-emerald-100 text-emerald-700' },
  suspended: { label: '중단',    badge: 'bg-slate-200 text-slate-600' },
};

/** 사업 등록·진행상황 관리 권한 (팀장 및 주무관만) */
export const PROJECT_EDITOR_ROLES = [
  'system_admin', 'project_manager', 'manager', 'officer',
];

/* ============================================================
 * 진행상황(절차별 날짜) — 핵심 1
 * ============================================================ */

export const PROGRESS_STATUS = {
  planned:     { label: '예정',   badge: 'bg-slate-100 text-slate-500', dot: 'bg-slate-300' },
  in_progress: { label: '진행 중', badge: 'bg-blue-100 text-blue-700',   dot: 'bg-blue-500' },
  done:        { label: '완료',   badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
};

/** 표준 단계 템플릿 — 공사 (12단계) */
export const STAGE_TEMPLATE_공사 = [
  '예산편성', '설계용역', '일상감사', '품의', '발주공고', '입찰·낙찰',
  '계약', '착공', '시공', '준공검사', '준공·정산', '하자보수',
];

/** 표준 단계 템플릿 — 용역 (9단계, 착수~준공) */
export const STAGE_TEMPLATE_용역 = [
  '예산편성', '일상감사', '품의', '발주공고', '입찰·낙찰',
  '계약', '착수', '용역수행', '준공',
];

/** 사업 유형에 맞는 표준 단계 템플릿 반환 */
export function getStageTemplate(type) {
  return isServiceType(type) ? STAGE_TEMPLATE_용역 : STAGE_TEMPLATE_공사;
}

/** 하위 호환용 기본 템플릿 (공사) */
export const STAGE_TEMPLATE = STAGE_TEMPLATE_공사;

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
  qna: {
    key: 'qna', label: '질의응답', icon: '❓',
    desc: '시공사·감리 질의 / 발주처 답변',
    post: 'all',               // 작성 가능: 모든 참여자
    badge: 'bg-amber-500 text-white',
  },
  report: {
    key: 'report', label: '작업일보', icon: '📋',
    desc: '발주처·시공사·감리 작업 보고',
    post: 'all',
    badge: 'bg-emerald-700 text-white',
  },
};
export const CATEGORY_ORDER = ['qna', 'report'];
