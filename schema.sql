-- Todo 앱 DB 스키마 (SQLite)
-- 관계: todos 1 ──< N todo_tags N >── 1 tags  (할 일 ↔ 태그 = 다대다)

PRAGMA foreign_keys = ON;  -- SQLite는 연결할 때마다 켜야 FK가 동작함

-- 할 일
CREATE TABLE IF NOT EXISTS todos (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  title        TEXT    NOT NULL CHECK (length(trim(title)) > 0),
  memo         TEXT,
  is_done      INTEGER NOT NULL DEFAULT 0 CHECK (is_done IN (0, 1)),
  due_date     TEXT,                       -- 마감일 'YYYY-MM-DD', NULL = 마감 없음
  completed_at TEXT,                       -- 완료 시각
  created_at   TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at   TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- 태그 (이름 중복 금지, 대소문자 무시)
CREATE TABLE IF NOT EXISTS tags (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL UNIQUE COLLATE NOCASE,
  color      TEXT,                         -- 예: '#4f8cff'
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- 할 일 ↔ 태그 연결 (할 일/태그 삭제 시 연결도 자동 삭제)
CREATE TABLE IF NOT EXISTS todo_tags (
  todo_id INTEGER NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
  tag_id  INTEGER NOT NULL REFERENCES tags(id)  ON DELETE CASCADE,
  PRIMARY KEY (todo_id, tag_id)
);

-- 오늘 할 일 / 마감 지남 / 미완료 필터 / 태그 필터용 인덱스
CREATE INDEX IF NOT EXISTS idx_todos_due_date ON todos(due_date);
CREATE INDEX IF NOT EXISTS idx_todos_is_done  ON todos(is_done);
CREATE INDEX IF NOT EXISTS idx_todo_tags_tag  ON todo_tags(tag_id);
