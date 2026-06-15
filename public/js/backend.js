/**
 * 백엔드 추상화 레이어 — 인증(Auth) + 데이터(Db)  · 심플 버전
 * ============================================================
 * firebase-config.js 의 키가 실제 값이면 → 'firebase' 모드 (Firebase SDK)
 * placeholder 상태면 → 'mock' 모드 (localStorage 백엔드)
 *
 * 데이터 범위(심플):
 *   users / approval_requests / projects(개요+진행상황) / posts(소통) / notifications
 * ============================================================
 */

import { firebaseConfig, isFirebaseConfigured } from './firebase-config.js';
import { ROLES } from './constants.js';

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

export class AuthError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = 'AuthError';
    this.code = code;
  }
}

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
  } catch { return fallback; }
}
function writeLS(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
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
  department_head:  { name: '김과장',  department: '도시주택국 건축과',   contact: '02-000-0002' },
  manager:          { name: '이담당',  department: '도시주택국 건축과',   contact: '010-1000-2000' },
  contractor_chief: { name: '박소장',  department: '(주)대한건설',         contact: '010-2000-3000' },
  supervisor_chief: { name: '최감리',  department: '한국건설감리단',       contact: '010-3000-4000' },
};
export const DEMO_ROLE_KEYS = Object.keys(DEMO_PROFILES);

function userTypeForRole(roleKey) {
  const group = ROLES[roleKey] ? ROLES[roleKey].group : 'officer';
  if (group === 'contractor') return 'contractor';
  if (group === 'supervisor') return 'supervisor';
  return 'officer';
}

function blankDb() {
  return { users: {}, approval_requests: {}, counters: {}, projects: {}, posts: {}, postComments: {}, notifications: {} };
}

/** 목업 DB 초기 시드 (최초 1회) */
function seedMockData() {
  let db = readLS(LS_DB, null);
  let accounts = readLS(LS_ACCOUNTS, null);
  if (db && accounts) return;

  db = blankDb();
  accounts = {};

  // 기본 시스템 관리자
  accounts['seed-admin'] = { uid: 'seed-admin', email: 'admin@clms.local', provider: 'email', password: hashPassword('admin1234'), emailVerified: true };
  db.users['seed-admin'] = {
    uid: 'seed-admin', name: '시스템 관리자', department: '도시주택국 정보화팀', position: '관리자',
    contact: '02-000-0000', email: 'admin@clms.local', userType: 'officer', note: '기본 관리자 계정',
    role: 'system_admin', status: 'active', accessibleProjects: [], authProvider: 'email',
    createdAt: nowIso(), approvedAt: nowIso(), approvedBy: 'system', lastLoginAt: null,
  };

  // 승인 대기 예시 2명
  const pendings = [
    { uid: 'seed-pending-1', name: '박현장', department: '(주)대한건설', position: '현장소장', contact: '010-2222-3333', email: 'park@daehan.co.kr', userType: 'contractor', note: '○○도로공사 현장소장입니다.' },
    { uid: 'seed-pending-2', name: '정감리', department: '한국건설감리단', position: '책임감리원', contact: '010-4444-5555', email: 'jung@kcm.co.kr', userType: 'supervisor', note: '감리 배정 예정입니다.' },
  ];
  for (const p of pendings) {
    accounts[p.uid] = { uid: p.uid, email: p.email, provider: 'email', password: hashPassword('test1234'), emailVerified: true };
    db.users[p.uid] = { ...p, role: 'pending', status: 'pending', accessibleProjects: [], authProvider: 'email', createdAt: nowIso(), approvedAt: null, approvedBy: null, lastLoginAt: null };
    const reqId = genId('req-');
    db.approval_requests[reqId] = { requestId: reqId, userId: p.uid, userInfo: { name: p.name, department: p.department, position: p.position, contact: p.contact, email: p.email, userType: p.userType, note: p.note }, requestedAt: nowIso(), status: 'pending', processedAt: null, processedBy: null, rejectionReason: null };
  }

  // 3자 참여자 (데모 uid 연결)
  const members1 = {
    officer:    { uid: 'demo-manager',          name: '이담당', org: '도시주택국 건축과', contact: '010-1000-2000' },
    contractor: { uid: 'demo-contractor_chief', name: '박소장', org: '(주)대한건설',       contact: '010-2000-3000' },
    supervisor: { uid: 'demo-supervisor_chief', name: '최감리', org: '한국건설감리단',     contact: '010-3000-4000' },
  };

  // 예시 사업 2건
  db.projects['2026-DOSI-001'] = {
    projectId: '2026-DOSI-001', deptCode: 'DOSI',
    basicInfo: { name: '행복로 도로개설공사', type: '도로공사', department: '도시주택국 건축과', location: '○○시 ○○구 행복로 일원', startDate: '2026-03-01', endDate: '2027-12-31', totalBudget: 4800000000, summary: '행복로 1.2km 구간 도로 신설 및 보도 정비' },
    members: JSON.parse(JSON.stringify(members1)),
    progress: [
      { id: 'pg1', title: '예산편성', date: '2026-01-05', status: 'done', note: '본예산 반영' },
      { id: 'pg2', title: '설계용역 완료', date: '2026-02-20', status: 'done', note: '' },
      { id: 'pg3', title: '공사계약 체결', date: '2026-03-10', status: 'done', note: '(주)대한건설' },
      { id: 'pg4', title: '착공', date: '2026-03-25', status: 'done', note: '' },
      { id: 'pg5', title: '시공 (노반·포장)', date: '2026-04-01', status: 'in_progress', note: '현재 노반 공정' },
      { id: 'pg6', title: '준공검사', date: '2026-12-10', status: 'planned', note: '' },
    ],
    createdAt: nowIso(), createdBy: 'demo-manager', updatedAt: nowIso(), status: 'active',
  };
  db.projects['2026-DOSI-002'] = {
    projectId: '2026-DOSI-002', deptCode: 'DOSI',
    basicInfo: { name: '△△ 어린이공원 조성공사', type: '조경공사', department: '도시주택국 건축과', location: '○○시 ○○구 △△동 123', startDate: '2026-06-01', endDate: '2027-06-30', totalBudget: 1250000000, summary: '△△동 근린 어린이공원 신규 조성' },
    members: { officer: members1.officer, contractor: { uid: null, name: '', org: '', contact: '' }, supervisor: { uid: null, name: '', org: '', contact: '' } },
    progress: [
      { id: 'pg1', title: '예산편성', date: '2026-01-10', status: 'done', note: '' },
      { id: 'pg2', title: '설계용역', date: '2026-03-02', status: 'done', note: '' },
      { id: 'pg3', title: '발주공고', date: '2026-05-20', status: 'in_progress', note: '나라장터 공고 중' },
      { id: 'pg4', title: '입찰·낙찰', date: '2026-06-15', status: 'planned', note: '' },
    ],
    createdAt: nowIso(), createdBy: 'demo-manager', updatedAt: nowIso(), status: 'active',
  };
  db.counters['2026-DOSI'] = 2;

  // 소통 샘플
  const post = (pid, coll, id, data) => {
    const key = `${pid}|${coll}`;
    db.posts[key] = db.posts[key] || {};
    db.posts[key][id] = { postId: id, projectId: pid, collection: coll, ...data };
  };
  post('2026-DOSI-001', 'notice', 'seed-n1', {
    type: 'notice', title: '정기 안전점검 일정 안내',
    content: '금주 금요일 14시에 현장 정기 안전점검을 실시합니다. 전 참여자 입회 바랍니다.\n관련 양식: https://www.law.go.kr',
    author: { uid: 'demo-department_head', name: '김과장', role: 'department_head' },
    readBy: {}, commentCount: 1, createdAt: nowIso(), updatedAt: null, deletedAt: null, revisions: [],
  });
  db.postComments['2026-DOSI-001|notice|seed-n1'] = {
    'seed-c1': { commentId: 'seed-c1', parentCommentId: null, author: { uid: 'demo-contractor_chief', name: '박소장', role: 'contractor_chief' }, content: '확인했습니다. 안전관리자 입회하겠습니다.', images: [], createdAt: nowIso(), updatedAt: null, deletedAt: null },
  };
  post('2026-DOSI-001', 'inquiry', 'seed-q1', {
    type: 'inquiry', title: '아스팔트 포장 두께 확인 요청',
    content: '설계도서상 표층 두께가 5cm로 되어 있는데, 현장 여건상 변경 가능한지 검토 부탁드립니다.',
    author: { uid: 'demo-contractor_chief', name: '박소장', role: 'contractor_chief' },
    readBy: {}, commentCount: 0, createdAt: nowIso(), updatedAt: null, deletedAt: null, revisions: [],
  });

  writeLS(LS_DB, db);
  writeLS(LS_ACCOUNTS, accounts);
}

function mockAuthUser(account) {
  if (!account) return null;
  return {
    uid: account.uid, email: account.email || null, phone: account.phone || null,
    provider: account.provider, displayName: account.googleName || null,
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
    if (!picked || !picked.email) throw new AuthError('google-account-required', '구글 계정을 선택해 주세요.');
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
    if (Object.values(accounts).some((a) => a.email === email)) throw new AuthError('email-already-in-use', '이미 가입된 이메일입니다.');
    const account = { uid: genId('e-'), email, provider: 'email', password: hashPassword(password), emailVerified: false };
    accounts[account.uid] = account;
    writeLS(LS_ACCOUNTS, accounts);
    localStorage.setItem(LS_SESSION, account.uid);
    return mockAuthUser(account);
  },
  async signInWithEmail(email, password) {
    const accounts = readLS(LS_ACCOUNTS, {});
    const account = Object.values(accounts).find((a) => a.email === email && a.provider === 'email');
    if (!account) throw new AuthError('user-not-found', '등록되지 않은 이메일입니다.');
    if (account.password !== hashPassword(password)) throw new AuthError('wrong-password', '비밀번호가 일치하지 않습니다.');
    localStorage.setItem(LS_SESSION, account.uid);
    return mockAuthUser(account);
  },
  async startPhoneSignIn(phone) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    return { _mock: true, phone: normalizePhone(phone), code };
  },
  async confirmPhoneCode(handle, code) {
    if (String(code) !== String(handle.code)) throw new AuthError('invalid-verification-code', '인증번호가 일치하지 않습니다.');
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
    if (!uid || !accounts[uid] || accounts[uid].provider !== 'email') throw new AuthError('not-email-user', '이메일 계정만 비밀번호를 변경할 수 있습니다.');
    accounts[uid].password = hashPassword(newPassword);
    writeLS(LS_ACCOUNTS, accounts);
  },
  async signOut() { localStorage.removeItem(LS_SESSION); },

  /** 데모 빠른 로그인 — 역할별 활성 사용자를 즉시 생성/로그인 (목업 전용) */
  devQuickLogin(roleKey) {
    seedMockData();
    const profile = DEMO_PROFILES[roleKey] || { name: '데모', department: '데모', contact: '' };
    const uid = 'demo-' + roleKey;
    const accounts = readLS(LS_ACCOUNTS, {});
    const db = readLS(LS_DB, blankDb());
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
  async getUser(uid) { return readLS(LS_DB, { users: {} }).users[uid] || null; },
  async setUser(uid, data) {
    const db = readLS(LS_DB, blankDb());
    db.users[uid] = { ...data, uid };
    writeLS(LS_DB, db);
    return db.users[uid];
  },
  async updateUser(uid, patch) {
    const db = readLS(LS_DB, blankDb());
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
    const db = readLS(LS_DB, blankDb());
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
    const db = readLS(LS_DB, blankDb());
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
  async deleteUserAndRequest(userId, requestId) {
    const db = readLS(LS_DB, blankDb());
    if (db.users) delete db.users[userId];
    if (db.approval_requests && requestId) delete db.approval_requests[requestId];
    writeLS(LS_DB, db);
  },

  // ---- 사업 ----
  async createProject(data) {
    const db = readLS(LS_DB, blankDb());
    const year = new Date().getFullYear();
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
    const db = readLS(LS_DB, blankDb());
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

  // ---- 소통 게시글 (collection: notice|inquiry|instruction) ----
  async createPost(projectId, collection, data) {
    const db = readLS(LS_DB, blankDb());
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
    const db = readLS(LS_DB, blankDb());
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
    const db = readLS(LS_DB, blankDb());
    const key = `${projectId}|${collection}|${postId}`;
    db.postComments[key] = db.postComments[key] || {};
    const commentId = genId('cmt-');
    db.postComments[key][commentId] = { ...data, commentId };
    writeLS(LS_DB, db);
    return db.postComments[key][commentId];
  },
  async updatePostComment(projectId, collection, postId, commentId, patch) {
    const db = readLS(LS_DB, blankDb());
    const key = `${projectId}|${collection}|${postId}`;
    db.postComments[key] = db.postComments[key] || {};
    if (db.postComments[key][commentId]) {
      db.postComments[key][commentId] = { ...db.postComments[key][commentId], ...patch };
      writeLS(LS_DB, db);
    }
    return db.postComments[key][commentId];
  },

  // ---- 알림 ----
  async createNotification(uid, data) {
    const db = readLS(LS_DB, blankDb());
    db.notifications[uid] = db.notifications[uid] || {};
    const id = genId('ntf-');
    db.notifications[uid][id] = { ...data, id, uid, read: false, createdAt: nowIso() };
    writeLS(LS_DB, db);
    return db.notifications[uid][id];
  },
  async listNotifications(uid) {
    return Object.values((readLS(LS_DB, {}).notifications || {})[uid] || {})
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  },
  async markAllNotificationsRead(uid) {
    const db = readLS(LS_DB, blankDb());
    const all = db.notifications[uid] || {};
    for (const id of Object.keys(all)) all[id].read = true;
    writeLS(LS_DB, db);
  },
  async uploadImage(base64DataUrl) {
    return base64DataUrl;
  },
};

/* ============================================================
 * Firebase 백엔드
 * ============================================================ */

const FB_SDK = 'https://www.gstatic.com/firebasejs/10.12.2';
let _fbPromise = null;

async function fb() {
  if (_fbPromise) return _fbPromise;
  _fbPromise = (async () => {
    const [appMod, authMod, fsMod, storageMod] = await Promise.all([
      import(`${FB_SDK}/firebase-app.js`),
      import(`${FB_SDK}/firebase-auth.js`),
      import(`${FB_SDK}/firebase-firestore.js`),
      import(`${FB_SDK}/firebase-storage.js`),
    ]);
    const app = appMod.initializeApp(firebaseConfig);
    return { app, A: authMod, F: fsMod, S: storageMod, auth: authMod.getAuth(app), db: fsMod.getFirestore(app), storage: storageMod.getStorage(app) };
  })();
  return _fbPromise;
}

function mapFbUser(u) {
  if (!u) return null;
  const provider = (u.providerData[0] && u.providerData[0].providerId) || '';
  return {
    uid: u.uid, email: u.email || null, phone: u.phoneNumber || null,
    provider: provider.includes('google') ? 'google' : provider.includes('phone') ? 'phone' : 'email',
    displayName: u.displayName || null, emailVerified: u.emailVerified,
  };
}

const firebaseAuth = {
  async ready() {
    const { auth, A } = await fb();
    await new Promise((resolve) => { const unsub = A.onAuthStateChanged(auth, () => { unsub(); resolve(); }); });
  },
  currentUser() { return null; },
  async currentUserAsync() { const { auth } = await fb(); return mapFbUser(auth.currentUser); },
  async signInWithGoogle() {
    const { auth, A } = await fb();
    const cred = await A.signInWithPopup(auth, new A.GoogleAuthProvider());
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
  async confirmPhoneCode(handle, code) { const cred = await handle.confirmationResult.confirm(code); return mapFbUser(cred.user); },
  async changePassword(newPassword) {
    const { auth, A } = await fb();
    if (!auth.currentUser) throw new AuthError('no-user', '로그인이 필요합니다.');
    await A.updatePassword(auth.currentUser, newPassword);
  },
  async signOut() { const { auth, A } = await fb(); await A.signOut(auth); },
};

const firebaseDb = {
  async getUser(uid) { const { db, F } = await fb(); const s = await F.getDoc(F.doc(db, 'users', uid)); return s.exists() ? s.data() : null; },
  async setUser(uid, data) { const { db, F } = await fb(); await F.setDoc(F.doc(db, 'users', uid), { ...data, uid }); return { ...data, uid }; },
  async updateUser(uid, patch) { const { db, F } = await fb(); await F.updateDoc(F.doc(db, 'users', uid), patch); return this.getUser(uid); },
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
  async updateApprovalRequest(requestId, patch) { const { db, F } = await fb(); await F.updateDoc(F.doc(db, 'approval_requests', requestId), patch); },
  async findApprovalRequestByUser(userId) {
    const { db, F } = await fb();
    const snap = await F.getDocs(F.query(F.collection(db, 'approval_requests'), F.where('userId', '==', userId)));
    return snap.docs.map((d) => d.data())[0] || null;
  },
  async deleteUserAndRequest(userId, requestId) {
    const { db, F } = await fb();
    await F.deleteDoc(F.doc(db, 'users', userId));
    if (requestId) {
      await F.deleteDoc(F.doc(db, 'approval_requests', requestId));
    }
  },

  async createProject(data) {
    const { db, F } = await fb();
    const year = new Date().getFullYear();
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
  async getProject(projectId) { const { db, F } = await fb(); const s = await F.getDoc(F.doc(db, 'projects', projectId)); return s.exists() ? s.data() : null; },
  async updateProject(projectId, patch) { const { db, F } = await fb(); await F.updateDoc(F.doc(db, 'projects', projectId), { ...patch, updatedAt: nowIso() }); return this.getProject(projectId); },
  async listProjects() { const { db, F } = await fb(); const snap = await F.getDocs(F.collection(db, 'projects')); return snap.docs.map((d) => d.data()); },

  async createPost(projectId, collection, data) {
    const { db, F } = await fb();
    const ref = F.doc(F.collection(db, 'projects', projectId, collection));
    await F.setDoc(ref, { ...data, postId: ref.id, projectId, collection });
    return { ...data, postId: ref.id, projectId, collection };
  },
  async getPost(projectId, collection, postId) { const { db, F } = await fb(); const s = await F.getDoc(F.doc(db, 'projects', projectId, collection, postId)); return s.exists() ? s.data() : null; },
  async listPosts(projectId, collection) { const { db, F } = await fb(); const snap = await F.getDocs(F.collection(db, 'projects', projectId, collection)); return snap.docs.map((d) => d.data()); },
  async updatePost(projectId, collection, postId, patch) { const { db, F } = await fb(); await F.updateDoc(F.doc(db, 'projects', projectId, collection, postId), patch); return this.getPost(projectId, collection, postId); },
  async listPostComments(projectId, collection, postId) { const { db, F } = await fb(); const snap = await F.getDocs(F.collection(db, 'projects', projectId, collection, postId, 'comments')); return snap.docs.map((d) => d.data()); },
  async createPostComment(projectId, collection, postId, data) {
    const { db, F } = await fb();
    const ref = F.doc(F.collection(db, 'projects', projectId, collection, postId, 'comments'));
    await F.setDoc(ref, { ...data, commentId: ref.id });
    return { ...data, commentId: ref.id };
  },
  async updatePostComment(projectId, collection, postId, commentId, patch) { const { db, F } = await fb(); await F.updateDoc(F.doc(db, 'projects', projectId, collection, postId, 'comments', commentId), patch); },

  async createNotification(uid, data) {
    const { db, F } = await fb();
    const ref = F.doc(F.collection(db, 'users', uid, 'notifications'));
    await F.setDoc(ref, { ...data, id: ref.id, uid, read: false, createdAt: nowIso() });
    return { ...data, id: ref.id, uid };
  },
  async listNotifications(uid) { const { db, F } = await fb(); const snap = await F.getDocs(F.collection(db, 'users', uid, 'notifications')); return snap.docs.map((d) => d.data()); },
  async markAllNotificationsRead(uid) {
    const { db, F } = await fb();
    const snap = await F.getDocs(F.collection(db, 'users', uid, 'notifications'));
    await Promise.all(snap.docs.map((d) => F.updateDoc(d.ref, { read: true })));
  },
  async uploadImage(base64DataUrl) {
    const { storage, S } = await fb();
    const name = `uploads/${Date.now()}_${Math.random().toString(36).slice(2,8)}.jpg`;
    const ref = S.ref(storage, name);
    await S.uploadString(ref, base64DataUrl, 'data_url');
    return await S.getDownloadURL(ref);
  },
};

/* ============================================================
 * 통합 인터페이스
 * ============================================================ */

export const Auth = isMock ? mockAuth : firebaseAuth;
export const Db = isMock ? mockDb : firebaseDb;

/** ready() 이후 현재 인증 사용자 조회 */
export async function getAuthUserSafe() {
  if (isMock) return mockAuth.currentUser();
  return firebaseAuth.currentUserAsync();
}
