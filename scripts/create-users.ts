import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { randomBytes } from "crypto";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2];
}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

// Shared household password (user can change per-account later).
const password = `Phoenix-${randomBytes(4).toString("hex")}`;

const emails = ["lloyd@phoenix.local", "milani@phoenix.local"];

async function main() {
  for (const email of emails) {
    const { error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // no verification email needed
    });
    console.log(error ? `${email}: ERROR — ${error.message}` : `${email}: created`);
  }
  console.log("\nPassword for both accounts:", password);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
