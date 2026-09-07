-- Migration 0026: create notifications table in the canonical migrations path.
--
-- db/0009_owner_control_tower.sql already creates it for handoff runs;
-- this file makes the migration history self-contained for supabase/migrations/
-- so 0013_notifications_extension.sql can safely alter it.

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
