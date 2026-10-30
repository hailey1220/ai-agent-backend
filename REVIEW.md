# AIFFEL Campus Agent Code Review Templete
- 개발자 : 서진수
- 리뷰어 : 이보라


# ART(Agent Review Template)
[x]  **1. 원하는 기능이 의도한 대로 동작하나요?**

PRD(`PRD.md`)에서 요청한 기능과 실제 구현을 비교했습니다.

| PRD 요구사항 | 구현 위치 | 결과 |
|---|---|---|
| 할 일 추가 / 목록 / 완료 표시 / 삭제 (CRUD) | `server/index.js:148-184`, `supabase/schema.sql` RPC 함수 | ✅ |
| 껐다 켜도 데이터 유지 | SQLite → Supabase Postgres로 변경 | ✅ (PRD는 "내 컴퓨터 DB"였지만 배포 과제에 맞게 클라우드 DB로 바꿈) |
| 직접 넣고 싶은 기능 1~2개 | 마감일, 태그, 오늘 할 일, 검색 **4개 모두** + 메모 | ✅ 요구보다 많이 구현 |
| 무료 도구만 사용 | Supabase Free, Render Free | ✅ |
| 비밀값은 .env로 | `.env.example`만 커밋, `.env`는 `.gitignore` | ✅ |
| 로그인은 검증된 라이브러리로 | Supabase Auth 사용 (직접 만들지 않음) | ✅ |
| 배포 | https://ai-agent-backend-2xvc.onrender.com (README) | ✅ (README 기준) |

- 코드를 읽어 보면 화면(`public/app.js`) → API(`server/index.js`) → DB 함수(`schema.sql`)가 잘 이어져 있고, 필터 5종(전체/미완료/오늘/마감 지남/완료), 태그 거르기, 검색이 모두 서버와 DB 쪽에서 처리됩니다.
- **직접 구동 결과**: 리뷰어가 직접 실행해 보니 요청 흐름에서 오류는 없었습니다. 다만 **반응 속도가 조금 느렸습니다**(원인 추정과 개선 방법은 아래 "개선 제안 3번"에 정리).
- 📷 **근거 캡처 첨부**: 아래 화면 캡처를 첨부합니다.
  1. 회원가입/로그인 화면
  2. 할 일 추가(마감일·태그·메모 포함) 후 목록
  3. "오늘 할 일" / "마감 지남" 필터, 태그 칩, 검색 결과
  4. 다른 계정으로 로그인했을 때 앞 계정의 할 일이 보이지 않는 화면 (RLS 확인용)


[x]  **2. 보안 검토를 수행했나요?**

**잘한 점**
- **하드코딩된 비밀값 없음**: Supabase URL과 키는 환경변수로만 읽고, 없으면 바로 종료합니다(`server/supabase.js:6-11`). `.env.example`에는 가짜 값만 들어 있습니다.
- **관리자 키를 쓰지 않음**: service_role 키 대신 publishable 키와 로그인한 사용자의 토큰을 사용하고, 모든 RPC 함수가 `security invoker`라서 **RLS가 항상 적용**됩니다. 결국 서버 코드에 버그가 있어도 다른 사람의 데이터에는 접근할 수 없습니다. 이번 프로젝트에서 가장 잘 설계된 부분입니다.
- **RLS 정책이 꼼꼼함**: 표 3개 모두 RLS가 켜져 있습니다. `todo_tags`는 할 일과 태그가 **둘 다** 본인 것일 때만 넣을 수 있고, `anon` 권한은 회수했으며 함수 `search_path = ''`도 고정했습니다.
- **토큰 보관 방식**: `httpOnly` + `sameSite=lax` + 배포 환경에서는 `secure` 쿠키를 써서 화면 JS가 토큰을 읽을 수 없습니다(XSS 대비).
- **입력값 검증**: title 200자, 태그 30자·10개, 날짜 형식, boolean 타입, id 정수 여부를 서버와 DB(check 제약) 양쪽에서 검사합니다(`server/index.js:26-81`).
- **XSS 방지**: 화면 렌더링에 `innerHTML` 없이 `textContent`만 사용합니다(`public/app.js:65-94`).
- **SQL 인젝션 / 와일드카드 방지**: 검색에 `LIKE` 대신 `strpos`를 써서 `%`, `_` 같은 문자도 안전하게 처리됩니다.
- **오류 메시지**: DB 원본 오류는 서버 로그에만 남기고, 사용자에게는 일반 메시지만 보여줍니다(`dbError`).

**보완하면 좋은 점**
- `memo`에 길이 제한이 없습니다. 지금은 express.json의 기본 한도(100kb)에만 막힙니다.
- 서버 쪽 요청 횟수 제한(rate limit)과 보안 헤더(helmet, CSP)가 없습니다. 로그인 시도 제한은 Supabase Auth의 기본 제한에만 의존합니다.
- 비밀번호 최소 길이가 6자로 짧습니다.
- 회원가입 시 "이미 가입된 이메일입니다"라고 알려 주기 때문에, 이 메시지로 가입 여부를 알아낼 수 있습니다(이메일 열거).
- 회고 6번에서 테스트용으로 **Confirm email을 껐는데**, 배포 상태에서는 다시 켜는 것을 권장합니다.
- 의존성 3개(`@supabase/supabase-js`, `express`, `cookie-parser`)는 모두 널리 쓰는 공식 패키지이고 `package-lock.json`도 커밋되어 있습니다. 다만 `npm audit` 결과를 남긴 기록은 없습니다.


[x]  **3. 에러가 난 부분을 디버깅하여 "문제를 해결한 기록"을 남겼나요?**

- README의 "**회고: 하다가 막혔던 것들**"에 8건이 `상황 → 원인 → 해결 → 배운 점` 형식으로 정리되어 있습니다. 특히 다음 두 건은 원인을 정확히 찾아 해결했습니다.
  - #2 예전 SQLite 서버가 3000번 포트를 계속 쓰고 있어서 생긴 "없는 API" 오류
  - #8 Render에 환경변수를 넣지 않아 생긴 `Exited with status 1` 재시작 반복 (로그 마지막 줄에서 원인을 찾음)
- Git 이력(`SQLite 버전 → Supabase + Auth + RLS로 변경`)을 보면 처음 시도한 방식에서 구조를 바꾼 실험 과정도 남아 있습니다.
- **아쉬운 점**: 회고 내용이 대부분 **환경·설정 문제**(포트, Region, 환경변수, 메뉴 위치)입니다. 템플릿이 요구하는 "**에이전트가 만든 코드의 오류를 발견하고 수정한 기록**"은 없습니다. 예를 들어 다음 내용을 추가하면 3번 항목을 더 충실하게 채울 수 있습니다.
  - SQLite에서 Supabase로 **왜** 바꿨는지 (배포 환경에서는 로컬 파일 DB가 유지되지 않음 등)
  - 에이전트가 만든 코드를 실행해 보고 실제로 고친 버그나 직접 확인한 테스트 내용 (예: 다른 계정으로 RLS가 막히는지 확인)


# 참고 링크 및 코드 개선

## 1.리뷰 시 참고한 링크가 있다면 링크와 간략한 설명을 첨부합니다.
- Supabase Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security — RLS 정책과 `(select auth.uid())` 성능 패턴 확인
- Supabase Database Functions (security invoker/definer): https://supabase.com/docs/guides/database/functions — RPC 함수의 권한 모델 확인
- Supabase API Keys (publishable vs secret): https://supabase.com/docs/guides/api/api-keys — 서버에서 publishable 키를 쓰는 것이 맞는지 확인
- Express 5 오류 처리: https://expressjs.com/en/guide/error-handling.html — Express 5는 async 핸들러에서 던진 오류를 자동으로 오류 미들웨어로 넘김 (`try/catch` 없이도 안전함을 확인)
- OWASP Authentication Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html — 비밀번호 길이, 계정 열거 관련 기준

## 2.리뷰를 통해 개선을 제안할 부분이 있다면 내용과 간략한 설명을 첨부합니다.
1. **memo 길이 제한 추가** — `parseTodoInput`에 예: 2000자 제한을 넣고, `schema.sql`에도 `check (length(memo) <= 2000)`를 추가합니다.
2. **README의 clone 주소 확인** — README에는 `jsseo0420/ai-agent-backend`가 적혀 있는데, 리뷰한 레포는 `hailey1220/ai-agent-backend`입니다. 원본 레포 주소가 맞다면 그대로 두어도 되지만, 제출용 레포를 기준으로 안내하려면 주소를 맞추는 것이 좋습니다.
3. **반응 속도 개선 (구동 시 체감된 느림)** — 코드와 설정으로 추정한 원인입니다. 측정해서 확인하지는 않았습니다.
   - **Render Free 슬립**: 무료 플랜은 일정 시간 요청이 없으면 서버를 재우기 때문에, 첫 접속에 수십 초가 걸릴 수 있습니다. 첫 로딩만 느렸다면 이것이 가장 유력한 원인입니다.
   - **매 요청마다 Supabase Auth 호출**: `requireUser`(`server/supabase.js:43-61`)가 요청마다 `setSession`을 부르면서 Auth 서버까지 한 번 더 왕복합니다. → JWT를 서버에서 로컬로 검증하는 방식(`auth.getClaims` 등)으로 줄일 수 있습니다.
   - **요청이 순서대로 실행됨**: 할 일을 체크하거나 추가하면 `run()`이 [변경 요청 → `/api/tags` → `/api/todos`]를 **하나씩 차례로** 보냅니다(`public/app.js:109-131`). 이 각각이 위의 Auth 왕복 + DB 호출을 거칩니다. → `Promise.all`로 tags와 todos를 동시에 요청하고, 체크박스는 화면을 먼저 바꾼 뒤 서버에 반영하는 방식(낙관적 업데이트)을 쓰면 체감 속도가 좋아집니다.
   - **서버와 DB의 지역 차이**: DB는 서울(`ap-northeast-2`)에 있는데, Render 서버가 미국이나 유럽 지역이면 요청마다 대륙을 오갑니다. Render 지역을 DB와 가까운 곳(예: Singapore)으로 맞추는 것을 권장합니다.
4. **보안 미들웨어 추가** — `helmet`(보안 헤더)과 `express-rate-limit`(로그인/가입 엔드포인트 제한)을 추가합니다.
5. **배포 환경 설정** — Supabase의 Confirm email을 다시 켜고, 비밀번호 최소 길이를 8자 이상으로 올립니다.
6. **테스트 추가** — `package.json`에 `test` 스크립트가 없습니다. 최소한 `parseTodoInput`/`isValidDate` 단위 테스트(`node --test`)와 "A 계정으로 B 계정 할 일 조회 불가" 같은 RLS 확인 테스트를 추천합니다.
7. **정리** — `.gitignore`의 `todo.db` 항목은 SQLite를 쓰던 시절의 흔적입니다. PRD의 "내 컴퓨터 DB" 문구도 실제 구현(Supabase + 배포)에 맞게 고치면 문서와 코드가 일치합니다.
8. **회고 보강** — 3번 항목에서 제안한 것처럼 "에이전트 코드 오류 → 발견 → 수정" 기록을 1~2건 추가합니다.


# 총평
PRD에서 요구한 것(CRUD + 기능 1~2개)보다 **훨씬 많이 구현한** 완성도 높은 프로젝트입니다. 마감일, 태그, 오늘/마감 지남 필터, 검색, 메모, 회원가입/로그인, 배포까지 갖췄습니다. 특히 보안 설계가 수준급입니다. **관리자 키를 쓰지 않고 RLS + security invoker 함수 + httpOnly 쿠키**로 구성해서 서버 코드에 실수가 있어도 다른 사용자의 데이터가 새지 않는 구조입니다. 입력값 검증과 XSS 방지도 서버·DB·화면 각 층에서 잘 되어 있고, 코드도 짧고 읽기 쉽습니다.

직접 구동해 본 결과 요청 흐름에서 오류는 없었고, **반응 속도가 다소 느린 점**만 확인됐습니다. 무료 서버의 슬립, 요청마다 일어나는 인증 왕복, 순차 요청, 서버와 DB의 지역 차이가 원인으로 추정됩니다.

아쉬운 점은 다음 두 가지입니다. ① **자동화된 테스트 기록이 없습니다**. ② 회고가 환경 설정 문제 위주라서 "**에이전트가 만든 코드를 검증하고 고친 기록**"이 빠져 있습니다. memo 길이 제한, README clone 주소, Confirm email 재활성화 같은 작은 보완만 하면 바로 실서비스 수준에 가깝습니다.

**평가: 기능 ★★★★★ / 보안 ★★★★☆ / 디버깅 기록 ★★★☆☆**
