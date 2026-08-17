-- Fix-up migration, discovered while running scripts/seed-supabase.ts against the real data:
-- several "timestamp-looking" fields in src/lib/data-store.ts (`nowTime()` / `todayLabel()`)
-- and their mock-data.ts seed values are actually opaque Arabic display strings
-- ("03:52 م", "اليوم 03:53 م", "أمس 08:10 م"), never real ISO timestamps — unlike
-- accounts.created_at / centers.created_at, which genuinely are `new Date().toISOString()`.
-- 0003/0004/0005 guessed `timestamptz` for these before that was confirmed; correcting here
-- instead of editing already-applied migrations.

alter table attendance_records alter column checked_in_at type text using checked_in_at::text;
alter table attendance_records alter column checked_in_at drop default;

alter table payments alter column created_at type text using created_at::text;
alter table payments alter column created_at drop default;

alter table shift_closures alter column closed_at type text using closed_at::text;
alter table shift_closures alter column closed_at drop default;

alter table whatsapp_logs alter column sent_at type text using sent_at::text;
alter table whatsapp_logs alter column sent_at drop default;

alter table session_events alter column at type text using at::text;
alter table session_events alter column at drop default;

alter table timer_extensions alter column at type text using at::text;
alter table timer_extensions alter column at drop default;

alter table random_pick_logs alter column picked_at type text using picked_at::text;
alter table random_pick_logs alter column picked_at drop default;

alter table assessment_scores alter column recorded_at type text using recorded_at::text;
alter table assessment_scores alter column recorded_at drop default;

alter table book_exercise_tasks alter column created_at type text using created_at::text;
alter table book_exercise_tasks alter column created_at drop default;

alter table lessons alter column taught_at type text using taught_at::text;
