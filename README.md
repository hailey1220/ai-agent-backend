# 백엔드-데이터베이스

배포까지 완료하기

## 배포 주소

https://ai-agent-backend-2xvc.onrender.com

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
