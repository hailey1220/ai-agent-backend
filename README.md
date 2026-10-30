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

## 회고: 하다가 막혔던 것들

### 1. 터미널에서 서버를 끄고 켜는 방법을 몰랐다
- **상황**: "`Ctrl+C`로 끄고 `npm start`로 켜라"는 말을 이해하지 못했다.
- **해결**: VS Code 아래쪽 터미널(`` Ctrl+` ``)을 클릭한 뒤 `Ctrl+C`를 누르고, `npm start`를 입력했다.
- **배운 점**: 서버는 터미널 하나를 차지하고 계속 실행되는 프로그램이다.

### 2. 회원가입을 누르면 "없는 API"가 떴다
- **상황**: Supabase 버전으로 바꿨는데 로그인·가입이 안 됐다.
- **원인**: **예전 SQLite 버전 서버가 3000번 포트에서 계속 켜져 있었다.** 화면 파일은 새것인데 서버는 옛날 것이었다.
- **해결**: 예전 서버를 끄고 `npm start`로 새로 켰다.
- **배운 점**: 한 포트는 한 프로그램만 쓴다. 코드를 바꾸면 서버도 다시 켜야 한다.

### 3. Supabase Region을 확인하지 않고 프로젝트를 만들었다
- **상황**: 나중에 보니 `eu-west-1`(아일랜드)로 만들어져 있었다.
- **해결**: 아직 표를 만들기 전이라 **서울(`ap-northeast-2`)** 로 새로 만들었다.
- **배운 점**: Region은 만든 뒤에 바꿀 수 없다. 사용자와 가까운 곳을 처음부터 고르자.

### 4. 표를 만든 뒤 어디서 확인하는지 몰랐다
- **해결**: 왼쪽 메뉴 **Table Editor**에서 표 3개를 확인했다.
- **헷갈렸던 점**: "주황색 표시가 안 보인다"가 정상이었다. `Unrestricted` 표시는 **RLS가 꺼진** 표에만 붙는다.

### 5. Project URL과 API URL이 같은 건지 헷갈렸다
- **답**: 같은 것이다. 화면마다 이름만 다르다.
- **주의**: 복사한 주소 끝의 `/rest/v1/`은 빼고 `.supabase.co`까지만 쓴다.

### 6. "Confirm email 끄기"가 무슨 뜻인지 몰랐다
- **의미**: 가입하면 확인 메일 링크를 눌러야 로그인되는 기능이다.
- **해결**: 테스트하는 동안은 꺼서 가입 즉시 로그인되게 했다.

### 7. Render 설정 화면의 "Compute" 항목을 몰랐다
- **답**: 서버 사양(요금제)을 고르는 곳이다. **Free**를 선택했다.

### 8. Render 배포가 계속 restarted 됐다
- **로그**: `SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY 환경변수가 필요합니다` 다음에 `Exited with status 1`
- **원인**: `.env`는 보안 때문에 GitHub에 안 올렸는데, Render에도 **환경변수를 넣지 않았다.**
- **해결**: Render → Environment에 Key/Value를 하나씩 넣고 Save and deploy를 눌렀다.
- **배운 점**: 오류가 나면 **로그 마지막 몇 줄**에 원인이 그대로 적혀 있다.

### 정리
- 막힌 곳 대부분은 **코드가 아니라 환경·설정** 문제였다. (포트, 지역, 환경변수)
- 비밀값은 `.env`에만 두고 GitHub에는 올리지 않는다. 배포할 때는 서비스 설정 화면에 따로 넣는다.
- 모르는 메뉴나 오류가 나오면 **화면에 보이는 글자를 그대로** 물어보는 게 가장 빨랐다.
