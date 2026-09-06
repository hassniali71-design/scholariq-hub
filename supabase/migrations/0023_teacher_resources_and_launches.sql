-- Migration 0023: group_resources + teacher_launches + homework_attempts
-- Plan 1788573108220 (المرحلة A — الموارد + الإطلاق + سجل الحضور).
--
-- كل الـ IDs نصية (`text primary key`) متّسقة مع 0001..0022 — التطبيق يصدرها
-- كـ `tc-${Date.now()}` ولا نعتمد على `gen_random_uuid()`.
--
-- 1) موارد المجموعة (روابط شرح، PDF، روابط خارجية، فيديو)
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

-- 2) الإطلاقات (مهام، واجبات، أنشطة، اختبارات تفاعلية)
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

-- 3) محاولات الطلاب على الواجبات الإلكترونية
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

comment on table group_resources is
  'روابط شرح / PDF / مرفقات المدرس للمجموعة (Migration 0023, المرحلة A).';
comment on table teacher_launches is
  'إطلاقات المدرس: واجبات، أنشطة، اختبارات تفاعلية، مراجعات (Migration 0023, المرحلة A).';
comment on table homework_attempts is
  'محاولات الطلاب على الواجبات الإلكترونية الصادرة من teacher_launches (Migration 0023, المرحلة A).';
