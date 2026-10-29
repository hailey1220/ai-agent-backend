# 백엔드-데이터베이스

배포까지 완료하기

## 배포 주소

https://ai-agent-backend-2xvc.onrender.com

## 기능 소개

### 할 일 관리
- **추가 / 목록 / 완료 표시 / 삭제** — 기본 CRUD
- **마감일** — 오늘 마감은 주황색, 지난 마감은 빨간색으로 표시
- **태그** — 할 일마다 여러 개 (`공부, 집` 처럼 쉼표로 입력), 대소문자 중복은 하나로 합침
- **메모** — 할 일마다 상세 메모 (선택)

### 보기 · 찾기
- **필터** — 전체 / 미완료 / 오늘 할 일 / 마감 지남 / 완료
- **태그로 거르기** — 태그 칩을 눌러 해당 태그만 보기
- **검색** — 할 일 내용과 메모에서 글자 검색

### 로그인 · 보안
- **회원가입 / 로그인 / 로그아웃** — Supabase Auth (이메일 + 비밀번호)
- **내 할 일만 보기** — 모든 할 일에 소유자가 기록되고, DB의 RLS(행 수준 보안) 정책으로 본인 데이터만 조회·추가·수정·삭제 가능
- **키는 서버에만** — 화면 코드는 백엔드 API만 호출하고, Supabase 키는 서버의 환경변수에만 있음
- **안전한 로그인 유지** — 로그인 토큰은 화면 JS가 읽을 수 없는 httpOnly 쿠키에 보관

### 기술 구성
| 구분 | 사용 기술 |
|---|---|
| 화면 | HTML / CSS / JavaScript |
| 백엔드 | Node.js + Express |
| DB · 로그인 | Supabase (Postgres + Auth + RLS) |
| 배포 | Render |

## 실행 방법 (내 컴퓨터)

### 준비물
- Node.js 22.9 이상
- Supabase 프로젝트 (무료)

### 1. 코드 받기 · 설치
```bash
git clone https://github.com/jsseo0420/ai-agent-backend.git
cd ai-agent-backend
npm ci
```

### 2. Supabase DB 준비 (처음 한 번)
Supabase 대시보드 → **SQL Editor** 에 `supabase/schema.sql` 전체를 붙여넣고 **Run**.
표(todos, tags, todo_tags)와 RLS 정책이 만들어집니다.

### 3. 환경변수 설정
```bash
cp .env.example .env
```
`.env` 를 열어 Supabase 값을 넣습니다. (Project Settings → API Keys / Data API)
```
SUPABASE_URL=https://<프로젝트ID>.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```
> secret / service_role 키는 넣지 마세요. `.env` 는 git에 올라가지 않습니다.

### 4. 실행
```bash
npm start
```
브라우저에서 http://localhost:3000 접속 → 회원가입 / 로그인.
끌 때는 터미널에서 `Ctrl+C`.

## 배포 (Render)

| 항목 | 값 |
|---|---|
| Build Command | `npm ci` |
| Start Command | `npm start` |
| 환경변수 | `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `HOST=0.0.0.0`, `NODE_ENV=production`, `APP_URL=<배포 주소>` |

`main` 브랜치에 push 하면 자동으로 다시 배포됩니다.
