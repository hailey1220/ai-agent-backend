// DB 접근은 이 파일에서만 한다. (화면 코드는 API만 호출)
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dbPath = path.resolve(rootDir, process.env.DB_PATH || 'todo.db');

const db = new DatabaseSync(dbPath);
db.exec('PRAGMA foreign_keys = ON;');
db.exec(readFileSync(path.join(rootDir, 'schema.sql'), 'utf8'));

function transaction(fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

const SELECT_TODO = `
  SELECT t.id, t.title, t.memo, t.is_done, t.due_date, t.completed_at, t.created_at, t.updated_at,
         (SELECT json_group_array(g.name)
            FROM todo_tags tt JOIN tags g ON g.id = tt.tag_id
           WHERE tt.todo_id = t.id) AS tags
    FROM todos t`;

function toTodo(row) {
  if (!row) return null;
  return { ...row, is_done: row.is_done === 1, tags: JSON.parse(row.tags).sort() };
}

function setTags(todoId, names) {
  db.prepare('DELETE FROM todo_tags WHERE todo_id = ?').run(todoId);
  for (const name of names) {
    db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)').run(name);
    const tag = db.prepare('SELECT id FROM tags WHERE name = ?').get(name);
    db.prepare('INSERT OR IGNORE INTO todo_tags (todo_id, tag_id) VALUES (?, ?)').run(todoId, tag.id);
  }
  // 어떤 할 일에도 안 붙은 태그는 정리
  db.exec('DELETE FROM tags WHERE id NOT IN (SELECT tag_id FROM todo_tags)');
}

export function listTodos({ filter = 'all', tag, q } = {}) {
  const where = [];
  const params = [];

  if (filter === 'active') where.push('t.is_done = 0');
  if (filter === 'done') where.push('t.is_done = 1');
  if (filter === 'today') where.push("t.due_date = date('now', 'localtime')");
  if (filter === 'overdue') where.push("t.due_date < date('now', 'localtime') AND t.is_done = 0");

  if (tag) {
    where.push(`EXISTS (SELECT 1 FROM todo_tags tt JOIN tags g ON g.id = tt.tag_id
                         WHERE tt.todo_id = t.id AND g.name = ?)`);
    params.push(tag);
  }
  if (q) {
    const like = `%${q.replace(/[\\%_]/g, (c) => '\\' + c)}%`;
    where.push("(t.title LIKE ? ESCAPE '\\' OR t.memo LIKE ? ESCAPE '\\')");
    params.push(like, like);
  }

  const sql = `${SELECT_TODO}
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY t.is_done ASC, t.due_date IS NULL, t.due_date ASC, t.id DESC`;
  return db.prepare(sql).all(...params).map(toTodo);
}

export function getTodo(id) {
  return toTodo(db.prepare(`${SELECT_TODO} WHERE t.id = ?`).get(id));
}

export function createTodo({ title, memo = null, due_date = null, tags = [] }) {
  return transaction(() => {
    const { lastInsertRowid } = db
      .prepare('INSERT INTO todos (title, memo, due_date) VALUES (?, ?, ?)')
      .run(title, memo, due_date);
    setTags(lastInsertRowid, tags);
    return getTodo(lastInsertRowid);
  });
}

export function updateTodo(id, fields) {
  return transaction(() => {
    if (!getTodo(id)) return null;

    const sets = [];
    const params = [];
    for (const key of ['title', 'memo', 'due_date']) {
      if (key in fields) {
        sets.push(`${key} = ?`);
        params.push(fields[key]);
      }
    }
    if ('is_done' in fields) {
      sets.push('is_done = ?');
      sets.push(`completed_at = CASE WHEN ? = 1 THEN datetime('now', 'localtime') ELSE NULL END`);
      const done = fields.is_done ? 1 : 0;
      params.push(done, done);
    }
    sets.push("updated_at = datetime('now', 'localtime')");
    db.prepare(`UPDATE todos SET ${sets.join(', ')} WHERE id = ?`).run(...params, id);

    if ('tags' in fields) setTags(id, fields.tags);
    return getTodo(id);
  });
}

export function deleteTodo(id) {
  return transaction(() => {
    const { changes } = db.prepare('DELETE FROM todos WHERE id = ?').run(id);
    db.exec('DELETE FROM tags WHERE id NOT IN (SELECT tag_id FROM todo_tags)');
    return changes > 0;
  });
}

export function listTags() {
  return db.prepare('SELECT id, name, color FROM tags ORDER BY name').all();
}
