import { FileSpreadsheet, Play, Send, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Panel } from "@/components/dashboard/StatCard";
import { parseQuestionsFromXlsx, type ParsedQuestion, toQuizQuestion } from "@/lib/excel-parser";
import { addTeacherLaunch } from "@/lib/data-store";
import { cn } from "@/lib/utils";
import type { QuizQuestion } from "@/types";

import { ActivityRunner } from "./ActivityRunner";
import type { Group } from "@/types";

/**
 * Migration 0023 / خطة C (C2): محرّك النشاط التفاعلي —
 * المدرس يرفع شيت Excel → preview السؤال (بطاقة كاملة، 4 اختيارات)
 * → «ابدأ النشاط» يحوّل لوضع التشغيل.
 *
 * SheetJS (~717KB) يُستورَد ديناميكياً داخل `parseQuestionsFromXlsx`
 * فقط — لا يُحمَّل في الـ bundle الأساسي ولا في وضع التشغيل.
 */
type ActivityMode = "interactive" | "website_homework" | "group_challenge" | "individual_challenge";

const ACTIVITY_MODES: { key: ActivityMode; label: string; hint: string }[] = [
  {
    key: "interactive",
    label: "نشاط تفاعلي",
    hint: "سحب طالب عشوائي + تايمر 20 ثانية لكل سؤال، مع تقليب صريح للسؤال التالي.",
  },
  {
    key: "website_homework",
    label: "واجب ويب سايت",
    hint: "نسخة لكل طالب · بدون تايمر · محاولة واحدة لا تتكرر · الدرجة X من Y · ينتهي بعد 24 ساعة.",
  },
  {
    key: "group_challenge",
    label: "تحدي مجموعات",
    hint: "نفس الأسئلة كتحدٍ بين مجموعات داخل الفصل — النقاط تُرصد للطالب المجيب.",
  },
  {
    key: "individual_challenge",
    label: "تحدي فردي",
    hint: "كل طالب يواجه أسئلته بنفسه بالترتيب — بدون سحب عشوائي.",
  },
];

export function InteractiveActivityStudio({
  group,
  teacherId,
  sessionId,
}: {
  group: Group;
  teacherId: string;
  sessionId: string;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [parsing, setParsing] = useState(false);
  const [running, setRunning] = useState(false);
  /** البند 6: نفس ملف الأسئلة يُستخدم في أربعة أوضاع مختلفة. */
  const [mode, setMode] = useState<ActivityMode>("interactive");

  const handleFile = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error("حجم الملف يتجاوز 10MB — قلل الحجم وحاول مرة أخرى.");
      return;
    }
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      toast.error("الملف يجب أن يكون بصيغة .xlsx");
      return;
    }
    setParsing(true);
    setWarnings([]);
    try {
      const result = await parseQuestionsFromXlsx(file);
      if (result.questions.length === 0) {
        toast.error("لم يتم العثور على أسئلة صالحة في الشيت");
        setQuestions([]);
        setWarnings(result.warnings);
        return;
      }
      const q = result.questions.map((p: ParsedQuestion) => toQuizQuestion(p, null, "manual"));
      setQuestions(q);
      setWarnings(result.warnings);
      toast.success(`تم تحميل ${q.length} سؤالاً من الشيت`);
    } catch (err) {
      console.error(err);
      toast.error("فشل قراءة الملف — تأكد أنه شيت Excel صالح");
    } finally {
      setParsing(false);
    }
  };

  const launchWebsiteHomework = () => {
    const dueAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    addTeacherLaunch({
      groupId: group.id,
      teacherId,
      launchType: "online_homework",
      title: `واجب ويب سايت — ${group.name}`,
      body: JSON.stringify(questions),
      notes: `نسخة لكل طالب · بدون تايمر · محاولة واحدة فقط · الدرجة من ${questions.length}`,
      dueAt,
    });
    toast.success(
      `تم إطلاق واجب الويب سايت — ${questions.length} سؤال، محاولة واحدة، ينتهي بعد 24 ساعة`,
    );
  };

  if (running && questions.length > 0) {
    return (
      <Panel
        title="نشاط تفاعلي — وضع التشغيل"
        description={`${questions.length} سؤال · مجموعة ${group.name}`}
        actions={
          <button
            type="button"
            onClick={() => setRunning(false)}
            className="rounded-xl border-2 border-border px-3 py-1.5 text-[11px] font-black text-muted-foreground hover:bg-muted"
          >
            ← العودة للمعاينة
          </button>
        }
      >
        <ActivityRunner
          group={group}
          teacherId={teacherId}
          sessionId={sessionId}
          questions={questions}
          onExit={() => setRunning(false)}
        />
      </Panel>
    );
  }

  return (
    <Panel
      title="النشاط التفاعلي (Kahoot-like)"
      description="ارفع شيت Excel فيه سؤال + اختيارات + رقم الإجابة الصحيحة — أو صح/غلط"
    >
      <div className="space-y-3 rounded-2xl bg-gradient-to-bl from-warning/15 via-primary/10 to-success/15 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-black text-muted-foreground">وضع التشغيل:</span>
          {ACTIVITY_MODES.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setMode(m.key)}
              className={cn(
                "rounded-lg border-2 px-3 py-1.5 text-xs font-black transition-colors",
                mode === m.key
                  ? "border-navy bg-navy text-navy-foreground"
                  : "border-border bg-background hover:border-primary",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="text-[11px] font-bold text-muted-foreground">
          {ACTIVITY_MODES.find((m) => m.key === mode)!.hint}
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
            e.target.value = "";
          }}
        />
        <div
          className={cn(
            "rounded-xl border-2 border-dashed p-4 text-center",
            questions.length > 0 ? "border-success/40 bg-success/5" : "border-border bg-canvas/30",
          )}
        >
          {questions.length > 0 ? (
            <>
              <p className="text-sm font-black text-foreground">
                ✓ تم تحميل {questions.length} سؤالاً
              </p>
              <p className="mt-1 text-xs font-bold text-muted-foreground">
                اضغط «ابدأ النشاط» لتشغيله
              </p>
            </>
          ) : (
            <>
              <FileSpreadsheet className="mx-auto size-8 text-primary" />
              <p className="mt-2 text-sm font-black text-foreground">ارفع شيت Excel (.xlsx)</p>
              <p className="mt-1 text-xs font-bold text-muted-foreground">
                أعمدة: سؤال · اختيار 1..4 · رقم الإجابة الصحيحة
              </p>
            </>
          )}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              disabled={parsing}
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 rounded-xl border-2 border-border bg-background px-4 py-2 text-xs font-black text-foreground hover:border-primary disabled:opacity-40"
            >
              <Upload className="size-4" />
              {questions.length > 0 ? "رفع شيت آخر" : "اختر ملف"}
            </button>
            {questions.length > 0 && mode === "website_homework" ? (
              <button
                type="button"
                onClick={launchWebsiteHomework}
                className="flex items-center gap-2 rounded-xl bg-navy px-4 py-2 text-xs font-black text-navy-foreground hover:opacity-90"
              >
                <Send className="size-4" /> إطلاق واجب الويب سايت
              </button>
            ) : null}
            {questions.length > 0 && mode !== "website_homework" ? (
              <button
                type="button"
                onClick={() => setRunning(true)}
                className="flex items-center gap-2 rounded-xl bg-navy px-4 py-2 text-xs font-black text-navy-foreground hover:opacity-90"
              >
                <Play className="size-4" /> ابدأ النشاط
              </button>
            ) : null}
          </div>
          {parsing ? (
            <p className="mt-2 text-xs font-bold text-primary">جاري قراءة الملف…</p>
          ) : null}
        </div>

        {warnings.length > 0 ? (
          <div className="rounded-xl border-2 border-warning/40 bg-warning/10 p-3">
            <p className="text-xs font-black text-warning">تنبيهات عند القراءة:</p>
            <ul className="mt-1 list-disc pe-4 text-[11px] font-bold text-warning">
              {warnings.slice(0, 5).map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {questions.length > 0 ? (
          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            <p className="text-[11px] font-black text-muted-foreground">
              معاينة ({questions.length} سؤال):
            </p>
            {questions.slice(0, 5).map((q, i) => (
              <div key={q.id} className="rounded-xl border-2 border-border bg-background p-3">
                <p className="text-xs font-black text-foreground">
                  {i + 1}. {q.text}
                </p>
                <div className="mt-2 grid gap-1 sm:grid-cols-2">
                  {q.options.map((opt, j) => (
                    <p
                      key={j}
                      className={cn(
                        "rounded-lg border-2 px-2 py-1 text-[11px] font-bold",
                        j === q.correct_index
                          ? "border-success/40 bg-success/10 text-success"
                          : "border-border text-muted-foreground",
                      )}
                    >
                      {["أ", "ب", "ج", "د"][j] ?? j + 1}. {opt}
                    </p>
                  ))}
                </div>
              </div>
            ))}
            {questions.length > 5 ? (
              <p className="text-center text-[11px] font-bold text-muted-foreground">
                + {questions.length - 5} سؤال آخر
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </Panel>
  );
}
