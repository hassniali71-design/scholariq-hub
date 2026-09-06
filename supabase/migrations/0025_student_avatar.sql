-- Migration 0025: students.avatar_data (صورة بروفايل الطالب)
-- نخزّن base64 داخل العمود، بنفس نمط teacher_launches.file_data (Migration 0024) —
-- تفادياً لإعداد Supabase Storage bucket منفصل الآن (يمكن نقلها لاحقاً بدون تغيير schema عام).

alter table public.students
  add column if not exists avatar_data text null,
  add column if not exists avatar_mime text null;

comment on column public.students.avatar_data is
  'صورة بروفايل الطالب (base64) — Migration 0025.';
comment on column public.students.avatar_mime is
  'نوع MIME لصورة البروفايل — Migration 0025.';
