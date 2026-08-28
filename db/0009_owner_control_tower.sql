-- ⚠️ شغّل الملف ده مرة واحدة في Supabase → SQL Editor (المشروع الخارجي بتاعك).
-- (مجلد supabase/migrations مقفول من طرف المنصة، فالملف اتحط هنا.)
--
-- برج تحكم المالك — الجداول الجديدة:
--  1) إعدادات النظام المالي لكل مركز (شهري / بالحصة / بالسيزون) + أساس رواتب الموظفين.
--  2) سجل تسليم واستلام الخزنة (المدير يستلم مبلغ من موظف بتاريخه).
--  3) الإشعارات المهمة (دفع، غياب، تأخير، انسحاب مدرس...).
--  4) سجل النشاط الموحّد (Timeline).
--  5) صلاحيات الموظفين التفصيلية.
-- كل الجداول تحمل center_id (نفس نمط §1) وتُقرأ/تُكتب عبر نفس طبقة CRUD العامة.

create table if not exists center_finance_settings (
  id text primary key,
  center_id text not null references centers (id) on delete cascade,
  billing_mode text not null default 'monthly' check (billing_mode in ('monthly', 'per_session', 'season')),
  monthly_fee numeric not null default 0,
  per_session_fee numeric not null default 0,
  season_fee numeric not null default 0,
  season_sessions integer not null default 0,
  staff_salary_basis text not null default 'fixed' check (staff_salary_basis in ('fixed', 'per_session', 'revenue_share')),
  staff_salary_value numeric not null default 0,
  updated_at text not null
);
create unique index if not exists idx_finance_settings_center on center_finance_settings (center_id);

create table if not exists safe_handovers (
  id text primary key,
  center_id text not null references centers (id) on delete cascade,
  staff_name text not null,
  staff_identifier text,
  amount numeric not null,
  note text,
  received_at text not null,
  created_at text not null
);
create index if not exists idx_safe_handovers_center on safe_handovers (center_id);

create table if not exists notifications (
  id text primary key,
  center_id text not null references centers (id) on delete cascade,
  kind text not null,
  severity text not null default 'info' check (severity in ('info', 'warning', 'critical')),
  title text not null,
  body text,
  read_at text,
  created_at text not null
);
create index if not exists idx_notifications_center on notifications (center_id);

create table if not exists activity_log (
  id text primary key,
  center_id text not null references centers (id) on delete cascade,
  kind text not null,
  title text not null,
  detail text,
  actor text,
  amount numeric,
  created_at text not null
);
create index if not exists idx_activity_log_center on activity_log (center_id);

create table if not exists staff_permissions (
  id text primary key,
  center_id text not null references centers (id) on delete cascade,
  account_identifier text not null,
  full_name text not null,
  permissions jsonb not null default '[]'::jsonb,
  updated_at text not null
);
create index if not exists idx_staff_permissions_center on staff_permissions (center_id);
create unique index if not exists idx_staff_permissions_account on staff_permissions (account_identifier);
