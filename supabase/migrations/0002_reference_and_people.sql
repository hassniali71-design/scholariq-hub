-- SUPABASE_MIGRATION_SPEC.md §1 — reference tables + core people/group entities.
-- Every table here carries center_id per §1 ("كل الجداول تقريباً، ما عدا جدول centers نفسه").

create table if not exists subjects (
  id text primary key,
  center_id text not null references centers (id) on delete cascade,
  name text not null,
  theme_key text not null
);
create index if not exists idx_subjects_center_id on subjects (center_id);

create table if not exists grades (
  id text primary key,
  center_id text not null references centers (id) on delete cascade,
  name text not null,
  "order" integer not null
);
create index if not exists idx_grades_center_id on grades (center_id);

-- Which subjects a grade actually studies (CURRICULUM_ENGINE_SPEC.md §8). No center_id in the
-- TS type itself (`GradeSubject` is a pure grade_id/subject_id pairing) — denormalized here
-- anyway per §1's "نحافظ على نمط center_id في كل كيان" so every table stays directly filterable.
create table if not exists grade_subjects (
  id text primary key,
  center_id text not null references centers (id) on delete cascade,
  grade_id text not null references grades (id) on delete cascade,
  subject_id text not null references subjects (id) on delete cascade
);
create index if not exists idx_grade_subjects_center_id on grade_subjects (center_id);
create index if not exists idx_grade_subjects_grade_id on grade_subjects (grade_id);
create index if not exists idx_grade_subjects_subject_id on grade_subjects (subject_id);

create table if not exists teachers (
  id text primary key,
  center_id text not null references centers (id) on delete cascade,
  -- The teacher's auth.ts login identifier (e.g. "TCH-2001") — a join key against
  -- accounts.identifier, not a literal FK column (same mechanism as students.code).
  user_id text,
  full_name text not null,
  subject text not null,
  subject_id text not null references subjects (id) on delete restrict,
  groups integer not null default 0,
  students integer not null default 0,
  timer_compliance integer not null default 0,
  sla_breaches integer not null default 0,
  monthly_revenue numeric not null default 0
);
create index if not exists idx_teachers_center_id on teachers (center_id);
create index if not exists idx_teachers_subject_id on teachers (subject_id);
create index if not exists idx_teachers_user_id on teachers (user_id);

create table if not exists groups (
  id text primary key,
  center_id text not null references centers (id) on delete cascade,
  name text not null,
  subject text not null,
  subject_id text not null references subjects (id) on delete restrict,
  teacher_name text not null,
  teacher_id text not null references teachers (id) on delete restrict,
  grade text not null,
  grade_id text not null references grades (id) on delete restrict,
  weekday text not null,
  "time" text not null,
  room text not null,
  enrolled integer not null default 0,
  capacity integer not null default 0
);
create index if not exists idx_groups_center_id on groups (center_id);
create index if not exists idx_groups_teacher_id on groups (teacher_id);
create index if not exists idx_groups_subject_id on groups (subject_id);
create index if not exists idx_groups_grade_id on groups (grade_id);

create table if not exists students (
  id text primary key,
  center_id text not null references centers (id) on delete cascade,
  code text not null unique,
  full_name text not null,
  grade text not null,
  group_name text not null,
  -- Null when the student's group_name has no matching Group record yet (pre-existing seed gap).
  group_id text references groups (id) on delete set null,
  guardian_name text not null,
  guardian_phone text not null,
  payment_status text not null check (payment_status in ('paid', 'pending', 'overdue')),
  balance_due numeric not null default 0,
  points integer not null default 0,
  attendance_rate integer not null default 0,
  avg_score integer not null default 0,
  -- CURRICULUM_ENGINE_SPEC.md §7 — explicit multi-subject enrollment.
  subject_ids text[] not null default '{}'
);
create index if not exists idx_students_center_id on students (center_id);
create index if not exists idx_students_group_id on students (group_id);
create index if not exists idx_students_code on students (code);
