/**
 * notifications.js — 인앱 알림 시스템
 *
 * 공지·댓글 등 이벤트 발생 시 수신자에게 알림 문서를 생성한다.
 * 수신자의 알림 설정(종류별 on/off, 야간 차단)을 존중한다.
 *
 * 실제 모바일 푸시(FCM)는 push.js + Cloud Functions 영역이며,
 * 인앱 알림은 모드(mock/firebase)와 무관하게 동작한다.
 */

import { Db, nowIso } from './backend.js';
import { DEFAULT_NOTIFICATION_SETTINGS } from './constants.js';

/** 사용자 알림 설정 (기본값 병합) */
export function getNotificationSettings(user) {
  return { ...DEFAULT_NOTIFICATION_SETTINGS, ...((user && user.notificationSettings) || {}) };
}

/** 현재 시각이 야간(22:00~07:00)인지 */
function isNightNow() {
  const h = new Date().getHours();
  return h >= 22 || h < 7;
}

/**
 * 수신자 1명에게 알림을 생성한다. 설정에 따라 생략될 수 있다.
 * @param {string} uid 수신자
 * @param {{type,title,body?,link?,projectId?,targetId?}} payload
 */
export async function notify(uid, payload) {
  if (!uid) return null;
  let recipient = null;
  try { recipient = await Db.getUser(uid); } catch { /* noop */ }
  if (recipient) {
    const settings = getNotificationSettings(recipient);
    if (settings[payload.type] === false) return null;
    if (settings.nightBlock && isNightNow()) return null;
  }
  return Db.createNotification(uid, {
    type: payload.type,
    title: payload.title,
    body: payload.body || '',
    link: payload.link || '',
    projectId: payload.projectId || null,
    targetId: payload.targetId || null,
    read: false,
    createdAt: nowIso(),
  });
}

/** 여러 수신자에게 동시 발송 (중복 uid 제거) */
export async function notifyMany(uids, payload) {
  const unique = [...new Set((uids || []).filter(Boolean))];
  await Promise.all(unique.map((uid) => notify(uid, payload)));
  return unique.length;
}

/** 미읽음 알림 개수 */
export async function unreadCount(uid) {
  if (!uid) return 0;
  const list = await Db.listNotifications(uid);
  return list.filter((n) => !n.read).length;
}

/** 최신순 정렬된 알림 목록 */
export async function listNotificationsSorted(uid) {
  const list = await Db.listNotifications(uid);
  return list.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}
