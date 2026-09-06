import { useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Migration 0023 / خطة المرحلة B (B3): لوحة مفاتيح رقمية ثابتة تظهر تحت
 * خانة الدرجة. المدرس يدوس رقم فيسمع في الـ input مباشرة، ما يحتاجش
 * يفتح كيبورد الجوال.
 *
 * - `value` / `onChange`: حالة محليّة (المُتصِل يدير الحالة بنفسه).
 * - `min` / `max`: حدود الرقم (افتراضي 0..10 للسلوك).
 * - عند `clearable=true`: زر مسح يُعيد للقيمة الافتراضية (0).
 */
export function StudentScoreKeyboard({
  value,
  onChange,
  min = 0,
  max = 10,
  clearable = true,
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  clearable?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const clamp = (n: number) => Math.max(min, Math.min(max, n));

  return (
    <div className="rounded-xl border-2 border-border bg-background p-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[11px] font-black text-muted-foreground">
          {value} / {max}
        </span>
        {clearable ? (
          <button
            type="button"
            onClick={() => onChange(0)}
            className="rounded-md border-2 border-border px-2 py-0.5 text-[10px] font-black text-muted-foreground hover:bg-muted"
          >
            مسح
          </button>
        ) : null}
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {Array.from({ length: 11 }, (_, i) => i).map((digit) => {
          const active = value === digit;
          return (
            <button
              key={digit}
              type="button"
              onClick={() => onChange(clamp(digit))}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              className={cn(
                "rounded-lg border-2 py-1.5 text-sm font-black transition-colors",
                active
                  ? "border-navy bg-navy text-navy-foreground"
                  : "border-border bg-background text-foreground hover:border-primary",
              )}
            >
              {digit}
            </button>
          );
        })}
      </div>
      {focused ? (
        <p className="mt-2 text-[10px] font-bold text-muted-foreground">
          المسموح من {min} إلى {max}
        </p>
      ) : null}
    </div>
  );
}
