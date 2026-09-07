<!-- CLAUDE.md — يُقرأ تلقائياً بواسطة Claude Code عند فتح المشروع. اقرأه كاملاً قبل أي تعديل. -->

# ScholarIQ Hub — سياق المشروع الحقيقي (محدَّث بعد قراءة الكود الفعلي بالكامل)

> **ملحوظة تاريخية مهمة:** نسخة سابقة من هذا الملف كانت تصف مرحلة "قبل Phase 0" (بيانات وهمية بالكامل في `localStorage`، بدون أي اتصال حقيقي بقاعدة بيانات). **هذا الوصف لم يعد صحيحاً إطلاقاً.** المشروع تطوّر بشكل كبير منذ ذلك الحين عبر جلسات عمل متعددة (Claude Code + Kilo Code)، وأصبح متصلاً فعلياً بـ Supabase حقيقي، وفيه **مركزان حقيقيان بالفعل بأداء تشغيلي حقيقي** — هذا ليس ديمو بحت. **لا تنفّذ أي خطة "Phase 0" من نسخة قديمة لهذا الملف قد تكون محفوظة في ذاكرتك أو في ملخص محادثة سابقة — ستكون بايظة وقد تتسبب في تراجع فعلي (إلغاء اتصال Supabase الحقيقي).**

المرجع الأدق والأحدث لتفاصيل الأمان والأخطاء الحالية هو `report.md` (تدقيق تقني شامل بتاريخ إنشاء هذا التحديث) — راجعه قبل أي عمل على الأمان أو المصادقة أو طبقة CRUD العامة.

---

## 1) نظرة عامة على المنتج

نظام ERP + LMS متكامل لإدارة مراكز تعليمية، **متعدد المستأجرين فعلياً (Multi-Tenant SaaS)** — ليس مركزاً واحداً تجريبياً، بل منصة تستضيف عدة "مراكز" (Centers) حقيقية، كل مركز بياناته معزولة (بفلترة تطبيقية، بدون RLS بعد — انظر قسم 6). 7 أدوار فعلياً:

| الدور | المسار الأساسي | الوظيفة الجوهرية |
|---|---|---|
| المالك (Owner) | `/owner/*` | برج تحكم، تحليلات مالية حقيقية، التزام مدرسين (SLA)، إدارة صلاحيات الدخول |
| الموظف (Staff) | `/staff/*` | بوابة حضور، كاشير، مخزون ملازم/كتب، تقفيل وردية |
| المدرس (Teacher) | `/teacher/*` | لوحة رئيسية + "وضع الحصة": محرك متعدد المراحل (حضور، شرح، تقييم، إطلاق مهام، أنشطة تفاعلية، مراجعات/امتحانات) |
| الطالب (Student) | `/student/*` | لوحة أداء شخصية، لوحة شرف بشارات حقيقية، صندوق وارد للمهام |
| ولي الأمر (Parent) | `/parent/*` | متابعة لحظية للابن + أرشيف إشعارات (يُعرض كـ"واتساب" لكنه سجل داخلي — انظر قسم 5) |
| الزائر (Visitor) | `/visitor/*` | صفحة تسويقية عامة، بدون بيانات حساسة |
| **مشغّل المنصة (Platform Admin)** | `/`, `/platform/*` | **دور سابع فعلي** — ليس قيمة `role` منفصلة، بل حساب Owner خاص بـ `center_id = "platform"` (ثابت `PLATFORM_CENTER_ID`). يدير كل المراكز الحقيقية: إنشاء مركز جديد + حساب Owner له (`/platform/new-center`)، تفعيل/إيقاف/تمديد اشتراك (`/platform/clients`)، رسائل تُبَث عبر كل المراكز لمدرسي مادة معيّنة (`/platform/teacher-notes`) |

**"وضع الحصة" (Session Mode)** عند المدرس يبقى قلب المنتج — أي حدث بداخله (حضور، تقييم واجب، درجة سؤال، إطلاق مهمة) يتغذى منه المالك (كأرقام مجمّعة حقيقية عبر `owner-metrics.ts`)، الطالب (كنقاط/شارات)، ولي الأمر (كإشعار)، ولوحة الشرف (كترتيب).

---

## 2) الستاك التقني

- **TanStack Start** (SSR كامل، ليس Next.js) + **TanStack Router** (file-based: `owner.index.tsx` → `/owner`, `teacher.session.$groupId.tsx` → `/teacher/session/:groupId`).
- **React 19** + **TanStack Query** (مُجهّز، غير مُستخدم فعلياً بعد حسب آخر فحص).
- **Tailwind CSS v4** (`@theme inline` — راجع `src/styles.css`) + **shadcn/ui** (style: new-york, alias `@/*` → `src/*`).
- **Supabase** (`@supabase/supabase-js@2.112.3`) — **عميل خادم واحد فقط بمفتاح Service Role** (`src/lib/supabase-server.ts`, `getSupabaseAdmin()`). لا يوجد أي استخدام لـ anon key أو اتصال من المتصفح مباشرة؛ كل استعلام يمرّ عبر TanStack Start server functions (`createServerFn`).
- **Nitro** + إعداد **Cloudflare Workers** للنشر (`DEPLOYMENT_SPEC.md`, `scripts/fix-cloudflare-chunks.ts` يُشغَّل تلقائياً بعد كل `build` عبر `postbuild`).
- **Bun** كمدير حزم (`bun.lock`) — لكن السكريبتات الفعلية تستدعي `vite` مباشرة (`vite dev`/`vite build`)، بلا تعارض.
- `xlsx` (تصدير Excel حقيقي)، `recharts`، `zod`، `react-hook-form`، `sonner`، `@fontsource/tajawal`.
- **لا يوجد أي SDK ذكاء اصطناعي** (لا `@anthropic-ai/sdk` ولا غيره) — ميزة "توليد الدرس بالـ AI" مازالت Stub بالكامل (قسم 4).
- `dir="rtl"` و`lang="ar"` على مستوى `<html>` في `src/routes/__root.tsx` — الواجهة كلها RTL. **لا تغيّر هذا أبداً.**
- `tsconfig.json`: `strict: true` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`، لكن `noUnusedLocals`/`noUnusedParameters` **معطَّلين عمداً** (وكذلك في ESLint) — هذا سبب وجود متغيرات ميتة معلَّقة بـ`void x;` بدل حذفها في أماكن متفرقة.

### أوامر التشغيل
```bash
bun i
bun run dev      # أو: npm run dev
bun run build
bun run lint     # bunx eslint . --fix لإصلاح مشاكل Prettier تلقائياً
bunx tsc --noEmit
```

⚠️ **قاعدة صارمة:** `bun run dev`/`build`/`lint` لازم تفضل نظيفة بعد أي تعديل. تأكد بتشغيلهم الثلاثة قبل ما تعتبر أي مهمة خلصت.

---

## 3) طبقة البيانات — Hybrid حقيقي فوق Supabase (مش localStorage Mock)

`src/lib/auth.ts` و`src/lib/data-store.ts` كلاهما فيهم علم واحد:

```ts
export const USE_SUPABASE = true;
```

**النمط في كل دالة تصدير:** فرع `if (USE_SUPABASE) { ...server function حقيقية... } else { ...كود localStorage قديم... }`. مسار الـ`localStorage` القديم **موجود لكنه ميت** حالياً — تُرك عمداً كـ"مفتاح رجوع سريع" (fast revert) موثّق في تعليقات الكود، وليس دليلاً على نقص في الترحيل. **لا تحذفه بدون سبب قوي، ولا تفترض أنه هو المصدر الفعلي للبيانات.**

### كيف تتدفق البيانات فعلياً
1. عند التحميل، `bootstrapFromSupabase()` (`data-store.ts`) يستدعي `fetchCenterData()` (`data-functions.server.ts`) التي تحلّ `center_id` الحقيقي للمستخدم من `identifier` **في الخادم** (`resolveCenterId` في `supabase-server.ts`)، وتجيب كل جداول هذا المركز فقط.
2. كل دالة Mutation (~90 دالة في `data-store.ts`) تتبع نمط **Optimistic UI**: تعدّل الـ state المحلي فوراً للاستجابة الفورية، ثم ترسل مزامنة خلفية (`syncInsert`/`syncUpdate`/`syncUpsert`/`syncDeleteIds`/`syncDeleteAll`) لدوال الخادم العامة `insertRow`/`updateRow`/`upsertRow`/`deleteRows` (`data-functions.server.ts`). فشل المزامنة الخلفية يظهر Toast لكن **لا يرجّع (rollback) التحديث المحلي** — لا يوجد حل تعارض offline حتى الآن.
3. `data-functions.server.ts` طبقة CRUD عامة واحدة فوق **44 جدولاً مسموحاً** (`TABLES` allowlist)، بدل دالة خادم منفصلة لكل جدول. فيها `withColumnFallback`: لو Postgres رجّع خطأ "عمود غير موجود"، تعيد المحاولة بدون هذا العمود مع تحذير في اللوج — تسامح مقصود مع تأخر تطبيق migration معيّنة، **وليس حلاً بديلاً عن تطبيقها**.
4. `src/lib/mock-data.ts` (460 سطر) **لم يعد مصدر البيانات الحي** — يُستخدم فقط: (أ) بيانات seed لمركز جديد يُنشأ عبر `/platform/new-center` (مواد/صفوف/ربط مادة-صف)، (ب) placeholder الـ SSR قبل الـ hydration، (ج) fallback لو `USE_SUPABASE = false`.
5. حماية من "وميض بيانات مركز سابق": `resetCacheToPlaceholder()` يمسح الكاش فوراً عند تسجيل الخروج أو تغيّر الـ identifier، لتفادي عرض بيانات مركز آخر لجزء من الثانية عند تبديل الحسابات.

### الجلسة (Session)
`Session { role, full_name, identifier, isPlatformAdmin? }` تُخزَّن في `localStorage` — **موثَّق صراحة كحالة UI محلية فقط، ليست حداً أمنياً**. الحد الأمني الحقيقي المفترض هو `resolveCenterId` في الخادم — لكن انظر قسم 6 لثغرات حقيقية في هذا النموذج.

---

## 4) ميزة الذكاء الاصطناعي — Stub متعمَّد وليس تكاملاً حقيقياً

`src/lib/ai/lesson-pipeline.ts` (169 سطر): الشكل الهندسي حقيقي (hash → فحص كاش → استخراج → توليد → تخزين، بحالة `ai_status`: processing/ready/failed، مع إعادة محاولة). **لكن `stubExtractText`/`stubGenerateContent` نصوص Placeholder ثابتة مبنية على اسم الملف/المادة — لا استخراج PDF حقيقي ولا استدعاء نموذج فعلي.** لا يوجد أي SDK ذكاء اصطناعي في `package.json`. عند ربط مفتاح API حقيقي مستقبلاً، فقط هاتين الدالتين تحتاجان تغيير — الهيكل حولهما جاهز.

---

## 5) ميزات أخرى تستحق الذكر

- **"واتساب" ليس واتساب فعلي.** `whatsapp_logs` جدول حقيقي، لكن الإرسال مجرد إنشاء سجل بـ`delivered: true` مكتوب يدوياً وقت الكتابة — لا يوجد أي استدعاء لـ Twilio/Meta WhatsApp Business API. `parent.messages.tsx` يعرضه كـ"أرشيف واتساب" لكنه فعلياً سجل إشعارات داخلي منسّق ليبدو كذلك.
- **تصدير Excel حقيقي** عبر `xlsx` (`src/lib/export-excel.ts`) — يصدّر بيانات المركز كاملة، مستخدَم من المالك ومن أدوات المنصة.
- **توليد المعرّفات (`identifier-gen.ts`) قرار أمني واعٍ ومقصود مؤقتاً:** الأكواد الآن مشتقة من الاسم (أول حرفين من الاسم الأول + أول حرفين من اسم الأب) بدل أرقام عشوائية بحتة — أسهل تخميناً، وموثَّق صراحة كتنازل مقبول لمرحلة التجربة فقط، وليس نسياناً.
- **تخزين ملفات Base64 بدل Supabase Storage**: `teacher_launches.file_data` و`students.avatar_data` يخزّنان الملفات/الصور كنص Base64 مباشرة في العمود، بلا حد أقصى للحجم على مستوى قاعدة البيانات — قرار مؤقت موثَّق، قابل للنقل لـ Storage لاحقاً بدون تغيير الـ Schema العام.
- **ألوان/هوية المركز**: `src/lib/tenant-colors.ts` يحدّد لوحة ألوان ثابتة (`TENANT_ACCENT_COLORS`) يختار منها كل مركز لونه (`centers.accent_color`)، يتحكم في تلوين الشريط الجانبي لكل عميل.
- **دخول لكل مركز برابط مخصص**: `login.$slug.tsx` — رابط مخصص لكل مركز (`/login/futures-academy` مثلاً) يُظهر اسم ولون المركز قبل تسجيل الدخول (استعلام عام غير حساس، `fetchCenterBySlug` يرجّع الاسم واللون فقط).

---

## 6) الحالة الأمنية — **مهم جداً قبل أي عمل مستقبلي**

النظام يخدم **مركزين حقيقيين ببيانات تشغيلية فعلية الآن**، وليس بيئة تجريبية معزولة. `report.md` (تدقيق كامل بالمسار ورقم السطر لكل نتيجة) يوثّق ثغرات حقيقية غير مُصلَحة بعد. **راجعه بالكامل قبل لمس `auth.ts`, `auth-functions.server.ts`, `data-functions.server.ts`, أو `supabase-server.ts`.** أهم النقاط:

- **لا توجد سياسات RLS إطلاقاً** على أي جدول (قرار موثَّق صراحة كدين تقني مؤجَّل في `SUPABASE_MIGRATION_SPEC.md`، أصبح أخطر بعد وجود عملاء حقيقيين). العزل الوحيد هو فلترة `center_id` يدوياً في كل استعلام.
- **دوال CRUD العامة (`insertRow`/`updateRow`/`upsertRow`/`deleteRows` في `data-functions.server.ts`) لا تتحقق من الدور (role) إطلاقاً** — أي حساب مسجَّل دخوله (حتى طالب) يقدر يستدعيها مباشرة (عبر HTTP، مش بس من الواجهة) ويعدّل بيانات أي جدول في مركزه، بما فيه رواتب ودرجات طلاب آخرين. طبقة `/platform/*` وحدها مطبِّقة تحققاً صحيحاً (`assertPlatformCaller`).
- **`deleteRows` بدون تمرير `ids` تمسح الجدول بالكامل** لهذا المركز — احتمال فعلي لفقدان بيانات كارثي.
- **كلمات السر نص صريح (plain text)** بلا أي تشفير، وتُعرض نص صريح في `owner.access.tsx`. حساب مالك تجريبي معروض بالكامل على صفحة الدخول العامة.
- **`resolveCurrentStudent` يرجّع طالباً عشوائياً بدل `null`** عند جلسة غير صالحة (نفس فئة الخطأ اتصلحت للمدرس، نُسيت هنا) — تسريب بيانات محتمل بين عائلات.
- **بنك إجابات الاختبارات (`correct_index`) يتخزّن ويُعرض حرفياً في بوابة الطالب** — أي طالب يقدر يشوف الإجابة الصحيحة قبل الحل.
- **سكريبتات `scripts/reset-clean-slate.ts` و`reset-and-seed-real.ts` تمسح بيانات مركزين حقيقيين فعلاً بدون أي تأكيد أو نسخة احتياطية** — لا تُشغَّل هذه السكريبتات أبداً بدون التأكد المطلق من الهدف، ويُفضَّل إضافة حماية `--confirm`/`--dry-run` قبل أي استخدام قادم.

هذه ليست كلها "أخطاء" بمعنى النسيان — RLS وتشفير كلمات السر موثَّقان صراحة في `SUPABASE_MIGRATION_SPEC.md §0/§7` كديون تقنية مؤجَّلة بقرار واعٍ لمرحلة الإطلاق المبكر. **لكن أي عمل مستقبلي على المصادقة/الصلاحيات لازم يبدأ من قراءة `report.md` قسم 6 كاملاً، مش من افتراضات.** أي تغيير في نموذج المصادقة (تشفير كلمات سر، RLS، جلسات موقّعة) يمس حسابات حقيقية موجودة فعلاً — يحتاج تخطيط ترحيل (migration) واضح، مش استبدالاً مباشراً.

---

## 7) قاعدة البيانات — بنية الـ Migrations (نقطة تشغيلية حرجة)

- `supabase/migrations/` فيه 24 ملفاً (0001→0030 بفجوات عند 0009-0011 و0027).
- **0009, 0010, 0011 مش ناقصين — موجودين فقط في `db/`** (`db/0009_owner_control_tower.sql` إلخ) لأن منصة الاستضافة قفلت مجلد `supabase/migrations/` وقتها. **هذا يعني: تطبيق `supabase/migrations/` وحده على قاعدة بيانات جديدة (بيئة staging جديدة مثلاً) سيفشل**، لأن `0013_notifications_extension.sql` يفترض وجود جدول `notifications` الذي يُنشأ فقط في `db/0009`. لازم تطبيق ملفات `db/0009→0011` يدوياً (عبر Supabase SQL Editor) **قبل** باقي الـ migrations المرقّمة، وهذا غير موثَّق حالياً في `DEPLOYMENT_SPEC.md` — يستحق الإضافة هناك.
- `db/handoff_*.sql` نسخ مطابقة لملفات مرقّمة موجودة أصلاً في `supabase/migrations/` — نفس آلية "شغّلها يدوياً لو المجلد مقفول"، مش تغييرات مختلفة.
- **0027 فجوة حقيقية غير موثَّقة** — لا يوجد ملف بهذا الرقم في أي مكان، ولا تفسير في أي Spec. لو احتجت رقم migration جديد، ابدأ من 0031، ولا تحاول ملء 0027 بدون فهم سبب غيابه أولاً.

---

## 8) خريطة الملفات الحرجة

```
src/config/roles.ts                     ← مصدر التنقل (Sidebar) لكل الأدوار
src/components/layout/AppShell.tsx      ← القالب العام (Sidebar+Header) — يؤثر على كل الصفحات
src/components/dashboard/StatCard.tsx   ← StatCard, Panel, StatusBadge المشتركة
src/components/session/                 ← مكوّنات "وضع الحصة" (SessionSteps, SessionFreeTimer, ActivityRunner...)
src/hooks/use-countdown.ts              ← منطق عدّ تنازلي (⚠️ 3 تطبيقات مستقلة منفصلة موجودة فعلياً — انظر report.md #14)
src/lib/auth.ts                         ← حسابات/جلسات (USE_SUPABASE flag + fallback localStorage ميت)
src/lib/auth-functions.server.ts        ← دوال خادم المصادقة الحقيقية (signIn, createAccount, createCenter...)
src/lib/data-store.ts                   ← 4400+ سطر: كل منطق الأعمال + التخزين المؤقت + المزامنة مع Supabase
src/lib/data-functions.server.ts        ← طبقة CRUD عامة (insertRow/updateRow/upsertRow/deleteRows) فوق 44 جدولاً
src/lib/platform-functions.server.ts    ← دوال خادم طبقة المنصة (assertPlatformCaller مطبَّق صح هنا)
src/lib/supabase-server.ts              ← عميل Supabase الوحيد (service role) + resolveCenterId
src/lib/owner-metrics.ts                ← كل حسابات KPI/تنبيهات المالك (مشتقة حقيقياً، لا نصوص ثابتة)
src/lib/mock-data.ts                    ← seed لمركز جديد فقط — ليس مصدر بيانات حي
src/lib/identifier-gen.ts               ← توليد أكواد الدخول (قرار أمني مؤقت موثَّق)
src/lib/ai/lesson-pipeline.ts           ← Stub توليد الدرس بالـ AI (قسم 4)
src/types/index.ts                      ← تعريفات الأنواع = القاموس الرسمي للبيانات
src/routes/*.tsx                        ← 36 ملف route (owner:8, staff:5, teacher:6, student:6, parent:2, visitor:1, platform:4, login/index:4)
supabase/migrations/ + db/              ← Schema (انظر قسم 7 — لازم تطبيق db/0009-0011 يدوياً)
```

**مستندات Spec كاملة موجودة في جذر الريبو ويجب الرجوع لها قبل أي عمل في نطاقها:**
`SUPABASE_MIGRATION_SPEC.md`, `PLATFORM_CLIENT_MANAGEMENT_SPEC.md`, `TEACHER_MODULE_SPEC.md`, `CURRICULUM_ENGINE_SPEC.md`, `DESIGN_ATMOSPHERE_SPEC.md`, `DEPLOYMENT_SPEC.md`, `report.md` (التدقيق الأمني/الهندسي الكامل).

---

## 9) قواعد عمل عامة

1. لا تغيّر أي تصميم بصري (ألوان، خطوط، تخطيط) إلا لو طُلب صراحة.
2. حافظ على RTL/العربي في كل مكان — `dir="rtl"` و`lang="ar"` أساسيان.
3. `bun run dev`/`build`/`lint`/`tsc --noEmit` لازم تفضل نظيفة بعد أي تعديل.
4. Commit صغير ومتكرر بوصف واضح (مش commit ضخم يجمع كذا حاجة غير مترابطة).
5. لا تضف مكتبات جديدة بدون داعي واضح.
6. عند الشك في نمط تعامل مع البيانات، ارجع لنمط `data-store.ts`/`auth.ts` الموجود (Optimistic update + مزامنة خلفية + `USE_SUPABASE` flag) — لا تخترع نمط تخزين تاني بجانبه.
7. **لا تُشغّل `scripts/reset-clean-slate.ts` أو `scripts/reset-and-seed-real.ts` أبداً** إلا بتأكيد صريح ومباشر من المستخدم لهذا الاستخدام تحديداً — يمسحان بيانات مراكز حقيقية بلا نسخة احتياطية.
8. أي تغيير في نموذج المصادقة/الصلاحيات (قسم 6) يحتاج تأكيداً من المستخدم قبل التنفيذ — يمس حسابات وبيانات حقيقية حية، وليس قراراً هندسياً بحتاً بلا أثر خارجي.
9. `AGENTS.md` فيه فقط تحذير مزامنة Git الخاص بـ Lovable — لا تعليمات هندسية إضافية هناك.

---

## 10) الأولويات الموصى بها للعمل القادم (من `report.md` §10، بالترتيب)

**فوري (أمان):** تعطيل/حماية سكريبتات التصفير المباشرة · إخفاء بيانات المالك التجريبي من صفحة الدخول العامة · إخفاء عرض كلمات السر في `owner.access.tsx` · إضافة تحقق دور حقيقي في `data-functions.server.ts`/`auth-functions.server.ts` · إصلاح `resolveCurrentStudent` (يرجّع `null` بدل طالب عشوائي) · منع تسريب `correct_index` للطالب.

**قريب المدى:** تشفير كلمات السر (bcrypt/argon2) · توحيد الـ migrations أو توثيق خطوات `db/*.sql` بوضوح في `DEPLOYMENT_SPEC.md` · جلسة موقّعة/منتهية الصلاحية بدل identifier خام · إصلاحات أخطاء متفرقة موثَّقة بالتفصيل في `report.md` §7 (كاشير، وردية، ملاحظة مدرّس احتياطية...).

**متوسط المدى:** Pagination على `fetchAllTablesForCenter` · تفعيل RLS تدريجياً · توحيد منطق العدّاد التنازلي في هوك واحد · اختبارات آلية أساسية (المشروع حالياً بصفر تغطية اختبارات).

لا تبدأ أي عمل من هذه القائمة بدون توجيه صريح من المستخدم حول الأولوية — القائمة هنا للمرجعية، مش خطة تنفيذ تلقائية.
