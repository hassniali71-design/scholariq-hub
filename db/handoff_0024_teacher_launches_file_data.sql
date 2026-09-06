-- Migration 0024 handoff: bundled version of 0024_teacher_launches_file_data.sql

alter table public.teacher_launches
  add column if not exists file_data text null,
  add column if not exists file_name text null,
  add column if not exists file_mime text null;
