-- Migration 0031: إصلاح قيدين حقيقيين اكتشفناهم من أخطاء Supabase الفعلية في الإنتاج
-- (Console errors أثناء استخدام "وضع الحصة" على بيانات حقيقية):
--
-- 1) teacher_launches.teacher_id كان يشاور على accounts(id) (Migration 0023)، لكن
--    كل الكود في المشروع (LaunchPanel, teacher.session.$groupId.tsx) يمرّر
--    group.teacher_id — وهذا فعلياً Teacher.id (مساحة "tc-..."), مش accounts.id
--    (مساحة "acc-..."). النتيجة: كل إطلاق مهمة/واجب من المدرس كان يفشل حفظه فعلياً
--    (foreign key violation "teacher_launches_teacher_id_fkey")، فالطالب ما كانش
--    بيستقبل حاجة أبداً رغم ظهورها للمدرس محلياً. نصحّح الـ FK ليطابق نفس النمط
--    المستخدم في باقي جداول محرك الحصة (session_records.teacher_id،
--    assessment_scores.recorded_by_teacher_id) اللي بيشاوروا صح على teachers(id).
alter table teacher_launches drop constraint if exists teacher_launches_teacher_id_fkey;
alter table teacher_launches
  add constraint teacher_launches_teacher_id_fkey
  foreign key (teacher_id) references teachers (id) on delete restrict;

-- 2) assessment_scores.category CHECK (Migration 0004) كانت ناقصة القيمة 'other'،
--    رغم إن النوع في types/index.ts:481 يسمح بيها من الأساس، ورغم إن
--    src/components/teacher/ExamsCard.tsx يسجّل درجات الامتحانات بهذه الفئة —
--    فأي محاولة تسجيل درجة امتحان كانت تفشل (check constraint violation).
alter table assessment_scores drop constraint if exists assessment_scores_category_check;
alter table assessment_scores
  add constraint assessment_scores_category_check
  check (category in ('homework', 'activity', 'behavior', 'question', 'e_homework', 'other'));
