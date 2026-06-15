/**
 * projects.js — 사업(개요·진행상황) 도메인 헬퍼 · 심플 버전
 *
 * 접근 권한, 진행률(절차별 날짜 milestone 기반), 참여자, 포맷터.
 */

import { Db, genId } from './backend.js';
import { PROJECT_EDITOR_ROLES } from './constants.js';

/** 사업 등록·진행상황 관리 권한 (감독공무원 그룹) */
export function canEditProjects(user) {
  return !!user && PROJECT_EDITOR_ROLES.includes(user.role);
}

function digits(value) { return String(value || '').replace(/\D/g, ''); }

/** 사업 참여자 uid 목록 (감독공무원·시공사·감리 + 등록자) */
export function memberUids(project) {
  const m = (project && project.members) || {};
  return [
    project && project.createdBy,
    m.officer && m.officer.uid,
    m.contractor && m.contractor.uid,
    m.supervisor && m.supervisor.uid,
  ].filter(Boolean);
}

/** 사용자가 해당 사업을 조회할 수 있는지 */
export function canViewProject(user, project) {
  if (!user || !project) return false;
  if (user.role === 'system_admin' || user.role === 'national_director') return true;

  if (memberUids(project).includes(user.uid)) return true;

  // 발주처(공무원)는 같은 부서 사업 조회 가능
  if (canEditProjects(user)) {
    const dept = project.basicInfo && project.basicInfo.department;
    if (dept && user.department && dept === user.department) return true;
  }

  // 시공사·감리: 등록된 연락처가 일치하면 조회 가능 (가입 자동 매칭 전 단계)
  if (user.contact) {
    const mine = digits(user.contact);
    const m = project.members || {};
    if (m.contractor && digits(m.contractor.contact) === mine) return true;
    if (m.supervisor && digits(m.supervisor.contact) === mine) return true;
  }
  return false;
}

/** 사용자가 조회 가능한 사업 목록 */
export async function listAccessibleProjects(user) {
  const all = await Db.listProjects();
  return all.filter((p) => canViewProject(user, p));
}

/* ---- 진행상황(절차별 날짜) ---- */

/** 진행률(%) — 완료 milestone 비율 */
export function calcProgress(project) {
  const list = (project && project.progress) || [];
  if (list.length === 0) return 0;
  const done = list.filter((m) => m.status === 'done').length;
  return Math.round((done / list.length) * 100);
}

/** 날짜순 정렬된 진행 단계 */
export function sortedProgress(project) {
  return [...((project && project.progress) || [])]
    .sort((a, b) => String(a.date || '9999').localeCompare(String(b.date || '9999')));
}

/** 다음 예정/진행 단계 */
export function nextMilestone(project) {
  return sortedProgress(project).find((m) => m.status !== 'done') || null;
}

export function newMilestone({ title, date, status = 'planned', note = '' }) {
  return { id: genId('pg-'), title, date: date || '', status, note: note || '' };
}

/* ---- 포맷터 ---- */

export function formatBudget(won) {
  const n = Number(won);
  if (!n) return '-';
  const eok = Math.floor(n / 100000000);
  const man = Math.floor((n % 100000000) / 10000);
  let s = '';
  if (eok) s += `${eok.toLocaleString()}억`;
  if (man) s += `${s ? ' ' : ''}${man.toLocaleString()}만`;
  return `${s || '0'}원`;
}

/** ISO/날짜 → YYYY.MM.DD */
export function formatDate(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '-';
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

/** 남은 일수 (음수면 경과) */
export function daysUntil(value) {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / 86400000);
}
