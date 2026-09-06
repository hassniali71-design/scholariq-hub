-- 0012_tasks.sql — نظام المهام الموحّد (Tasks)
-- كل مهمة مرتبطة بـ center_id (RLS) + لها مُكلَّف واحد من ثلاث فئات (teacher/staff/owner).
-- المالك يمكنه رؤية كل المهام، الموظف يرى المُكلَّفة له، المدرس يرى المُكلَّفة له.

create table if not exists tasks (
  id text primary key,
  center_id text not null references centers (id) on delete cascade,
  title text not null,
  task_type text not null default 'general',
  assignee_role text not null check (assignee_role in ('teacher', 'staff', 'owner')),
  assignee_id text,
  assignee_name text not null,
  created_by_id text,
  created_by_name text,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  is_urgent boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'done', 'cancelled')),
  note text,
  due_at text,
  completed_at text,
  created_at text not null,
  updated_at text not null
);
create index if not exists idx_tasks_center on tasks (center_id);
create index if not exists idx_tasks_assignee on tasks (center_id, assignee_role, assignee_id);
create index if not exists idx_tasks_status on tasks (center_id, status);
