-- Migration 0025: fix-up for the two schema contradictions found in the live-DB audit.
--
-- CD1 — teachers.stages / teachers.primary_stage: declared in the TS `Teacher` type
--       (src/types/index.ts:101-103), written by createTeacherRecord
--       (src/lib/data-store.ts:778-779) and seeded in mock-data.ts:209-210, but no earlier
--       migration ever added them — withColumnFallback silently dropped the columns on every
--       insert (data-functions.server.ts:367), so a teacher's المراحل was never persisted.
--       Using the app's text[] convention (subject_ids in migration 0002, bullets/options in
--       0003).
-- CD2 — center_finance_settings.default_group_capacity: written by saveFinanceSettings via
--       DEFAULT_FINANCE_SETTINGS (data-store.ts:2872, default 20) and rendered by the owner
--       finance UI, but db/0009's table definition has no such column — silently dropped too.

alter table public.teachers
  add column if not exists stages text[] not null default '{primary}';
alter table public.teachers
  add column if not exists primary_stage text not null default 'primary';

alter table public.center_finance_settings
  add column if not exists default_group_capacity integer not null default 20;

comment on column public.teachers.stages is
  'المراحل التي يدرّسها المدرس (ابتدائي/إعدادي/ثانوي) — Migration 0025.';
comment on column public.teachers.primary_stage is
  'أول مرحلة رئيسية (fallback في الـ UI) — Migration 0025.';
comment on column public.center_finance_settings.default_group_capacity is
  'السعة الافتراضية للمجموعة الجديدة (20 افتراضياً) — Migration 0025.';