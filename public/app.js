// 화면 코드: DB·Supabase에 직접 접근하지 않고 백엔드 API(/api/...)만 호출한다.
// 로그인 토큰은 서버가 httpOnly 쿠키로 관리하므로 이 코드에서는 다루지 않는다.
const state = { filter: 'all', tag: '', q: '' };

const $ = (id) => document.getElementById(id);
const els = {
  form: $('add-form'), title: $('title'), due: $('due'), tags: $('tags'), memo: $('memo'),
  error: $('error'), filters: $('filters'), search: $('search'),
  tagFilter: $('tag-filter'), list: $('list'), empty: $('empty'),
  authView: $('auth-view'), authForm: $('auth-form'), email: $('email'), password: $('password'),
  authMessage: $('auth-message'), authError: $('auth-error'),
  todoView: $('todo-view'), userBox: $('user-box'), userEmail: $('user-email'), logout: $('logout'),
};

class AuthRequired extends Error {}

async function api(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && !url.startsWith('/api/auth/login')) throw new AuthRequired(data.error);
  if (!res.ok) throw new Error(data.error || `요청 실패 (${res.status})`);
  return data;
}

function showMessage(node, message) {
  node.textContent = message || '';
  node.hidden = !message;
}
const showError = (message) => showMessage(els.error, message);

function showAuth(message) {
  els.todoView.hidden = true;
  els.userBox.hidden = true;
  els.authView.hidden = false;
  showMessage(els.authError, message);
  els.email.focus();
}

function showTodos(user) {
  els.authView.hidden = true;
  els.todoView.hidden = false;
  els.userBox.hidden = false;
  els.userEmail.textContent = user.email;
  showMessage(els.authMessage, '');
  showMessage(els.authError, '');
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

  const params = new URLSearchParams({ filter: state.filter, today: todayStr() });
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
    if (err instanceof AuthRequired) showAuth(err.message);
    else showError(err.message);
  }
}

els.authForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const mode = e.submitter?.dataset.mode === 'signup' ? 'signup' : 'login';
  const body = { email: els.email.value, password: els.password.value };
  showMessage(els.authMessage, '');
  showMessage(els.authError, '');
  try {
    const data = await api('POST', `/api/auth/${mode}`, body);
    if (data.needsConfirmation) {
      showMessage(els.authMessage, '가입 확인 메일을 보냈습니다. 메일의 링크를 누른 뒤 로그인하세요.');
      return;
    }
    els.authForm.reset();
    showTodos(data.user);
    run(() => {});
  } catch (err) {
    showMessage(els.authError, err.message);
  }
});

els.logout.addEventListener('click', async () => {
  await api('POST', '/api/auth/logout').catch(() => {});
  els.list.replaceChildren();
  els.tagFilter.replaceChildren();
  showAuth();
});

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

// 시작: 이미 로그인돼 있으면 목록, 아니면 로그인 화면
api('GET', '/api/auth/me')
  .then(({ user }) => { showTodos(user); run(() => {}); })
  .catch((err) => showAuth(err instanceof AuthRequired ? '' : err.message));
