-- 0029_group_activations.sql — إشارة "المجموعة نشطة الآن" مستقلة تماماً عن
-- sessionRecords/attendanceRecords (فصل زر بدء الحصة عند المدرس عن المجموعات
-- النشطة عند المالك — حصراً فعل الموظف: بوابة الحضور أو زر بدء الحصة).

create table if not exists group_activations (
  id text primary key,
  center_id text not null references centers (id) on delete cascade,
  group_id text not null,
  activated_at text not null
);
create index if not exists idx_group_activations_center on group_activations (center_id);
create index if not exists idx_group_activations_group on group_activations (group_id, activated_at);
