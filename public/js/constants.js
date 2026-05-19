/** CLMS 공통 상수 — 전 모듈 공유 */

export const APP_NAME = '시설공사 통합관리시스템';
export const APP_SHORT = 'CLMS';

/**
 * 사용자 역할(Role) 정의.
 * PRD §2.1 사용자 그룹 / 작업지시서 Phase 2 role enum 기준.
 * badge 는 Tailwind 유틸 클래스(런타임 JIT로 적용됨).
 */
export const ROLES = {
  system_admin:      { label: '시스템 관리자', group: 'admin',      badge: 'bg-slate-700 text-white' },
  national_director: { label: '국장',          group: 'officer',    badge: 'bg-navy text-white' },
  department_head:   { label: '과장',          group: 'officer',    badge: 'bg-navy text-white' },
  manager:           { label: '담당자',        group: 'officer',    badge: 'bg-navy-light text-white' },
  officer:           { label: '실무 담당',     group: 'officer',    badge: 'bg-navy-light text-white' },
  contractor_chief:  { label: '현장소장',      group: 'contractor', badge: 'bg-amber-600 text-white' },
  contractor_staff:  { label: '시공사 직원',   group: 'contractor', badge: 'bg-amber-500 text-white' },
  supervisor_chief:  { label: '책임감리',      group: 'supervisor', badge: 'bg-emerald-700 text-white' },
  supervisor_staff:  { label: '보조감리',      group: 'supervisor', badge: 'bg-emerald-600 text-white' },
  external_viewer:   { label: '외부 열람자',   group: 'external',   badge: 'bg-slate-500 text-white' },
  pending:           { label: '승인 대기',     group: 'pending',    badge: 'bg-amber-400 text-navy-dark' },
};

export function roleLabel(roleKey) {
  return (ROLES[roleKey] && ROLES[roleKey].label) || '미지정';
}

export function roleBadgeClass(roleKey) {
  return (ROLES[roleKey] && ROLES[roleKey].badge) || 'bg-slate-400 text-white';
}

/** 가입 시 선택하는 사용자 유형 (PRD §2.2.2) */
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

/** 사업 유형 (PRD §3.3.1) */
export const PROJECT_TYPES = ['도로공사', '건축공사', '조경공사', '토목공사', '기타'];

/** 사업 상태 */
export const PROJECT_STATUS = {
  active: '진행 중',
  completed: '완료',
  suspended: '중단',
};

/** 사업 등록·단계 전환이 가능한 역할 (PRD §7 권한 매트릭스) */
export const PROJECT_EDITOR_ROLES = [
  'system_admin', 'national_director', 'department_head', 'manager', 'officer',
];

/** 공지사항을 작성할 수 있는 역할 (PRD §7 — 공무원) */
export const NOTICE_AUTHOR_ROLES = [
  'system_admin', 'national_director', 'department_head', 'manager', 'officer',
];

/** 게시글 중요도 */
export const NOTICE_PRIORITIES = {
  urgent:    { label: '긴급', badge: 'bg-red-100 text-red-700',     dot: 'bg-red-500' },
  important: { label: '중요', badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  normal:    { label: '일반', badge: 'bg-slate-100 text-slate-600', dot: 'bg-slate-300' },
};

/** 알림 종류 */
export const NOTIFICATION_TYPES = {
  notice:   { label: '공지사항',   icon: '📢' },
  comment:  { label: '댓글',       icon: '💬' },
  reply:    { label: '답글',       icon: '↩️' },
  approval: { label: '가입 승인',  icon: '✅' },
  stage:    { label: '단계 전환',  icon: '🏗️' },
};

/** 알림 설정 기본값 (users/{uid}.notificationSettings) */
export const DEFAULT_NOTIFICATION_SETTINGS = {
  notice: true, comment: true, reply: true, approval: true, stage: true,
  nightBlock: false,
};

/** 공정 구분 (작업일지·사진 분류) */
export const PROCESS_OPTIONS = ['토공', '구조', '마감', '설비', '조경', '가설', '기타'];

/** 도면 분류 */
export const DRAWING_CATEGORIES = ['건축', '구조', '설비', '토목', '조경', '기타'];
