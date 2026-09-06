-- 0013_notifications_extension.sql — توسيع جدول notifications لربطه بمصدر الحدث.
-- هذا يمكّن النظام من تمييز تنبيه "تأخر المدرس" عن تنبيه "مهمة مستعجلة" بمرونة أكبر.

alter table notifications add column if not exists source_event text;
alter table notifications add column if not exists source_id text;
alter table notifications add column if not exists acknowledged_at text;
alter table notifications add column if not exists is_actionable boolean not null default false;

create index if not exists idx_notifications_source on notifications (center_id, source_event, source_id);
