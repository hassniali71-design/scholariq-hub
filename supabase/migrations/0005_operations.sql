-- SUPABASE_MIGRATION_SPEC.md §1 — attendance, money, inventory, and the
-- per-portal (student/parent) entities.

create table if not exists attendance_records (
  id text primary key,
  center_id text not null references centers (id) on delete cascade,
  student_id text not null references students (id) on delete cascade,
  student_name text not null,
  group_name text not null,
  status text not null check (status in ('present', 'late', 'absent')),
  checked_in_at timestamptz not null default now(),
  method text not null check (method in ('qr', 'barcode', 'manual')),
  -- Session-mode marks link here; QR-gate / legacy check-ins have no session context.
  session_id text references session_records (id) on delete set null
);
create index if not exists idx_attendance_records_center_id on attendance_records (center_id);
create index if not exists idx_attendance_records_student_id on attendance_records (student_id);
create index if not exists idx_attendance_records_session_id on attendance_records (session_id);

create table if not exists payments (
  id text primary key,
  center_id text not null references centers (id) on delete cascade,
  student_name text not null,
  student_code text not null,
  amount numeric not null,
  method text not null check (method in ('cash', 'wallet', 'instapay')),
  item text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_payments_center_id on payments (center_id);
create index if not exists idx_payments_student_code on payments (student_code);

create table if not exists booklets (
  id text primary key,
  center_id text not null references centers (id) on delete cascade,
  title text not null,
  subject text not null,
  price numeric not null default 0,
  in_stock integer not null default 0,
  delivered integer not null default 0
);
create index if not exists idx_booklets_center_id on booklets (center_id);

create table if not exists shift_closures (
  id text primary key,
  center_id text not null references centers (id) on delete cascade,
  expected numeric not null,
  counted numeric not null,
  diff numeric not null,
  closed_at timestamptz not null default now()
);
create index if not exists idx_shift_closures_center_id on shift_closures (center_id);

-- In-session running scoreboard, keyed one row per student, upserted live and cleared when
-- a session ends (data-store.ts resets this to [] on session end — mirrors that here as a
-- delete, not a new "cleared" flag, keeping the table's meaning identical to the TS array).
create table if not exists live_scores (
  student_id text primary key references students (id) on delete cascade,
  center_id text not null references centers (id) on delete cascade,
  student_name text not null,
  homework_score integer,
  question_score integer,
  points integer not null default 0
);
create index if not exists idx_live_scores_center_id on live_scores (center_id);

-- §"leaderboard" (`LeaderboardEntry`) intentionally has NO table: in data-store.ts it is
-- always `buildLeaderboard(students)`, a pure ranking computed from `students.points` at
-- every read — never independently written. Recomputing it from `students` (client-side, or
-- via `order by points desc` in the server function) preserves that exactly; a stored copy
-- would just be a cache that can drift, which the current code never had to worry about.

create table if not exists quiz_results (
  id text primary key,
  center_id text not null references centers (id) on delete cascade,
  student_id text not null references students (id) on delete cascade,
  subject text not null,
  title text not null,
  date text not null,
  score numeric not null,
  max_score numeric not null
);
create index if not exists idx_quiz_results_center_id on quiz_results (center_id);
create index if not exists idx_quiz_results_student_id on quiz_results (student_id);

create table if not exists homework_tasks (
  id text primary key,
  center_id text not null references centers (id) on delete cascade,
  student_id text not null references students (id) on delete cascade,
  subject text not null,
  title text not null,
  due_date text not null,
  status text not null check (status in ('pending', 'submitted', 'graded', 'late')),
  grade numeric
);
create index if not exists idx_homework_tasks_center_id on homework_tasks (center_id);
create index if not exists idx_homework_tasks_student_id on homework_tasks (student_id);

create table if not exists whatsapp_logs (
  id text primary key,
  center_id text not null references centers (id) on delete cascade,
  student_id text not null references students (id) on delete cascade,
  sent_at timestamptz not null default now(),
  template text not null check (template in ('attendance', 'payment', 'grade', 'homework', 'absence')),
  message text not null,
  delivered boolean not null default false
);
create index if not exists idx_whatsapp_logs_center_id on whatsapp_logs (center_id);
create index if not exists idx_whatsapp_logs_student_id on whatsapp_logs (student_id);

create table if not exists teacher_notes (
  id text primary key,
  center_id text not null references centers (id) on delete cascade,
  student_id text not null references students (id) on delete cascade,
  teacher_id text not null references teachers (id) on delete cascade,
  teacher_name text not null,
  subject text not null,
  date text not null,
  note text not null,
  tone text not null check (tone in ('positive', 'neutral', 'warning'))
);
create index if not exists idx_teacher_notes_center_id on teacher_notes (center_id);
create index if not exists idx_teacher_notes_student_id on teacher_notes (student_id);
