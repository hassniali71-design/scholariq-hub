-- Migration 0036: نسب مرسل الرسالة (المدرس) على whatsapp_logs.
-- كان جدول whatsapp_logs بيسجّل رسالة الوسام/التنبيه اللي بيبعتها المدرس
-- (sendTeacherMessage) من غير أي عمود يحفظ *مين* بعتها — يعني مستحيل نعرف
-- أي مدرس أصدر الوسام/التنبيه، رغم إن ده مطلوب صراحة يظهر عند الطالب وولي
-- الأمر. العمودين اختياريان (nullable) لأن باقي أنواع الرسائل (حضور/دفع/
-- درجة/واجب/غياب) بتتولّد آلياً من النظام نفسه بلا مدرس مُصدِر.

alter table whatsapp_logs add column if not exists teacher_id text references teachers (id) on delete set null;
alter table whatsapp_logs add column if not exists teacher_name text;

create index if not exists idx_whatsapp_logs_teacher_id on whatsapp_logs (teacher_id);
