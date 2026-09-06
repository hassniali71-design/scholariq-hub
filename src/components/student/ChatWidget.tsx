import { MessageCircle, Send, X } from "lucide-react";
import { useState } from "react";

/**
 * شات بوت خفيف تجميلي فقط — بند 7 في طلب الطالب الجديد. لا اتصال حقيقي بأي
 * ذكاء اصطناعي ولا قاعدة بيانات، مجرد تفاعل بصري بسيط برد آلي عشوائي/بالكلمة
 * المفتاحية. لا تُخزَّن الرسائل ولا تُرسَل لأي مكان.
 */

const KEYWORD_REPLIES: { keywords: string[]; reply: string }[] = [
  { keywords: ["واجب", "واجبات"], reply: "تقدر تشوف كل واجباتك في صفحة \"الاستقبال\" 📥" },
  { keywords: ["درجة", "درجات", "نتيجة", "نتائج"], reply: "درجاتك بالتفصيل موجودة في صفحة \"المستويات\" 📊" },
  { keywords: ["حضور", "غياب"], reply: "سجل حضورك وغيابك بالكامل في صفحة \"الحضور والغياب\" ✅" },
  { keywords: ["مدرس", "مدرسين", "مدرّس"], reply: "كل مدرّسينك ومنهجك موجودين في صفحة \"مدرّسيني ومنهجي\" 📚" },
  { keywords: ["نقاط", "شارة", "شارات"], reply: "نقاطك وشاراتك تقدر تتابعها في \"لوحة الشرف\" 🏆" },
  { keywords: ["شكرا", "شكراً", "تسلم"], reply: "العفو! دايماً في خدمتك 🌟" },
];

const DEFAULT_REPLIES = [
  "استمر في اجتهادك، أنت شغّال كويس! 💪",
  "لو محتاج أي حاجة، إنت في المكان الصح 🙂",
  "كل يوم فرصة جديدة تتفوّق فيها ✨",
];

function botReply(userText: string): string {
  const text = userText.trim();
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
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: 0, from: "bot", text: "أهلاً بيك! أنا مساعدك الصغير 🤖 اسألني عن واجباتك، درجاتك، أو حضورك." },
  ]);
  const [text, setText] = useState("");

  function send() {
    const trimmed = text.trim();
    if (!trimmed) return;
    const mine: ChatMessage = { id: Date.now(), from: "me", text: trimmed };
    const reply: ChatMessage = { id: Date.now() + 1, from: "bot", text: botReply(trimmed) };
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
                    ? "mr-auto max-w-[85%] rounded-2xl rounded-bl-sm bg-primary/10 px-3 py-2 text-sm font-bold text-foreground"
                    : "ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-muted px-3 py-2 text-sm font-bold text-foreground"
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
