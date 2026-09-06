-- Migration 0024: teacher_launches.file_data (مراجعات/قراءة/ملحقات base64)
-- Migration 0023 / خطة C (C7): المدرس يرفع PDF/صور/مستندات لقراءة الطلاب.
-- نخزّن base64 داخل العمود لتفادي إعداد Supabase Storage bucket منفصل
-- (يمكن لاحقاً نقله لـ Storage بدون تغيير في الـ schema العام).

alter table public.teacher_launches
  add column if not exists file_data text null,
  add column if not exists file_name text null,
  add column if not exists file_mime text null;

comment on column public.teacher_launches.file_data is
  'محتوى الملف (base64) للمراجعات/القراءة — Migration 0024 (المرحلة C).';
comment on column public.teacher_launches.file_name is
  'اسم الملف الأصلي — Migration 0024.';
comment on column public.teacher_launches.file_mime is
  'نوع MIME — Migration 0024.';
