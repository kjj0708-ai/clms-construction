# 시설공사 통합관리시스템 (CLMS)

> Construction Lifecycle Management System
> 기초지자체 시설공사 사업의 전 생애주기(예산편성~하자보수)를 통합 관리하는 모바일 우선 PWA

- **대상 사용자**: 발주처 공무원 · 시공사 현장소장 · 감리원
- **핵심 가치**: 이력 보존 · 3자 소통 · 책임 명확화 · 데이터 이동성
- **기술 스택**: HTML/CSS/JS + Tailwind CSS(CDN) + Firebase + PWA

---

## 개발 진행 현황

| Phase | 내용 | 상태 |
|-------|------|------|
| **Phase 1** | 프로젝트 셋업 + PWA + 공통 컴포넌트 | ✅ 완료 |
| **Phase 2** | 통합 인증 + 관리자 승인 | ✅ 완료 |
| **Phase 3** | 사업 등록 + 12단계 관리 | ✅ 완료 |
| **Phase 4** | 공지사항 + 댓글 + 알림 | ✅ 완료 |
| **Phase 5-1** | 협업 게시판 (지시·질의·설계변경·회의록) | ✅ 완료 |
| **Phase 5-2** | 현장 아카이브 (작업일지·사진·도면) | ✅ 완료 |
| **Phase 5-3** | 안전·품질 점검 체크리스트 | ✅ 완료 |
| **Phase 6** | 보고서 + JSON 내보내기/가져오기 | ✅ 완료 |

---

## 프로젝트 구조

### 폴더 구조

```
clms/
├── firebase.json              # Firebase Hosting/Firestore/Storage 설정
├── .firebaserc                # Firebase 프로젝트 별칭
├── firestore.rules            # Firestore 보안 규칙
├── firestore.indexes.json     # Firestore 인덱스
├── storage.rules              # Storage 보안 규칙
├── package.json               # 실행 스크립트
├── tools/
│   ├── gen-icons.js           # PWA 아이콘 생성 스크립트
│   └── dev-server.js          # 의존성 없는 로컬 개발 서버
└── public/                    # ← 배포 루트 (Firebase Hosting public)
    ├── index.html             # 로그인 (구글·이메일·휴대폰)
    ├── signup-info.html       # 가입 정보 입력
    ├── pending.html           # 승인 대기 화면
    ├── dashboard.html         # 대시보드 (역할별 사업 현황)
    ├── profile.html           # 내 정보 수정
    ├── projects.html          # 사업 목록 (검색·필터)
    ├── project-new.html       # 사업 등록 (5단계 위저드)
    ├── project-detail.html    # 사업 상세 (12단계·서류·공지 탭)
    ├── notice.html            # 공지 상세 (댓글·수정·삭제)
    ├── post.html              # 협업 게시글 상세 (지시·질의·설계변경·회의록)
    ├── daily-log.html         # 작업일지 상세 (감리 확인·댓글)
    ├── inspection.html        # 점검 결과 상세 (3자 디지털 서명)
    ├── corrective-action.html # 시정조치 폐쇄루프
    ├── notifications.html     # 알림 센터
    ├── settings/
    │   └── notifications.html # 알림 설정 + 푸시 권한
    ├── admin/
    │   ├── approvals.html     # 관리자 — 가입 승인 관리
    │   └── data-management.html # 관리자 — 백업·복원·보고서
    ├── test-components.html   # 공통 컴포넌트 동작 테스트
    ├── offline.html           # 오프라인 폴백 화면
    ├── manifest.json          # PWA 매니페스트
    ├── service-worker.js      # PWA 서비스 워커 (앱 셸 캐싱)
    ├── firebase-messaging-sw.js # FCM 백그라운드 메시지 (Firebase 모드)
    ├── icons/                 # 앱 아이콘 (192/512/badge-72)
    ├── css/
    │   └── styles.css         # 커스텀 보조 스타일
    └── js/
        ├── firebase-config.js # Firebase 설정 (★ 키 입력 위치)
        ├── tailwind-config.js # Tailwind 테마(navy/gold)
        ├── constants.js       # 역할·사용자유형·사업유형 상수
        ├── stages.js          # 공사 12단계 정의 + 필수 서류
        ├── backend.js         # 백엔드 추상화 (Auth/Db/Storage)
        ├── auth.js            # 인증·권한 미들웨어 (페이지 가드)
        ├── projects.js        # 사업 접근권한·진행률·단계 전환 헬퍼
        ├── notices.js         # 공지·댓글 헬퍼 (이미지 처리·수정 이력)
        ├── notifications.js   # 인앱 알림 fan-out·설정
        ├── post-types.js      # 협업 게시글 유형 정의 (상태 흐름)
        ├── board.js           # 협업 게시글 공통 로직 (상태 전환)
        ├── archive.js         # 작업일지·사진·도면 헬퍼 (워터마크)
        ├── inspections.js     # 점검 체크리스트·시정조치·3자 서명
        ├── reports.js         # DOCX·XLSX 보고서 생성
        ├── data-io.js         # JSON 내보내기/가져오기
        ├── push.js            # FCM 푸시 (Firebase 모드)
        ├── app.js             # 공통 부트스트랩 (SW 등록 등)
        └── components/
            ├── exif-reader.js     # JPEG EXIF(촬영시각·GPS) 파서
            ├── image-compressor.js# 이미지 500KB 자동 압축 + 썸네일
            ├── image-viewer.js    # 풀스크린 줌 이미지 뷰어
            ├── link-renderer.js   # 본문 URL 자동 링크화(새 창)
            ├── comment-thread.js  # 2단계 중첩 댓글 스레드
            ├── post-actions.js    # 게시글 작성자 액션(수정·삭제)
            └── layout.js          # 공통 헤더·푸터
```

### 공통 컴포넌트 (Phase 2 이후 전 모듈에서 재사용)

| 컴포넌트 | 기능 | 주요 API |
|----------|------|----------|
| `image-compressor.js` | 이미지 500KB 이하 자동 압축, 긴 변 1280px, 썸네일 200px 생성, EXIF 보존 | `compressImage(file, { onProgress })` |
| `image-viewer.js` | 풀스크린 뷰어, 휠·핀치 줌, 드래그 이동, 이미지 클릭/ESC로 닫기 | `openImageViewer(images, options)` |
| `link-renderer.js` | 본문 URL 자동 감지 → `target="_blank" rel="noopener noreferrer"` | `renderTextWithLinks(text)` |
| `comment-thread.js` | 2단계 중첩 댓글(댓글→답글), 작성·수정·삭제, 이미지 첨부 | `renderCommentThread(el, options)` |
| `post-actions.js` | 권한 기반 작성자 액션 메뉴, 수정 모달, 소프트 삭제 | `attachPostActions(el, options)` |

---

## 실행 방법

### 1. 목업 모드로 바로 실행 (Firebase 불필요)

`firebase-config.js`의 키가 placeholder인 동안에는 **목업 모드**로 동작하여
브라우저의 localStorage를 백엔드로 사용합니다. 가장 빠른 확인 방법:

```bash
# 방법 A) Node가 있으면
npm start
#   → http://localhost:5000

# 방법 B) Python이 있으면
cd public
python -m http.server 5000
#   → http://localhost:5000
```

> ⚠️ `file://`로 직접 열면 서비스 워커·ES 모듈이 동작하지 않습니다. 반드시 로컬 서버로 여세요.

확인 페이지:
- `http://localhost:5000/` — 로그인 (목업 모드에서는 데모 로그인 가능)
- `http://localhost:5000/test-components.html` — 공통 컴포넌트 테스트

### 2. Firebase 연동 모드

1. [Firebase Console](https://console.firebase.google.com)에서 **부서 공용 구글 계정**으로
   프로젝트 생성 (이름 `clms-construction` 권장, 리전 `asia-northeast3` 서울).
2. Authentication / Firestore / Storage / Cloud Messaging / Hosting 활성화.
3. 프로젝트 설정 → 웹 앱 등록 → SDK 설정값 복사.
4. **`public/js/firebase-config.js`** 파일을 열어 placeholder 값을 실제 키로 교체.
   `apiKey`가 실제 값이 되는 순간 자동으로 Firebase 모드로 전환됩니다.
5. `.firebaserc`의 프로젝트 ID를 실제 ID로 변경.
6. 배포:
   ```bash
   firebase login
   firebase deploy
   ```

> Firebase 키 입력 위치는 **`public/js/firebase-config.js` 단 한 곳**입니다.

---

## 주요 기능

- **인증** — 구글·이메일·휴대폰 로그인, 관리자 가입 승인
- **사업 관리** — 사업 등록(5단계 위저드), 12단계 추적, 필수 서류
- **협업** — 공지·공사지시서·질의응답·설계변경·회의록 (댓글·이미지·수정 이력)
- **현장 기록** — 작업일지(감리 확인), 사진 아카이브(워터마크), 도면 버전 관리
- **안전·품질 점검** — 디지털 체크리스트, 3자 디지털 서명, 시정조치 폐쇄루프
- **알림** — 인앱 알림 + FCM 푸시(Firebase 모드)
- **보고서·데이터** — DOCX/XLSX 보고서, JSON 내보내기/가져오기

---

## 로그인 (Phase 2)

3가지 로그인 방식을 지원합니다 — **구글 / 이메일+비밀번호 / 휴대폰+SMS**.
첫 로그인 시 가입 정보를 입력하면 `pending`(승인 대기) 상태가 되고, 관리자 승인 후 사용할 수 있습니다.

목업 모드 데모 계정:

| 구분 | 방법 |
|------|------|
| 시스템 관리자 | 이메일 `admin@clms.local` / 비밀번호 `admin1234` |
| 역할별 빠른 로그인 | 로그인 화면 하단 **데모 모드** 패널에서 역할 선택 |
| 가입 흐름 체험 | 이메일 회원가입 → 정보 입력 → 관리자 계정으로 로그인하여 승인 |

> 목업 모드에서는 휴대폰 인증번호가 화면에 토스트로 표시되고, 구글 로그인은 데모 계정 선택창이 뜹니다.
> 관리자 승인 화면은 `대시보드 → 사용자 승인 관리` 또는 우측 상단 메뉴에서 진입합니다.

---

## 색상 테마

| 용도 | 색상 | HEX |
|------|------|-----|
| 메인 | deep navy | `#1a3a5c` |
| 강조 | gold | `#c9a961` |
| 위험 | red | `#dc2626` |
| 경고 | amber | `#f59e0b` |
| 성공 | green | `#16a34a` |

---

## 라이선스

내부 행정용 시스템 (UNLICENSED).
