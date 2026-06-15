# 공사관리시스템 (CMS)

> 발주처(감독공무원)·시공사·감리 3자가 **사업 개요 · 절차별(날짜) 진행상황 · 소통**을
> 가볍게 공유하는 모바일 우선 PWA. (문서 저장소가 아닌, 진행 공유·소통 도구)

- **기술 스택**: HTML/CSS/JS + Tailwind CSS(CDN) + Firebase
- **백엔드 자동 전환**: `firebase-config.js` 키가 placeholder면 localStorage 목업, 실제 키면 Firebase

---

## 핵심 3기능

| 기능 | 설명 |
|------|------|
| **개요** | 사업명·유형·위치·기간·예산 + 감독공무원/시공사/감리 연락처 |
| **진행상황** | 절차별 단계를 **날짜 + 상태(예정/진행/완료)** 타임라인으로 관리. 진행률 자동 계산. "표준 12단계" 일괄 추가 |
| **소통** | **공지 · 질의 · 지시** 3종 게시판 + 답글. 작성자 역할 배지, 본문 URL 자동 링크, 새 글·답글 알림 |

> 공지·지시는 감독공무원이, 질의는 모든 참여자가 작성. 답글은 누구나.

---

## 폴더 구조

```
clms/
├── firebase.json / .firebaserc / firestore.rules / storage.rules
└── public/                       # 배포 루트
    ├── index.html                # 로그인 (구글·이메일·휴대폰)
    ├── signup-info.html          # 가입 정보 입력
    ├── pending.html              # 승인 대기
    ├── dashboard.html            # 내 사업 목록 + 통계
    ├── project-new.html          # 사업 등록·수정 (단일 폼)
    ├── project.html              # 사업: 개요 / 진행상황 / 소통
    ├── profile.html              # 내 정보
    ├── admin/approvals.html      # 관리자 — 가입 승인
    ├── offline.html · manifest.json · service-worker.js · icons/
    ├── css/styles.css
    └── js/
        ├── firebase-config.js    # ★ Firebase 키 입력 위치 (한 곳)
        ├── constants.js          # 역할·카테고리·진행상태·12단계 템플릿
        ├── backend.js            # Auth + Db (Firebase ↔ 목업)
        ├── auth.js               # 페이지 가드·라우팅
        ├── projects.js           # 접근권한·진행률·포맷터
        ├── communication.js      # 공지·질의·지시 + 답글 + 알림
        ├── app.js · tailwind-config.js
        └── components/           # layout · link-renderer · comment-thread · image-viewer · post-actions
```

---

## 실행

```bash
npm start            # http://localhost:5000 (목업 모드, Firebase 불필요)
```

목업 데모 로그인:
- 로그인 화면 하단 **데모 모드** 패널에서 역할 선택 (감독공무원/시공사/감리 등)
- 또는 관리자 이메일 `admin@clms.local` / 비밀번호 `admin1234`

예시 사업 2건과 공지·질의 샘플이 시드되어 있습니다.

## Firebase 연동 / 배포

1. Firebase 콘솔에서 웹 앱 등록 → `firebaseConfig` 복사
2. Authentication / Firestore 활성화 (리전 `asia-northeast3`)
3. `public/js/firebase-config.js`에 키 입력 (이 순간 자동으로 Firebase 모드)
4. 배포: `firebase deploy --only hosting` (규칙까지: `firebase deploy`)

- 라이브: https://clms-construction.web.app
- 저장소: https://github.com/kjj0708-ai/clms-construction

---

## 색상 테마

deep navy `#1a3a5c` · gold `#c9a961`
