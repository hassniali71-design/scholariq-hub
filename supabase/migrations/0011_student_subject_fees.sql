-- Migration 0011: نظام دفع الطالب لكل مادة على حدة.
--
-- ملف ثبّت أصلاً في db/0011_student_subject_fees.sql (نفس سبب نقل 0009/0010 —
-- راجع تعليقهما). النسخة الأصلية كانت بتكرر إنشاء جداول 0010 دفاعياً ("0010 لسه
-- ماتشغّلش")؛ الآن بعد ما 0010 بقى ملف حقيقي في تسلسله الصحيح، الاكتفاء هنا
-- بالإضافة الفعلية الوحيدة لـ 0011: أعمدة جديدة على students.
--
--  * students.billing_plan — نظام دفع الطالب: حصة / شهر / موسم.
--  * students.subject_fees — سعر كل مادة لهذا الطالب تحديداً (jsonb: { subject_id: price }).
--    السعر شخصي لكل طالب (مثال: علوم ٣٠٠، عربي ٤٠٠) وليس سعراً عاماً ثابتاً.

alter table students add column if not exists billing_plan text;
alter table students add column if not exists subject_fees jsonb not null default '{}'::jsonb;
