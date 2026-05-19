/**
 * projects.js — 사업 관련 헬퍼
 *
 * 접근 권한 판정, 진행률 계산, 단계 전환 로직 등 사업 도메인 로직을 모은다.
 */

import { Db } from './backend.js';
import { TOTAL_STAGES } from './stages.js';
import { PROJECT_EDITOR_ROLES } from './constants.js';

/** 사업 등록·수정·단계 전환 권한 보유 여부 */
export function canEditProjects(user) {
  return !!user && PROJECT_EDITOR_ROLES.includes(user.role);
}

function digits(value) {
  return String(value || '').replace(/\D/g, '');
}

/** 사용자가 해당 사업을 조회할 수 있는지 판정 */
export function canViewProject(user, project) {
  if (!user || !project) return false;
  if (user.role === 'system_admin' || user.role === 'national_director') return true;

  const m = project.members || {};
  const memberUids = [
    project.createdBy,
    m.officer && m.officer.uid,
    m.manager && m.manager.uid,
    m.departmentHead && m.departmentHead.uid,
    m.contractor && m.contractor.chiefUid,
    m.supervisor && m.supervisor.chiefUid,
    ...((m.contractor && m.contractor.staffUids) || []),
    ...((m.supervisor && m.supervisor.staffUids) || []),
  ].filter(Boolean);
  if (memberUids.includes(user.uid)) return true;

  // 발주처 직원은 같은 부서 사업 조회 가능
  if (['department_head', 'manager', 'officer'].includes(user.role)) {
    const dept = project.basicInfo && project.basicInfo.department;
    if (dept && user.department && dept === user.department) return true;
  }

  // 시공사·감리: 연락처가 사업 등록 정보와 일치하면 조회 가능 (가입 자동 매칭 전 단계)
  if (user.contact) {
    const myPhone = digits(user.contact);
    if (m.contractor && digits(m.contractor.chiefPhone) === myPhone) return true;
    if (m.supervisor && digits(m.supervisor.chiefPhone) === myPhone) return true;
  }

  // 외부 열람자: 승인된 사업 목록
  if (user.role === 'external_viewer') {
    return Array.isArray(user.accessibleProjects) && user.accessibleProjects.includes(project.projectId);
  }
  return false;
}

/** 사용자가 조회 가능한 사업 목록 */
export async function listAccessibleProjects(user) {
  const all = await Db.listProjects();
  return all.filter((p) => canViewProject(user, p));
}

/** 진행률(%) — 완료된 단계 수 기준 */
export function calcProgress(project) {
  if (!project || !project.stages) return 0;
  const completed = Object.values(project.stages).filter((s) => s.status === 'completed').length;
  return Math.round((completed / TOTAL_STAGES) * 100);
}

/** 현재 단계의 필수 서류가 모두 업로드되었는지 */
export function currentStageDocsComplete(project) {
  const stage = project && project.stages && project.stages[project.currentStage];
  if (!stage || !Array.isArray(stage.requiredDocs)) return false;
  return stage.requiredDocs.every((d) => d.uploaded);
}

/** 다음 단계로 전환 가능한지 (마지막 단계가 아니고 필수 서류 완비) */
export function canAdvanceStage(project) {
  return !!project && project.currentStage < TOTAL_STAGES && currentStageDocsComplete(project);
}

/**
 * 다음 단계로 전환하기 위한 patch 객체를 만든다.
 * @returns {{stages:object, currentStage:number, status?:string}}
 */
export function buildStageAdvancePatch(project, reason) {
  const now = new Date().toISOString();
  const stages = JSON.parse(JSON.stringify(project.stages));
  const cur = project.currentStage;

  stages[cur].status = 'completed';
  stages[cur].completedAt = now;
  stages[cur].transitionReason = reason || '';

  const patch = { stages, currentStage: cur };
  if (cur < TOTAL_STAGES) {
    stages[cur + 1].status = 'in_progress';
    stages[cur + 1].startedAt = now;
    patch.currentStage = cur + 1;
  }
  if (cur + 1 >= TOTAL_STAGES && stages[TOTAL_STAGES].status === 'completed') {
    patch.status = 'completed';
  }
  return patch;
}

/** 처리기한 임박 여부 — endDate 기준 D-30 이내 */
export function isDeadlineNear(project) {
  const end = project && project.basicInfo && project.basicInfo.endDate;
  if (!end) return false;
  const days = (new Date(end).getTime() - Date.now()) / 86400000;
  return days >= 0 && days <= 30;
}

/** 예산 금액을 한국식으로 표기 (예: 48억 5,000만원) */
export function formatBudget(won) {
  const n = Number(won);
  if (!n) return '0원';
  const eok = Math.floor(n / 100000000);
  const man = Math.floor((n % 100000000) / 10000);
  let s = '';
  if (eok) s += `${eok.toLocaleString()}억`;
  if (man) s += `${s ? ' ' : ''}${man.toLocaleString()}만`;
  return `${s || '0'}원`;
}

/** ISO 날짜 → YYYY.MM.DD */
export function formatDate(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '-';
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

/** 경과 일수 */
export function daysSince(iso) {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}
