-- 0014_teacher_expected_salary.sql
-- §0.3: راتب المدرس "المتفق عليه" (expected) ≠ "المدفوع فعلياً" (payroll_records).
-- هذا الحقل منفصل تماماً — لا يُخصم من الخزنة ولا يظهر في صافي الربح.

alter table teachers
  add column if not exists expected_salary_basis text
    check (expected_salary_basis in ('per_session', 'weekly', 'monthly'));

alter table teachers
  add column if not exists expected_salary_value numeric not null default 0;
