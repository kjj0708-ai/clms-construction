/**
 * 백엔드 추상화 레이어 — 인증(Auth) + 데이터(Db)
 * ============================================================
 * firebase-config.js 의 키가 실제 값이면 → 'firebase' 모드 (Firebase SDK)
 * placeholder 상태면 → 'mock' 모드 (localStorage 백엔드)
 *
 * 페이지·미들웨어(auth.js)는 모드를 신경 쓰지 않고 동일한
 * Auth / Db 인터페이스만 사용한다.
 * ============================================================
 */

import { firebaseConfig, isFirebaseConfigured } from './firebase-config.js';
import { ROLES } from './constants.js';
import { STAGES } from './stages.js';

export const BACKEND_MODE = isFirebaseConfigured() ? 'firebase' : 'mock';
export const isMock = BACKEND_MODE === 'mock';

/* ============================================================
 * 공통 유틸
 * ============================================================ */

export function genId(prefix = '') {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function nowIso() {
  return new Date().toISOString();
}

/** 한국 휴대폰 번호를 E.164(+82) 형식으로 정규화 */
export function normalizePhone(raw) {
  let digits = String(raw || '').replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('0')) digits = digits.slice(1);
  return '+82' + digits;
}

/** 인증 오류 — code 로 분기, message 는 사용자 노출용 */
export class AuthError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = 'AuthError';
    this.code = code;
  }
}

/** 데모 모드 구글 계정 선택지 (목업 전용) */
export const DEMO_GOOGLE_ACCOUNTS = [
  { email: 'gildong.hong@gmail.com', name: '홍길동' },
  { email: 'clms.officer@gmail.com', name: '김주무' },
];

/* ============================================================
 * 목업 백엔드 (localStorage)
 * ============================================================ */

const LS_DB = 'clms.mock.db';
const LS_ACCOUNTS = 'clms.mock.accounts';
const LS_SESSION = 'clms.mock.session';

function readLS(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}
function writeLS(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

/** 가져오기 — 평면 문서 맵 병합 (충돌 전략 적용) */
function mergeDocs(target, source, strategy, report) {
  for (const [id, doc] of Object.entries(source || {})) {
    if (target[id] !== undefined) {
      if (strategy === 'skip') { report.skipped++; continue; }
      target[id] = doc;
      report.overwritten++;
    } else {
      target[id] = doc;
      report.created++;
    }
  }
}
/** 가져오기 — 2단계 중첩 문서 맵 병합 */
function mergeNested(target, source, strategy, report) {
  for (const [outerKey, inner] of Object.entries(source || {})) {
    target[outerKey] = target[outerKey] || {};
    mergeDocs(target[outerKey], inner, strategy, report);
  }
}

/** 데모용 단순 해시 — 실제 비밀번호 보안은 Firebase Auth가 담당한다. */
function hashPassword(pw) {
  let h = 0;
  const s = 'clms~salt~' + pw;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return 'h' + (h >>> 0).toString(36);
}

const DEMO_PROFILES = {
  system_admin:     { name: '관리자',  department: '도시주택국 정보화팀', contact: '02-000-0000' },
  national_director:{ name: '나국장',  department: '도시주택국',           contact: '02-000-0001' },
  department_head:  { name: '김과장',  department: '도시주택국 건축과',     contact: '02-000-0002' },
  manager:          { name: '이담당',  department: '도시주택국 건축과',     contact: '010-1000-2000' },
  contractor_chief: { name: '박소장',  department: '(주)대한건설',           contact: '010-2000-3000' },
  supervisor_chief: { name: '최감리',  department: '한국건설감리단',         contact: '010-3000-4000' },
  external_viewer:  { name: '감사관',  department: '감사위원회',             contact: '02-000-0009' },
};
export const DEMO_ROLE_KEYS = Object.keys(DEMO_PROFILES);

function userTypeForRole(roleKey) {
  const group = ROLES[roleKey] ? ROLES[roleKey].group : 'officer';
  if (group === 'contractor') return 'contractor';
  if (group === 'supervisor') return 'supervisor';
  if (group === 'external') return 'other';
  return 'officer';
}

/** 시드 사업의 12단계 맵 생성 — currentStage 이전은 완료, 해당 단계는 진행 중 */
function seedProjectStages(currentStage) {
  const stages = {};
  for (const s of STAGES) {
    const done = s.number < currentStage;
    stages[s.number] = {
      number: s.number,
      name: s.name,
      status: done ? 'completed' : s.number === currentStage ? 'in_progress' : 'pending',
      startedAt: s.number <= currentStage ? nowIso() : null,
      completedAt: done ? nowIso() : null,
      requiredDocs: s.requiredDocs.map((name) => ({
        name,
        uploaded: done,
        file: done ? { name: name + '.pdf', size: 204800, type: 'application/pdf', url: null, uploadedAt: nowIso(), uploadedBy: 'seed' } : null,
      })),
    };
  }
  return stages;
}

/** 목업 DB 초기 시드 (최초 1회) — 기본 관리자 + 승인 대기 예시 사용자 + 예시 사업 */
function seedMockData() {
  let db = readLS(LS_DB, null);
  let accounts = readLS(LS_ACCOUNTS, null);
  if (db && accounts) return;

  db = db || { users: {}, approval_requests: {}, counters: {}, projects: {} };
  db.projects = db.projects || {};
  db.notices = db.notices || {};
  db.comments = db.comments || {};
  db.notifications = db.notifications || {};
  db.posts = db.posts || {};
  db.postComments = db.postComments || {};
  accounts = accounts || {};

  // 기본 시스템 관리자
  const adminUid = 'seed-admin';
  accounts[adminUid] = {
    uid: adminUid, email: 'admin@clms.local', provider: 'email',
    password: hashPassword('admin1234'), emailVerified: true,
  };
  db.users[adminUid] = {
    uid: adminUid, name: '시스템 관리자', department: '도시주택국 정보화팀',
    position: '관리자', contact: '02-000-0000', email: 'admin@clms.local',
    userType: 'officer', note: '기본 관리자 계정', role: 'system_admin', status: 'active',
    accessibleProjects: [], authProvider: 'email',
    createdAt: nowIso(), approvedAt: nowIso(), approvedBy: 'system', lastLoginAt: null,
  };

  // 승인 대기 예시 사용자 2명 (관리자 승인 화면 확인용)
  const pendings = [
    { uid: 'seed-pending-1', name: '박현장', department: '(주)대한건설', position: '현장소장',
      contact: '010-2222-3333', email: 'park@daehan.co.kr', userType: 'contractor', note: '○○도로공사 현장소장입니다.' },
    { uid: 'seed-pending-2', name: '정감리', department: '한국건설감리단', position: '책임감리원',
      contact: '010-4444-5555', email: 'jung@kcm.co.kr', userType: 'supervisor', note: '감리 배정 예정입니다.' },
  ];
  for (const p of pendings) {
    accounts[p.uid] = { uid: p.uid, email: p.email, provider: 'email', password: hashPassword('test1234'), emailVerified: true };
    db.users[p.uid] = {
      ...p, role: 'pending', status: 'pending', accessibleProjects: [],
      authProvider: 'email', createdAt: nowIso(), approvedAt: null, approvedBy: null, lastLoginAt: null,
    };
    const reqId = genId('req-');
    db.approval_requests[reqId] = {
      requestId: reqId, userId: p.uid,
      userInfo: { name: p.name, department: p.department, position: p.position, contact: p.contact, email: p.email, userType: p.userType, note: p.note },
      requestedAt: nowIso(), status: 'pending', processedAt: null, processedBy: null, rejectionReason: null,
    };
  }

  // 예시 사업 2건 (데모 사용자 uid 를 참여자로 연결)
  const demoMembers = {
    officer: { uid: 'demo-manager', name: '이담당', phone: '010-1000-2000', email: 'manager@demo.clms' },
    manager: { uid: 'demo-manager', name: '이담당' },
    departmentHead: { uid: 'demo-department_head', name: '김과장' },
    contractor: { company: '(주)대한건설', chiefPhone: '010-2000-3000', chiefUid: 'demo-contractor_chief', staffUids: [] },
    supervisor: { company: '한국건설감리단', chiefPhone: '010-3000-4000', chiefUid: 'demo-supervisor_chief', staffUids: [] },
  };
  const sampleProjects = [
    { projectId: '2026-DOSI-001', name: '행복로 도로개설공사', type: '도로공사', stage: 9,
      budget: 4_800_000_000, district: '○○동', address: '○○시 ○○구 행복로 일원' },
    { projectId: '2026-DOSI-002', name: '△△ 어린이공원 조성공사', type: '조경공사', stage: 5,
      budget: 1_250_000_000, district: '△△동', address: '○○시 ○○구 △△동 123' },
  ];
  for (const sp of sampleProjects) {
    db.projects[sp.projectId] = {
      projectId: sp.projectId,
      deptCode: 'DOSI',
      basicInfo: {
        name: sp.name, type: sp.type, department: '도시주택국 건축과',
        startDate: '2026-03-01', endDate: '2027-12-31',
        totalBudget: sp.budget, fiscalYear: 2026, budgetCode: '411-01',
      },
      location: { address: sp.address, lat: null, lng: null, district: sp.district },
      currentStage: sp.stage,
      stages: seedProjectStages(sp.stage),
      members: JSON.parse(JSON.stringify(demoMembers)),
      createdAt: nowIso(), createdBy: 'seed-admin', updatedAt: nowIso(), status: 'active',
    };
  }
  db.counters['2026-DOSI'] = 2;

  // 예시 공지사항 1건 + 댓글 1건 (행복로 도로개설공사)
  db.notices['2026-DOSI-001'] = {
    'seed-notice-1': {
      noticeId: 'seed-notice-1', projectId: '2026-DOSI-001', type: 'notice',
      title: '정기 안전점검 일정 안내',
      content: '금주 금요일 14시에 현장 정기 안전점검을 실시합니다.\n관련 점검 양식은 https://www.law.go.kr 에서 확인하실 수 있습니다.\n전 참여자 입회 바랍니다.',
      priority: 'important',
      author: { uid: 'demo-department_head', name: '김과장', role: 'department_head', department: '도시주택국 건축과', position: '과장' },
      images: [], attachments: [], externalLinks: [],
      targetRoles: ['all'], readBy: {}, commentCount: 1,
      createdAt: nowIso(), updatedAt: null, deletedAt: null, revisions: [],
    },
  };
  db.comments['2026-DOSI-001|seed-notice-1'] = {
    'seed-comment-1': {
      commentId: 'seed-comment-1', parentCommentId: null,
      author: { uid: 'demo-contractor_chief', name: '박소장', role: 'contractor_chief' },
      content: '확인했습니다. 안전관리자 입회하도록 하겠습니다.',
      images: [], createdAt: nowIso(), updatedAt: null, deletedAt: null,
    },
  };

  writeLS(LS_DB, db);
  writeLS(LS_ACCOUNTS, accounts);
}

function mockAuthUser(account) {
  if (!account) return null;
  return {
    uid: account.uid,
    email: account.email || null,
    phone: account.phone || null,
    provider: account.provider,
    displayName: account.googleName || null,
    emailVerified: account.provider === 'email' ? !!account.emailVerified : true,
  };
}

const mockAuth = {
  async ready() { seedMockData(); },

  currentUser() {
    const uid = localStorage.getItem(LS_SESSION);
    if (!uid) return null;
    return mockAuthUser(readLS(LS_ACCOUNTS, {})[uid]);
  },

  async signInWithGoogle(opts = {}) {
    const picked = opts.mockAccount;
    if (!picked || !picked.email) {
      throw new AuthError('google-account-required', '구글 계정을 선택해 주세요.');
    }
    const accounts = readLS(LS_ACCOUNTS, {});
    let account = Object.values(accounts).find((a) => a.provider === 'google' && a.email === picked.email);
    if (!account) {
      account = { uid: genId('g-'), email: picked.email, provider: 'google', googleName: picked.name || '' };
      accounts[account.uid] = account;
      writeLS(LS_ACCOUNTS, accounts);
    }
    localStorage.setItem(LS_SESSION, account.uid);
    return mockAuthUser(account);
  },

  async signUpWithEmail(email, password) {
    const accounts = readLS(LS_ACCOUNTS, {});
    if (Object.values(accounts).some((a) => a.email === email)) {
      throw new AuthError('email-already-in-use', '이미 가입된 이메일입니다.');
    }
    const account = {
      uid: genId('e-'), email, provider: 'email',
      password: hashPassword(password), emailVerified: false,
    };
    accounts[account.uid] = account;
    writeLS(LS_ACCOUNTS, accounts);
    localStorage.setItem(LS_SESSION, account.uid);
    return mockAuthUser(account);
  },

  async signInWithEmail(email, password) {
    const accounts = readLS(LS_ACCOUNTS, {});
    const account = Object.values(accounts).find((a) => a.email === email && a.provider === 'email');
    if (!account) throw new AuthError('user-not-found', '등록되지 않은 이메일입니다.');
    if (account.password !== hashPassword(password)) {
      throw new AuthError('wrong-password', '비밀번호가 일치하지 않습니다.');
    }
    localStorage.setItem(LS_SESSION, account.uid);
    return mockAuthUser(account);
  },

  async startPhoneSignIn(phone) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    return { _mock: true, phone: normalizePhone(phone), code };
  },

  async confirmPhoneCode(handle, code) {
    if (String(code) !== String(handle.code)) {
      throw new AuthError('invalid-verification-code', '인증번호가 일치하지 않습니다.');
    }
    const accounts = readLS(LS_ACCOUNTS, {});
    let account = Object.values(accounts).find((a) => a.provider === 'phone' && a.phone === handle.phone);
    if (!account) {
      account = { uid: genId('p-'), phone: handle.phone, provider: 'phone' };
      accounts[account.uid] = account;
      writeLS(LS_ACCOUNTS, accounts);
    }
    localStorage.setItem(LS_SESSION, account.uid);
    return mockAuthUser(account);
  },

  async changePassword(newPassword) {
    const uid = localStorage.getItem(LS_SESSION);
    const accounts = readLS(LS_ACCOUNTS, {});
    if (!uid || !accounts[uid] || accounts[uid].provider !== 'email') {
      throw new AuthError('not-email-user', '이메일 계정만 비밀번호를 변경할 수 있습니다.');
    }
    accounts[uid].password = hashPassword(newPassword);
    writeLS(LS_ACCOUNTS, accounts);
  },

  async signOut() {
    localStorage.removeItem(LS_SESSION);
  },

  /** 데모 빠른 로그인 — 역할별 활성 사용자를 즉시 생성/로그인 (목업 전용) */
  devQuickLogin(roleKey) {
    seedMockData();
    const profile = DEMO_PROFILES[roleKey] || { name: '데모', department: '데모', contact: '' };
    const uid = 'demo-' + roleKey;
    const accounts = readLS(LS_ACCOUNTS, {});
    const db = readLS(LS_DB, { users: {}, approval_requests: {}, counters: {} });
    accounts[uid] = { uid, email: roleKey + '@demo.clms', provider: 'demo' };
    db.users[uid] = {
      uid, name: profile.name, department: profile.department,
      position: (ROLES[roleKey] && ROLES[roleKey].label) || '', contact: profile.contact,
      email: roleKey + '@demo.clms', userType: userTypeForRole(roleKey), note: '데모 계정',
      role: roleKey, status: 'active', accessibleProjects: [], authProvider: 'demo',
      createdAt: nowIso(), approvedAt: nowIso(), approvedBy: 'system', lastLoginAt: nowIso(),
    };
    writeLS(LS_ACCOUNTS, accounts);
    writeLS(LS_DB, db);
    localStorage.setItem(LS_SESSION, uid);
    return mockAuthUser(accounts[uid]);
  },
};

const mockDb = {
  async getUser(uid) {
    return readLS(LS_DB, { users: {} }).users[uid] || null;
  },
  async setUser(uid, data) {
    const db = readLS(LS_DB, { users: {}, approval_requests: {}, counters: {} });
    db.users[uid] = { ...data, uid };
    writeLS(LS_DB, db);
    return db.users[uid];
  },
  async updateUser(uid, patch) {
    const db = readLS(LS_DB, { users: {}, approval_requests: {}, counters: {} });
    db.users[uid] = { ...(db.users[uid] || {}), ...patch, uid };
    writeLS(LS_DB, db);
    return db.users[uid];
  },
  async listUsers(filter = {}) {
    let users = Object.values(readLS(LS_DB, { users: {} }).users);
    if (filter.status) users = users.filter((u) => u.status === filter.status);
    if (filter.role) users = users.filter((u) => u.role === filter.role);
    return users.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  },
  async createApprovalRequest(data) {
    const db = readLS(LS_DB, { users: {}, approval_requests: {}, counters: {} });
    const requestId = genId('req-');
    db.approval_requests[requestId] = { ...data, requestId };
    writeLS(LS_DB, db);
    return db.approval_requests[requestId];
  },
  async listApprovalRequests(filter = {}) {
    let reqs = Object.values(readLS(LS_DB, { approval_requests: {} }).approval_requests);
    if (filter.status) reqs = reqs.filter((r) => r.status === filter.status);
    return reqs.sort((a, b) => String(b.requestedAt).localeCompare(String(a.requestedAt)));
  },
  async updateApprovalRequest(requestId, patch) {
    const db = readLS(LS_DB, { users: {}, approval_requests: {}, counters: {} });
    if (db.approval_requests[requestId]) {
      db.approval_requests[requestId] = { ...db.approval_requests[requestId], ...patch };
      writeLS(LS_DB, db);
    }
    return db.approval_requests[requestId];
  },
  async findApprovalRequestByUser(userId) {
    const reqs = Object.values(readLS(LS_DB, { approval_requests: {} }).approval_requests);
    return reqs.filter((r) => r.userId === userId).sort((a, b) => String(b.requestedAt).localeCompare(String(a.requestedAt)))[0] || null;
  },

  async createProject(data) {
    const db = readLS(LS_DB, { projects: {}, counters: {} });
    db.projects = db.projects || {};
    db.counters = db.counters || {};
    const year = data.basicInfo.fiscalYear;
    const deptCode = (data.deptCode || 'GEN').toUpperCase();
    const key = `${year}-${deptCode}`;
    const seq = (db.counters[key] || 0) + 1;
    db.counters[key] = seq;
    const projectId = `${year}-${deptCode}-${String(seq).padStart(3, '0')}`;
    db.projects[projectId] = { ...data, projectId, deptCode };
    writeLS(LS_DB, db);
    return db.projects[projectId];
  },
  async getProject(projectId) {
    return (readLS(LS_DB, { projects: {} }).projects || {})[projectId] || null;
  },
  async updateProject(projectId, patch) {
    const db = readLS(LS_DB, { projects: {} });
    db.projects = db.projects || {};
    if (db.projects[projectId]) {
      db.projects[projectId] = { ...db.projects[projectId], ...patch, updatedAt: nowIso() };
      writeLS(LS_DB, db);
    }
    return db.projects[projectId];
  },
  async listProjects() {
    return Object.values(readLS(LS_DB, { projects: {} }).projects || {})
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  },

  // ---- 공지사항 ----
  async createNotice(projectId, data) {
    const db = readLS(LS_DB, {});
    db.notices = db.notices || {};
    db.notices[projectId] = db.notices[projectId] || {};
    const noticeId = genId('notice-');
    db.notices[projectId][noticeId] = { ...data, noticeId, projectId };
    writeLS(LS_DB, db);
    return db.notices[projectId][noticeId];
  },
  async getNotice(projectId, noticeId) {
    return ((readLS(LS_DB, {}).notices || {})[projectId] || {})[noticeId] || null;
  },
  async listNotices(projectId) {
    const all = (readLS(LS_DB, {}).notices || {})[projectId] || {};
    return Object.values(all);
  },
  async updateNotice(projectId, noticeId, patch) {
    const db = readLS(LS_DB, {});
    db.notices = db.notices || {};
    db.notices[projectId] = db.notices[projectId] || {};
    if (db.notices[projectId][noticeId]) {
      db.notices[projectId][noticeId] = { ...db.notices[projectId][noticeId], ...patch };
      writeLS(LS_DB, db);
    }
    return db.notices[projectId][noticeId];
  },

  // ---- 댓글 ----
  async listComments(projectId, noticeId) {
    const all = (readLS(LS_DB, {}).comments || {})[`${projectId}|${noticeId}`] || {};
    return Object.values(all);
  },
  async createComment(projectId, noticeId, data) {
    const db = readLS(LS_DB, {});
    db.comments = db.comments || {};
    const key = `${projectId}|${noticeId}`;
    db.comments[key] = db.comments[key] || {};
    const commentId = genId('cmt-');
    db.comments[key][commentId] = { ...data, commentId };
    writeLS(LS_DB, db);
    return db.comments[key][commentId];
  },
  async updateComment(projectId, noticeId, commentId, patch) {
    const db = readLS(LS_DB, {});
    db.comments = db.comments || {};
    const key = `${projectId}|${noticeId}`;
    db.comments[key] = db.comments[key] || {};
    if (db.comments[key][commentId]) {
      db.comments[key][commentId] = { ...db.comments[key][commentId], ...patch };
      writeLS(LS_DB, db);
    }
    return db.comments[key][commentId];
  },

  // ---- 알림 ----
  async createNotification(uid, data) {
    const db = readLS(LS_DB, {});
    db.notifications = db.notifications || {};
    db.notifications[uid] = db.notifications[uid] || {};
    const id = genId('ntf-');
    db.notifications[uid][id] = { ...data, id, uid };
    writeLS(LS_DB, db);
    return db.notifications[uid][id];
  },
  async listNotifications(uid) {
    return Object.values((readLS(LS_DB, {}).notifications || {})[uid] || {});
  },
  async updateNotification(uid, id, patch) {
    const db = readLS(LS_DB, {});
    db.notifications = db.notifications || {};
    db.notifications[uid] = db.notifications[uid] || {};
    if (db.notifications[uid][id]) {
      db.notifications[uid][id] = { ...db.notifications[uid][id], ...patch };
      writeLS(LS_DB, db);
    }
    return db.notifications[uid][id];
  },
  async markAllNotificationsRead(uid) {
    const db = readLS(LS_DB, {});
    const all = (db.notifications || {})[uid] || {};
    for (const id of Object.keys(all)) all[id].read = true;
    writeLS(LS_DB, db);
  },

  // ---- 협업 게시글 (공사지시서·질의·회의록·설계변경 등 임의 컬렉션) ----
  async createPost(projectId, collection, data) {
    const db = readLS(LS_DB, {});
    db.posts = db.posts || {};
    const key = `${projectId}|${collection}`;
    db.posts[key] = db.posts[key] || {};
    const postId = genId(collection + '-');
    db.posts[key][postId] = { ...data, postId, projectId, collection };
    writeLS(LS_DB, db);
    return db.posts[key][postId];
  },
  async getPost(projectId, collection, postId) {
    return ((readLS(LS_DB, {}).posts || {})[`${projectId}|${collection}`] || {})[postId] || null;
  },
  async listPosts(projectId, collection) {
    return Object.values((readLS(LS_DB, {}).posts || {})[`${projectId}|${collection}`] || {});
  },
  async updatePost(projectId, collection, postId, patch) {
    const db = readLS(LS_DB, {});
    db.posts = db.posts || {};
    const key = `${projectId}|${collection}`;
    db.posts[key] = db.posts[key] || {};
    if (db.posts[key][postId]) {
      db.posts[key][postId] = { ...db.posts[key][postId], ...patch };
      writeLS(LS_DB, db);
    }
    return db.posts[key][postId];
  },
  async listPostComments(projectId, collection, postId) {
    return Object.values((readLS(LS_DB, {}).postComments || {})[`${projectId}|${collection}|${postId}`] || {});
  },
  async createPostComment(projectId, collection, postId, data) {
    const db = readLS(LS_DB, {});
    db.postComments = db.postComments || {};
    const key = `${projectId}|${collection}|${postId}`;
    db.postComments[key] = db.postComments[key] || {};
    const commentId = genId('cmt-');
    db.postComments[key][commentId] = { ...data, commentId };
    writeLS(LS_DB, db);
    return db.postComments[key][commentId];
  },
  async updatePostComment(projectId, collection, postId, commentId, patch) {
    const db = readLS(LS_DB, {});
    db.postComments = db.postComments || {};
    const key = `${projectId}|${collection}|${postId}`;
    db.postComments[key] = db.postComments[key] || {};
    if (db.postComments[key][commentId]) {
      db.postComments[key][commentId] = { ...db.postComments[key][commentId], ...patch };
      writeLS(LS_DB, db);
    }
    return db.postComments[key][commentId];
  },

  // ---- 데이터 내보내기/가져오기 ----
  async exportAll() {
    const db = readLS(LS_DB, {});
    return JSON.parse(JSON.stringify({
      users: db.users || {},
      projects: db.projects || {},
      notices: db.notices || {},
      comments: db.comments || {},
      posts: db.posts || {},
      postComments: db.postComments || {},
      approval_requests: db.approval_requests || {},
      counters: db.counters || {},
    }));
  },
  async exportProject(projectId) {
    const db = readLS(LS_DB, {});
    const project = (db.projects || {})[projectId];
    if (!project) return null;
    const pick = (obj, test) => Object.fromEntries(
      Object.entries(obj || {}).filter(([k]) => test(k)));
    const bundle = {
      projects: { [projectId]: project },
      notices: pick(db.notices, (k) => k === projectId),
      comments: pick(db.comments, (k) => k.startsWith(projectId + '|')),
      posts: pick(db.posts, (k) => k.startsWith(projectId + '|')),
      postComments: pick(db.postComments, (k) => k.startsWith(projectId + '|')),
      users: {},
    };
    // 참여자 사용자 문서 포함 (참조 무결성)
    const m = project.members || {};
    const uids = [project.createdBy, m.officer && m.officer.uid, m.manager && m.manager.uid,
      m.departmentHead && m.departmentHead.uid, m.contractor && m.contractor.chiefUid,
      m.supervisor && m.supervisor.chiefUid].filter(Boolean);
    for (const uid of uids) {
      if ((db.users || {})[uid]) bundle.users[uid] = db.users[uid];
    }
    return JSON.parse(JSON.stringify(bundle));
  },
  async importBundle(bundle, strategy = 'skip') {
    const db = readLS(LS_DB, {});
    for (const k of ['users', 'projects', 'approval_requests', 'notices', 'comments', 'posts', 'postComments', 'counters']) {
      db[k] = db[k] || {};
    }
    const report = { created: 0, overwritten: 0, skipped: 0 };
    if (bundle.users) mergeDocs(db.users, bundle.users, strategy, report);
    if (bundle.projects) mergeDocs(db.projects, bundle.projects, strategy, report);
    if (bundle.approval_requests) mergeDocs(db.approval_requests, bundle.approval_requests, strategy, report);
    if (bundle.notices) mergeNested(db.notices, bundle.notices, strategy, report);
    if (bundle.comments) mergeNested(db.comments, bundle.comments, strategy, report);
    if (bundle.posts) mergeNested(db.posts, bundle.posts, strategy, report);
    if (bundle.postComments) mergeNested(db.postComments, bundle.postComments, strategy, report);
    if (bundle.counters) {
      for (const [k, v] of Object.entries(bundle.counters)) {
        db.counters[k] = Math.max(db.counters[k] || 0, Number(v) || 0);
      }
    }
    writeLS(LS_DB, db);
    return report;
  },
};

/* ============================================================
 * Firebase 백엔드 (firebase-config.js 에 실제 키 입력 시 활성)
 * ============================================================ */

const FB_SDK = 'https://www.gstatic.com/firebasejs/10.12.2';
let _fbPromise = null;

async function fb() {
  if (_fbPromise) return _fbPromise;
  _fbPromise = (async () => {
    const [appMod, authMod, fsMod, stMod] = await Promise.all([
      import(`${FB_SDK}/firebase-app.js`),
      import(`${FB_SDK}/firebase-auth.js`),
      import(`${FB_SDK}/firebase-firestore.js`),
      import(`${FB_SDK}/firebase-storage.js`),
    ]);
    const app = appMod.initializeApp(firebaseConfig);
    return {
      app, A: authMod, F: fsMod, S: stMod,
      auth: authMod.getAuth(app),
      db: fsMod.getFirestore(app),
      storage: stMod.getStorage(app),
    };
  })();
  return _fbPromise;
}

function mapFbUser(u) {
  if (!u) return null;
  const provider = (u.providerData[0] && u.providerData[0].providerId) || '';
  return {
    uid: u.uid,
    email: u.email || null,
    phone: u.phoneNumber || null,
    provider: provider.includes('google') ? 'google' : provider.includes('phone') ? 'phone' : 'email',
    displayName: u.displayName || null,
    emailVerified: u.emailVerified,
  };
}

const firebaseAuth = {
  async ready() {
    const { auth, A } = await fb();
    await new Promise((resolve) => {
      const unsub = A.onAuthStateChanged(auth, () => { unsub(); resolve(); });
    });
  },
  currentUser() {
    // fb() 가 해석된 뒤에만 정확하다 — auth.js 에서 ready() 후 호출한다.
    return _fbPromise ? null : null; // 동기 접근 불가 → currentUserAsync 사용
  },
  async currentUserAsync() {
    const { auth } = await fb();
    return mapFbUser(auth.currentUser);
  },
  async signInWithGoogle() {
    const { auth, A } = await fb();
    const provider = new A.GoogleAuthProvider();
    const cred = await A.signInWithPopup(auth, provider);
    return mapFbUser(cred.user);
  },
  async signUpWithEmail(email, password) {
    const { auth, A } = await fb();
    const cred = await A.createUserWithEmailAndPassword(auth, email, password);
    try { await A.sendEmailVerification(cred.user); } catch { /* noop */ }
    return mapFbUser(cred.user);
  },
  async signInWithEmail(email, password) {
    const { auth, A } = await fb();
    const cred = await A.signInWithEmailAndPassword(auth, email, password);
    return mapFbUser(cred.user);
  },
  async startPhoneSignIn(phone, recaptchaContainerId) {
    const { auth, A } = await fb();
    const verifier = new A.RecaptchaVerifier(auth, recaptchaContainerId, { size: 'invisible' });
    const confirmationResult = await A.signInWithPhoneNumber(auth, normalizePhone(phone), verifier);
    return { _fb: true, confirmationResult };
  },
  async confirmPhoneCode(handle, code) {
    const cred = await handle.confirmationResult.confirm(code);
    return mapFbUser(cred.user);
  },
  async changePassword(newPassword) {
    const { auth, A } = await fb();
    if (!auth.currentUser) throw new AuthError('no-user', '로그인이 필요합니다.');
    await A.updatePassword(auth.currentUser, newPassword);
  },
  async signOut() {
    const { auth, A } = await fb();
    await A.signOut(auth);
  },
};

const firebaseDb = {
  async getUser(uid) {
    const { db, F } = await fb();
    const snap = await F.getDoc(F.doc(db, 'users', uid));
    return snap.exists() ? snap.data() : null;
  },
  async setUser(uid, data) {
    const { db, F } = await fb();
    await F.setDoc(F.doc(db, 'users', uid), { ...data, uid });
    return { ...data, uid };
  },
  async updateUser(uid, patch) {
    const { db, F } = await fb();
    await F.updateDoc(F.doc(db, 'users', uid), patch);
    return this.getUser(uid);
  },
  async listUsers(filter = {}) {
    const { db, F } = await fb();
    let q = F.collection(db, 'users');
    const clauses = [];
    if (filter.status) clauses.push(F.where('status', '==', filter.status));
    if (filter.role) clauses.push(F.where('role', '==', filter.role));
    if (clauses.length) q = F.query(q, ...clauses);
    const snap = await F.getDocs(q);
    return snap.docs.map((d) => d.data());
  },
  async createApprovalRequest(data) {
    const { db, F } = await fb();
    const ref = F.doc(F.collection(db, 'approval_requests'));
    await F.setDoc(ref, { ...data, requestId: ref.id });
    return { ...data, requestId: ref.id };
  },
  async listApprovalRequests(filter = {}) {
    const { db, F } = await fb();
    let q = F.collection(db, 'approval_requests');
    if (filter.status) q = F.query(q, F.where('status', '==', filter.status));
    const snap = await F.getDocs(q);
    return snap.docs.map((d) => d.data());
  },
  async updateApprovalRequest(requestId, patch) {
    const { db, F } = await fb();
    await F.updateDoc(F.doc(db, 'approval_requests', requestId), patch);
  },
  async findApprovalRequestByUser(userId) {
    const { db, F } = await fb();
    const snap = await F.getDocs(F.query(F.collection(db, 'approval_requests'), F.where('userId', '==', userId)));
    return snap.docs.map((d) => d.data())[0] || null;
  },

  async createProject(data) {
    const { db, F } = await fb();
    const year = data.basicInfo.fiscalYear;
    const deptCode = (data.deptCode || 'GEN').toUpperCase();
    const counterRef = F.doc(db, 'counters', `${year}-${deptCode}`);
    const seq = await F.runTransaction(db, async (tx) => {
      const snap = await tx.get(counterRef);
      const next = (snap.exists() ? (snap.data().seq || 0) : 0) + 1;
      tx.set(counterRef, { seq: next });
      return next;
    });
    const projectId = `${year}-${deptCode}-${String(seq).padStart(3, '0')}`;
    await F.setDoc(F.doc(db, 'projects', projectId), { ...data, projectId, deptCode });
    return { ...data, projectId, deptCode };
  },
  async getProject(projectId) {
    const { db, F } = await fb();
    const snap = await F.getDoc(F.doc(db, 'projects', projectId));
    return snap.exists() ? snap.data() : null;
  },
  async updateProject(projectId, patch) {
    const { db, F } = await fb();
    await F.updateDoc(F.doc(db, 'projects', projectId), { ...patch, updatedAt: nowIso() });
    return this.getProject(projectId);
  },
  async listProjects() {
    const { db, F } = await fb();
    const snap = await F.getDocs(F.collection(db, 'projects'));
    return snap.docs.map((d) => d.data());
  },

  // ---- 공지사항 ----
  async createNotice(projectId, data) {
    const { db, F } = await fb();
    const ref = F.doc(F.collection(db, 'projects', projectId, 'notices'));
    await F.setDoc(ref, { ...data, noticeId: ref.id, projectId });
    return { ...data, noticeId: ref.id, projectId };
  },
  async getNotice(projectId, noticeId) {
    const { db, F } = await fb();
    const snap = await F.getDoc(F.doc(db, 'projects', projectId, 'notices', noticeId));
    return snap.exists() ? snap.data() : null;
  },
  async listNotices(projectId) {
    const { db, F } = await fb();
    const snap = await F.getDocs(F.collection(db, 'projects', projectId, 'notices'));
    return snap.docs.map((d) => d.data());
  },
  async updateNotice(projectId, noticeId, patch) {
    const { db, F } = await fb();
    await F.updateDoc(F.doc(db, 'projects', projectId, 'notices', noticeId), patch);
    return this.getNotice(projectId, noticeId);
  },

  // ---- 댓글 ----
  async listComments(projectId, noticeId) {
    const { db, F } = await fb();
    const snap = await F.getDocs(F.collection(db, 'projects', projectId, 'notices', noticeId, 'comments'));
    return snap.docs.map((d) => d.data());
  },
  async createComment(projectId, noticeId, data) {
    const { db, F } = await fb();
    const ref = F.doc(F.collection(db, 'projects', projectId, 'notices', noticeId, 'comments'));
    await F.setDoc(ref, { ...data, commentId: ref.id });
    return { ...data, commentId: ref.id };
  },
  async updateComment(projectId, noticeId, commentId, patch) {
    const { db, F } = await fb();
    await F.updateDoc(F.doc(db, 'projects', projectId, 'notices', noticeId, 'comments', commentId), patch);
  },

  // ---- 알림 ----
  async createNotification(uid, data) {
    const { db, F } = await fb();
    const ref = F.doc(F.collection(db, 'users', uid, 'notifications'));
    await F.setDoc(ref, { ...data, id: ref.id, uid });
    return { ...data, id: ref.id, uid };
  },
  async listNotifications(uid) {
    const { db, F } = await fb();
    const snap = await F.getDocs(F.collection(db, 'users', uid, 'notifications'));
    return snap.docs.map((d) => d.data());
  },
  async updateNotification(uid, id, patch) {
    const { db, F } = await fb();
    await F.updateDoc(F.doc(db, 'users', uid, 'notifications', id), patch);
  },
  async markAllNotificationsRead(uid) {
    const { db, F } = await fb();
    const snap = await F.getDocs(F.collection(db, 'users', uid, 'notifications'));
    await Promise.all(snap.docs.map((d) => F.updateDoc(d.ref, { read: true })));
  },

  // ---- 협업 게시글 ----
  async createPost(projectId, collection, data) {
    const { db, F } = await fb();
    const ref = F.doc(F.collection(db, 'projects', projectId, collection));
    await F.setDoc(ref, { ...data, postId: ref.id, projectId, collection });
    return { ...data, postId: ref.id, projectId, collection };
  },
  async getPost(projectId, collection, postId) {
    const { db, F } = await fb();
    const snap = await F.getDoc(F.doc(db, 'projects', projectId, collection, postId));
    return snap.exists() ? snap.data() : null;
  },
  async listPosts(projectId, collection) {
    const { db, F } = await fb();
    const snap = await F.getDocs(F.collection(db, 'projects', projectId, collection));
    return snap.docs.map((d) => d.data());
  },
  async updatePost(projectId, collection, postId, patch) {
    const { db, F } = await fb();
    await F.updateDoc(F.doc(db, 'projects', projectId, collection, postId), patch);
    return this.getPost(projectId, collection, postId);
  },
  async listPostComments(projectId, collection, postId) {
    const { db, F } = await fb();
    const snap = await F.getDocs(F.collection(db, 'projects', projectId, collection, postId, 'comments'));
    return snap.docs.map((d) => d.data());
  },
  async createPostComment(projectId, collection, postId, data) {
    const { db, F } = await fb();
    const ref = F.doc(F.collection(db, 'projects', projectId, collection, postId, 'comments'));
    await F.setDoc(ref, { ...data, commentId: ref.id });
    return { ...data, commentId: ref.id };
  },
  async updatePostComment(projectId, collection, postId, commentId, patch) {
    const { db, F } = await fb();
    await F.updateDoc(F.doc(db, 'projects', projectId, collection, postId, 'comments', commentId), patch);
  },

  // ---- 데이터 내보내기/가져오기 ----
  // Firebase 모드의 대량 내보내기/복원은 Firestore 콘솔 또는
  // gcloud firestore export 사용을 권장한다 (작업지시서 §8.4).
  async exportAll() {
    throw new AuthError('not-supported',
      'Firebase 모드의 전체 내보내기는 Firestore 콘솔/gcloud 를 이용하세요.');
  },
  async exportProject() {
    throw new AuthError('not-supported',
      'Firebase 모드의 사업 내보내기는 Firestore 콘솔/gcloud 를 이용하세요.');
  },
  async importBundle() {
    throw new AuthError('not-supported',
      'Firebase 모드의 데이터 가져오기는 Firestore 콘솔/gcloud 를 이용하세요.');
  },
};

/* ============================================================
 * 파일 저장소 (Storage)
 * ============================================================ */

const mockStorage = {
  async uploadFile(path, file, onProgress) {
    // 목업: 파일 바이트는 보관하지 않고 메타데이터만 기록한다.
    if (onProgress) { onProgress(40); onProgress(100); }
    return {
      path, name: file.name, size: file.size,
      type: file.type || 'application/octet-stream',
      url: null, uploadedAt: nowIso(),
    };
  },
  async deleteFile() { /* 목업: noop */ },
};

const firebaseStorage = {
  async uploadFile(path, file, onProgress) {
    const { storage, S } = await fb();
    const ref = S.ref(storage, path);
    const task = S.uploadBytesResumable(ref, file);
    await new Promise((resolve, reject) => {
      task.on('state_changed',
        (snap) => onProgress && onProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
        reject, resolve);
    });
    const url = await S.getDownloadURL(ref);
    return { path, name: file.name, size: file.size, type: file.type, url, uploadedAt: nowIso() };
  },
  async deleteFile(path) {
    const { storage, S } = await fb();
    await S.deleteObject(S.ref(storage, path));
  },
};

/* ============================================================
 * 통합 인터페이스
 * ============================================================ */

export const Auth = isMock ? mockAuth : firebaseAuth;
export const Db = isMock ? mockDb : firebaseDb;
export const Storage = isMock ? mockStorage : firebaseStorage;

/** Firebase 모드에서 ready() 이후 현재 인증 사용자 조회 (mock 은 동기) */
export async function getAuthUserSafe() {
  if (isMock) return mockAuth.currentUser();
  return firebaseAuth.currentUserAsync();
}
