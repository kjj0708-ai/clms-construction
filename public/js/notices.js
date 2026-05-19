/**
 * notices.js — 공지사항·댓글 도메인 헬퍼
 *
 * 게시글/댓글 생성·수정·삭제와 이미지 처리, 알림 fan-out 을 담당한다.
 * 모든 게시글 모듈(공지·지시·질의 등)에서 재사용 가능한 형태를 지향한다.
 */

import { Db, Storage, isMock, genId, nowIso } from './backend.js';
import { compressImage } from './components/image-compressor.js';
import { notify, notifyMany } from './notifications.js';

/* ---- 이미지 처리 ---- */

function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * 첨부 이미지 1장을 압축하고 표시 가능한 이미지 객체로 변환한다.
 * 목업 모드 → data URL, Firebase 모드 → Storage 업로드 URL.
 */
export async function prepareImage(file, pathPrefix) {
  const { compressedFile, thumbnail, metadata } = await compressImage(file);
  const id = genId('img-');
  let url, thumbnailUrl;
  if (isMock) {
    url = await fileToDataURL(compressedFile);
    thumbnailUrl = await fileToDataURL(thumbnail);
  } else {
    const main = await Storage.uploadFile(`${pathPrefix}/${id}.jpg`, compressedFile);
    const thumb = await Storage.uploadFile(`${pathPrefix}/${id}_thumb.jpg`, thumbnail);
    url = main.url;
    thumbnailUrl = thumb.url;
  }
  return {
    id, url, thumbnailUrl,
    originalSize: metadata.originalSize, resizedSize: metadata.resizedSize,
    width: metadata.width, height: metadata.height,
    capturedAt: metadata.capturedAt, description: '',
  };
}

/** draft.images 의 항목 중 새 파일(_file)은 압축·저장하고, 기존 항목은 유지 */
export async function resolveDraftImages(images, pathPrefix) {
  const out = [];
  for (const img of images || []) {
    if (img && img.file instanceof File) {
      out.push(await prepareImage(img.file, pathPrefix));
    } else if (img && img.url) {
      out.push(img);
    }
  }
  return out;
}

/* ---- 참여자 ---- */

/** 사업 참여자 uid 목록 */
export function projectMemberUids(project) {
  const m = (project && project.members) || {};
  return [...new Set([
    project && project.createdBy,
    m.officer && m.officer.uid,
    m.manager && m.manager.uid,
    m.departmentHead && m.departmentHead.uid,
    m.contractor && m.contractor.chiefUid,
    m.supervisor && m.supervisor.chiefUid,
    ...((m.contractor && m.contractor.staffUids) || []),
    ...((m.supervisor && m.supervisor.staffUids) || []),
  ].filter(Boolean))];
}

/* ---- 공지사항 ---- */

/** 공지 생성 + 참여자 알림 */
export async function createNotice(project, author, draft) {
  const notice = await Db.createNotice(project.projectId, {
    type: 'notice',
    title: draft.title,
    content: draft.content,
    priority: draft.priority || 'normal',
    author: {
      uid: author.uid, name: author.name, role: author.role,
      department: author.department || '', position: author.position || '',
    },
    images: draft.images || [],
    attachments: [],
    externalLinks: [],
    targetRoles: ['all'],
    readBy: { [author.uid]: nowIso() },
    commentCount: 0,
    createdAt: nowIso(), updatedAt: null, deletedAt: null,
    revisions: [],
  });

  const link = `/notice.html?project=${project.projectId}&id=${notice.noticeId}`;
  await notifyMany(
    projectMemberUids(project).filter((uid) => uid !== author.uid),
    {
      type: 'notice',
      title: `[${project.basicInfo.name}] ${draft.title}`,
      body: (draft.content || '').slice(0, 100),
      link, projectId: project.projectId, targetId: notice.noticeId,
    }
  );
  return notice;
}

/** 공지 수정 — 이전 버전을 revisions 에 보존 */
export async function updateNotice(project, notice, draft, editor) {
  const revision = {
    revisionId: genId('rev-'),
    editedAt: nowIso(),
    editedBy: editor.uid,
    previousTitle: notice.title,
    previousContent: notice.content,
  };
  return Db.updateNotice(project.projectId, notice.noticeId, {
    title: draft.title,
    content: draft.content,
    priority: draft.priority || notice.priority,
    images: draft.images || notice.images,
    updatedAt: nowIso(),
    revisions: [...(notice.revisions || []), revision],
  });
}

/** 공지 소프트 삭제 */
export async function softDeleteNotice(project, notice) {
  return Db.updateNotice(project.projectId, notice.noticeId, { deletedAt: nowIso() });
}

/** 읽음 처리 */
export async function markNoticeRead(projectId, notice, uid) {
  if (!uid || (notice.readBy && notice.readBy[uid])) return notice;
  return Db.updateNotice(projectId, notice.noticeId, {
    readBy: { ...(notice.readBy || {}), [uid]: nowIso() },
  });
}

/* ---- 댓글 ---- */

/** 댓글/답글 생성 + 알림 */
export async function createComment(project, notice, author, draft) {
  const comment = await Db.createComment(project.projectId, notice.noticeId, {
    parentCommentId: draft.parentCommentId || null,
    author: { uid: author.uid, name: author.name, role: author.role },
    content: draft.content,
    images: draft.images || [],
    createdAt: nowIso(), updatedAt: null, deletedAt: null,
  });

  await Db.updateNotice(project.projectId, notice.noticeId, {
    commentCount: (notice.commentCount || 0) + 1,
  });

  const link = `/notice.html?project=${project.projectId}&id=${notice.noticeId}`;
  if (draft.parentCommentId) {
    const comments = await Db.listComments(project.projectId, notice.noticeId);
    const parent = comments.find((c) => c.commentId === draft.parentCommentId);
    if (parent && parent.author.uid !== author.uid) {
      await notify(parent.author.uid, {
        type: 'reply',
        title: `${author.name}님이 답글을 남겼습니다`,
        body: (draft.content || '').slice(0, 100),
        link, projectId: project.projectId, targetId: notice.noticeId,
      });
    }
  } else if (notice.author.uid !== author.uid) {
    await notify(notice.author.uid, {
      type: 'comment',
      title: `${author.name}님이 댓글을 남겼습니다`,
      body: (draft.content || '').slice(0, 100),
      link, projectId: project.projectId, targetId: notice.noticeId,
    });
  }
  return comment;
}

/** 댓글 수정 — images 가 명시된 경우에만 교체(미지정 시 기존 이미지 유지) */
export async function updateComment(project, noticeId, commentId, draft) {
  const patch = { content: draft.content, updatedAt: nowIso() };
  if (draft.images !== undefined) patch.images = draft.images;
  return Db.updateComment(project.projectId, noticeId, commentId, patch);
}

/** 댓글 소프트 삭제 */
export async function softDeleteComment(project, noticeId, commentId) {
  return Db.updateComment(project.projectId, noticeId, commentId, { deletedAt: nowIso() });
}
