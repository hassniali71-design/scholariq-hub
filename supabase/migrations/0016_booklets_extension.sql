-- 0016_booklets_extension.sql
-- Section 3 — extend booklets with kind, page_count, printed, paper_per_unit

alter table booklets
  add column if not exists kind text not null default 'booklet'
    check (kind in ('book', 'booklet', 'exam')),
  add column if not exists page_count integer not null default 0,
  add column if not exists printed integer not null default 0,
  add column if not exists paper_per_unit integer not null default 1;
