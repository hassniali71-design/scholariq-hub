import { BookOpen, ClipboardList, Link2, Trash2, Video } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Panel } from "@/components/dashboard/StatCard";
import {
  deleteGroupResource,
  deleteTeacherLaunch,
  getGroupResourcesForGroup,
  getTeacherLaunchesForGroup,
  useDataStore,
} from "@/lib/data-store";
import { cn } from "@/lib/utils";
import type { GroupResource, TeacherLaunch } from "@/types";

/**
 * المرحلة A — كارت "منهج المجموعة" في `/teacher/curriculum`.
 * Timeline يدمج روابط المنهج (`group_resources`) والإطلاقات (`teacher_launches`)
 * بالأحدث أولاً، مع بحث وفلتر حسب النوع.
 */
export function GroupCurriculumTimeline({ groupId }: { groupId: string }) {
  const state = useDataStore();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "resource" | "launch">("all");

  const resources = useMemo(
    () => getGroupResourcesForGroup(state, groupId),
    [state.groupResources, groupId],
  );
  const launches = useMemo(
    () => getTeacherLaunchesForGroup(state, groupId),
    [state.teacherLaunches, groupId],
  );

  type Item =
    | { kind: "resource"; at: string; data: GroupResource }
    | { kind: "launch"; at: string; data: TeacherLaunch };

  const items: Item[] = useMemo(() => {
    const list: Item[] = [];
    if (filter !== "launch") {
      for (const r of resources) list.push({ kind: "resource", at: r.created_at, data: r });
    }
    if (filter !== "resource") {
      for (const l of launches) list.push({ kind: "launch", at: l.created_at, data: l });
    }
    list.sort((a, b) => (a.at < b.at ? 1 : -1));
    if (!search.trim()) return list;
    const q = search.trim().toLowerCase();
    return list.filter((it) => {
      if (it.kind === "resource") {
        return (
          it.data.name.toLowerCase().includes(q) ||
          it.data.url.toLowerCase().includes(q) ||
          (it.data.unit ?? "").toLowerCase().includes(q)
        );
      }
      return it.data.title.toLowerCase().includes(q);
    });
  }, [resources, launches, filter, search]);

  return (
    <Panel
      title="منهج المجموعة (Timeline)"
      description="روابط المنهج + كل ما أطلقه المدرس (واجبات، أنشطة، اختبارات) مرتّبة بالأحدث"
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <FilterPill active={filter === "all"} onClick={() => setFilter("all")}>
            الكل
          </FilterPill>
          <FilterPill active={filter === "resource"} onClick={() => setFilter("resource")}>
            روابط فقط
          </FilterPill>
          <FilterPill active={filter === "launch"} onClick={() => setFilter("launch")}>
            إطلاقات فقط
          </FilterPill>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث..."
            className="ms-auto w-full max-w-xs rounded-xl border-2 border-border bg-background px-3 py-1.5 text-xs font-bold outline-none focus:border-primary"
          />
        </div>

        <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
          {items.length === 0 ? (
            <p className="rounded-xl border-2 border-dashed border-border p-6 text-center text-sm font-bold text-muted-foreground">
              لا توجد عناصر منهج بعد. ابدأ بإضافة روابط أو إطلاق واجب من صفحة الحصة.
            </p>
          ) : (
            items.map((it) =>
              it.kind === "resource" ? (
                <ResourceItem
                  key={`r-${it.data.id}`}
                  resource={it.data}
                  onDelete={() => {
                    if (confirm(`حذف "${it.data.name}"؟`)) {
                      deleteGroupResource(it.data.id);
                      toast.success("تم الحذف");
                    }
                  }}
                />
              ) : (
                <LaunchItem
                  key={`l-${it.data.id}`}
                  launch={it.data}
                  onDelete={() => {
                    if (confirm(`حذف "${it.data.title}"؟`)) {
                      deleteTeacherLaunch(it.data.id);
                      toast.success("تم الحذف");
                    }
                  }}
                />
              ),
            )
          )}
        </div>
      </div>
    </Panel>
  );
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl border-2 px-3 py-1.5 text-xs font-black",
        active
          ? "border-navy bg-navy text-navy-foreground"
          : "border-border bg-background text-foreground hover:border-primary",
      )}
    >
      {children}
    </button>
  );
}

const RESOURCE_LABEL: Record<GroupResource["resource_type"], string> = {
  lesson_url: "رابط شرح",
  pdf: "PDF",
  external_link: "رابط خارجي",
  video: "فيديو",
  other: "أخرى",
};

const RESOURCE_ICON: Record<GroupResource["resource_type"], typeof Link2> = {
  lesson_url: Link2,
  pdf: BookOpen,
  external_link: Link2,
  video: Video,
  other: BookOpen,
};

function ResourceItem({ resource, onDelete }: { resource: GroupResource; onDelete: () => void }) {
  const Icon = RESOURCE_ICON[resource.resource_type];
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border-2 border-border bg-background p-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-3.5" />
          </span>
          <span className="rounded-lg bg-primary/10 px-2 py-0.5 text-[11px] font-black text-primary">
            {RESOURCE_LABEL[resource.resource_type]}
          </span>
          <a
            href={resource.url}
            target="_blank"
            rel="noreferrer noopener"
            className="truncate text-sm font-black text-foreground underline decoration-dotted underline-offset-2 hover:text-primary"
          >
            {resource.name}
          </a>
        </div>
        {resource.unit ? (
          <p className="mt-1 text-xs font-bold text-muted-foreground">الوحدة: {resource.unit}</p>
        ) : null}
        <p className="mt-1 text-[11px] font-bold text-muted-foreground" dir="ltr">
          {new Date(resource.created_at).toLocaleString("ar-EG", { numberingSystem: "latn" })}
        </p>
      </div>
      <button
        type="button"
        onClick={onDelete}
        className="rounded-lg border-2 border-destructive/30 p-1.5 text-destructive hover:bg-destructive/10"
        aria-label="حذف"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}

const TYPE_LABEL: Record<TeacherLaunch["launch_type"], string> = {
  homework: "واجب بيتي",
  homework_with_correction: "واجب مع تصحيح",
  in_class_task: "مهمة صف",
  interactive_activity: "نشاط تفاعلي",
  online_homework: "واجب إلكتروني",
  online_quiz: "اختبار إلكتروني",
  reading_assignment: "مراجعة / قراءة",
  oral_recitation: "تسميع",
};

const TYPE_TONE: Record<TeacherLaunch["launch_type"], string> = {
  homework: "bg-primary/10 text-primary",
  homework_with_correction: "bg-info/10 text-info",
  in_class_task: "bg-success/10 text-success",
  interactive_activity: "bg-warning/15 text-warning",
  online_homework: "bg-primary/10 text-primary",
  online_quiz: "bg-destructive/10 text-destructive",
  reading_assignment: "bg-info/10 text-info",
  oral_recitation: "bg-success/10 text-success",
};

function LaunchItem({ launch, onDelete }: { launch: TeacherLaunch; onDelete: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border-2 border-border bg-background p-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-info/10 text-info">
            <ClipboardList className="size-3.5" />
          </span>
          <span
            className={cn(
              "rounded-lg px-2 py-0.5 text-[11px] font-black",
              TYPE_TONE[launch.launch_type],
            )}
          >
            {TYPE_LABEL[launch.launch_type]}
          </span>
          <p className="text-sm font-black text-foreground">{launch.title}</p>
        </div>
        {launch.body ? (
          <p className="mt-1 line-clamp-2 text-xs font-bold text-muted-foreground">{launch.body}</p>
        ) : null}
        <p className="mt-1 text-[11px] font-bold text-muted-foreground">
          {new Date(launch.created_at).toLocaleString("ar-EG", { numberingSystem: "latn" })}
          {launch.due_at
            ? ` · يُسلَّم قبل ${new Date(launch.due_at).toLocaleString("ar-EG", { numberingSystem: "latn" })}`
            : null}
        </p>
      </div>
      <button
        type="button"
        onClick={onDelete}
        className="rounded-lg border-2 border-destructive/30 p-1.5 text-destructive hover:bg-destructive/10"
        aria-label="حذف"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}
