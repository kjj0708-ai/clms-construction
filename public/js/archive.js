/**
 * archive.js — 현장 아카이브 (작업일지·사진·도면) 도메인 헬퍼
 *
 * Phase 5-1 의 범용 게시글 저장소(Db.createPost 등)를 재사용하여
 * dailyLogs / photos / drawings 컬렉션을 다룬다.
 */

import { Db, Storage, isMock, genId, nowIso } from './backend.js';
import { compressImage } from './components/image-compressor.js';
import { resolveDraftImages, projectMemberUids } from './notices.js';
import { notify, notifyMany } from './notifications.js';
import { OFFICER_ROLES, CONTRACTOR_ROLES, SUPERVISOR_ROLES } from './post-types.js';

export const COLL = { logs: 'dailyLogs', photos: 'photos', drawings: 'drawings' };

/** 권한 */
export const DAILY_LOG_AUTHOR_ROLES = [...CONTRACTOR_ROLES, 'system_admin'];
export const DAILY_LOG_CONFIRM_ROLES = [...SUPERVISOR_ROLES, 'system_admin'];
export const PHOTO_UPLOAD_ROLES = [...CONTRACTOR_ROLES, ...SUPERVISOR_ROLES, ...OFFICER_ROLES];
export const DRAWING_UPLOAD_ROLES = [...OFFICER_ROLES, ...SUPERVISOR_ROLES];

export function canWriteDailyLog(user) { return !!user && DAILY_LOG_AUTHOR_ROLES.includes(user.role); }
export function canConfirmDailyLog(user) { return !!user && DAILY_LOG_CONFIRM_ROLES.includes(user.role); }
export function canUploadPhoto(user) { return !!user && PHOTO_UPLOAD_ROLES.includes(user.role); }
export function canUploadDrawing(user) { return !!user && DRAWING_UPLOAD_ROLES.includes(user.role); }

function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ============================================================
 * 작업일지
 * ============================================================ */

export async function createDailyLog(project, author, draft) {
  const log = await Db.createPost(project.projectId, COLL.logs, {
    type: 'dailyLog',
    date: draft.date,
    weather: draft.weather || '',
    process: draft.process || '',
    workContent: draft.workContent || '',
    workforce: Number(draft.workforce) || 0,
    equipment: draft.equipment || '',
    materials: draft.materials || '',
    progress: Number(draft.progress) || 0,
    safetyNotes: draft.safetyNotes || '',
    images: draft.images || [],
    author: { uid: author.uid, name: author.name, role: author.role },
    supervisorConfirm: null,
    readBy: { [author.uid]: nowIso() },
    commentCount: 0,
    createdAt: nowIso(), updatedAt: null, deletedAt: null, revisions: [],
  });
  await notifyMany(
    projectMemberUids(project).filter((uid) => uid !== author.uid),
    {
      type: 'notice',
      title: `[${project.basicInfo.name}] 작업일지 (${draft.date})`,
      body: (draft.workContent || '').slice(0, 100),
      link: `/daily-log.html?project=${project.projectId}&id=${log.postId}`,
      projectId: project.projectId, targetId: log.postId,
    }
  );
  return log;
}

export function listDailyLogs(projectId) {
  return Db.listPosts(projectId, COLL.logs);
}
export function getDailyLog(projectId, logId) {
  return Db.getPost(projectId, COLL.logs, logId);
}
export async function updateDailyLog(project, log, draft, editor) {
  const revision = {
    revisionId: genId('rev-'), editedAt: nowIso(), editedBy: editor.uid,
    previousContent: log.workContent,
  };
  return Db.updatePost(project.projectId, COLL.logs, log.postId, {
    weather: draft.weather, process: draft.process, workContent: draft.workContent,
    workforce: Number(draft.workforce) || 0, equipment: draft.equipment,
    materials: draft.materials, progress: Number(draft.progress) || 0,
    safetyNotes: draft.safetyNotes, images: draft.images || log.images,
    updatedAt: nowIso(), revisions: [...(log.revisions || []), revision],
  });
}
export async function softDeleteDailyLog(project, log) {
  return Db.updatePost(project.projectId, COLL.logs, log.postId, { deletedAt: nowIso() });
}

/** 감리 일일 확인 서명 */
export async function confirmDailyLog(project, log, supervisor, opinion) {
  const updated = await Db.updatePost(project.projectId, COLL.logs, log.postId, {
    supervisorConfirm: { uid: supervisor.uid, name: supervisor.name, at: nowIso(), opinion: opinion || '' },
  });
  if (log.author.uid !== supervisor.uid) {
    await notify(log.author.uid, {
      type: 'notice',
      title: `작업일지 감리 확인 완료 (${log.date})`,
      body: `${supervisor.name} 감리원이 확인했습니다.`,
      link: `/daily-log.html?project=${project.projectId}&id=${log.postId}`,
      projectId: project.projectId, targetId: log.postId,
    });
  }
  return updated;
}

/** 목업용 가상 날씨 (실제 운영 시 기상청 단기예보 API 연동) */
export function mockWeather() {
  const conditions = ['맑음', '구름 조금', '흐림', '비', '눈'];
  const c = conditions[Math.floor(Math.random() * conditions.length)];
  const temp = Math.round(5 + Math.random() * 22);
  return `${c}, ${temp}°C`;
}

/* ============================================================
 * 현장 사진
 * ============================================================ */

/** 이미지에 워터마크(사업명·일시)를 새긴다. */
export function watermarkImage(blob, lines) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      const pad = Math.round(canvas.width * 0.022);
      const fontSize = Math.max(13, Math.round(canvas.width * 0.026));
      ctx.font = `bold ${fontSize}px Pretendard, sans-serif`;
      const lineH = fontSize + 6;
      const barH = lineH * lines.length + pad;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, canvas.height - barH, canvas.width, barH);
      ctx.fillStyle = '#ffffff';
      ctx.textBaseline = 'top';
      lines.forEach((line, i) => {
        ctx.fillText(line, pad, canvas.height - barH + pad / 2 + i * lineH);
      });
      canvas.toBlob((out) => {
        URL.revokeObjectURL(url);
        resolve(out || blob);
      }, 'image/jpeg', 0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(blob); };
    img.src = url;
  });
}

/** 사진 1장을 압축·워터마크 처리하여 저장 가능한 이미지 객체로 만든다. */
export async function preparePhoto(file, project) {
  const { compressedFile, thumbnail, metadata } = await compressImage(file);
  const wmText = [
    project.basicInfo.name,
    new Date(metadata.capturedAt || Date.now()).toLocaleString('ko-KR'),
  ];
  if (metadata.gps) wmText.push(`GPS ${metadata.gps.lat}, ${metadata.gps.lng}`);
  const watermarked = await watermarkImage(compressedFile, wmText);

  const id = genId('photo-');
  let url, thumbnailUrl;
  if (isMock) {
    url = await fileToDataURL(watermarked);
    thumbnailUrl = await fileToDataURL(thumbnail);
  } else {
    const main = await Storage.uploadFile(`projects/${project.projectId}/photos/${id}.jpg`, watermarked);
    const thumb = await Storage.uploadFile(`projects/${project.projectId}/photos/${id}_thumb.jpg`, thumbnail);
    url = main.url;
    thumbnailUrl = thumb.url;
  }
  return {
    id, url, thumbnailUrl,
    width: metadata.width, height: metadata.height,
    capturedAt: metadata.capturedAt, gps: metadata.gps || null,
  };
}

export async function createPhoto(project, author, photoData) {
  const photo = await Db.createPost(project.projectId, COLL.photos, {
    type: 'photo',
    image: photoData.image,
    process: photoData.process || '',
    locationDesc: photoData.locationDesc || '',
    description: photoData.description || '',
    capturedAt: photoData.image.capturedAt || nowIso(),
    gps: photoData.image.gps || null,
    tags: photoData.tags || [],
    watermarked: true,
    author: { uid: author.uid, name: author.name, role: author.role },
    createdAt: nowIso(), deletedAt: null,
  });
  return photo;
}

export function listPhotos(projectId) {
  return Db.listPosts(projectId, COLL.photos);
}
export async function softDeletePhoto(project, photo) {
  return Db.updatePost(project.projectId, COLL.photos, photo.postId, { deletedAt: nowIso() });
}

/* ============================================================
 * 도면
 * ============================================================ */

/** 도면 파일을 업로드한다. (목업 모드는 메타데이터만 보관) */
export async function createDrawing(project, author, draft) {
  let file = { name: draft.fileName, size: draft.fileSize, type: draft.fileType, url: null };
  if (!isMock && draft.fileBlob) {
    const up = await Storage.uploadFile(
      `projects/${project.projectId}/drawings/${genId('dwg-')}_${draft.fileName}`, draft.fileBlob);
    file = up;
  }
  const drawing = await Db.createPost(project.projectId, COLL.drawings, {
    type: 'drawing',
    title: draft.title,
    category: draft.category,
    version: Number(draft.version) || 1,
    changeReason: draft.changeReason || '',
    file,
    author: { uid: author.uid, name: author.name, role: author.role },
    createdAt: nowIso(), deletedAt: null,
  });
  await notifyMany(
    projectMemberUids(project).filter((uid) => uid !== author.uid),
    {
      type: 'notice',
      title: `[${project.basicInfo.name}] 도면 등록: ${draft.title}`,
      body: `${draft.category} · v${draft.version}`,
      link: `/project-detail.html?id=${project.projectId}`,
      projectId: project.projectId, targetId: drawing.postId,
    }
  );
  return drawing;
}

export function listDrawings(projectId) {
  return Db.listPosts(projectId, COLL.drawings);
}
export async function softDeleteDrawing(project, drawing) {
  return Db.updatePost(project.projectId, COLL.drawings, drawing.postId, { deletedAt: nowIso() });
}

export { resolveDraftImages };
