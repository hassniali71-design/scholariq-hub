import { createServerFn } from "@tanstack/react-start";

import { getSupabaseAdmin, readSupabaseEnv, resolveCenterId } from "@/lib/supabase-server";

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
  "center_finance_settings",
  "safe_handovers",
  "notifications",
  "activity_log",
  "staff_permissions",
  "expenses",
  "payroll_records",
  "subject_prices",
  "schedule_slots",
  "tasks",
  "paper_credits",
  "paper_transactions",
  "booklet_sales",
  "lesson_plans",
  "group_resources",
  "teacher_launches",
  "homework_attempts",
  "group_activations",
  "student_group_enrollments",
  "subject_quotes",
  "launch_views",
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
    supabase
      .from("centers")
      .select("id, name, branch, accent_color, slug")
      .eq("id", centerId)
      .single(),
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

  // برج تحكم المالك (migration db/0009): tolerant fetch — لو الجداول الجديدة لسه ماتعملتش
  // في قاعدة البيانات، الصفحات تشتغل عادي بقوائم فاضية بدل ما التطبيق كله يقع.
  const optional = async (table: TableName) => {
    const { data, error } = await scoped(table);
    if (error) {
      console.warn(`[data] optional table ${table} unavailable: ${error.message}`);
      return [] as unknown[];
    }
    return (data ?? []) as unknown[];
  };
  const [
    financeSettings,
    safeHandovers,
    notifications,
    activityLog,
    staffPermissions,
    expenses,
    payrollRecords,
    subjectPrices,
    scheduleSlots,
    tasks,
    paperCredits,
    paperTransactions,
    bookletSales,
    lessonPlans,
    groupResources,
    teacherLaunches,
    homeworkAttempts,
    groupActivations,
    studentGroupEnrollments,
    subjectQuotes,
    launchViews,
  ] = await Promise.all([
    optional("center_finance_settings"),
    optional("safe_handovers"),
    optional("notifications"),
    optional("activity_log"),
    optional("staff_permissions"),
    optional("expenses"),
    optional("payroll_records"),
    optional("subject_prices"),
    optional("schedule_slots"),
    optional("tasks"),
    optional("paper_credits"),
    optional("paper_transactions"),
    optional("booklet_sales"),
    optional("lesson_plans"),
    optional("group_resources"),
    optional("teacher_launches"),
    optional("homework_attempts"),
    optional("group_activations"),
    optional("student_group_enrollments"),
    optional("subject_quotes"),
    optional("launch_views"),
  ]);

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
    financeSettings,
    safeHandovers,
    notifications,
    activityLog,
    staffPermissions,
    expenses,
    payrollRecords,
    subjectPrices,
    scheduleSlots,
    tasks,
    paperCredits,
    paperTransactions,
    bookletSales,
    lessonPlans,
    groupResources,
    teacherLaunches,
    homeworkAttempts,
    groupActivations,
    studentGroupEnrollments,
    subjectQuotes,
    launchViews,
  } as unknown as {
    centerId: string;
    center: {
      id: string;
      name: string;
      branch: string;
      accent_color: string | null;
      slug: string | null;
    };
  } & Record<keyof typeof results, unknown[]> &
    Record<
      | "financeSettings"
      | "safeHandovers"
      | "notifications"
      | "activityLog"
      | "staffPermissions"
      | "expenses"
      | "payrollRecords"
      | "subjectPrices"
      | "scheduleSlots"
      | "tasks"
      | "paperCredits"
      | "paperTransactions"
      | "bookletSales"
      | "lessonPlans"
      | "groupResources"
      | "teacherLaunches"
      | "homeworkAttempts"
      | "groupActivations"
      | "studentGroupEnrollments"
      | "subjectQuotes"
      | "launchViews",
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
    // Branding-only, pre-auth lookup: if the server has no Supabase credentials yet (or the
    // lookup fails), fall back to the generic login card instead of crashing the whole page
    // with a 500 — the real failure then surfaces at sign-in, where it is actionable.
    const env = readSupabaseEnv();
    if (!env.url || !env.serviceRoleKey) return null;
    try {
      const supabase = getSupabaseAdmin();
      const { data: center } = await supabase
        .from("centers")
        .select("name, accent_color")
        .eq("slug", data.slug)
        .maybeSingle();
      return center as { name: string; accent_color: string | null } | null;
    } catch (error) {
      console.error("fetchCenterBySlug failed:", error);
      return null;
    }
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

/**
 * أعمدة جديدة (زي students.subject_fees / billing_plan في db/0011) ممكن تكون لسه ماتضافتش
 * لقاعدة البيانات. بدل ما العملية كلها تفشل، نشيل العمود المفقود ونعيد المحاولة — البيانات
 * تتسجل، والعمود يترجع تلقائياً بمجرد تشغيل ملف الهجرة.
 */
function missingColumn(message: string): string | null {
  const m = /Could not find the '([^']+)' column/.exec(message);
  return m?.[1] ?? null;
}

async function withColumnFallback(
  row: Record<string, unknown>,
  run: (row: Record<string, unknown>) => Promise<{ error: { message: string } | null }>,
) {
  let current = { ...row };
  for (let attempt = 0; attempt < 5; attempt++) {
    const { error } = await run(current);
    if (!error) return;
    const column = missingColumn(error.message);
    if (!column || !(column in current)) throw new Error(error.message);
    console.warn(`[data] dropping unknown column "${column}" — run the pending SQL migration.`);
    delete current[column];
  }
  throw new Error("تعذّر حفظ البيانات — شغّل ملف الهجرة db/0011 في قاعدة البيانات.");
}

export const insertRow = createServerFn({ method: "POST" })
  .validator((data: { identifier: string; table: TableName; row: Record<string, unknown> }) => data)
  .handler(async ({ data }) => {
    assertAllowedTable(data.table);
    const centerId = await resolveCenterId(data.identifier);
    const supabase = getSupabaseAdmin();
    await withColumnFallback({ ...data.row, center_id: centerId }, async (row) => {
      const { error } = await supabase.from(data.table).insert(row);
      return { error };
    });
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
    await withColumnFallback(data.patch, async (patch) => {
      const { error } = await supabase
        .from(data.table)
        .update(patch)
        .eq(idColumn, data.id)
        .eq("center_id", centerId);
      return { error };
    });
  });

export const upsertRow = createServerFn({ method: "POST" })
  .validator(
    (data: {
      identifier: string;
      table: TableName;
      row: Record<string, unknown>;
      onConflict: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    assertAllowedTable(data.table);
    const centerId = await resolveCenterId(data.identifier);
    const supabase = getSupabaseAdmin();
    await withColumnFallback({ ...data.row, center_id: centerId }, async (row) => {
      const { error } = await supabase
        .from(data.table)
        .upsert(row, { onConflict: data.onConflict });
      return { error };
    });
  });

export const deleteRows = createServerFn({ method: "POST" })
  .validator(
    (data: { identifier: string; table: TableName; idColumn?: string; ids?: string[] }) => data,
  )
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

/* ---------------- 0019: lesson_plans (teacher-owned) + platform_teacher_notes (cross-tenant) ---------------- */

/** جلب خطط الدروس لمدرس معيّن في مركزه الحالي. */
export const fetchLessonPlans = createServerFn({ method: "GET", strict: { output: false } })
  .validator((data: { identifier: string; teacherId: string }) => data)
  .handler(async ({ data }) => {
    const centerId = await resolveCenterId(data.identifier);
    const supabase = getSupabaseAdmin();
    const { data: rows, error } = await supabase
      .from("lesson_plans")
      .select("*")
      .eq("center_id", centerId)
      .eq("teacher_id", data.teacherId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/** upsert خطة درس (إنشاء أو تحديث). */
export const upsertLessonPlanRow = createServerFn({ method: "POST" })
  .validator(
    (data: {
      identifier: string;
      row: {
        id: string;
        center_id: string;
        teacher_id: string;
        group_id: string;
        lesson_name: string;
        unit?: string | null;
        notes?: string | null;
        prepared_at?: string | null;
        prepared_done?: boolean;
        taught_at?: string | null;
        taught_done?: boolean;
        created_at: string;
        updated_at: string;
      };
    }) => data,
  )
  .handler(async ({ data }) => {
    const centerId = await resolveCenterId(data.identifier);
    const supabase = getSupabaseAdmin();
    const row = { ...data.row, center_id: centerId };
    const { error } = await supabase
      .from("lesson_plans")
      .upsert(row, { onConflict: "id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** حذف خطة درس. */
export const deleteLessonPlanRow = createServerFn({ method: "POST" })
  .validator((data: { identifier: string; id: string }) => data)
  .handler(async ({ data }) => {
    const centerId = await resolveCenterId(data.identifier);
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("lesson_plans")
      .delete()
      .eq("center_id", centerId)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** جلب رسائل مدير المنصة لمادة معيّنة — **بدون فلتر center_id** (عبر كل المراكز). */
export const fetchPlatformTeacherNotes = createServerFn({ method: "GET", strict: { output: false } })
  .validator((data: { identifier: string; subjectId: string }) => data)
  .handler(async ({ data }) => {
    const supabase = getSupabaseAdmin();
    const { data: rows, error } = await supabase
      .from("platform_teacher_notes")
      .select("*")
      .eq("subject_id", data.subjectId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/** upsert رسالة مدير المنصة. */
export const upsertPlatformTeacherNote = createServerFn({ method: "POST" })
  .validator(
    (data: {
      identifier: string;
      row: {
        id: string;
        subject_id: string;
        body: string;
        author_identifier: string;
        author_name: string;
        created_at: string;
        updated_at: string;
      };
    }) => data,
  )
  .handler(async ({ data }) => {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("platform_teacher_notes")
      .upsert(data.row, { onConflict: "id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** حذف رسالة مدير المنصة. */
export const deletePlatformTeacherNote = createServerFn({ method: "POST" })
  .validator((data: { identifier: string; id: string }) => data)
  .handler(async ({ data }) => {
    const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("platform_teacher_notes")
    .delete()
    .eq("id", data.id);
  if (error) throw new Error(error.message);
  return { ok: true };
});

/* ---------------- 0020: groups real source (createGroup / updateGroup / deleteGroup + addStudentToGroup / removeStudentFromGroup) ---------------- */

/** إنشاء مجموعة جديدة (المصدر الوحيد = جدول groups). */
export const createGroupRow = createServerFn({ method: "POST" })
  .validator(
    (data: {
      identifier: string;
      row: {
        id: string;
        center_id: string;
        name: string;
        subject: string;
        subject_id: string;
        teacher_name: string;
        teacher_id: string;
        grade: string;
        grade_id: string;
        weekday: string;
        time: string;
        room: string;
        enrolled: number;
        capacity: number;
        scheduling_status: "pending" | "scheduled";
        created_at: string;
        notes?: string | null;
      };
    }) => data,
  )
  .handler(async ({ data }) => {
    const centerId = await resolveCenterId(data.identifier);
    const supabase = getSupabaseAdmin();
    const row = { ...data.row, center_id: centerId };
    await withColumnFallback(row, async (r) => {
      const { error } = await supabase.from("groups").insert(r);
      return { error };
    });
    return { ok: true };
  });

/** تحديث مجموعة (capacity / notes / scheduling fields). */
export const updateGroupRow = createServerFn({ method: "POST" })
  .validator(
    (data: {
      identifier: string;
      id: string;
      patch: Record<string, unknown>;
    }) => data,
  )
  .handler(async ({ data }) => {
    const centerId = await resolveCenterId(data.identifier);
    const supabase = getSupabaseAdmin();
    await withColumnFallback(data.patch, async (patch) => {
      const { error } = await supabase
        .from("groups")
        .update(patch)
        .eq("id", data.id)
        .eq("center_id", centerId);
      return { error };
    });
    return { ok: true };
  });

/** حذف مجموعة. */
export const deleteGroupRow = createServerFn({ method: "POST" })
  .validator((data: { identifier: string; id: string }) => data)
  .handler(async ({ data }) => {
    const centerId = await resolveCenterId(data.identifier);
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("groups")
      .delete()
      .eq("center_id", centerId)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** إضافة طالب إلى مجموعة (يحدّث group_id و group_name). */
export const addStudentToGroupRow = createServerFn({ method: "POST" })
  .validator(
    (data: {
      identifier: string;
      studentId: string;
      groupId: string;
      groupName: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const centerId = await resolveCenterId(data.identifier);
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("students")
      .update({ group_id: data.groupId, group_name: data.groupName })
      .eq("center_id", centerId)
      .eq("id", data.studentId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** إزالة طالب من مجموعة (يعود إلى "بدون مجموعة"). */
export const removeStudentFromGroupRow = createServerFn({ method: "POST" })
  .validator((data: { identifier: string; studentId: string }) => data)
  .handler(async ({ data }) => {
    const centerId = await resolveCenterId(data.identifier);
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("students")
      .update({ group_id: null, group_name: "بدون مجموعة" })
      .eq("center_id", centerId)
      .eq("id", data.studentId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
