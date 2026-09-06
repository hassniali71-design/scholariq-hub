-- 0020_groups_real_source.sql
-- تحويل `groups` إلى المصدر الوحيد الحقيقي، مع حقل جديد لتتبّع "بانتظار الجدولة".
-- ملاحظة: لا نحذف أي عمود قديم — كل إضافة nullable / default آمن على بيانات قائمة.

alter table groups
  add column if not exists scheduling_status text not null default 'pending'
    check (scheduling_status in ('pending', 'scheduled')),
  add column if not exists created_at text not null default (now()::text),
  add column if not exists notes text;

-- Index للاستعلامات المتكررة (real source: students / owner.index / etc.).
create index if not exists idx_groups_grade_subject
  on groups (center_id, grade_id, subject_id);
create index if not exists idx_groups_status
  on groups (center_id, scheduling_status);
