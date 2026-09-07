import { MessageCircle, Send, X } from "lucide-react";
import { useState } from "react";

import { useCurrentStudent } from "@/hooks/use-current-student";
import {
  getCurriculumLessonsForUnit,
  getCurriculumUnitsForSubjectGrade,
  getGroupResourcesForGroup,
  getGroupsForStudent,
  useDataStore,
  type DataState,
} from "@/lib/data-store";

/**
 * مساعد الطالب — بيبحث فعلياً في بيانات الطالب الحقيقية (مجموعاته، منهجه،
 * مرفقات مدرّسيه) بدل ردود جاهزة ثابتة بالكامل. بحث بالكلمة المفتاحية داخل
 * بيانات النظام الفعلية — مش اتصال حقيقي بذكاء اصطناعي خارجي (لا يوجد
 * backend لموديل لغوي في المشروع)، لكنه بيدل الطالب فعلياً على اللي يخصه.
 */

const KEYWORD_REPLIES: { keywords: string[]; reply: string }[] = [
  { keywords: ["واجب", "واجبات"], reply: 'تقدر تشوف كل واجباتك في صفحة "الاستقبال" 📥' },
  {
    keywords: ["درجة", "درجات", "نتيجة", "نتائج"],
    reply: 'درجاتك بالتفصيل موجودة في صفحة "المستويات" 📊',
  },
  { keywords: ["حضور", "غياب"], reply: 'سجل حضورك وغيابك بالكامل في صفحة "الحضور والغياب" ✅' },
  {
    keywords: ["مدرس", "مدرسين", "مدرّس"],
    reply: 'كل مدرّسينك ومنهجك موجودين في صفحة "مدرّسيني ومنهجي" 📚',
  },
  { keywords: ["نقاط", "شارة", "شارات"], reply: 'نقاطك وشاراتك تقدر تتابعها في "لوحة الشرف" 🏆' },
  { keywords: ["شكرا", "شكراً", "تسلم"], reply: "العفو! دايماً في خدمتك 🌟" },
];

const DEFAULT_REPLIES = [
  "استمر في اجتهادك، أنت شغّال كويس! 💪",
  "لو محتاج أي حاجة، إنت في المكان الصح 🙂",
  "كل يوم فرصة جديدة تتفوّق فيها ✨",
];

interface KnowledgeHit {
  title: string;
  detail: string;
}

/** بحث حقيقي في منهج ومرفقات ومدرّسي الطالب — مصدره state الفعلي، مش نص ثابت. */
function searchStudentKnowledge(
  state: DataState,
  studentId: string,
  query: string,
): KnowledgeHit[] {
  const q = query.trim();
  if (q.length < 2) return [];
  const hits: KnowledgeHit[] = [];
  const groups = getGroupsForStudent(state, studentId);

  for (const g of groups) {
    if (g.subject.includes(q) || g.teacher_name.includes(q)) {
      hits.push({
        title: `${g.subject} — ${g.teacher_name}`,
        detail: `${g.weekday} الساعة ${g.time} · قاعة ${g.room}`,
      });
    }
    const units = getCurriculumUnitsForSubjectGrade(state, g.subject_id, g.grade_id);
    for (const u of units) {
      if (u.name.includes(q)) {
        hits.push({ title: u.name, detail: `وحدة في مادة ${g.subject} مع ${g.teacher_name}` });
      }
      for (const l of getCurriculumLessonsForUnit(state, u.id)) {
        if (l.title.includes(q)) {
          hits.push({ title: l.title, detail: `درس في وحدة "${u.name}" — مادة ${g.subject}` });
        }
      }
    }
    for (const r of getGroupResourcesForGroup(state, g.id)) {
      if (r.name.includes(q)) {
        hits.push({ title: r.name, detail: `مرفق من ${g.teacher_name} — مادة ${g.subject}` });
      }
    }
  }
  return hits.slice(0, 3);
}

function botReply(state: DataState, studentId: string, userText: string): string {
  const text = userText.trim();
  // البحث الحقيقي في منهج/مرفقات/مدرّسي الطالب له الأولوية — لو الطالب كتب اسم
  // درس أو مادة أو مدرّس بعينه، أدق من رد عام بيوجّهه لصفحة فقط.
  const hits = searchStudentKnowledge(state, studentId, text);
  if (hits.length > 0) {
    return hits.map((h) => `📘 ${h.title} — ${h.detail}`).join("\n");
  }
  for (const entry of KEYWORD_REPLIES) {
    if (entry.keywords.some((k) => text.includes(k))) return entry.reply;
  }
  return DEFAULT_REPLIES[Math.floor(Math.random() * DEFAULT_REPLIES.length)]!;
}

interface ChatMessage {
  id: number;
  from: "me" | "bot";
  text: string;
}

export function StudentChatWidget() {
  const state = useDataStore();
  const me = useCurrentStudent();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 0,
      from: "bot",
      text: "أهلاً بيك! أنا مساعدك الصغير 🤖 اسألني عن واجباتك، درجاتك، حضورك، أو اكتب اسم درس/مادة/مدرّس وهدلّك عليه.",
    },
  ]);
  const [text, setText] = useState("");

  function send() {
    const trimmed = text.trim();
    if (!trimmed || !me) return;
    const mine: ChatMessage = { id: Date.now(), from: "me", text: trimmed };
    const reply: ChatMessage = {
      id: Date.now() + 1,
      from: "bot",
      text: botReply(state, me.id, trimmed),
    };
    setMessages((prev) => [...prev, mine, reply]);
    setText("");
  }

  return (
    <div className="fixed bottom-5 left-5 z-40">
      {open ? (
        <div className="mb-3 flex h-96 w-80 flex-col overflow-hidden rounded-2xl border-2 border-border bg-background shadow-2xl">
          <div className="flex items-center justify-between gap-2 bg-navy px-4 py-3 text-navy-foreground">
            <p className="text-sm font-black">مساعدك الصغير</p>
            <button type="button" onClick={() => setOpen(false)} aria-label="إغلاق">
              <X className="size-4" />
            </button>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto p-3">
            {messages.map((m) => (
              <div
                key={m.id}
                className={
                  m.from === "me"
                    ? "mr-auto max-w-[85%] whitespace-pre-line rounded-2xl rounded-bl-sm bg-primary/10 px-3 py-2 text-sm font-bold text-foreground"
                    : "ml-auto max-w-[85%] whitespace-pre-line rounded-2xl rounded-br-sm bg-muted px-3 py-2 text-sm font-bold text-foreground"
                }
              >
                {m.text}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 border-t-2 border-border p-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="اكتب رسالتك…"
              className="h-10 flex-1 rounded-xl border-2 border-border bg-background px-3 text-sm font-bold outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={send}
              className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-navy text-navy-foreground hover:opacity-90"
              aria-label="إرسال"
            >
              <Send className="size-4" />
            </button>
          </div>
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex size-14 items-center justify-center rounded-full bg-navy text-navy-foreground shadow-2xl transition-transform hover:scale-105"
        aria-label="فتح المساعد الصغير"
      >
        <MessageCircle className="size-6" />
      </button>
    </div>
  );
}
