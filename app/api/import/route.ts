import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { parseBankCsv, detectInstitution, Institution } from "@/lib/parse";
import { categoriseSync, MerchantRule } from "@/lib/categorise";

// Import one or more raw bank CSV exports (NAB or CBA — auto-detected).
// Rows are categorised with the deterministic engine, de-duplicated against
// existing rows, and inserted as pending_review for approval.
//
// Body: { files: { name: string; csv: string; institution?: "NAB"|"CBA" }[] }
export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    files: { name: string; csv: string; institution?: Institution }[];
  };
  if (!body?.files?.length) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: rules } = await supabase.from("merchant_rules").select("*");
  const merchantRules = (rules ?? []) as MerchantRule[];

  // Pull existing keys once for de-duplication (date|amount|detail|owner).
  const { data: existing } = await supabase
    .from("transactions")
    .select("date, amount, detail, owner");
  const seen = new Set(
    (existing ?? []).map((e) => `${e.date}|${e.amount}|${e.detail}|${e.owner}`)
  );

  const toInsert: any[] = [];
  const perFile: {
    name: string;
    institution: Institution;
    parsed: number;
    imported: number;
    skipped: number;
  }[] = [];

  for (const file of body.files) {
    const institution = file.institution ?? detectInstitution(file.csv);
    const rows = parseBankCsv(file.csv, institution);
    let added = 0;
    for (const r of rows) {
      const key = `${r.date}|${r.amount}|${r.detail}|${r.owner}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const s = categoriseSync(r.merchant, r.detail, merchantRules, r.bank_category);
      toInsert.push({
        date: r.date,
        amount: r.amount,
        owner: r.owner,
        transaction_type: r.transaction_type,
        detail: r.detail,
        merchant: r.merchant,
        category: s.category,
        sub_category: s.sub_category,
        type: s.type,
        status: "pending_review", // always — no silent auto-categorisation
        confidence: s.confidence,
        source: "bank_import",
      });
      added++;
    }
    perFile.push({ name: file.name, institution, parsed: rows.length, imported: added, skipped: rows.length - added });
  }

  if (toInsert.length === 0) {
    return NextResponse.json({ imported: 0, perFile, message: "No new transactions (all duplicates)." });
  }

  // Insert in batches to stay within payload limits.
  for (let i = 0; i < toInsert.length; i += 500) {
    const { error } = await supabase.from("transactions").insert(toInsert.slice(i, i + 500));
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ imported: toInsert.length, perFile });
}
