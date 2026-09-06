-- Migration 0023 handoff: bundled version of 0023_teacher_resources_and_launches.sql

create table if not exists group_resources (
  id text primary key,
  center_id text not null references centers (id) on delete cascade,
  group_id text not null references groups (id) on delete cascade,
  resource_type text not null check (resource_type in ('lesson_url','pdf','external_link','video','other')),
  url text not null,
  name text not null,
  unit text null,
  created_by text not null references accounts (id),
  created_at timestamptz not null default now()
);
create index if not exists group_resources_group_idx
  on group_resources (group_id, created_at desc);

create table if not exists teacher_launches (
  id text primary key,
  center_id text not null references centers (id) on delete cascade,
  group_id text not null references groups (id) on delete cascade,
  teacher_id text not null references accounts (id),
  launch_type text not null check (launch_type in (
    'homework','homework_with_correction','in_class_task',
    'interactive_activity','online_homework','online_quiz',
    'reading_assignment','oral_recitation'
  )),
  title text not null,
  body text null,
  notes text null,
  due_at timestamptz null,
  duration_min integer null,
  source_launch_id text null,
  created_at timestamptz not null default now()
);
create index if not exists teacher_launches_group_idx
  on teacher_launches (group_id, created_at desc);
create index if not exists teacher_launches_teacher_idx
  on teacher_launches (teacher_id, created_at desc);

create table if not exists homework_attempts (
  id text primary key,
  center_id text not null references centers (id) on delete cascade,
  launch_id text not null references teacher_launches (id) on delete cascade,
  student_id text not null references students (id) on delete cascade,
  student_name text not null,
  answer text null,
  score numeric(5,2) null,
  max_score numeric(5,2) null,
  submitted_at timestamptz not null default now(),
  unique (launch_id, student_id)
);
create index if not exists homework_attempts_launch_idx
  on homework_attempts (launch_id);
