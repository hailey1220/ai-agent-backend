import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as db from './db.js';

const app = express();
const port = Number(process.env.PORT) || 3000;
const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');

app.use(express.json());
app.use(express.static(publicDir));

class BadRequest extends Error {}

// 요청 본문 검증: 허용한 필드만, 올바른 형식만 통과
function parseTodoInput(body, { partial }) {
  if (!body || typeof body !== 'object') throw new BadRequest('JSON 본문이 필요합니다.');
  const out = {};

  if ('title' in body || !partial) {
    if (typeof body.title !== 'string' || !body.title.trim()) throw new BadRequest('할 일 내용을 입력하세요.');
    if (body.title.length > 200) throw new BadRequest('할 일은 200자 이하로 입력하세요.');
    out.title = body.title.trim();
  }
  if ('memo' in body) {
    if (body.memo !== null && typeof body.memo !== 'string') throw new BadRequest('메모 형식이 올바르지 않습니다.');
    out.memo = body.memo?.trim() || null;
  }
  if ('due_date' in body) {
    const d = body.due_date;
    if (d !== null && d !== '' && !isValidDate(d)) throw new BadRequest('마감일은 YYYY-MM-DD 형식이어야 합니다.');
    out.due_date = d || null;
  }
  if ('is_done' in body) {
    if (typeof body.is_done !== 'boolean') throw new BadRequest('is_done 은 true/false 여야 합니다.');
    out.is_done = body.is_done;
  }
  if ('tags' in body) {
    if (!Array.isArray(body.tags) || body.tags.some((t) => typeof t !== 'string')) {
      throw new BadRequest('태그는 문자열 배열이어야 합니다.');
    }
    const seen = new Map();
    for (const t of body.tags.map((t) => t.trim()).filter(Boolean)) {
      if (t.length > 30) throw new BadRequest('태그는 30자 이하로 입력하세요.');
      if (!seen.has(t.toLowerCase())) seen.set(t.toLowerCase(), t);
    }
    if (seen.size > 10) throw new BadRequest('태그는 10개까지 붙일 수 있습니다.');
    out.tags = [...seen.values()];
  }
  return out;
}

function isValidDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function parseId(raw) {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new BadRequest('잘못된 id 입니다.');
  return id;
}

const FILTERS = ['all', 'active', 'done', 'today', 'overdue'];

app.get('/api/todos', (req, res) => {
  const filter = FILTERS.includes(req.query.filter) ? req.query.filter : 'all';
  const tag = typeof req.query.tag === 'string' ? req.query.tag : undefined;
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : undefined;
  res.json(db.listTodos({ filter, tag, q }));
});

app.post('/api/todos', (req, res) => {
  const input = parseTodoInput(req.body, { partial: false });
  res.status(201).json(db.createTodo(input));
});

app.patch('/api/todos/:id', (req, res) => {
  const todo = db.updateTodo(parseId(req.params.id), parseTodoInput(req.body, { partial: true }));
  if (!todo) return res.status(404).json({ error: '할 일을 찾을 수 없습니다.' });
  res.json(todo);
});

app.delete('/api/todos/:id', (req, res) => {
  if (!db.deleteTodo(parseId(req.params.id))) return res.status(404).json({ error: '할 일을 찾을 수 없습니다.' });
  res.status(204).end();
});

app.get('/api/tags', (req, res) => {
  res.json(db.listTags());
});

app.use('/api', (req, res) => res.status(404).json({ error: '없는 API 입니다.' }));

app.use((err, req, res, next) => {
  if (err instanceof BadRequest) return res.status(400).json({ error: err.message });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON 형식이 올바르지 않습니다.' });
  console.error(err);
  res.status(500).json({ error: '서버 오류가 발생했습니다.' });
});

app.listen(port, '127.0.0.1', () => {
  console.log(`Todo 앱 실행 중: http://localhost:${port}`);
});
