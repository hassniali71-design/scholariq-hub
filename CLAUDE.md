# ScholarIQ Hub

ERP + LMS لسنتر تعليمي — 6 أدوار منفصلة (owner/staff/teacher/student/parent/visitor)
مبنية بـ TanStack Start. التفاصيل الكاملة في `docs/` — لا تقرأها كلها؛ اقرأ الملف
المطلوب فقط.

## الستاك
TanStack Start + TanStack Router (file-based) + React 19 + Tailwind v4 + shadcn/ui
+ bun. تفاصيل كاملة: @docs/02_STACK.md

## قوانين توفير الكريدت (مهمة جداً)
- **متقراش** `node_modules/` أو `.next/` أو أي مجلد بناء إطلاقاً.
- اقرأ فقط الملف اللي بتشير له بـ `@` في كل طلب — متفتحش ملفات `docs/` الباقية
  تلقائياً "علشان تتأكد".
- استخدم **haiku** لتصليح الأخطاء الصغيرة/الأخطاء الإملائية، و**sonnet** للميزات
  الجديدة والقرارات المعمارية.
- بعد أي Phase/تاسك تخلّصه: **حدّث `docs/03_STATE.md`** بس (مش أي ملف تاني) بسطر
  أو سطرين يوضّحوا اللي اتغيّر.

## خريطة الملفات الحرجة
- @src/config/roles.ts — مصدر التنقل (Sidebar) لكل الأدوار
- @src/components/layout/AppShell.tsx — القالب العام (Sidebar+Header)
- @src/components/dashboard/StatCard.tsx — StatCard/Panel/StatusBadge المشتركة
- @src/components/dashboard/Charts.tsx — كل الشارتات
- @src/components/session/SessionSteps.tsx — مراحل وضع الحصة الأربعة
- @src/lib/auth.ts — نمط localStorage+subscribe المعتمد (مرجع لأي state مشترك)
- @src/lib/mock-data.ts — البيانات الوهمية (مصدر seed)
- @src/types/index.ts — تعريفات الأنواع

## المستندات
@docs/01_BRIEF.md · @docs/02_STACK.md · @docs/03_STATE.md · @docs/04_BRAND.md ·
@docs/05_IMPLEMENTED.md · @docs/06_PLAN.md · @docs/07_RULES.md · @docs/08_FINANCE.md ·
@docs/09_WORKFLOW.md
