/**
 * One-time patch for data that already existed in Supabase before migration 0007 added
 * accent_color/slug, and before mock-data.ts's grades grew from 6 to 9 (SUPABASE_MIGRATION_SPEC.md
 * §11). New centers created after this point get all of this from createCenter/seed-supabase.ts
 * directly — this script is only for what was already live.
 *
 * Run: bun run scripts/backfill-tenant-identity.ts
 * Safe to re-run (upserts).
 */
import { createClient } from "@supabase/supabase-js";

import { gradeSubjects, grades } from "../src/lib/mock-data";
import { TENANT_ACCENT_COLORS } from "../src/lib/tenant-colors";

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing — check .env");
const supabase = createClient(url, serviceRoleKey);

async function backfillCenterIdentity() {
  const updates = [
    { id: "ctr-0001", accent_color: TENANT_ACCENT_COLORS[0].hex, slug: "elite-center" },
    { id: "ctr-isolation-test", accent_color: TENANT_ACCENT_COLORS[1].hex, slug: "isolation-test-center" },
    { id: "platform", accent_color: TENANT_ACCENT_COLORS[6].hex, slug: null },
  ];
  for (const u of updates) {
    const { error } = await supabase.from("centers").update({ accent_color: u.accent_color, slug: u.slug }).eq("id", u.id);
    if (error) throw new Error(`centers/${u.id}: ${error.message}`);
    console.log(`  ✓ centers/${u.id} -> accent_color=${u.accent_color} slug=${u.slug}`);
  }
}

/** New gd-7/8/9 (+ their grade_subjects) only existed in mock-data.ts, not yet in the live demo center. */
async function backfillNewGrades() {
  const newGrades = grades.filter((g) => g.order > 6).map((g) => ({ ...g, center_id: "ctr-0001" }));
  if (newGrades.length > 0) {
    const { error } = await supabase.from("grades").upsert(newGrades);
    if (error) throw new Error(`grades: ${error.message}`);
    console.log(`  ✓ grades (${newGrades.length} new)`);
  }

  const newGradeIds = new Set(newGrades.map((g) => g.id));
  const newGradeSubjects = gradeSubjects
    .filter((gs) => newGradeIds.has(gs.grade_id))
    .map((gs) => ({ ...gs, center_id: "ctr-0001" }));
  if (newGradeSubjects.length > 0) {
    const { error } = await supabase.from("grade_subjects").upsert(newGradeSubjects);
    if (error) throw new Error(`grade_subjects: ${error.message}`);
    console.log(`  ✓ grade_subjects (${newGradeSubjects.length} new)`);
  }
}

async function main() {
  console.log("Backfilling center accent_color/slug...");
  await backfillCenterIdentity();
  console.log("Backfilling gd-7/8/9 into ctr-0001...");
  await backfillNewGrades();
  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
