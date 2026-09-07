-- Migration 0033: subject_quotes — عبارات المواد القابلة للتعديل والإطلاق من المالك.
-- بديل قابل للتعديل لبنك الاقتباسات الثابت في src/lib/daily-quotes.ts: المالك يضيف
-- عبارات لكل مادة، ويطلق واحدة منها لتظهر في "غرفة المادة" عند المدرس بدل الاقتباس
-- الثابت. عبارة واحدة فقط نشطة لكل مادة في نفس اللحظة (is_active).

create table if not exists public.subject_quotes (
  id text primary key,
  center_id text not null references centers (id) on delete cascade,
  subject_id text not null references subjects (id) on delete cascade,
  text text not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists subject_quotes_subject_idx
  on public.subject_quotes (subject_id, is_active);

comment on table public.subject_quotes is
  'عبارات/اقتباسات لكل مادة يديرها المالك — Migration 0033. is_active = العبارة المُطلَقة حالياً لهذه المادة.';
