-- 0018_booklet_sales.sql
-- Section 3 — sales of booklets/books/exams to students

create table if not exists booklet_sales (
  id text primary key,
  center_id text not null references centers (id) on delete cascade,
  student_id text not null references students (id) on delete cascade,
  student_name text not null,
  student_code text not null,
  booklet_id text not null references booklets (id) on delete restrict,
  booklet_title text not null,
  quantity integer not null,
  unit_price numeric not null,
  total_amount numeric not null,
  paper_consumed integer not null,
  sold_by text not null,
  sold_at text not null
);
create index if not exists idx_booklet_sales_center on booklet_sales (center_id, sold_at desc);
create index if not exists idx_booklet_sales_student on booklet_sales (center_id, student_id);
