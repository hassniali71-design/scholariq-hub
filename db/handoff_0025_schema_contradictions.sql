-- Migration 0025 handoff: bundled version of 0025_fix_schema_contradictions.sql

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