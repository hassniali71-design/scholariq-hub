/**
 * One-time: creates the real platform-operator account (email-based identifier, used by the
 * new /platform/login page) alongside the existing placeholder PLATFORM-ADMIN account — this
 * doesn't remove that one, just adds the real one requested.
 *
 * Run: bun run scripts/create-platform-owner.ts
 */
import { randomBytes } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing — check .env");
const supabase = createClient(url, serviceRoleKey);

function generateStrongPassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%^&*-_+=";
  const all = upper + lower + digits + symbols;

  const pick = (chars: string) => chars[randomBytes(1)[0]! % chars.length]!;
  const required = [pick(upper), pick(lower), pick(digits), pick(symbols)];
  const rest = Array.from({ length: 12 }, () => pick(all));
  const combined = [...required, ...rest];
  // Fisher-Yates shuffle so the required chars aren't always in the first 4 positions.
  for (let i = combined.length - 1; i > 0; i--) {
    const j = randomBytes(1)[0]! % (i + 1);
    [combined[i], combined[j]] = [combined[j]!, combined[i]!];
  }
  return combined.join("");
}

async function main() {
  const email = "hassniali71@gmail.com";
  const password = generateStrongPassword();

  const { error } = await supabase.from("accounts").upsert(
    {
      id: "acc-platform-owner-real",
      center_id: "platform",
      role: "owner",
      full_name: "مدير المنصة",
      phone: null,
      identifier: email,
      password,
      created_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  if (error) throw new Error(error.message);

  console.log("Platform login created at /platform/login");
  console.log(`  Email:    ${email}`);
  console.log(`  Password: ${password}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
