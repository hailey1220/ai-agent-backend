// 화면 코드: DB에 직접 접근하지 않고 백엔드 API(/api/...)만 호출한다.
const state = { filter: 'all', tag: '', q: '' };

const $ = (id) => document.getElementById(id);
const els = {
  form: $('add-form'), title: $('title'), due: $('due'), tags: $('tags'), memo: $('memo'),
  error: $('error'), filters: $('filters'), search: $('search'),
  tagFilter: $('tag-filter'), list: $('list'), empty: $('empty'),
};

async function api(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `요청 실패 (${res.status})`);
  return data;
}

function showError(message) {
  els.error.textContent = message || '';
  els.error.hidden = !message;
}

function todayStr() {
  return new Date().toLocaleDateString('sv'); // YYYY-MM-DD (로컬 시간)
}

function dueLabel(due, done) {
  if (!due) return null;
  const today = todayStr();
  if (!done && due < today) return { text: `마감 지남 (${due})`, cls: 'overdue' };
  if (due === today) return { text: '오늘 마감', cls: 'today' };
  return { text: `마감 ${due}`, cls: '' };
}

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  for (const child of [].concat(children)) if (child) node.append(child);
  return node;
}

function renderTodo(todo) {
  const checkbox = el('input', { type: 'checkbox', checked: todo.is_done, title: '완료 표시' });
  checkbox.addEventListener('change', () => run(() => api('PATCH', `/api/todos/${todo.id}`, { is_done: checkbox.checked })));

  const del = el('button', { className: 'delete', textContent: '삭제' });
  del.addEventListener('click', () => {
    if (confirm(`"${todo.title}" 을(를) 삭제할까요?`)) run(() => api('DELETE', `/api/todos/${todo.id}`));
  });

  const due = dueLabel(todo.due_date, todo.is_done);
  const meta = el('div', { className: 'meta' }, [
    due && el('span', { className: `due ${due.cls}`, textContent: due.text }),
    ...todo.tags.map((t) => el('span', { className: 'chip', textContent: `#${t}` })),
  ]);

  const body = el('div', {}, [
    el('div', { className: 'title', textContent: todo.title }),
    todo.memo && el('div', { className: 'memo', textContent: todo.memo }),
    meta.childElementCount ? meta : null,
  ]);

  return el('li', { className: `item${todo.is_done ? ' done' : ''}` }, [checkbox, body, del]);
}

function renderTagFilter(tags) {
  if (state.tag && !tags.some((t) => t.name === state.tag)) state.tag = '';
  const chips = [{ name: '' }, ...tags].map((t) => {
    const btn = el('button', {
      className: `chip${state.tag === t.name ? ' active' : ''}`,
      textContent: t.name ? `#${t.name}` : '모든 태그',
    });
    btn.addEventListener('click', () => run(() => { state.tag = t.name; }));
    return btn;
  });
  els.tagFilter.replaceChildren(...(tags.length ? chips : []));
}

async function load() {
  const tags = await api('GET', '/api/tags');
  renderTagFilter(tags);

  const params = new URLSearchParams({ filter: state.filter });
  if (state.tag) params.set('tag', state.tag);
  if (state.q) params.set('q', state.q);
  const todos = await api('GET', `/api/todos?${params}`);

  els.list.replaceChildren(...todos.map(renderTodo));
  els.empty.hidden = todos.length > 0;
}

async function run(action) {
  try {
    showError('');
    await action();
    await load();
  } catch (err) {
    showError(err.message);
  }
}

els.form.addEventListener('submit', (e) => {
  e.preventDefault();
  const body = {
    title: els.title.value,
    memo: els.memo.value || null,
    due_date: els.due.value || null,
    tags: els.tags.value.split(',').map((t) => t.trim()).filter(Boolean),
  };
  run(async () => {
    await api('POST', '/api/todos', body);
    els.form.reset();
    els.title.focus();
  });
});

els.filters.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-filter]');
  if (!btn) return;
  state.filter = btn.dataset.filter;
  for (const b of els.filters.querySelectorAll('button')) b.classList.toggle('active', b === btn);
  run(() => {});
});

let searchTimer;
els.search.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { state.q = els.search.value.trim(); run(() => {}); }, 250);
});

run(() => {});
