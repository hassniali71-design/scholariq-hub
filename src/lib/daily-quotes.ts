/**
 * DESIGN_ATMOSPHERE_SPEC.md §4 — small fixed quote bank per subject, one picked
 * deterministically per day (not random-per-refresh). Real linkage to the
 * actual taught lesson (via `Lesson.extracted_text`) needs a live AI call —
 * deferred until decision #1 in TEACHER_MODULE_SPEC.md is resolved for real;
 * this is a general subject-level quote until then.
 */
const DAILY_QUOTES: Record<string, string[]> = {
  arabic: [
    "اللغة وعاء الفكر، وجمالها انعكاس لجمال المعنى",
    "من أتقن العربية أتقن مفتاح كل علم",
    "الكلمة الصادقة أبقى أثراً من أي زخرف بلاغي",
    "القراءة اليوم هي فصاحة الغد",
    "لكل نص روح — ابحث عنها قبل أن تحلّل تركيبه",
  ],
  english: [
    "Every new word is a small door to a bigger world",
    "Practice speaking even before you feel ready — fluency follows courage",
    "Grammar is the map; vocabulary is the journey",
    "Read a little every day — consistency beats intensity",
    "Mistakes are proof that you're actually trying",
  ],
  math: [
    "الرياضيات لغة الكون، وكل معادلة قصة تنتظر الحل",
    "الخطأ في الحل خطوة نحو الفهم، مش نهاية الطريق",
    "كل مسألة صعبة هي مجموعة مسائل بسيطة متراكبة",
    "التمرين اليومي أهم من الحفظ وقت الامتحان",
    "الدقة في الخطوة الأولى توفّر وقت الحل كله",
  ],
  science: [
    "كل اكتشاف علمي بدأ بسؤال بسيط: ليه؟",
    "التفاعل الكيميائي إعادة ترتيب، مش اختفاء",
    "الملاحظة الدقيقة أساس أي تجربة ناجحة",
    "العلم لا يعطي إجابات نهائية، بل أسئلة أفضل",
    "الطبيعة لا تكذب — فقط نحن نسيء قراءتها أحياناً",
  ],
  social: [
    "من لا يعرف تاريخه لا يفهم حاضره",
    "الجغرافيا تشرح لماذا حدث التاريخ حيث حدث بالضبط",
    "كل حضارة تركت أثراً، حتى لو اندثرت أسماؤها",
    "فهم المجتمع يبدأ بفهم أرضه وموارده",
    "التاريخ لا يعيد نفسه، لكنه يشبه نفسه كثيراً",
  ],
};

/** Deterministic pick — same quote all day, changes at midnight, not on refresh. */
export function getTodayQuote(themeKey: string | undefined): string | null {
  const list = themeKey ? DAILY_QUOTES[themeKey] : undefined;
  if (!list || list.length === 0) return null;
  const dayIndex = new Date().getDate() % list.length;
  return list[dayIndex] ?? null;
}
