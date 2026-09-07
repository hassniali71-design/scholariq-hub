-- Migration 0035: launch_views — تعليم "اطلعت عليه" من الطالب على إطلاق المدرس.
-- منفصل تماماً عن homework_attempts (التسليم الفعلي) عشان "الاطلاع" لا يُحسَب
-- تلقائياً كـ"تسليم" — إشارة خفيفة بس إن الطالب شاف المهمة.

create table if not exists public.launch_views (
  id text primary key,
  center_id text not null references centers (id) on delete cascade,
  launch_id text not null references teacher_launches (id) on delete cascade,
  student_id text not null references students (id) on delete cascade,
  seen_at timestamptz not null default now(),
  unique (launch_id, student_id)
);
create index if not exists launch_views_launch_idx on public.launch_views (launch_id);

comment on table public.launch_views is
  'تعليم "اطلعت عليه" من الطالب على إطلاق مدرس — Migration 0035، منفصل عن التسليم الفعلي.';
