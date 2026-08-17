import { createServerFn } from "@tanstack/react-start";

import { getSupabaseAdmin, resolveCenterId } from "@/lib/supabase-server";

/**
 * SUPABASE_MIGRATION_SPEC.md §5 — one generic CRUD layer instead of ~40 bespoke server
 * functions (one per data-store.ts mutation). Every table's TS row shape already matches
 * its Postgres columns 1:1 (src/types/index.ts fields are snake_case already — `full_name`,
 * `center_id`, etc. — this app was deliberately written that way for exactly this migration,
 * see CLAUDE.md §5), so a table name + a plain row object is enough; no per-entity mapping.
 *
 * Every one of these tables has a `center_id` column per §1, so `.eq("center_id", centerId)`
 * uniformly scopes every read/update/delete — `centerId` is resolved server-side from the
 * caller's `identifier` (see resolveCenterId), never trusted from client input.
 */
const TABLES = [
  "students",
  "teachers",
  "groups",
  "subjects",
  "grades",
  "grade_subjects",
  "attendance_records",
  "payments",
  "booklets",
  "quiz_results",
  "homework_tasks",
  "whatsapp_logs",
  "teacher_notes",
  "live_scores",
  "shift_closures",
  "lessons",
  "lesson_slides",
  "session_questions",
  "timer_extensions",
  "random_pick_logs",
  "session_events",
  "session_records",
  "assessment_scores",
  "curriculum_units",
  "curriculum_lessons",
  "book_exercise_tasks",
  "suggested_activities",
  "electronic_homeworks",
] as const;

export type TableName = (typeof TABLES)[number];

function assertAllowedTable(table: string): asserts table is TableName {
  if (!(TABLES as readonly string[]).includes(table)) {
    throw new Error(`جدول غير مسموح به: ${table}`);
  }
}

/**
 * Replaces the old "seed mock-data.ts into localStorage on first run" step: fetches every
 * table for the caller's center in parallel and hands back a DataState-shaped payload
 * (collection keys stay camelCase to match data-store.ts's existing `DataState`; the rows
 * inside each array are untouched Postgres rows).
 */
/**
 * Shared by `fetchCenterData` (self, resolved from the caller's own identifier) and
 * `fetchCenterDataForAdmin` (§10-ب, platform admin pulling an arbitrary `centerId`) — same
 * 28-table fetch either way, just a different source for `centerId`.
 */
async function fetchAllTablesForCenter(centerId: string) {
    const supabase = getSupabaseAdmin();

    const scoped = (table: TableName) => supabase.from(table).select("*").eq("center_id", centerId);

    const [
      centerRow,
      students,
      teachers,
      groups,
      subjects,
      grades,
      gradeSubjects,
      attendanceRecords,
      payments,
      booklets,
      quizResults,
      homeworkTasks,
      whatsappLogs,
      teacherNotes,
      liveScores,
      shiftClosures,
      lessons,
      lessonSlides,
      sessionQuestions,
      timerExtensions,
      randomPickLogs,
      sessionEvents,
      sessionRecords,
      assessmentScores,
      curriculumUnits,
      curriculumLessons,
      bookExerciseTasks,
      suggestedActivities,
      electronicHomeworks,
    ] = await Promise.all([
      supabase.from("centers").select("id, name, branch, accent_color, slug").eq("id", centerId).single(),
      scoped("students"),
      scoped("teachers"),
      scoped("groups"),
      scoped("subjects"),
      scoped("grades"),
      scoped("grade_subjects"),
      scoped("attendance_records"),
      scoped("payments"),
      scoped("booklets"),
      scoped("quiz_results"),
      scoped("homework_tasks"),
      scoped("whatsapp_logs"),
      scoped("teacher_notes"),
      scoped("live_scores"),
      scoped("shift_closures"),
      scoped("lessons"),
      scoped("lesson_slides"),
      scoped("session_questions"),
      scoped("timer_extensions"),
      scoped("random_pick_logs"),
      scoped("session_events"),
      scoped("session_records"),
      scoped("assessment_scores"),
      scoped("curriculum_units"),
      scoped("curriculum_lessons"),
      scoped("book_exercise_tasks"),
      scoped("suggested_activities"),
      scoped("electronic_homeworks"),
    ]);

    const results = {
      students,
      teachers,
      groups,
      subjects,
      grades,
      gradeSubjects,
      attendanceRecords,
      payments,
      booklets,
      quizResults,
      homeworkTasks,
      whatsappLogs,
      teacherNotes,
      liveScores,
      shiftClosures,
      lessons,
      lessonSlides,
      sessionQuestions,
      timerExtensions,
      randomPickLogs,
      sessionEvents,
      sessionRecords,
      assessmentScores,
      curriculumUnits,
      curriculumLessons,
      bookExerciseTasks,
      suggestedActivities,
      electronicHomeworks,
    };

    if (centerRow.error) {
      throw new Error(`فشل تحميل بيانات المركز: ${centerRow.error.message}`);
    }
    for (const [key, result] of Object.entries(results)) {
      if (result.error) {
        throw new Error(`فشل تحميل ${key}: ${result.error.message}`);
      }
    }

    return {
      centerId,
      // §8/§11: every client sees their own center's real name/branch/accent color, not the
      // seeded demo tenant's.
      center: centerRow.data,
      ...Object.fromEntries(Object.entries(results).map(([key, result]) => [key, result.data ?? []])),
    } as {
      centerId: string;
      center: { id: string; name: string; branch: string; accent_color: string | null; slug: string | null };
    } & Record<
      keyof typeof results,
      unknown[]
    >;
}

export const fetchCenterData = createServerFn({ method: "GET", strict: { output: false } })
  .validator((data: { identifier: string }) => data)
  .handler(async ({ data }) => {
    const centerId = await resolveCenterId(data.identifier);
    return fetchAllTablesForCenter(centerId);
  });

/**
 * SUPABASE_MIGRATION_SPEC.md §11-ب — /login/$slug's pre-auth lookup. Deliberately public (no
 * identifier, no resolveCenterId): only ever returns name + accent_color, which the spec
 * itself calls out as non-sensitive and safe to show before sign-in (same idea as a company
 * showing its own logo on its login page). Never touches accounts or any business table.
 */
export const fetchCenterBySlug = createServerFn({ method: "GET" })
  .validator((data: { slug: string }) => data)
  .handler(async ({ data }) => {
    const supabase = getSupabaseAdmin();
    const { data: center } = await supabase
      .from("centers")
      .select("name, accent_color")
      .eq("slug", data.slug)
      .maybeSingle();
    return center as { name: string; accent_color: string | null } | null;
  });

/**
 * SUPABASE_MIGRATION_SPEC.md §10-ب — admin tool (not visible to clients) that exports one
 * specific center's data on demand, for quick recovery of a single affected client without
 * restoring the whole database. Same platform-only check as `createCenter`.
 */
export const fetchCenterDataForAdmin = createServerFn({ method: "POST", strict: { output: false } })
  .validator((data: { identifier: string; targetCenterId: string }) => data)
  .handler(async ({ data }) => {
    const callerCenterId = await resolveCenterId(data.identifier);
    if (callerCenterId !== "platform") {
      throw new Error("هذا الحساب غير مصرَّح له بتصدير بيانات عملاء آخرين");
    }
    return fetchAllTablesForCenter(data.targetCenterId);
  });

export const insertRow = createServerFn({ method: "POST" })
  .validator((data: { identifier: string; table: TableName; row: Record<string, unknown> }) => data)
  .handler(async ({ data }) => {
    assertAllowedTable(data.table);
    const centerId = await resolveCenterId(data.identifier);
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from(data.table).insert({ ...data.row, center_id: centerId });
    if (error) throw new Error(error.message);
  });

export const updateRow = createServerFn({ method: "POST" })
  .validator(
    (data: {
      identifier: string;
      table: TableName;
      idColumn?: string;
      id: string;
      patch: Record<string, unknown>;
    }) => data,
  )
  .handler(async ({ data }) => {
    assertAllowedTable(data.table);
    const centerId = await resolveCenterId(data.identifier);
    const supabase = getSupabaseAdmin();
    const idColumn = data.idColumn ?? "id";
    // The center_id filter is what makes this safe: a caller can only ever touch rows that
    // already belong to their own (server-verified) center, even if `id` collides with
    // another tenant's row.
    const { error } = await supabase
      .from(data.table)
      .update(data.patch)
      .eq(idColumn, data.id)
      .eq("center_id", centerId);
    if (error) throw new Error(error.message);
  });

export const upsertRow = createServerFn({ method: "POST" })
  .validator((data: { identifier: string; table: TableName; row: Record<string, unknown>; onConflict: string }) => data)
  .handler(async ({ data }) => {
    assertAllowedTable(data.table);
    const centerId = await resolveCenterId(data.identifier);
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from(data.table)
      .upsert({ ...data.row, center_id: centerId }, { onConflict: data.onConflict });
    if (error) throw new Error(error.message);
  });

export const deleteRows = createServerFn({ method: "POST" })
  .validator((data: { identifier: string; table: TableName; idColumn?: string; ids?: string[] }) => data)
  .handler(async ({ data }) => {
    assertAllowedTable(data.table);
    const centerId = await resolveCenterId(data.identifier);
    const supabase = getSupabaseAdmin();
    let query = supabase.from(data.table).delete().eq("center_id", centerId);
    if (data.ids && data.ids.length > 0) {
      query = query.in(data.idColumn ?? "id", data.ids);
    }
    const { error } = await query;
    if (error) throw new Error(error.message);
  });
