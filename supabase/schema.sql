-- Todo 앱 DB 스키마 (Supabase Postgres)
-- Supabase 대시보드 → SQL Editor 에 전체를 붙여넣고 Run.
-- 관계: auth.users 1 ──< todos / tags,  todos N >──< tags (todo_tags)
-- 모든 표에 RLS를 켜고, 로그인한 사용자(authenticated)는 자기 행만 접근 가능.

-- ─────────────────────────────── 표 ───────────────────────────────

create table if not exists public.todos (
  id           bigint generated always as identity primary key,
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title        text not null check (length(trim(title)) > 0 and length(title) <= 200),
  memo         text,
  is_done      boolean not null default false,
  due_date     date,                                   -- 마감일, null = 마감 없음
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.tags (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name       text not null check (length(trim(name)) > 0 and length(name) <= 30),
  color      text,
  created_at timestamptz not null default now()
);

create table if not exists public.todo_tags (
  todo_id bigint not null references public.todos (id) on delete cascade,
  tag_id  bigint not null references public.tags (id) on delete cascade,
  primary key (todo_id, tag_id)
);

-- 사용자별로 태그 이름 중복 금지 (대소문자 무시)
create unique index if not exists tags_user_name_key on public.tags (user_id, lower(name));
create index if not exists todos_user_due_idx on public.todos (user_id, due_date);
create index if not exists todo_tags_tag_idx on public.todo_tags (tag_id);

-- updated_at 자동 갱신
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists todos_set_updated_at on public.todos;
create trigger todos_set_updated_at
  before update on public.todos
  for each row execute function public.set_updated_at();

-- ─────────────────────────────── 권한 ───────────────────────────────
-- 로그인 안 한 요청(anon)은 아무것도 못 하고, 로그인한 사용자만 표를 다룰 수 있음.

revoke all on public.todos, public.tags, public.todo_tags from anon, authenticated;
grant select, insert, update, delete on public.todos, public.tags, public.todo_tags to authenticated;

-- ─────────────────────────────── RLS ───────────────────────────────

alter table public.todos     enable row level security;
alter table public.tags      enable row level security;
alter table public.todo_tags enable row level security;

-- todos: 본인 것만
drop policy if exists "todos_select_own" on public.todos;
drop policy if exists "todos_insert_own" on public.todos;
drop policy if exists "todos_update_own" on public.todos;
drop policy if exists "todos_delete_own" on public.todos;
create policy "todos_select_own" on public.todos for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "todos_insert_own" on public.todos for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "todos_update_own" on public.todos for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "todos_delete_own" on public.todos for delete to authenticated
  using ((select auth.uid()) = user_id);

-- tags: 본인 것만
drop policy if exists "tags_select_own" on public.tags;
drop policy if exists "tags_insert_own" on public.tags;
drop policy if exists "tags_update_own" on public.tags;
drop policy if exists "tags_delete_own" on public.tags;
create policy "tags_select_own" on public.tags for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "tags_insert_own" on public.tags for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "tags_update_own" on public.tags for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "tags_delete_own" on public.tags for delete to authenticated
  using ((select auth.uid()) = user_id);

-- todo_tags: 할 일과 태그가 둘 다 본인 것일 때만
drop policy if exists "todo_tags_select_own" on public.todo_tags;
drop policy if exists "todo_tags_insert_own" on public.todo_tags;
drop policy if exists "todo_tags_delete_own" on public.todo_tags;
create policy "todo_tags_select_own" on public.todo_tags for select to authenticated
  using (exists (select 1 from public.todos t where t.id = todo_id and t.user_id = (select auth.uid())));
create policy "todo_tags_insert_own" on public.todo_tags for insert to authenticated
  with check (
    exists (select 1 from public.todos t where t.id = todo_id and t.user_id = (select auth.uid()))
    and exists (select 1 from public.tags g where g.id = tag_id and g.user_id = (select auth.uid()))
  );
create policy "todo_tags_delete_own" on public.todo_tags for delete to authenticated
  using (exists (select 1 from public.todos t where t.id = todo_id and t.user_id = (select auth.uid())));

-- ─────────────────────── 함수 (백엔드가 RPC로 호출) ───────────────────────
-- 모두 security invoker: 호출한 사용자 권한으로 실행되므로 RLS가 그대로 적용됨.

-- 목록 조회: filter = all | active | done | today | overdue
create or replace function public.list_todos(
  p_filter text default 'all',
  p_tag    text default null,
  p_q      text default null,
  p_today  date default current_date
)
returns table (
  id bigint, title text, memo text, is_done boolean, due_date date,
  completed_at timestamptz, created_at timestamptz, updated_at timestamptz, tags text[]
)
language sql
stable
security invoker
set search_path = ''
as $$
  select t.id, t.title, t.memo, t.is_done, t.due_date, t.completed_at, t.created_at, t.updated_at,
         array(select g.name
                 from public.todo_tags tt join public.tags g on g.id = tt.tag_id
                where tt.todo_id = t.id
                order by g.name) as tags
    from public.todos t
   where t.user_id = (select auth.uid())
     and case p_filter
           when 'active'  then not t.is_done
           when 'done'    then t.is_done
           when 'today'   then t.due_date = p_today
           when 'overdue' then t.due_date < p_today and not t.is_done
           else true
         end
     and (p_tag is null or exists (
           select 1 from public.todo_tags tt join public.tags g on g.id = tt.tag_id
            where tt.todo_id = t.id and lower(g.name) = lower(p_tag)))
     and (coalesce(p_q, '') = ''
          or strpos(lower(t.title), lower(p_q)) > 0
          or strpos(lower(coalesce(t.memo, '')), lower(p_q)) > 0)
   order by t.is_done, t.due_date nulls last, t.id desc;
$$;

-- 할 일에 붙은 태그를 통째로 교체 + 안 쓰는 태그 정리
create or replace function public.set_todo_tags(p_todo_id bigint, p_tags text[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_name   text;
  v_tag_id bigint;
begin
  if not exists (select 1 from public.todos where id = p_todo_id) then
    raise exception 'todo % not found', p_todo_id using errcode = 'P0002';
  end if;

  delete from public.todo_tags where todo_id = p_todo_id;

  foreach v_name in array coalesce(p_tags, '{}') loop
    insert into public.tags (name) values (v_name)
      on conflict (user_id, lower(name)) do nothing;
    select g.id into v_tag_id from public.tags g where lower(g.name) = lower(v_name);
    insert into public.todo_tags (todo_id, tag_id) values (p_todo_id, v_tag_id)
      on conflict do nothing;
  end loop;

  delete from public.tags g
   where not exists (select 1 from public.todo_tags tt where tt.tag_id = g.id);
end;
$$;

-- 추가 (할 일 + 태그를 한 트랜잭션으로), 새 id 반환
create or replace function public.create_todo(
  p_title text, p_memo text default null, p_due_date date default null, p_tags text[] default '{}'
)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id bigint;
begin
  insert into public.todos (title, memo, due_date)
  values (p_title, p_memo, p_due_date)
  returning id into v_id;

  perform public.set_todo_tags(v_id, p_tags);
  return v_id;
end;
$$;

-- 수정: p_patch 에 들어 있는 키(title, memo, due_date, is_done, tags)만 바꿈
create or replace function public.update_todo(p_todo_id bigint, p_patch jsonb)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.todos set
    title        = case when p_patch ? 'title'    then p_patch ->> 'title' else title end,
    memo         = case when p_patch ? 'memo'     then p_patch ->> 'memo' else memo end,
    due_date     = case when p_patch ? 'due_date' then (p_patch ->> 'due_date')::date else due_date end,
    is_done      = case when p_patch ? 'is_done'  then (p_patch ->> 'is_done')::boolean else is_done end,
    completed_at = case
                     when not p_patch ? 'is_done' then completed_at
                     when (p_patch ->> 'is_done')::boolean then coalesce(completed_at, now())
                     else null
                   end
  where id = p_todo_id;

  if not found then
    return false;
  end if;

  if p_patch ? 'tags' then
    perform public.set_todo_tags(
      p_todo_id, array(select jsonb_array_elements_text(p_patch -> 'tags')));
  end if;
  return true;
end;
$$;

-- 삭제 + 안 쓰는 태그 정리
create or replace function public.delete_todo(p_todo_id bigint)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  delete from public.todos where id = p_todo_id;
  if not found then
    return false;
  end if;

  delete from public.tags g
   where not exists (select 1 from public.todo_tags tt where tt.tag_id = g.id);
  return true;
end;
$$;

-- 함수는 로그인한 사용자만 호출 가능
revoke execute on function
  public.list_todos(text, text, text, date),
  public.set_todo_tags(bigint, text[]),
  public.create_todo(text, text, date, text[]),
  public.update_todo(bigint, jsonb),
  public.delete_todo(bigint)
from public, anon;
grant execute on function
  public.list_todos(text, text, text, date),
  public.set_todo_tags(bigint, text[]),
  public.create_todo(text, text, date, text[]),
  public.update_todo(bigint, jsonb),
  public.delete_todo(bigint)
to authenticated;
