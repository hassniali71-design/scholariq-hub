-- ⚠️ شغّل الملف ده مرة واحدة في Supabase → SQL Editor (نفس مشروعك الخارجي).
--
-- (0010 لسه ماتشغّلش على القاعدة الحالية — الجداول الناقصة متكررة هنا بأمان بـ if not exists.)
--
-- الجديد في 0011:
--  * students.billing_plan   — نظام دفع الطالب: حصة / شهر / موسم.
--  * students.subject_fees   — سعر كل مادة لهذا الطالب تحديداً (jsonb: { subject_id: price }).
--    السعر شخصي لكل طالب (مثال: علوم ٣٠٠، عربي ٤٠٠) وليس سعراً عاماً ثابتاً.

create table if not exists expenses (
  id text primary key,
  center_id text not null references centers (id) on delete cascade,
  category text not null default 'other',
  title text not null,
  amount numeric not null default 0,
  spent_at text not null,
  note text,
  created_at text not null
);
create index if not exists idx_expenses_center on expenses (center_id);

create table if not exists payroll_records (
  id text primary key,
  center_id text not null references centers (id) on delete cascade,
  person_type text not null default 'teacher',
  person_id text,
  person_name text not null,
  basis text not null default 'monthly',
  amount numeric not null default 0,
  period text not null,
  paid_at text not null,
  created_at text not null
);
create index if not exists idx_payroll_center on payroll_records (center_id);

create table if not exists subject_prices (
  id text primary key,
  center_id text not null references centers (id) on delete cascade,
  subject_id text not null,
  subject_name text not null,
  monthly_price numeric not null default 0,
  per_session_price numeric not null default 0,
  updated_at text not null
);
create unique index if not exists idx_subject_prices_unique on subject_prices (center_id, subject_id);

create table if not exists schedule_slots (
  id text primary key,
  center_id text not null references centers (id) on delete cascade,
  teacher_id text not null,
  teacher_name text not null,
  subject_id text,
  subject text not null default '',
  grade text not null default '',
  weekday text not null,
  time text not null,
  room text not null default '',
  group_id text,
  updated_at text not null
);
create index if not exists idx_schedule_slots_center on schedule_slots (center_id);

alter table students add column if not exists billing_plan text;
alter table students add column if not exists subject_fees jsonb not null default '{}'::jsonb;
