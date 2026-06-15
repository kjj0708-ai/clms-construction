/**
 * communication.js — 3자 소통 (공지 · 질의 · 지시) · 심플 버전
 *
 * 카테고리별 글 작성·조회·수정·삭제, 답글(comment-thread), 알림 fan-out.
 * 저장은 Db 의 범용 posts(collection = 카테고리 key) 를 사용한다.
 */

import { Db, nowIso } from './backend.js';
import { COMMUNICATION_CATEGORIES, PROJECT_EDITOR_ROLES } from './constants.js';
import { memberUids } from './projects.js';

/** 해당 카테고리에 글을 쓸 수 있는지 */
export function canPost(category, user) {
  const c = COMMUNICATION_CATEGORIES[category];
  if (!c || !user) return false;
  if (c.post === 'all') return true;
  if (c.post === 'contractor_supervisor') {
    return user.role.startsWith('contractor') || user.role.startsWith('supervisor');
  }
  return PROJECT_EDITOR_ROLES.includes(user.role); // 'officer'
}

/* ---- 알림 ---- */

export async function notify(uid, data) {
  if (!uid) return;
  try { await Db.createNotification(uid, data); } catch { /* noop */ }
}
export async function notifyMembers(project, exceptUid, data) {
  const targets = memberUids(project).filter((u) => u && u !== exceptUid);
  await Promise.all([...new Set(targets)].map((u) => notify(u, data)));
}
export async function unreadCount(uid) {
  if (!uid) return 0;
  try { return (await Db.listNotifications(uid)).filter((n) => !n.read).length; }
  catch { return 0; }
}

/* ---- 글 ---- */

export async function listPosts(projectId, category) {
  const posts = await Db.listPosts(projectId, category);
  return posts.filter((p) => !p.deletedAt)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export async function createPost(project, category, author, { title, content, images }) {
  const post = await Db.createPost(project.projectId, category, {
    type: category,
    title: title.trim(),
    content: content.trim(),
    images: images || [],
    author: { uid: author.uid, name: author.name, role: author.role },
    readBy: { [author.uid]: nowIso() },
    commentCount: 0,
    createdAt: nowIso(), updatedAt: null, deletedAt: null, revisions: [],
  });
  const cat = COMMUNICATION_CATEGORIES[category];
  await notifyMembers(project, author.uid, {
    type: category,
    title: `[${project.basicInfo.name}] ${cat.label}: ${post.title}`,
    body: content.slice(0, 80),
    link: `/project.html?id=${encodeURIComponent(project.projectId)}&tab=comm&cat=${category}&post=${post.postId}`,
  });
  return post;
}

export async function updatePost(project, category, post, { title, content, images }, editor) {
  const revision = {
    revisionId: 'rev-' + Date.now().toString(36), editedAt: nowIso(), editedBy: editor.uid,
    title: post.title, content: post.content, images: post.images || []
  };
  return Db.updatePost(project.projectId, category, post.postId, {
    title: title.trim(), content: content.trim(), images: images || [], updatedAt: nowIso(),
    revisions: [...(post.revisions || []), revision],
  });
}

export async function softDeletePost(project, category, post) {
  return Db.updatePost(project.projectId, category, post.postId, { deletedAt: nowIso() });
}

export async function markRead(project, category, post, uid) {
  if (!uid || (post.readBy && post.readBy[uid])) return post;
  return Db.updatePost(project.projectId, category, post.postId, {
    readBy: { ...(post.readBy || {}), [uid]: nowIso() },
  });
}

/* ---- 답글(댓글) ---- */

export async function listComments(projectId, category, postId) {
  return Db.listPostComments(projectId, category, postId);
}

export async function createComment(project, category, post, author, draft) {
  const comment = await Db.createPostComment(project.projectId, category, post.postId, {
    parentCommentId: draft.parentCommentId || null,
    author: { uid: author.uid, name: author.name, role: author.role },
    content: draft.content,
    images: [],
    createdAt: nowIso(), updatedAt: null, deletedAt: null,
  });
  await Db.updatePost(project.projectId, category, post.postId, {
    commentCount: (post.commentCount || 0) + 1,
  });

  const link = `/project.html?id=${encodeURIComponent(project.projectId)}&tab=comm&cat=${category}&post=${post.postId}`;
  if (draft.parentCommentId) {
    const comments = await Db.listPostComments(project.projectId, category, post.postId);
    const parent = comments.find((c) => c.commentId === draft.parentCommentId);
    if (parent && parent.author.uid !== author.uid) {
      await notify(parent.author.uid, { type: 'reply', title: `${author.name}님이 답글을 남겼습니다`, body: draft.content.slice(0, 80), link });
    }
  } else if (post.author.uid !== author.uid) {
    await notify(post.author.uid, { type: 'comment', title: `${author.name}님이 답글을 남겼습니다`, body: draft.content.slice(0, 80), link });
  }
  return comment;
}

export async function updateComment(projectId, category, postId, commentId, draft) {
  return Db.updatePostComment(projectId, category, postId, commentId, { content: draft.content, updatedAt: nowIso() });
}
export async function deleteComment(projectId, category, postId, commentId) {
  return Db.updatePostComment(projectId, category, postId, commentId, { deletedAt: nowIso() });
}
