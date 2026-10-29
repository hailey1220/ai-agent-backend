import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { newClient, saveSession, clearSession, requireUser } from './supabase.js';

const app = express();
const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || '127.0.0.1';
const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');

app.use(express.json());
app.use(cookieParser());
app.use(express.static(publicDir));

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const badRequest = (message) => new HttpError(400, message);

// ─────────────────────────────── 입력 검증 ───────────────────────────────

function parseTodoInput(body, { partial }) {
  if (!body || typeof body !== 'object') throw badRequest('JSON 본문이 필요합니다.');
  const out = {};

  if ('title' in body || !partial) {
    if (typeof body.title !== 'string' || !body.title.trim()) throw badRequest('할 일 내용을 입력하세요.');
    if (body.title.length > 200) throw badRequest('할 일은 200자 이하로 입력하세요.');
    out.title = body.title.trim();
  }
  if ('memo' in body) {
    if (body.memo !== null && typeof body.memo !== 'string') throw badRequest('메모 형식이 올바르지 않습니다.');
    out.memo = body.memo?.trim() || null;
  }
  if ('due_date' in body) {
    const d = body.due_date;
    if (d !== null && d !== '' && !isValidDate(d)) throw badRequest('마감일은 YYYY-MM-DD 형식이어야 합니다.');
    out.due_date = d || null;
  }
  if ('is_done' in body) {
    if (typeof body.is_done !== 'boolean') throw badRequest('is_done 은 true/false 여야 합니다.');
    out.is_done = body.is_done;
  }
  if ('tags' in body) {
    if (!Array.isArray(body.tags) || body.tags.some((t) => typeof t !== 'string')) {
      throw badRequest('태그는 문자열 배열이어야 합니다.');
    }
    const seen = new Map();
    for (const t of body.tags.map((t) => t.trim()).filter(Boolean)) {
      if (t.length > 30) throw badRequest('태그는 30자 이하로 입력하세요.');
      if (!seen.has(t.toLowerCase())) seen.set(t.toLowerCase(), t);
    }
    if (seen.size > 10) throw badRequest('태그는 10개까지 붙일 수 있습니다.');
    out.tags = [...seen.values()];
  }
  return out;
}

function parseCredentials(body) {
  const email = typeof body?.email === 'string' ? body.email.trim() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw badRequest('올바른 이메일을 입력하세요.');
  if (password.length < 6) throw badRequest('비밀번호는 6자 이상이어야 합니다.');
  return { email, password };
}

function isValidDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function parseId(raw) {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw badRequest('잘못된 id 입니다.');
  return id;
}

// Supabase(PostgREST) 오류를 HTTP 오류로 변환
function dbError(error) {
  if (['23514', '22007', '22008', '22P02'].includes(error.code)) return badRequest('입력값이 올바르지 않습니다.');
  if (error.code === 'P0002') return new HttpError(404, '할 일을 찾을 수 없습니다.');
  if (error.code === '42501') return new HttpError(403, '권한이 없습니다.');
  if (error.code?.startsWith('PGRST3')) return new HttpError(401, '로그인이 필요합니다.');
  console.error('Supabase 오류:', error);
  return new HttpError(500, '서버 오류가 발생했습니다.');
}

async function rpc(req, fn, args) {
  const { data, error } = await req.supabase.rpc(fn, args);
  if (error) throw dbError(error);
  return data;
}

// ─────────────────────────────── 로그인 (Supabase Auth) ───────────────────────────────

app.post('/api/auth/signup', async (req, res) => {
  const { email, password } = parseCredentials(req.body);
  const options = process.env.APP_URL ? { emailRedirectTo: process.env.APP_URL } : undefined;
  const { data, error } = await newClient().auth.signUp({ email, password, options });
  if (error) {
    if (error.status === 429) throw new HttpError(429, '요청이 너무 많습니다. 잠시 후 다시 시도하세요.');
    if (error.code === 'user_already_exists') throw badRequest('이미 가입된 이메일입니다.');
    if (error.code === 'weak_password') throw badRequest('비밀번호가 너무 약합니다.');
    console.error('회원가입 오류:', error);
    throw badRequest('회원가입에 실패했습니다.');
  }
  if (!data.session) return res.status(201).json({ needsConfirmation: true });
  saveSession(res, data.session);
  res.status(201).json({ user: { email: data.user.email } });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = parseCredentials(req.body);
  const { data, error } = await newClient().auth.signInWithPassword({ email, password });
  if (error) {
    if (error.status === 429) throw new HttpError(429, '요청이 너무 많습니다. 잠시 후 다시 시도하세요.');
    if (error.code === 'email_not_confirmed') throw new HttpError(403, '이메일 인증을 먼저 완료하세요.');
    throw new HttpError(401, '이메일 또는 비밀번호가 올바르지 않습니다.');
  }
  saveSession(res, data.session);
  res.json({ user: { email: data.user.email } });
});

app.post('/api/auth/logout', async (req, res) => {
  const { sb_access: access_token, sb_refresh: refresh_token } = req.cookies;
  if (access_token && refresh_token) {
    const supabase = newClient();
    const { error } = await supabase.auth.setSession({ access_token, refresh_token });
    if (!error) await supabase.auth.signOut({ scope: 'local' }); // 이 기기의 토큰 폐기
  }
  clearSession(res);
  res.status(204).end();
});

app.get('/api/auth/me', requireUser, (req, res) => {
  res.json({ user: { email: req.user.email } });
});

// ─────────────────────────────── 할 일 / 태그 (로그인 필요) ───────────────────────────────

const FILTERS = ['all', 'active', 'done', 'today', 'overdue'];

app.get('/api/todos', requireUser, async (req, res) => {
  const { filter, tag, q, today } = req.query;
  const todos = await rpc(req, 'list_todos', {
    p_filter: FILTERS.includes(filter) ? filter : 'all',
    p_tag: typeof tag === 'string' && tag ? tag : null,
    p_q: typeof q === 'string' ? q.trim() : null,
    ...(isValidDate(today) ? { p_today: today } : {}), // 사용자 기준 '오늘' (없으면 DB 날짜)
  });
  res.json(todos);
});

app.post('/api/todos', requireUser, async (req, res) => {
  const input = parseTodoInput(req.body, { partial: false });
  const id = await rpc(req, 'create_todo', {
    p_title: input.title,
    p_memo: input.memo ?? null,
    p_due_date: input.due_date ?? null,
    p_tags: input.tags ?? [],
  });
  res.status(201).json({ id });
});

app.patch('/api/todos/:id', requireUser, async (req, res) => {
  const id = parseId(req.params.id);
  const patch = parseTodoInput(req.body, { partial: true });
  if (!(await rpc(req, 'update_todo', { p_todo_id: id, p_patch: patch }))) {
    throw new HttpError(404, '할 일을 찾을 수 없습니다.');
  }
  res.json({ id });
});

app.delete('/api/todos/:id', requireUser, async (req, res) => {
  if (!(await rpc(req, 'delete_todo', { p_todo_id: parseId(req.params.id) }))) {
    throw new HttpError(404, '할 일을 찾을 수 없습니다.');
  }
  res.status(204).end();
});

app.get('/api/tags', requireUser, async (req, res) => {
  const { data, error } = await req.supabase.from('tags').select('id, name, color').order('name');
  if (error) throw dbError(error);
  res.json(data);
});

// ─────────────────────────────── 오류 처리 ───────────────────────────────

app.use('/api', (req, res) => res.status(404).json({ error: '없는 API 입니다.' }));

app.use((err, req, res, next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON 형식이 올바르지 않습니다.' });
  console.error(err);
  res.status(500).json({ error: '서버 오류가 발생했습니다.' });
});

app.listen(port, host, () => {
  console.log(`Todo 앱 실행 중: http://localhost:${port}`);
});
