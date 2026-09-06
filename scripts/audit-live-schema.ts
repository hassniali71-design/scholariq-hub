/**
 * Schema audit harness — pulls the live Supabase table definitions via the Management API
 * (SUPABASE_ACCESS_TOKEN in .env) and prints them as a compact table list for comparison
 * against the migration files in supabase/migrations/ and db/.
 */
import fs from "node:fs";

const envPath = "C:\\Users\\almnara\\Downloads\\مشروع السنتر\\scholariq-hub\\.env";
const envText = fs.readFileSync(envPath, "utf8");
function readEnv(key: string): string {
  const m = new RegExp(`^${key}=(.*)$`, "m").exec(envText);
  return m?.[1]?.trim() ?? "";
}

const accessToken = readEnv("SUPABASE_ACCESS_TOKEN");
if (!accessToken) throw new Error("SUPABASE_ACCESS_TOKEN missing from .env");

const ref = "kpssxczlhczbbqdwgcuf";
const API = `https://api.supabase.com/v1/projects/${ref}/database/query`;

async function runQuery(query: string): Promise<any[]> {
  const res = await fetch(API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`query failed (${res.status}): ${body.slice(0, 500)}`);
  }
  return res.json();
}

interface ColRow {
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable: "YES" | "NO";
  column_default: string | null;
  is_identity: "YES" | "NO";
}

const cols = (await runQuery(
  `select table_name, column_name, data_type, is_nullable, column_default, is_identity
   from information_schema.columns
   where table_schema = 'public'
   order by table_name, ordinal_position`,
)) as ColRow[];

const byTable = new Map<string, ColRow[]>();
for (const c of cols) {
  const arr = byTable.get(c.table_name) ?? [];
  arr.push(c);
  byTable.set(c.table_name, arr);
}

const tableNames = [...byTable.keys()].sort();
console.log("TOTAL PUBLIC TABLES:", tableNames.length);
for (const t of tableNames) {
  const seen = new Set<string>();
  const clean = byTable
    .get(t)!
    .filter((c) => {
      if (seen.has(c.column_name)) return false;
      seen.add(c.column_name);
      return true;
    });
  console.log(`\n### ${t} (${clean.length})`);
  for (const c of clean) {
    console.log(
      `  ${c.column_name}  ${c.data_type}${c.is_nullable === "YES" ? "" : " NOT NULL"}${c.is_identity === "YES" ? " IDENTITY" : ""}${c.column_default ? " = " + c.column_default.replace(/\s+/g, " ").slice(0, 40) : ""}`,
    );
  }
}