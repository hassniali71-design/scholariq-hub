-- 0019_teacher_planning.sql
-- Section 1 (teacher identity) + Section 6 (lesson plans) + platform teacher notes (Mukawala)
-- Ù…Ù„Ø§Ø­Ø¸Ø©: Ù„Ø§ Ù†Ø­Ø°Ù Ø£ÙŠ Ø¹Ù…ÙˆØ¯ Ù‚Ø¯ÙŠÙ… â€” ÙƒÙ„ Ø¥Ø¶Ø§ÙØ© nullable / default Ø¢Ù…Ù† Ø¹Ù„Ù‰ Ø¨ÙŠØ§Ù†Ø§Øª Ù‚Ø§Ø¦Ù…Ø©.

-- 1) ØªÙˆØ³Ø¹Ø© teachers â€” honorific + ØµÙˆØ±Ø© ØºÙ„Ø§Ù
alter table teachers
  add column if not exists honorific text not null default 'mr'
    check (honorific in ('mr', 'miss', 'mrs')),
  add column if not exists cover_image_key text;

-- 2) Ø®Ø·Ø· Ø§Ù„Ø¯Ø±ÙˆØ³ (teacher-owned â€” Ù…Ù†ÙØµÙ„Ø© ØªÙ…Ø§Ù…Ø§Ù‹ Ø¹Ù† tasks Ùˆ lessons)
create table if not exists lesson_plans (
  id text primary key,
  center_id text not null references centers (id) on delete cascade,
  teacher_id text not null references teachers (id) on delete cascade,
  group_id text not null references groups (id) on delete cascade,
  lesson_name text not null,
  unit text,
  notes text,
  prepared_at text,
  prepared_done boolean not null default false,
  taught_at text,
  taught_done boolean not null default false,
  created_at text not null,
  updated_at text not null
);
create index if not exists idx_lesson_plans_teacher
  on lesson_plans (center_id, teacher_id, group_id, created_at desc);
create index if not exists idx_lesson_plans_group
  on lesson_plans (center_id, group_id);
create index if not exists idx_lesson_plans_unit
  on lesson_plans (center_id, teacher_id, unit);

-- 3) Ø±Ø³Ø§Ø¦Ù„ Ù…Ø¯ÙŠØ± Ø§Ù„Ù…Ù†ØµØ© Ù„Ù„Ù…Ø¯Ø±Ø³ÙŠÙ† (Mukawala) â€” Ø¨Ø¯ÙˆÙ† center_id (Ø¹Ø¨Ø± ÙƒÙ„ Ø§Ù„Ù…Ø±Ø§ÙƒØ²)
create table if not exists platform_teacher_notes (
  id text primary key,
  subject_id text not null references subjects (id) on delete cascade,
  body text not null,
  author_identifier text not null,
  author_name text not null,
  created_at text not null,
  updated_at text not null
);
create index if not exists idx_platform_teacher_notes_subject
  on platform_teacher_notes (subject_id, created_at desc);
