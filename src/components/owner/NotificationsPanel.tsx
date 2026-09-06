import { Search, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Panel, StatusBadge } from "@/components/dashboard/StatCard";
import { OwnerPasswordConfirmModal } from "@/components/owner/OwnerPasswordConfirmModal";
import {
  deleteAllNotifications,
  deleteNotification,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/data-store";
import { formatDateTime, formatNumber } from "@/lib/format";
import type { CenterNotification } from "@/types";

/**
 * §0.3 — كرت الإشعارات scrollable + بحث بالاسم والنص + حذف فرد/كل
 * مع تأكيد كلمة سر المالك.
 */
export function NotificationsPanel({
  notifications,
}: {
  notifications: CenterNotification[];
}) {
  const [query, setQuery] = useState("");
  const [confirmingClearAll, setConfirmingClearAll] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return notifications;
    return notifications.filter((n) => {
      const haystack = `${n.title} ${n.body ?? ""} ${n.source_event ?? ""} ${n.kind}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [notifications, query]);

  const unread = notifications.filter((n) => !n.read_at).length;

  return (
    <Panel
      title="الإشعارات المهمة"
      description={`${formatNumber(unread)} إشعار غير مقروء من إجمالي ${formatNumber(notifications.length)}`}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {unread > 0 ? (
            <button
              type="button"
              onClick={() => markAllNotificationsRead()}
              className="flex items-center gap-1.5 rounded-lg border-2 border-border px-3 py-1.5 text-xs font-black text-foreground hover:border-primary"
            >
              تعليم الكل كمقروء
            </button>
          ) : null}
          {notifications.length > 0 ? (
            <button
              type="button"
              onClick={() => setConfirmingClearAll(true)}
              className="flex items-center gap-1.5 rounded-lg border-2 border-destructive/40 px-3 py-1.5 text-xs font-black text-destructive hover:border-destructive"
              aria-label="حذف كل الإشعارات"
            >
              <Trash2 className="size-4" />
              حذف الكل
            </button>
          ) : null}
        </div>
      }
    >
      <div className="mb-3 relative">
        <Search className="absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="بحث في الإشعارات (مثل: تحصيل، غياب، تأخر)…"
          className="h-10 w-full rounded-xl border-2 border-border bg-background pr-9 pl-3 text-sm font-bold outline-none focus:border-primary"
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="مسح البحث"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>

      <div className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
        {notifications.length === 0 ? (
          <p className="rounded-xl border-2 border-dashed border-border p-6 text-center text-sm font-bold text-muted-foreground">
            لا توجد إشعارات بعد.
          </p>
        ) : filtered.length === 0 ? (
          <p className="rounded-xl border-2 border-dashed border-border p-6 text-center text-sm font-bold text-muted-foreground">
            لا توجد نتائج للبحث "{query}".
          </p>
        ) : (
          filtered.map((n) => <NotificationRow key={n.id} n={n} />)
        )}
      </div>

      <OwnerPasswordConfirmModal
        open={confirmingClearAll}
        title="حذف كل الإشعارات"
        description="سيتم حذف كل الإشعارات نهائياً من كل المتصفحات."
        confirmLabel="نعم، احذف الكل"
        destructive
        onClose={() => setConfirmingClearAll(false)}
        onConfirm={() => {
          deleteAllNotifications();
          toast.success("تم حذف كل الإشعارات");
        }}
      />
    </Panel>
  );
}

function NotificationRow({ n }: { n: CenterNotification }) {
  const toneClass =
    n.severity === "critical"
      ? "border-destructive/40 bg-destructive/5"
      : n.severity === "warning"
        ? "border-warning/40 bg-warning/5"
        : "border-success/40 bg-success/5";
  return (
    <div
      className={`rounded-xl border-2 p-3 ${n.read_at ? "border-border opacity-70" : toneClass}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-foreground">{n.title}</p>
          <p className="mt-0.5 text-xs font-bold text-muted-foreground">
            {formatDateTime(n.created_at)}
            {n.body ? ` · ${n.body}` : ""}
            {n.source_event ? ` · ${n.source_event}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {n.read_at ? (
            <StatusBadge tone="neutral">مقروء</StatusBadge>
          ) : (
            <button
              type="button"
              onClick={() => markNotificationRead(n.id)}
              className="rounded-lg border-2 border-border px-2 py-1 text-xs font-black text-foreground hover:border-primary"
            >
              اطلاع
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (!window.confirm("متأكد إنك عايز تحذف هذا الإشعار؟")) return;
              deleteNotification(n.id);
              toast.success("تم حذف الإشعار");
            }}
            className="rounded-lg border-2 border-border p-1.5 text-destructive hover:border-destructive"
            aria-label="حذف"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
