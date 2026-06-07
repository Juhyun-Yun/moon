# 🌙 달의 위상 여행 앱

한 달 동안 달의 모양 변화를 탐구하고 도전 퀴즈로 학습하는 웹앱입니다.
학생은 이름을 골라 학습하고, 결과(점수·정답률·날짜)는 **구글 스프레드시트**에 자동으로 쌓입니다.

> **구조 한눈에 보기 (단일 백엔드)**
> - **관리자(개발자)가 최초 1번**: 시트 웹앱 주소(`.../exec`)를 `index.html`의 `DEFAULT_API_URL`에 박아넣고 GitHub Pages 배포
> - 이후 **선생님은 아무것도 배포/연결/링크 생성 안 함** → GitHub 앱 주소만 사용
> - **학생**은 앱 주소를 누르고 **이름만 고르면** 끝 (설정 없음)
> - 모든 선생님·학생이 **하나의 GitHub 앱 + 하나의 스프레드시트**를 공유
> - `index.html`(앱 본체)은 **GitHub에만**, Apps Script에는 **`Code.gs`만** → 코드 노출 최소화

---

## 📁 파일 구성

| 파일 | 용도 | 어디에? |
|------|------|---------|
| `index.html` | 학생용 학습 앱 (화면) | **GitHub Pages** |
| `moon.jpg` | 달 사진 | **GitHub Pages** |
| `Code.gs` | 서버 코드 + 사이드바 + 대시보드 + 선생님 가이드 | 스프레드시트의 Apps Script |
| `Sidebar.html` / `Dashboard.html` | (참고용 — Code.gs에 내장되어 있어 불필요) | — |
| `moon_image_b64.html` | (이 구조에선 불필요 — index.html을 Apps Script에 안 넣으므로) | — |
| `설정안내.txt` | 선생님용 한글 설정 안내 | — |

---

## 1️⃣ 관리자(개발자) — 최초 1번만 설정

선생님은 아무것도 배포/연결하지 않습니다. **관리자가 한 번만** 연결해 두면 끝입니다.

1. 구글 시트 1개 만들기(`sheets.new`) → [확장 프로그램] → [Apps Script]
   → `Code.gs` 붙여넣기(저장). **`index.html`은 Apps Script에 넣지 않음**(코드 노출 방지)
2. 시트 새로고침 → **[📊 달의 위상 여행 대시보드] → [🗂 시트 초기화 / 만들기]** (권한 승인)
3. Apps Script **[배포] → [새 배포] → 웹 앱** (실행: 나 / 액세스: **모든 사용자**) → `.../exec` 복사
4. **`index.html` 맨 위 `DEFAULT_API_URL`** 에 그 `.../exec` 주소를 붙여넣기
   ```js
   const DEFAULT_API_URL = 'https://script.google.com/macros/s/XXXX/exec';
   ```
5. GitHub 저장소에 **`index.html` + `moon.jpg`** 업로드 → Settings → Pages → Source `main /(root)`
   → 나오는 `https://<아이디>.github.io/<저장소>/` 가 **앱 주소**
6. (선택) `Code.gs` 상단 `APP_BASE_URL` 에도 앱 주소를 적으면 가이드 탭에 자동 표시
7. 앱 주소를 선생님들에게 공유. 끝!

---

## 2️⃣ 선생님 — 사용만 (배포·링크 없음)

스프레드시트 **「📖 선생님 가이드」 탭**에 색깔 안내가 들어 있습니다. 요약:

1. **「학생명단」 B열**에 학생 이름 입력
2. 학생에게 **앱 주소**(관리자가 공유한 GitHub 주소) 알려주기 → 학생은 주소만 누르고 이름만 고르면 끝
3. **「학습기록」 탭** / **[📈 전체 통계 보기]** 로 결과 확인

> 모든 선생님·학생이 **하나의 GitHub 앱 + 하나의 스프레드시트**를 함께 씁니다.
> 반별로 데이터를 완전히 분리하려면 "반 선택" 기능이 필요합니다(요청 시 추가).

---

## 🔧 연결 방식 (기술 메모)

GitHub Pages는 정적 호스팅이라 `google.script.run` 을 쓸 수 없습니다.
대신 앱은 `DEFAULT_API_URL`(관리자가 박아둔 시트 웹앱)과 **JSONP(GET)** 로 통신합니다.

- 명단 불러오기: `?action=getStudents&callback=...`
- 결과 저장: `?action=save&student=...&score=...&total=...&details=...&callback=...`

CORS 제약 없이 동작하며, 앱이 Apps Script 안에서 직접 실행될 때는 기존처럼 `google.script.run` 을 사용합니다(자동 감지).
