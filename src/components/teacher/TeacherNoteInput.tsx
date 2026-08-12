import { Send } from "lucide-react";
import { useState } from "react";

interface TeacherNoteInputProps {
  onSubmit: (note: string) => void;
}

export function TeacherNoteInput({ onSubmit }: TeacherNoteInputProps) {
  const [value, setValue] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const note = value.trim();
        if (!note) return;
        onSubmit(note);
        setValue("");
      }}
      className="mt-3 flex items-center gap-2"
    >
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="أضف ملاحظتك..."
        className="h-10 flex-1 rounded-lg border-2 border-border bg-background px-3 text-sm font-bold outline-none focus:border-primary"
      />
      <button
        type="submit"
        className="flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-navy px-3 text-xs font-black text-navy-foreground transition-opacity hover:opacity-90"
      >
        <Send className="size-3.5" />
        إضافة
      </button>
    </form>
  );
}
