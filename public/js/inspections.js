/**
 * inspections.js — 안전·품질 점검 도메인 헬퍼 (Phase 5-3)
 *
 * 디지털 체크리스트 점검, 3자 서명, 시정조치 폐쇄루프를 처리한다.
 * Phase 5-1 의 범용 게시글 저장소(Db.createPost 등)를 재사용한다.
 */

import { Db, nowIso } from './backend.js';
import { projectMemberUids } from './notices.js';
import { notify, notifyMany } from './notifications.js';
import { OFFICER_ROLES, CONTRACTOR_ROLES, SUPERVISOR_ROLES } from './post-types.js';

export const COLL = { inspections: 'inspections', actions: 'correctiveActions' };

/** 점검 종류별 표준 체크리스트 */
const SAFETY_CHECKLIST = [
  '가설구조물 안전성', '추락 방지시설', '개인보호구 착용', '위험기계·기구 점검',
  '화재 예방조치', '비상 대응체계', '안전 표지·신호',
];
const QUALITY_CHECKLIST = [
  '콘크리트 압축강도', '철근 배근 상태', '다짐도 시험',
  '자재 반입 검수', '시공 허용오차', '양생 관리',
];

export const INSPECTION_TYPES = {
  weekly_safety:  { label: '주간 안전점검', checklist: SAFETY_CHECKLIST },
  monthly_safety: { label: '월간 안전점검', checklist: SAFETY_CHECKLIST },
  quarterly:      { label: '분기 정밀점검', checklist: SAFETY_CHECKLIST },
  quality_test:   { label: '품질시험',     checklist: QUALITY_CHECKLIST },
};

/** 체크리스트 결과 라벨 */
export const RESULT_INFO = {
  good:              { label: '양호',   badge: 'bg-emerald-100 text-emerald-700' },
  needs_improvement: { label: '미흡',   badge: 'bg-red-100 text-red-700' },
  na:                { label: '해당없음', badge: 'bg-slate-100 text-slate-500' },
};

/** 점검 종합 결과 */
export const OVERALL_INFO = {
  pass:        { label: '적합',     badge: 'bg-emerald-100 text-emerald-700' },
  conditional: { label: '조건부적합', badge: 'bg-amber-100 text-amber-700' },
  fail:        { label: '부적합',   badge: 'bg-red-100 text-red-700' },
};

/** 시정조치 상태 */
export const CA_STATUS = {
  open:                 { label: '시정 대기',   badge: 'bg-red-100 text-red-700' },
  submitted:            { label: '시정 완료',   badge: 'bg-amber-100 text-amber-700' },
  supervisor_confirmed: { label: '감리 확인',   badge: 'bg-blue-100 text-blue-700' },
  closed:               { label: '폐쇄',        badge: 'bg-emerald-100 text-emerald-700' },
};

/** 점검 실시 권한 (시공사·감리·발주처) */
export const INSPECTOR_ROLES = [...CONTRACTOR_ROLES, ...SUPERVISOR_ROLES, ...OFFICER_ROLES];
export function canInspect(user) {
  return !!user && INSPECTOR_ROLES.includes(user.role);
}

/** 역할 → 서명 슬롯 */
export function roleSlot(role) {
  if (CONTRACTOR_ROLES.includes(role)) return 'contractor';
  if (SUPERVISOR_ROLES.includes(role)) return 'supervisor';
  if (OFFICER_ROLES.includes(role)) return 'officer';
  return null;
}
const SLOT_LABEL = { contractor: '시공사', supervisor: '감리', officer: '발주처' };
export function slotLabel(slot) { return SLOT_LABEL[slot] || slot; }

/** 서명 시 위치(GPS)를 best-effort 로 수집 */
function getGps() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: +pos.coords.latitude.toFixed(6), lng: +pos.coords.longitude.toFixed(6) }),
      () => resolve(null),
      { timeout: 4000, maximumAge: 60000 }
    );
  });
}

async function buildSignature(user, image) {
  return {
    uid: user.uid, name: user.name, role: user.role,
    signedAt: nowIso(),
    image,
    gps: await getGps(),
    device: navigator.userAgent.slice(0, 90),
  };
}

/* ============================================================
 * 점검
 * ============================================================ */

export function listInspections(projectId) {
  return Db.listPosts(projectId, COLL.inspections);
}
export function getInspection(projectId, inspectionId) {
  return Db.getPost(projectId, COLL.inspections, inspectionId);
}

/**
 * 점검을 실시(생성)한다.
 * @param draft { type, checklist:[{itemName,result,memo,photos}], signatureImage }
 */
export async function createInspection(project, inspector, draft) {
  const typeDef = INSPECTION_TYPES[draft.type];
  const failCount = draft.checklist.filter((i) => i.result === 'needs_improvement').length;
  const overallResult = failCount === 0 ? 'pass' : failCount >= 3 ? 'fail' : 'conditional';

  const checklist = draft.checklist.map((item, idx) => ({
    itemId: 'item-' + idx,
    itemName: item.itemName,
    result: item.result || 'good',
    memo: item.memo || '',
    photos: item.photos || [],
    correctiveActionId: null,
  }));

  let inspection = await Db.createPost(project.projectId, COLL.inspections, {
    type: 'inspection',
    inspectionType: draft.type,
    typeLabel: typeDef.label,
    inspectedAt: nowIso(),
    inspector: { uid: inspector.uid, name: inspector.name, role: inspector.role },
    checklist,
    overallResult,
    signatures: { contractor: null, supervisor: null, officer: null },
    createdAt: nowIso(), createdBy: inspector.uid, deletedAt: null,
  });

  // 점검자 본인 서명
  const slot = roleSlot(inspector.role);
  if (slot && draft.signatureImage) {
    const signatures = { ...inspection.signatures };
    signatures[slot] = await buildSignature(inspector, draft.signatureImage);
    inspection = await Db.updatePost(project.projectId, COLL.inspections, inspection.postId, { signatures });
  }

  // 미흡 항목 → 시정조치 자동 생성
  for (const item of checklist) {
    if (item.result === 'needs_improvement') {
      const action = await createCorrectiveAction(project, inspector, {
        inspectionId: inspection.postId,
        inspectionLabel: typeDef.label,
        itemName: item.itemName,
        issue: item.memo || item.itemName,
        issuePhotos: item.photos || [],
      });
      item.correctiveActionId = action.postId;
    }
  }
  inspection = await Db.updatePost(project.projectId, COLL.inspections, inspection.postId, { checklist });

  await notifyMany(
    projectMemberUids(project).filter((uid) => uid !== inspector.uid),
    {
      type: 'notice',
      title: `[${project.basicInfo.name}] ${typeDef.label} 실시`,
      body: `종합 결과: ${OVERALL_INFO[overallResult].label}${failCount ? ` · 미흡 ${failCount}건` : ''}`,
      link: `/inspection.html?project=${project.projectId}&id=${inspection.postId}`,
      projectId: project.projectId, targetId: inspection.postId,
    }
  );
  return inspection;
}

/** 점검에 3자 서명을 추가한다 (입회 확인). */
export async function addSignature(project, inspection, user, image) {
  const slot = roleSlot(user.role);
  if (!slot) throw new Error('서명 권한이 없는 역할입니다.');
  const signatures = { ...inspection.signatures };
  signatures[slot] = await buildSignature(user, image);
  return Db.updatePost(project.projectId, COLL.inspections, inspection.postId, { signatures });
}

export async function softDeleteInspection(project, inspection) {
  return Db.updatePost(project.projectId, COLL.inspections, inspection.postId, { deletedAt: nowIso() });
}

/* ============================================================
 * 시정조치 폐쇄루프
 * ============================================================ */

export function listCorrectiveActions(projectId) {
  return Db.listPosts(projectId, COLL.actions);
}
export function getCorrectiveAction(projectId, actionId) {
  return Db.getPost(projectId, COLL.actions, actionId);
}

export async function createCorrectiveAction(project, author, draft) {
  return Db.createPost(project.projectId, COLL.actions, {
    type: 'correctiveAction',
    inspectionId: draft.inspectionId || null,
    inspectionLabel: draft.inspectionLabel || '',
    itemName: draft.itemName || '',
    issue: draft.issue || '',
    issuePhotos: draft.issuePhotos || [],
    deadline: draft.deadline || null,
    status: 'open',
    correctionPhotos: [], correctionMemo: '', correctedAt: null,
    supervisorConfirm: null, officerConfirm: null,
    author: { uid: author.uid, name: author.name, role: author.role },
    createdAt: nowIso(), deletedAt: null,
  });
}

/** 시공사 시정 완료 제출 */
export async function submitCorrection(project, action, user, { photos, memo }) {
  const updated = await Db.updatePost(project.projectId, COLL.actions, action.postId, {
    status: 'submitted',
    correctionPhotos: photos || [],
    correctionMemo: memo || '',
    correctedAt: nowIso(),
  });
  await notifyMany(
    projectMemberUids(project).filter((u) => u !== user.uid),
    {
      type: 'notice', title: '시정조치 완료 제출 — 확인 요청',
      body: action.itemName,
      link: `/corrective-action.html?project=${project.projectId}&id=${action.postId}`,
      projectId: project.projectId, targetId: action.postId,
    }
  );
  return updated;
}

/** 감리 확인 */
export async function confirmCorrectionBySupervisor(project, action, user) {
  return Db.updatePost(project.projectId, COLL.actions, action.postId, {
    status: 'supervisor_confirmed',
    supervisorConfirm: { uid: user.uid, name: user.name, at: nowIso() },
  });
}

/** 발주처 최종 확인 → 폐쇄 */
export async function confirmCorrectionByOfficer(project, action, user) {
  const updated = await Db.updatePost(project.projectId, COLL.actions, action.postId, {
    status: 'closed',
    officerConfirm: { uid: user.uid, name: user.name, at: nowIso() },
  });
  if (action.author.uid !== user.uid) {
    await notify(action.author.uid, {
      type: 'notice', title: '시정조치 폐쇄 완료',
      body: action.itemName,
      link: `/corrective-action.html?project=${project.projectId}&id=${action.postId}`,
      projectId: project.projectId, targetId: action.postId,
    });
  }
  return updated;
}
