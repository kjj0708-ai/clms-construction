/**
 * auth.js — 인증·권한 미들웨어
 *
 * 페이지 가드(접근 제어), 현재 사용자 조회, 로그인 후 라우팅을 담당한다.
 * 백엔드(mock/firebase) 차이는 backend.js 가 흡수하므로 여기서는 신경 쓰지 않는다.
 */

import { Auth, Db, getAuthUserSafe } from './backend.js';

let _userCache = null;
let _userLoaded = false;

/** 현재 인증 사용자(uid·email·phone·provider) 또는 null */
export async function currentAuthUser() {
  await Auth.ready();
  return getAuthUserSafe();
}

/** 현재 앱 사용자 문서(users/{uid}). 캐시됨. */
export async function getCurrentUser({ force = false } = {}) {
  if (_userLoaded && !force) return _userCache;
  const authUser = await currentAuthUser();
  _userCache = authUser ? await Db.getUser(authUser.uid) : null;
  _userLoaded = true;
  return _userCache;
}

export function clearUserCache() {
  _userCache = null;
  _userLoaded = false;
}

/**
 * 인증 상태를 판정한다.
 * @returns {{state:'no-auth'|'no-profile'|'pending'|'active'|'inactive', authUser, user}}
 */
export async function resolveState() {
  const authUser = await currentAuthUser();
  if (!authUser) return { state: 'no-auth', authUser: null, user: null };

  // 부트스트랩 관리자: kjj0708@gmail.com 은 항상 system_admin 으로 처리
  if (authUser.email === 'kjj0708@gmail.com') {
    const existingUser = await Db.getUser(authUser.uid);
    const adminUser = {
      uid: authUser.uid,
      email: authUser.email,
      name: (existingUser && existingUser.name) || authUser.displayName || '관리자',
      department: (existingUser && existingUser.department) || '',
      position: (existingUser && existingUser.position) || '',
      contact: (existingUser && existingUser.contact) || '',
      userType: (existingUser && existingUser.userType) || 'officer',
      note: (existingUser && existingUser.note) || '',
      role: 'system_admin',
      status: 'active',
      accessibleProjects: (existingUser && existingUser.accessibleProjects) || [],
      authProvider: authUser.provider,
      createdAt: (existingUser && existingUser.createdAt) || new Date().toISOString(),
      approvedAt: (existingUser && existingUser.approvedAt) || new Date().toISOString(),
      approvedBy: 'system',
      lastLoginAt: new Date().toISOString(),
    };
    // Firestore 문서도 백그라운드로 업데이트
    Db.setUser(authUser.uid, adminUser).catch(() => {});
    _userCache = adminUser;
    _userLoaded = true;
    return { state: 'active', authUser, user: adminUser };
  }

  const user = await Db.getUser(authUser.uid);
  if (!user) return { state: 'no-profile', authUser, user: null };
  const state = user.status === 'active' ? 'active'
    : user.status === 'inactive' ? 'inactive' : 'pending';
  _userCache = user;
  _userLoaded = true;
  return { state, authUser, user };
}

const DESTINATION = {
  'no-auth': '/index.html',
  'no-profile': '/signup-info.html',
  'pending': '/pending.html',
  'active': '/dashboard.html',
  'inactive': '/index.html?blocked=1',
};

export function destinationFor(state) {
  return DESTINATION[state] || '/index.html';
}

/** 로그인 직후 호출 — 상태에 따라 이동할 경로를 함께 반환 */
export async function routeAfterAuth() {
  const s = await resolveState();
  return { ...s, dest: destinationFor(s.state) };
}

/* ---- 페이지 가드 ----
 * 허용되지 않은 상태면 적절한 화면으로 redirect 하고 null 을 반환한다.
 * 페이지는 반환값이 null 이면 렌더링을 중단해야 한다. */

async function guard(allowedStates) {
  const s = await resolveState();
  if (!allowedStates.includes(s.state)) {
    location.replace(destinationFor(s.state));
    return null;
  }
  return s;
}

/** 가입 정보 입력 화면: 프로필 미작성 또는 승인 대기(수정) 상태만 허용 */
export async function requireSignup() {
  return guard(['no-profile', 'pending']);
}

/** 승인 대기 화면 */
export async function requirePending() {
  const s = await guard(['pending']);
  return s ? s.user : null;
}

/** 활성 사용자 전용 화면(대시보드·내 정보 등) */
export async function requireActive() {
  const s = await guard(['active']);
  return s ? s.user : null;
}

/** 특정 역할 전용 화면 */
export async function requireRole(roles) {
  const user = await requireActive();
  if (!user) return null;
  if (!roles.includes(user.role)) {
    location.replace('/dashboard.html');
    return null;
  }
  return user;
}

/** 로그아웃 후 이동 */
export async function logout(redirect = '/index.html') {
  try { await Auth.signOut(); } catch { /* noop */ }
  clearUserCache();
  window.location.href = redirect;
}

/* ---- 작업지시서 §3.2 항목9 명세 별칭 ---- */

export async function checkAuth() {
  return !!(await currentAuthUser());
}
export async function checkActive() {
  const u = await getCurrentUser();
  return !!u && u.status === 'active';
}
export async function checkRole(roles) {
  const u = await getCurrentUser();
  return !!u && roles.includes(u.role);
}
/** 사업 접근 권한 — 전사 조회 권한자는 항상 true, 그 외는 accessibleProjects 검사 */
export function checkProjectAccess(user, projectId) {
  if (!user) return false;
  if (['system_admin', 'national_director'].includes(user.role)) return true;
  return Array.isArray(user.accessibleProjects) && user.accessibleProjects.includes(projectId);
}
