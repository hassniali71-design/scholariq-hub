# المعادلات / المنطق الأساسي — عقد دوال الـ Mutation المركزية

هذا العقد جزء من Phase 0 (`docs/06_PLAN.md` §0.3) — الدوال دي هي الواجهة الوحيدة
المسموح بيها لتعديل المصدر المركزي (`data-store.ts`). كل دالة: تعدّل الحالة محلياً
ثم تستدعي `emit()` (نفس آلية `auth.ts`).

```ts
recordAttendance(studentId: UUID, status: AttendanceStatus, method: AttendanceRecord["method"]): void
recordPayment(studentCode: string, amount: number, method: PaymentMethod, item: string): void
deliverBooklet(bookletId: UUID): void
closeShift(countedAmount: number): { expected: number; diff: number }
scoreHomework(studentId: UUID, value: number): void          // يحدّث homework_score + points
recordQuestionAnswer(studentId: UUID, correct: boolean): void // يحدّث points + leaderboard
releaseSessionTasks(groupId: UUID): void
  // ينشئ HomeworkTask لكل طالب في المجموعة
  // + WhatsAppLog تلقائي لكل ولي أمر
  // + يحدّث ملخص الحصة
```
