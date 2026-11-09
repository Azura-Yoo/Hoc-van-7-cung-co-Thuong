-- STEM features for "Văn 7 cùng cô Thương"
-- Run once in Supabase SQL Editor for the project's database.
-- Existing profiles, assignments, submissions and storage data are not modified.

create table if not exists public.learning_resources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  resource_type text not null default 'link' check (resource_type in ('link','note')),
  content text,
  external_url text,
  class_name text,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.learning_activities (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  class_name text not null,
  is_published boolean not null default true,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.learning_questions (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.learning_activities(id) on delete cascade,
  prompt text not null,
  options jsonb not null default '[]'::jsonb,
  correct_answer text not null,
  explanation text,
  points numeric(5,2) not null default 1 check (points > 0),
  position integer not null default 1
);

create table if not exists public.learning_attempts (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.learning_activities(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  score numeric(6,2) not null default 0,
  total numeric(6,2) not null default 0,
  submitted_at timestamptz not null default now()
);

create table if not exists public.learning_portfolio (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  item_type text not null default 'writing' check (item_type in ('writing','reflection','project','link')),
  content text,
  external_url text,
  teacher_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists learning_resources_class_created_idx on public.learning_resources(class_name, created_at desc);
create index if not exists learning_activities_class_created_idx on public.learning_activities(class_name, created_at desc);
create index if not exists learning_questions_activity_position_idx on public.learning_questions(activity_id, position);
create index if not exists learning_attempts_student_date_idx on public.learning_attempts(student_id, submitted_at desc);
create index if not exists learning_portfolio_student_date_idx on public.learning_portfolio(student_id, created_at desc);

alter table public.learning_resources enable row level security;
alter table public.learning_activities enable row level security;
alter table public.learning_questions enable row level security;
alter table public.learning_attempts enable row level security;
alter table public.learning_portfolio enable row level security;

-- Explicit API grants; row-level security below decides which rows each role can access.
grant select, insert, update, delete on public.learning_resources to authenticated;
grant select, insert, update, delete on public.learning_activities to authenticated;
grant insert, update, delete on public.learning_questions to authenticated;
grant select on public.learning_attempts to authenticated;
grant select, insert, update, delete on public.learning_portfolio to authenticated;


-- Remove only policies with these names so this migration is safe to rerun.
drop policy if exists "resources_students_read_their_class" on public.learning_resources;
drop policy if exists "resources_teachers_manage" on public.learning_resources;
drop policy if exists "activities_students_read_published_class" on public.learning_activities;
drop policy if exists "activities_teachers_manage" on public.learning_activities;
drop policy if exists "questions_students_read_published" on public.learning_questions;
drop policy if exists "questions_teachers_manage" on public.learning_questions;
drop policy if exists "questions_teachers_insert" on public.learning_questions;
drop policy if exists "questions_teachers_update" on public.learning_questions;
drop policy if exists "questions_teachers_delete" on public.learning_questions;
drop policy if exists "attempts_students_read_own" on public.learning_attempts;
drop policy if exists "attempts_students_insert_own" on public.learning_attempts;
drop policy if exists "attempts_teachers_read" on public.learning_attempts;
drop policy if exists "portfolio_students_manage_own" on public.learning_portfolio;
drop policy if exists "portfolio_teachers_read" on public.learning_portfolio;

create policy "resources_students_read_their_class"
on public.learning_resources for select to authenticated
using (
  class_name is null
  or class_name = (select p.class_name from public.profiles p where p.id = auth.uid())
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'teacher')
);

create policy "resources_teachers_manage"
on public.learning_resources for all to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'teacher'))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'teacher'));

create policy "activities_students_read_published_class"
on public.learning_activities for select to authenticated
using (
  (is_published = true and class_name = (select p.class_name from public.profiles p where p.id = auth.uid()))
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'teacher')
);

create policy "activities_teachers_manage"
on public.learning_activities for all to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'teacher'))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'teacher'));

-- Students can read question prompts/options, but never the answer key.
-- The frontend reads this table only through a security-invoker view below.
-- Keep answer keys inaccessible from the browser. Writes are teacher-only;
-- the Edge Function uses the service role after validating the caller.
revoke all on public.learning_questions from anon, authenticated;
grant select (id, activity_id, prompt, options, points, position) on public.learning_questions to authenticated;
grant insert, update, delete on public.learning_questions to authenticated;

create policy "questions_students_read_published"
on public.learning_questions for select to authenticated
using (
  exists (
    select 1 from public.learning_activities a
    join public.profiles p on p.id = auth.uid()
    where a.id = activity_id
      and p.role = 'student'
      and a.is_published = true
      and a.class_name = p.class_name
  )
  or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'teacher')
);

create policy "questions_teachers_insert"
on public.learning_questions for insert to authenticated
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'teacher'));

create policy "questions_teachers_update"
on public.learning_questions for update to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'teacher'))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'teacher'));

create policy "questions_teachers_delete"
on public.learning_questions for delete to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'teacher'));

create policy "attempts_students_read_own"
on public.learning_attempts for select to authenticated
using (student_id = auth.uid());

create policy "attempts_students_insert_own"
on public.learning_attempts for insert to authenticated
with check (
  student_id = auth.uid()
  and exists (
    select 1 from public.profiles p
    join public.learning_activities a on a.class_name = p.class_name
    where p.id = auth.uid() and p.role = 'student'
      and a.id = activity_id and a.is_published = true
  )
);

create policy "attempts_teachers_read"
on public.learning_attempts for select to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'teacher'));

create policy "portfolio_students_manage_own"
on public.learning_portfolio for all to authenticated
using (student_id = auth.uid())
with check (student_id = auth.uid());

create policy "portfolio_teachers_read"
on public.learning_portfolio for select to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'teacher'));

-- A safe student-facing view that omits correct_answer.
create or replace view public.learning_questions_public
with (security_invoker = true, security_barrier = true) as
select q.id, q.activity_id, q.prompt, q.options, q.points, q.position
from public.learning_questions q
join public.learning_activities a on a.id = q.activity_id
where exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'teacher')
   or (
     a.is_published = true
     and a.class_name = (select p.class_name from public.profiles p where p.id = auth.uid())
   );

grant select on public.learning_questions_public to authenticated;
