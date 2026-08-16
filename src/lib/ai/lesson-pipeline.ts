import {
  completeLessonGeneration,
  createLesson,
  findLessonByHash,
  getData,
  markLessonFailed,
  retryLessonGeneration as flipLessonToProcessing,
  setLessonExtractedText,
} from "@/lib/data-store";
import type { LessonSlide, QuizQuestion, SuggestedActivity } from "@/types";

/**
 * PDF → AI pipeline orchestration (TEACHER_MODULE_SPEC.md §7-د, §10).
 *
 * STUB implementation — spec §15 decision #1: no Anthropic API key wired up
 * yet, so `stubExtractText`/`stubGenerateContent` are deterministic
 * placeholders, not real PDF parsing or a real model call. The pipeline
 * *shape* (hash → cache check → extract → generate → store, with a durable
 * `processing`/`ready`/`failed` state machine) is real and matches what a
 * live integration will slot into — only those two functions need to change
 * when a real API key is available; nothing else in this file does.
 */

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export interface RunLessonPipelineInput {
  file: File;
  contentHash: string;
  groupId: string;
  subjectId: string;
  teacherId: string;
  subjectName: string;
  /** §13-ب: explicit curriculum slot chosen by the teacher, or null to upload unlinked. */
  curriculumLessonId: string | null;
}

export interface LessonPipelineResult {
  lessonId: string;
  reusedFromCache: boolean;
}

export async function runLessonPipeline(
  input: RunLessonPipelineInput,
): Promise<LessonPipelineResult> {
  const cached = findLessonByHash(getData(), input.contentHash);
  if (cached && cached.ai_status === "ready") {
    return { lessonId: cached.id, reusedFromCache: true };
  }

  const lessonId = createLesson(
    input.groupId,
    input.subjectId,
    input.teacherId,
    input.file.name,
    input.contentHash,
    input.curriculumLessonId,
  );

  await generateInto(lessonId, input.file.name, input.subjectName);
  return { lessonId, reusedFromCache: false };
}

/** "إعادة المحاولة" — reuses the existing Lesson row, no re-upload needed. */
export async function retryLessonPipeline(lessonId: string, subjectName: string) {
  flipLessonToProcessing(lessonId);
  const lesson = getData().lessons.find((l) => l.id === lessonId);
  await generateInto(lessonId, lesson?.source_file_name ?? "الدرس", subjectName);
}

async function generateInto(lessonId: string, fileName: string, subjectName: string) {
  try {
    await delay(400);
    setLessonExtractedText(lessonId, stubExtractText(fileName));

    await delay(800); // simulates real model latency
    const { slides, questions, activity } = stubGenerateContent(fileName, subjectName);
    completeLessonGeneration(lessonId, slides, questions, activity);
  } catch (err) {
    markLessonFailed(lessonId, err instanceof Error ? err.message : "فشل غير متوقع أثناء المعالجة");
  }
}

/** Placeholder for real PDF text extraction (a parsing library, not AI — §10). */
function stubExtractText(fileName: string): string {
  return `[نص تجريبي — لا يوجد استخراج PDF حقيقي بعد. اسم الملف: "${fileName}"]`;
}

/** Placeholder for the real AI Server Function call (§10) — deterministic, not random. */
function stubGenerateContent(
  fileName: string,
  subjectName: string,
): {
  slides: Array<Omit<LessonSlide, "id" | "lesson_id">>;
  questions: Array<Omit<QuizQuestion, "id" | "lesson_id" | "source">>;
  activity: Omit<SuggestedActivity, "id" | "lesson_id">;
} {
  const title = fileName.replace(/\.pdf$/i, "");
  const slides: Array<Omit<LessonSlide, "id" | "lesson_id">> = [
    {
      index: 1,
      title: `${title} — نظرة عامة`,
      bullets: [
        `أهداف حصة ${subjectName} اليوم`,
        "المفاهيم الأساسية المطلوب تغطيتها",
        "الأسئلة المتوقعة من الطلاب",
      ],
    },
    {
      index: 2,
      title: "الشرح التفصيلي",
      bullets: ["النقطة الأولى من الدرس", "مثال محلول على السبورة", "خطأ شائع يجب التنبيه له"],
    },
    {
      index: 3,
      title: "ملخص وتطبيقات",
      bullets: [
        "خريطة ذهنية سريعة للدرس",
        "أسئلة نموذجية من امتحانات سابقة",
        "الواجب المنزلي المطلوب",
      ],
    },
  ];
  const questions: Array<Omit<QuizQuestion, "id" | "lesson_id" | "source">> = [
    {
      kind: "mcq",
      text: `أي مما يلي يرتبط مباشرة بموضوع "${title}"؟`,
      options: ["المفهوم الأول", "المفهوم الثاني", "المفهوم الثالث", "لا شيء مما سبق"],
      correct_index: 0,
    },
    {
      kind: "true_false",
      text: `الدرس "${title}" يغطي أساسيات ${subjectName} في هذا الباب.`,
      options: ["صح", "خطأ"],
      correct_index: 0,
    },
    {
      kind: "ordering",
      text: `رتّب خطوات فهم درس "${title}" بالترتيب المنطقي الصحيح.`,
      options: [
        "قراءة أهداف الدرس",
        "استيعاب المفهوم الأساسي",
        "حل مثال محلول",
        "تطبيق ما تم فهمه على مسألة جديدة",
      ],
      correct_index: 0,
    },
    {
      kind: "matching",
      text: `صل كل مفهوم من درس "${title}" بتعريفه الصحيح.`,
      options: ["المفهوم الأول", "المفهوم الثاني", "المفهوم الثالث"],
      correct_index: 0,
      match_targets: ["تعريف المفهوم الأول", "تعريف المفهوم الثاني", "تعريف المفهوم الثالث"],
    },
  ];
  /**
   * §8 — one activity per lesson. A deterministic placeholder like the rest of
   * this stub (real content depends on the lesson's actual PDF, which isn't
   * parsed yet — §10's real API key work), not random and not invented subject
   * knowledge.
   */
  const activity: Omit<SuggestedActivity, "id" | "lesson_id"> = {
    type: "practice",
    title: `تدرّب على تطبيق درس "${title}"`,
    description: `نشاط عملي قصير يربط مفاهيم ${subjectName} في هذا الدرس بمثال واقعي، لتثبيت الفهم بعد الحصة.`,
  };
  return { slides, questions, activity };
}
