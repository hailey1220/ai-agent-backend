// Supabase 접근은 이 파일과 index.js(백엔드)에서만 한다. 화면 코드는 /api 만 호출.
// 관리자 키(secret/service_role)는 쓰지 않는다: publishable 키 + 로그인한 사용자 토큰으로
// 요청하므로 DB의 RLS가 항상 적용된다.
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) {
  console.error('SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY 환경변수가 필요합니다. (.env.example 참고)');
  process.exit(1);
}

const isProd = process.env.NODE_ENV === 'production';
const ACCESS_COOKIE = 'sb_access';
const REFRESH_COOKIE = 'sb_refresh';
const cookieOptions = {
  httpOnly: true, // 화면 JS에서 토큰을 읽을 수 없음
  sameSite: 'lax',
  secure: isProd, // 배포(https)에서는 https로만 전송
  path: '/',
  maxAge: 30 * 24 * 60 * 60 * 1000,
};

export function newClient() {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export function saveSession(res, session) {
  res.cookie(ACCESS_COOKIE, session.access_token, cookieOptions);
  res.cookie(REFRESH_COOKIE, session.refresh_token, cookieOptions);
}

export function clearSession(res) {
  const { maxAge, ...opts } = cookieOptions;
  res.clearCookie(ACCESS_COOKIE, opts);
  res.clearCookie(REFRESH_COOKIE, opts);
}

// 로그인 필요 미들웨어: 쿠키의 토큰으로 사용자 확인(만료 시 자동 갱신) 후
// 그 사용자 권한의 Supabase 클라이언트를 req.supabase 에 넣는다.
export async function requireUser(req, res, next) {
  const access_token = req.cookies[ACCESS_COOKIE];
  const refresh_token = req.cookies[REFRESH_COOKIE];
  if (!access_token || !refresh_token) {
    return res.status(401).json({ error: '로그인이 필요합니다.' });
  }

  const supabase = newClient();
  const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
  if (error || !data.session) {
    clearSession(res);
    return res.status(401).json({ error: '로그인이 만료되었습니다. 다시 로그인하세요.' });
  }
  if (data.session.access_token !== access_token) saveSession(res, data.session);

  req.supabase = supabase;
  req.user = data.user;
  next();
}
