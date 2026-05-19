/**
 * data-io.js — JSON 데이터 내보내기/가져오기
 *
 * 사업 단위 또는 전체 데이터를 JSON envelope 로 직렬화하고,
 * 가져오기 시 충돌 전략(덮어쓰기/건너뛰기)에 따라 병합한다.
 *
 * 목업 모드: localStorage 기반으로 완전 동작.
 * Firebase 모드: Firestore 콘솔/gcloud 사용 권장 (backend.js 참조).
 */

import { Db, nowIso } from './backend.js';

const EXPORT_VERSION = '1.1';

/** 사업 1건 내보내기 envelope 생성 */
export async function buildProjectExport(projectId, user) {
  const bundle = await Db.exportProject(projectId);
  if (!bundle) throw new Error('사업을 찾을 수 없습니다.');
  return {
    exportVersion: EXPORT_VERSION,
    exportedAt: nowIso(),
    exportedBy: { uid: user.uid, name: user.name },
    exportType: 'project',
    projectId,
    bundle,
  };
}

/** 전체 데이터 내보내기 envelope 생성 */
export async function buildFullExport(user) {
  const bundle = await Db.exportAll();
  return {
    exportVersion: EXPORT_VERSION,
    exportedAt: nowIso(),
    exportedBy: { uid: user.uid, name: user.name },
    exportType: 'full',
    projectId: null,
    bundle,
  };
}

/** envelope → 다운로드용 JSON Blob */
export function envelopeToBlob(envelope) {
  return new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' });
}

/** 파일을 읽어 JSON 으로 파싱 */
export function readJsonFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try { resolve(JSON.parse(reader.result)); }
      catch { reject(new Error('JSON 파싱에 실패했습니다.')); }
    };
    reader.onerror = () => reject(new Error('파일을 읽지 못했습니다.'));
    reader.readAsText(file);
  });
}

/** envelope 유효성 검사 + 들어올 데이터 요약 */
export function summarizeEnvelope(envelope) {
  if (!envelope || typeof envelope !== 'object') throw new Error('올바른 JSON 파일이 아닙니다.');
  if (!envelope.bundle || typeof envelope.bundle !== 'object') {
    throw new Error('CLMS 내보내기 파일 형식이 아닙니다. (bundle 누락)');
  }
  const b = envelope.bundle;
  const flat = (m) => Object.keys(m || {}).length;
  const nested = (m) => Object.values(m || {}).reduce((n, inner) => n + Object.keys(inner || {}).length, 0);
  return {
    exportType: envelope.exportType || '알 수 없음',
    exportVersion: envelope.exportVersion || '-',
    exportedAt: envelope.exportedAt || '-',
    exportedBy: (envelope.exportedBy && envelope.exportedBy.name) || '-',
    counts: {
      사용자: flat(b.users),
      사업: flat(b.projects),
      공지사항: nested(b.notices),
      협업게시글: nested(b.posts),
      댓글: nested(b.comments) + nested(b.postComments),
      가입신청: flat(b.approval_requests),
    },
  };
}

/** 가져오기 실행 → 처리 보고서 반환 */
export async function applyImport(envelope, strategy) {
  return Db.importBundle(envelope.bundle, strategy);
}
