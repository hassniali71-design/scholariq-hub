-- 0030_student_group_enrollments.sql — تسجيل الطالب في مجموعات إضافية (مواد
-- تانية)، منفصل تماماً عن students.group_id (المجموعة الأساسية القديمة اللي
-- كل الحضور/المدفوعات/وضع الحصة معتمدين عليها بلا أي تغيير). إضافي بحت لدعم
-- صفحة "مدرّسيني ومنهجي" — طالب واحد يقدر يكون في أكتر من مجموعة/مدرس.

create table if not exists student_group_enrollments (
  id text primary key,
  center_id text not null references centers (id) on delete cascade,
  student_id text not null,
  group_id text not null,
  unique (student_id, group_id)
);
create index if not exists idx_sge_center on student_group_enrollments (center_id);
create index if not exists idx_sge_student on student_group_enrollments (student_id);
