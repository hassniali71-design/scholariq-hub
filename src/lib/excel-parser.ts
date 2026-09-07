import type { QuizQuestion } from "@/types";

/**
 * Migration 0023 / خطة C (C1): قراءة شيت Excel (.xlsx) وتحويله لمجموعة
 * أسئلة QuizQuestion. يُستخدم في النشاط التفاعلي.
 *
 * SheetJS (`xlsx`) ثقيل (~717KB) — يُستورَد ديناميكياً داخل الدالة
 * فقط، ولا يُحمَّل في الـ bundle الأساسي.
 *
 * الأعمدة المتوقعة (بالترتيب، Header في الصف الأول):
 *   A: السؤال (نص)
 *   B: الاختيار 1
 *   C: الاختيار 2
 *   D: الاختيار 3
 *   E: الاختيار 4 (اختياري — 3 اختيارات تكفي لاختيار 3)
 *   F: رقم الإجابة الصحيحة (1..4) — أو نص "صح"/"خطأ" لأسئلة true/false
 *
 * أو للنوع true_false:
 *   A: السؤال · B: الإجابة (صح/خطأ)
 *
 * يُكتشف النوع من الأعمدة الموجودة.
 */

export interface ParsedQuestion {
  text: string;
  options: string[];
  correct_index: number;
  kind: "mcq" | "true_false";
}

export interface ParseResult {
  questions: ParsedQuestion[];
  warnings: string[];
}

export async function parseQuestionsFromXlsx(file: File): Promise<ParseResult> {
  // dynamic import — SheetJS 717KB لا يُحمَّل في الـ bundle الأساسي
  const xlsx = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = xlsx.read(buffer, { type: "array" });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]!];
  if (!firstSheet) {
    return { questions: [], warnings: ["الملف فارغ — لا توجد أوراق عمل."] };
  }
  const rows = xlsx.utils.sheet_to_json<(string | number)[]>(firstSheet, {
    header: 1,
    blankrows: false,
    defval: "",
  });

  const warnings: string[] = [];
  const questions: ParsedQuestion[] = [];

  // تخطّي الـ header (إن وُجد نص في الصف الأول لا يبدو كسؤال).
  const dataRows = rows.slice(looksLikeHeader(rows[0] ?? []) ? 1 : 0);

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i] ?? [];
    const [a, b, c, d, e, f] = row;
    const text = String(a ?? "").trim();
    if (!text) continue;

    // true_false detection: عمودين فقط (سؤال + صح/خطأ)
    if ((row.length <= 2 || (!c && !d && !e)) && b !== undefined && b !== "") {
      const answerText = String(b ?? "").trim();
      const isCorrect = answerText === "صح" || answerText === "true" || answerText === "1";
      if (
        answerText !== "صح" &&
        answerText !== "خطأ" &&
        answerText !== "true" &&
        answerText !== "false" &&
        answerText !== "1" &&
        answerText !== "0"
      ) {
        warnings.push(`صف ${i + 2}: إجابة غير مفهومة (${answerText}) — تم تجاهلها.`);
        continue;
      }
      questions.push({
        kind: "true_false",
        text,
        options: ["صح", "خطأ"],
        correct_index: isCorrect ? 0 : 1,
      });
      continue;
    }

    // mcq
    const options = [String(b ?? ""), String(c ?? ""), String(d ?? ""), String(e ?? "")]
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (options.length < 2) {
      warnings.push(`صف ${i + 2}: عدد اختيارات غير كافٍ.`);
      continue;
    }
    const correctRaw = Number(f);
    let correctIndex =
      Number.isFinite(correctRaw) && correctRaw >= 1 && correctRaw <= options.length
        ? correctRaw - 1
        : -1;
    if (correctIndex === -1) {
      // محاولة تفسير نص الإجابة
      const ansText = String(f ?? "").trim();
      const idx = options.findIndex((o) => o === ansText);
      correctIndex = idx;
    }
    if (correctIndex === -1) {
      warnings.push(`صف ${i + 2}: لم نتمكن من تحديد الإجابة الصحيحة.`);
      continue;
    }
    questions.push({ kind: "mcq", text, options, correct_index: correctIndex });
  }

  return { questions, warnings };
}

function looksLikeHeader(row: (string | number)[]): boolean {
  if (row.length === 0) return false;
  const first = String(row[0] ?? "").trim();
  return /^(سؤال|السؤال|Question|Q\.|#|رقم|م)/i.test(first);
}

export function toQuizQuestion(
  parsed: ParsedQuestion,
  lessonId: string | null,
  source: QuizQuestion["source"] = "manual",
): QuizQuestion {
  return {
    id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    lesson_id: lessonId,
    source,
    kind: parsed.kind,
    text: parsed.text,
    options: parsed.options,
    correct_index: parsed.correct_index,
  };
}
