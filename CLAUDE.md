<!-- CLAUDE.md — هذا الملف يُقرأ تلقائياً بواسطة Claude Code عند فتح المشروع. ضعه في جذر الريبو (نفس مستوى package.json). لا تحذفه ولا تدمجه مع AGENTS.md. -->
ScholarIQ Hub — سياق المشروع الكامل وخطة العمل

ملحوظة لـ Claude Code: هذا المشروع بدأ في Lovable ووصلنا فيه لمرحلة "الشكل الأساسي" (Skeleton) لكل الأدوار الستة. من دلوقتي العمل انتقل بالكامل لك (Claude Code) محلياً. اقرأ الملف ده كامل قبل أي تعديل. كل قرار معماري مكتوب هنا اتاخد بعد تحليل الكود الفعلي سطر بسطر، مش افتراضات.

1) نظرة عامة على المنتج

نظام ERP + LMS متكامل لإدارة سنتر تعليمي ("سنتر النخبة التعليمي" — بيانات تجريبية). النظام مقسّم لـ 6 أدوار (Portals) منفصلة تماماً في الصلاحيات والواجهة، لكن مفروض تشترك في نفس مصدر البيانات:

الدور	المسار الأساسي	الوظيفة الجوهرية
المالك (Owner)	/owner/*	تحليلات مالية، التزام مدرسين (SLA)، إدارة صلاحيات الدخول
الموظف (Staff)	/staff/*	بوابة حضور QR، كاشير، مخزون ملازم، تقفيل وردية
المدرس (Teacher)	/teacher/*	لوحة رئيسية + "وضع الحصة": محرك تايمر رباعي المراحل
الطالب (Student)	/student/*	لوحة أداء شخصية + لوحة شرف
ولي الأمر (Parent)	/parent/*	متابعة لحظية للابن + أرشيف واتساب
الزائر (Visitor)	/visitor/*	صفحة تسويقية عامة، بدون بيانات حساسة

الفكرة المحورية للمنتج: "وضع الحصة" (Session Mode) عند المدرس هو قلب النظام — كل حدث بيحصل جواه (حضور، تقييم واجب، درجة سؤال، إطلاق مهمة) المفروض يتغذى منه: لوحة المالك (كأرقام مجمّعة)، لوحة الموظف (كعملية تحصيل)، لوحة الطالب (كنقاط)، لوحة ولي الأمر (كإشعار واتساب)، ولوحة الشرف (كترتيب تنافسي).

2) الستاك التقني (مهم — مختلف عن الافتراضات الشائعة)
TanStack Start (ليس Next.js وليس Vite+React SPA عادي) — فريمورك SSR كامل
TanStack Router: file-based routing حسب اسم الملف (owner.index.tsx → /owner, teacher.session.tsx → /teacher/session)
React 19 + TanStack Query (مُجهّز في router.tsx لكن غير مُستخدم فعلياً بعد)
Tailwind CSS v4 (نظام توكينز @theme inline مختلف عن v3 — راجع src/styles.css)
shadcn/ui (style: new-york, prefix فارغ, alias @/* → src/*)
Vite 8 + بلجن Lovable (@lovable.dev/vite-tanstack-config) — لا تضف بلجنز يدوياً فوق البلجن ده، فيه تحذير صريح في vite.config.ts إنه هيكسر التطبيق (duplicate plugins)
Package manager: bun (bun.lock موجود، مفيش package-lock.json أو yarn.lock)
dir="rtl" وlang="ar" مضبوطين على مستوى <html> في routes/__root.tsx — الواجهة كلها RTL
أوامر التشغيل
bash
bun i
bun run dev      # أو: npm run dev
bun run build
bun run lint

⚠️ قاعدة صارمة موروثة من AGENTS.md الأصلي: npm run dev (أو bun run dev) لازم يفضل شغال بعد أي تعديل طول الوقت. لو انقطع الشغل في أي لحظة (تحقق أو حد الرسائل)، لازم المشروع يفضل في حالة قابلة للتشغيل والبناء، مش نص شغلانة.

3) حالة قاعدة البيانات الحقيقية: لا توجد — Mock كامل

فحصنا المشروع بالكامل بحثاً عن أي اتصال حقيقي (Supabase / API / env vars) — صفر نتائج. كل ما هو موجود:

src/lib/mock-data.ts: مصفوفات ثابتة في الذاكرة (students, teachers, groups, payments...) هذه هي "قاعدة البيانات" الوهمية الحالية. كل صفحة بتاخد نسخة منها في useState محلي منفصل.
src/lib/auth.ts: النظام الوحيد المتصل فعلياً بـ localStorage (حسابات + جلسات دخول). فيه نمط subscribe/emit شغال ومُثبت — ده النمط اللي هنعمم على باقي الكيانات.
الفجوة الجوهرية المكتشفة

لما البيانات بتظهر متطابقة بين تابات المالك/الموظف/المدرس/الطالب في السكرين شوتس، ده مش لأن فيه ربط حقيقي — كلهم بيقروا من نفس القيم المبدئية الثابتة في mock-data.ts. أي تفاعل (تسجيل حضور، تحصيل فلوس، رصد درجة) بيضيع فوراً بمجرد الخروج من الصفحة أو الـ refresh، ومفيش أي تأثير متبادل بين الأدوار.

ملاحظات دقة صغيرة (اعرفها قبل ما تلمس owner.*)
totalStudents = 764 في owner.index.tsx مكتوب يدوي، مش students.length (الفعلي = 6)
نفس الموضوع: "٢٢ مجموعة" في owner.students.tsx مكتوب يدوي
الشارات (Badges) في لوحة شرف الطالب صورية بالكامل، مش مشتقة من أي شرط حقيقي
تنبيهات "قرارات تحتاج اتخاذ" في برج التحكم نص ثابت (hardcoded strings)
4) خريطة الملفات الحرجة
src/config/roles.ts          ← مصدر وحيد للتنقل (Sidebar) لكل الأدوار الستة
src/components/layout/AppShell.tsx   ← القالب العام (Sidebar+Header) — تعديل هنا يأثر على الكل
src/components/dashboard/StatCard.tsx ← StatCard, Panel, StatusBadge (مشتركة عبر كل الصفحات)
src/components/dashboard/Charts.tsx   ← RevenueChart, AttendanceChart, PerformanceChart, ScoreTrendChart
src/components/session/SessionSteps.tsx  ← مكونات المراحل الأربعة (Homework/Lesson/Question/Live)
src/components/session/SessionTimer.tsx  ← التايمر البصري (يُعاد استخدامه لمرحلة السؤال 60 ثانية)
src/hooks/use-countdown.ts   ← منطق العد التنازلي (مستقل، لا يلمس الـ store)
src/lib/auth.ts              ← نظام الحسابات/الجلسات (نمط localStorage+subscribe جاهز ومُثبت)
src/lib/mock-data.ts         ← البيانات الوهمية الحالية (المصدر الذي سيُستبدل)
src/types/index.ts           ← تعريفات الأنواع = القاموس الرسمي للبيانات
src/routes/*.tsx             ← صفحة لكل مسار (18 route file)
5) خطة التأسيس (Phase 0) — لازم تخلص قبل أي فيتشر جديد

الهدف: تحويل البيانات من "مصفوفات معزولة لكل صفحة" إلى مصدر مركزي واحد بحيث أي حدث في أي دور ينعكس تلقائياً على باقي الأدوار، بدون أي تعديل بصري (Refactor بحت، صفر تغيير في الشكل/الألوان/التخطيط).

5.1 توسعة الأنواع (src/types/index.ts)

أضف student_id: UUID إلى: QuizResult, HomeworkTask, WhatsAppLog, TeacherNote, LeaderboardEntry. احذف is_me من LeaderboardEntry واجعلها محسوبة (derived) من هوية الطالب الحالي بدل علم ثابت داخل البيانات.

5.2 إنشاء src/lib/data-store.ts

طبّق نفس نمط auth.ts (قراءة/كتابة localStorage + subscribe/emit) على الكيانات: students, teachers, groups, attendanceRecords, payments, booklets, quizResults, homeworkTasks, whatsappLogs, teacherNotes, leaderboard.

أول تشغيل (seed) لازم يبذر بنفس القيم الموجودة في mock-data.ts بالظبط — صفر فرق بصري عند أول تشغيل بعد الترقية.

5.3 دوال Mutation مركزية (العقد اللي Claude Code هينفذه بالظبط)
ts
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

كل دالة: تعدّل المصدر المركزي في localStorage ثم تستدعي emit() عشان أي صفحة مفتوحة تحدّث نفسها فوراً (نفس آلية auth.ts بالظبط).

5.4 ربط الصفحات الـ 18 كلها

كل route تحت owner.*, staff.*, teacher.*, student.*, parent.*, visitor.* يقرأ ويكتب من data-store.ts فقط — يتوقف الاستيراد المباشر من mock-data.ts في الصفحات (يفضل mock-data.ts كمصدر seed فقط داخل data-store.ts).

5.5 تصحيح الأرقام الوهمية

owner.index.tsx وowner.students.tsx: استبدال 764 و22 وأمثالها بقيم مشتقة فعلياً (students.length, groups.length).

5.6 ربط "وضع الحصة" فعلياً بالمصدر المركزي

teacher.session.tsx: كل تقييم واجب / نقطة سؤال / إطلاق مهام يتسجل مباشرة في data-store.ts (مش useState محلي بيضيع). النتيجة تظهر فوراً في لوحة الطالب/ولي الأمر/المالك عند رجوعهم للصفحة، وتفضل محفوظة بعد تسجيل خروج ودخول.

قاعدة عامة لكل Phase 0

حافظ على نمط center_id في كل كيان (تحضير مسبق لعزل بيانات المستأجرين RLS عند ربط Supabase مستقبلاً). اكتب الكود بحيث الانتقال لاحقاً من localStorage إلى استعلامات Supabase يكون استبدال دالة داخلية بسيط (drop-in)، مش إعادة بناء لكل الصفحات.

6) منهجية العمل بعد Phase 0 — الترتيب ولماذا

المبدأ: الأطراف المنتجة للبيانات قبل الأطراف المستهلكة لها، عشان محدش يرجع يعدّل مرتين.

المدرس (Teacher) — منتج أساسي (حضور، درجات، تقييم، إطلاق مهام)
الموظف (Staff) — منتج ثانٍ (فلوس، حضور بوابة الدخول، مخزون)
المالك (Owner) — مستهلك بحت الآن (تجميع وعرض فقط، بيانات المصدر خلصت)
الطالب + ولي الأمر معاً — نسخة طبق الأصل من بعض بصلاحية مختلفة، توفير وقت
الزائر — آخر حاجة، أبسط طرف وأقل اعتماد

كل دور هيتقسّم لتعديلات صغيرة متتالية (نفس منطق "3 تعديلات × 5 طلبات" اللي كان متبع في Lovable)، لكن بما إننا دلوقتي في Claude Code مباشرة: كل تعديل = مهمة هندسية محددة واحدة Claude Code ينفذها، يشغّل bun run dev للتأكد، يعمل commit بوصف واضح، وبعدين ننتقل للي بعده. مفيش داعي لصيغة "برومت" — الوصف المباشر للمهمة كافي.

مثال تقسيم "تعديل 1" في المدرس (بعد Phase 0):

منطق وضع الحصة الأساسي (تثبيت الـ 4 مراحل بعد الربط بالـ store)
فيتشرز ذكية (رفع درس PDF → توليد شرح وأسئلة تلقائي بالـ AI) — مؤجّل لحد ما Phase 0 يخلص
الصفحة الرئيسية للمدرس (جدول مجموعات حقيقي، متابعة طلاب متعثرين من الداتا الحقيقية)
7) قواعد عمل عامة لـ Claude Code في هذا المشروع
لا تغيّر أي تصميم بصري (ألوان، خطوط، تخطيط) إلا لو طُلب صراحة — هذا القسم كله Refactor أو إضافة وظيفية فوق شكل ثابت بالفعل ومعتمد.
حافظ على RTL/العربي في كل مكان — dir="rtl" وlang="ar" أساسيان في هذا المنتج.
لا تكسر bun run dev بعد أي تعديل — تأكد بتشغيله قبل ما تعتبر المهمة خلصت.
Commit صغير ومتكرر بوصف واضح بالعربي أو الإنجليزي (مش commit ضخم يجمع كذا حاجة).
لا تضف مكتبات جديدة بدون داعي واضح — الستاك الحالي (recharts, lucide-react, shadcn/ui) كافي لمعظم الاحتياجات المتوقعة.
عند الشك في نمط تصميم (زي إزاي تتعامل مع state مشترك)، ارجع لنمط auth.ts الموجود بالفعل كمرجع — هو النمط المُعتمد في هذا المشروع، لا تخترع نمط تاني بجانبه.
ملف AGENTS.md الأصلي فيه ملاحظة خاصة بمزامنة Lovable (git history) — Lovable لم يعد مصدر التعديل الأساسي، لكن اتركه كما هو احتياطياً ما لم يُطلب حذفه.
8) الخطوة التالية المباشرة

تنفيذ Phase 0 (القسم 5 كامل) بالترتيب المكتوب فيه (5.1 → 5.6)، مع تشغيل bun run dev والتأكد من عدم وجود أي فرق بصري بعد كل خطوة فرعية، ثم commit، ثم الانتقال للفرعية التالية. بعد Phase 0، الانتظار لتعليمات تفصيلية لتعديل 1 في دور المدرس.