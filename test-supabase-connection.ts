import { getSupabaseAdmin } from "./src/lib/supabase-server";

async function main() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("centers").select("id, slug, name").limit(1);
    if (error) {
      console.error("DB ERROR:", error.message);
      process.exit(1);
    }
    console.log("OK — connected. Sample row:", data);
  } catch (e: any) {
    console.error("ERROR:", e.message);
    process.exit(1);
  }
}
main();
