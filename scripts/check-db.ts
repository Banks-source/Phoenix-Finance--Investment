import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

// Minimal .env.local loader (avoid extra deps).
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2];
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(url, service, { auth: { persistSession: false } });

async function main() {
  console.log("URL:", url);

  // 1. Do the core tables exist?
  for (const t of ["transactions", "categories", "accounts", "merchant_rules"]) {
    const { count, error } = await admin.from(t).select("id", { count: "exact", head: true });
    console.log(
      `table ${t}:`,
      error ? `MISSING/ERROR — ${error.message}` : `ok (${count ?? 0} rows)`
    );
  }

  // 2. Existing auth users?
  const { data, error } = await admin.auth.admin.listUsers();
  if (error) console.log("auth listUsers error:", error.message);
  else console.log("auth users:", data.users.map((u) => u.email).join(", ") || "(none)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
