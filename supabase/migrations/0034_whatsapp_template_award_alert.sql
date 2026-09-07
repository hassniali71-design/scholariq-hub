-- Migration 0034: whatsapp_logs.template CHECK كان ناقص 'award' و'alert'.
-- src/types/index.ts's WhatsAppLog.template يسمح بالقيمتين من قبل (توسّع النوع بدون
-- تحديث القيد الحقيقي في القاعدة) — نفس فئة الخطأ المُصلَحة في Migration 0031
-- (assessment_scores.category) قبل ما تتسبب في فشل حفظ حقيقي.

alter table public.whatsapp_logs drop constraint if exists whatsapp_logs_template_check;
alter table public.whatsapp_logs
  add constraint whatsapp_logs_template_check
  check (template in ('attendance', 'payment', 'grade', 'homework', 'absence', 'award', 'alert'));
