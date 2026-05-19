/**
 * board.js — 협업 게시판 공통 로직 (공사지시서·질의응답·회의록·설계변경)
 *
 * post-types.js 의 유형 정의를 바탕으로 게시글 생성·수정·삭제,
 * 상태 전환, 댓글, 알림 fan-out 을 유형 무관하게 처리한다.
 */

import { Db, nowIso, genId } from './backend.js';
import { resolveDraftImages, projectMemberUids } from './notices.js';
import { notify, notifyMany } from './notifications.js';
import { getPostType } from './post-types.js';

/** 게시글 상세 URL */
export function postLink(projectId, typeKey, postId) {
  return `/post.html?project=${encodeURIComponent(projectId)}&type=${typeKey}&id=${encodeURIComponent(postId)}`;
}

/** 해당 유형의 게시글을 작성할 수 있는지 */
export function canCreatePost(typeKey, user) {
  const t = getPostType(typeKey);
  return !!t && !!user && t.authorRoles.includes(user.role);
}

/* ---- 게시글 ---- */

export async function createPost(typeKey, project, author, draft) {
  const t = getPostType(typeKey);
  const initial = t.statuses[t.initialStatus];
  const post = await Db.createPost(project.projectId, t.collection, {
    type: typeKey,
    title: draft.title,
    content: draft.content,
    author: {
      uid: author.uid, name: author.name, role: author.role,
      department: author.department || '', position: author.position || '',
    },
    images: draft.images || [],
    extra: draft.extra || {},
    status: t.initialStatus,
    statusHistory: [{ status: t.initialStatus, label: initial.label, by: author.uid, byName: author.name, at: nowIso() }],
    readBy: { [author.uid]: nowIso() },
    commentCount: 0,
    createdAt: nowIso(), updatedAt: null, deletedAt: null, revisions: [],
  });

  await notifyMany(
    projectMemberUids(project).filter((uid) => uid !== author.uid),
    {
      type: 'notice',
      title: `[${project.basicInfo.name}] ${t.label}: ${draft.title}`,
      body: (draft.content || '').slice(0, 100),
      link: postLink(project.projectId, typeKey, post.postId),
      projectId: project.projectId, targetId: post.postId,
    }
  );
  return post;
}

export async function updatePost(typeKey, project, post, draft, editor) {
  const t = getPostType(typeKey);
  const revision = {
    revisionId: genId('rev-'), editedAt: nowIso(), editedBy: editor.uid,
    previousTitle: post.title, previousContent: post.content,
  };
  return Db.updatePost(project.projectId, t.collection, post.postId, {
    title: draft.title,
    content: draft.content,
    images: draft.images || post.images,
    extra: draft.extra || post.extra,
    updatedAt: nowIso(),
    revisions: [...(post.revisions || []), revision],
  });
}

export async function softDeletePost(typeKey, project, post) {
  const t = getPostType(typeKey);
  return Db.updatePost(project.projectId, t.collection, post.postId, { deletedAt: nowIso() });
}

export async function markPostRead(typeKey, projectId, post, uid) {
  if (!uid || (post.readBy && post.readBy[uid])) return post;
  const t = getPostType(typeKey);
  return Db.updatePost(projectId, t.collection, post.postId, {
    readBy: { ...(post.readBy || {}), [uid]: nowIso() },
  });
}

/* ---- 상태 전환 ---- */

/** 현재 사용자가 수행 가능한 상태 전환 목록 */
export function availableTransitions(typeKey, post, user) {
  const t = getPostType(typeKey);
  if (!t || !user || post.deletedAt) return [];
  return t.transitions.filter((tr) => {
    if (tr.from !== post.status) return false;
    if (tr.roles.includes(user.role)) return true;
    if (tr.roles.includes('author') && post.author.uid === user.uid) return true;
    return false;
  });
}

export async function applyTransition(typeKey, project, post, transition, user) {
  const t = getPostType(typeKey);
  const entry = {
    status: transition.to, label: t.statuses[transition.to].label,
    by: user.uid, byName: user.name, at: nowIso(),
  };
  const updated = await Db.updatePost(project.projectId, t.collection, post.postId, {
    status: transition.to,
    statusHistory: [...(post.statusHistory || []), entry],
  });
  if (post.author.uid !== user.uid) {
    await notify(post.author.uid, {
      type: 'notice',
      title: `${t.label} 상태 변경: ${t.statuses[transition.to].label}`,
      body: post.title,
      link: postLink(project.projectId, typeKey, post.postId),
      projectId: project.projectId, targetId: post.postId,
    });
  }
  return updated;
}

/* ---- 댓글 ---- */

export async function listComments(typeKey, projectId, postId) {
  const t = getPostType(typeKey);
  return Db.listPostComments(projectId, t.collection, postId);
}

export async function createComment(typeKey, project, post, author, draft) {
  const t = getPostType(typeKey);
  const comment = await Db.createPostComment(project.projectId, t.collection, post.postId, {
    parentCommentId: draft.parentCommentId || null,
    author: { uid: author.uid, name: author.name, role: author.role },
    content: draft.content, images: draft.images || [],
    createdAt: nowIso(), updatedAt: null, deletedAt: null,
  });
  await Db.updatePost(project.projectId, t.collection, post.postId, {
    commentCount: (post.commentCount || 0) + 1,
  });

  const link = postLink(project.projectId, typeKey, post.postId);
  if (draft.parentCommentId) {
    const comments = await Db.listPostComments(project.projectId, t.collection, post.postId);
    const parent = comments.find((c) => c.commentId === draft.parentCommentId);
    if (parent && parent.author.uid !== author.uid) {
      await notify(parent.author.uid, {
        type: 'reply', title: `${author.name}님이 답글을 남겼습니다`,
        body: (draft.content || '').slice(0, 100), link,
        projectId: project.projectId, targetId: post.postId,
      });
    }
  } else if (post.author.uid !== author.uid) {
    await notify(post.author.uid, {
      type: 'comment', title: `${author.name}님이 댓글을 남겼습니다`,
      body: (draft.content || '').slice(0, 100), link,
      projectId: project.projectId, targetId: post.postId,
    });
  }
  return comment;
}

export async function updateComment(typeKey, projectId, postId, commentId, draft) {
  const t = getPostType(typeKey);
  const patch = { content: draft.content, updatedAt: nowIso() };
  if (draft.images !== undefined) patch.images = draft.images;
  return Db.updatePostComment(projectId, t.collection, postId, commentId, patch);
}

export async function softDeleteComment(typeKey, projectId, postId, commentId) {
  const t = getPostType(typeKey);
  return Db.updatePostComment(projectId, t.collection, postId, commentId, { deletedAt: nowIso() });
}

export { resolveDraftImages };
