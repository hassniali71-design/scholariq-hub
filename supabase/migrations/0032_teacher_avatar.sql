-- Migration 0032: teachers.avatar_data (صورة بروفايل المدرس)
-- نفس نمط students.avatar_data (Migration 0028) — base64 داخل العمود.

alter table public.teachers
  add column if not exists avatar_data text null,
  add column if not exists avatar_mime text null;

comment on column public.teachers.avatar_data is
  'صورة بروفايل المدرس (base64) — Migration 0032.';
comment on column public.teachers.avatar_mime is
  'نوع MIME لصورة بروفايل المدرس — Migration 0032.';
