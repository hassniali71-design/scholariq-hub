-- 0021_teachers_subject_nullable.sql
-- إصلاح: teachers.subject_id و teachers.subject كانا NOT NULL مما يمنع إنشاء مدرس
-- بدون اختيار مادة (مثلاً: مدرس متعدد مواد، أو المدرس يُنشأ أولاً ثم تُربط المادة بعد ذلك).
-- تخفيف القيد إلى NULL + default '' لـ subject — آمن على البيانات القائمة (لا حذف، لا إعادة تسمية).

alter table teachers
  alter column subject_id drop not null,
  alter column subject drop not null,
  alter column subject set default '';

-- Index يبقى كما هو — Supabase يقبل NULL في indexed column بدون مشاكل.
