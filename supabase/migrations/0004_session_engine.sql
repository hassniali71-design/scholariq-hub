-- SUPABASE_MIGRATION_SPEC.md §1 — the "وضع الحصة" session engine
-- (CURRICULUM_ENGINE_SPEC.md §13): one record per taught session + everything
-- logged during it.

create table if not exists session_records (
  id text primary key,
  center_id text not null references centers (id) on delete cascade,
  group_id text not null references groups (id) on delete cascade,
  lesson_id text references lessons (id) on delete set null,
  teacher_id text not null references teachers (id) on delete restrict,
  date text not null,
  attendees_count integer not null default 0,
  absentees_count integer not null default 0,
  questions_asked_count integer not null default 0,
  participants_count integer not null default 0,
  homework_launch_status text not null check (homework_launch_status in ('not_sent', 'sent')),
  e_homework_launch_status text not null check (e_homework_launch_status in ('not_sent', 'sent')),
  activity_completed_in_session boolean not null default false,
  duration_seconds integer not null default 0,
  explanation_duration_seconds integer not null default 0,
  extension_seconds integer not null default 0,
  general_notes text
);
create index if not exists idx_session_records_center_id on session_records (center_id);
create index if not exists idx_session_records_group_id on session_records (group_id);
create index if not exists idx_session_records_lesson_id on session_records (lesson_id);

create table if not exists session_events (
  id text primary key,
  center_id text not null references centers (id) on delete cascade,
  session_id text not null references session_records (id) on delete cascade,
  student_id text not null references students (id) on delete cascade,
  at timestamptz not null default now(),
  kind text not null check (kind in ('homework_score', 'question_answer', 'activity_score', 'attendance', 'note')),
  payload jsonb not null default '{}'
);
create index if not exists idx_session_events_center_id on session_events (center_id);
create index if not exists idx_session_events_session_id on session_events (session_id);
create index if not exists idx_session_events_student_id on session_events (student_id);

create table if not exists timer_extensions (
  id text primary key,
  center_id text not null references centers (id) on delete cascade,
  session_id text not null references session_records (id) on delete cascade,
  step_key text not null check (
    step_key in (
      'last_homework', 'lesson', 'questions', 'book_exercise',
      'activity_review', 'release_homework', 'release_e_homework', 'behavior'
    )
  ),
  added_seconds integer not null,
  reason text,
  at timestamptz not null default now()
);
create index if not exists idx_timer_extensions_center_id on timer_extensions (center_id);
create index if not exists idx_timer_extensions_session_id on timer_extensions (session_id);

create table if not exists random_pick_logs (
  id text primary key,
  center_id text not null references centers (id) on delete cascade,
  group_id text not null references groups (id) on delete cascade,
  student_id text not null references students (id) on delete cascade,
  session_id text not null references session_records (id) on delete cascade,
  picked_at timestamptz not null default now()
);
create index if not exists idx_random_pick_logs_center_id on random_pick_logs (center_id);
create index if not exists idx_random_pick_logs_session_id on random_pick_logs (session_id);
create index if not exists idx_random_pick_logs_group_id on random_pick_logs (group_id);

create table if not exists assessment_scores (
  id text primary key,
  center_id text not null references centers (id) on delete cascade,
  student_id text not null references students (id) on delete cascade,
  session_id text references session_records (id) on delete set null,
  lesson_id text references lessons (id) on delete set null,
  category text not null check (category in ('homework', 'activity', 'behavior', 'question', 'e_homework')),
  source text not null check (source in ('auto', 'manual')),
  value numeric not null,
  max_value numeric not null,
  recorded_by_teacher_id text not null references teachers (id) on delete restrict,
  recorded_at timestamptz not null default now()
);
create index if not exists idx_assessment_scores_center_id on assessment_scores (center_id);
create index if not exists idx_assessment_scores_student_id on assessment_scores (student_id);
create index if not exists idx_assessment_scores_session_id on assessment_scores (session_id);
create index if not exists idx_assessment_scores_lesson_id on assessment_scores (lesson_id);

-- CURRICULUM_ENGINE_SPEC.md §1 — "حل تمارين الكتاب": same shape used twice per session via
-- `context`, once in-class and once as homework.
create table if not exists book_exercise_tasks (
  id text primary key,
  center_id text not null references centers (id) on delete cascade,
  session_id text not null references session_records (id) on delete cascade,
  student_group_id text not null references groups (id) on delete cascade,
  pages_text text not null,
  context text not null check (context in ('in_session', 'homework')),
  created_at timestamptz not null default now()
);
create index if not exists idx_book_exercise_tasks_center_id on book_exercise_tasks (center_id);
create index if not exists idx_book_exercise_tasks_session_id on book_exercise_tasks (session_id);
