import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import { createServiceClient } from "@/lib/supabase/server";
import { resolveOwner, resolveType } from "@/lib/taxonomy";
import { categoriseTransaction, MerchantRule } from "@/lib/categorise";

// Handles new NAB/CBA CSV exports going forward. Raw bank exports don't
// include Category/Sub Category/Merchant — this route runs the
// categorisation engine and always lands new rows as pending_review.
export async function POST(req: NextRequest) {
  const { csv, institution } = (await req.json()) as { csv: string; institution: "NAB" | "CBA" };
  const supabase = createServiceClient();

  const { data: rules } = await supabase.from("merchant_rules").select("*");
  const parsed = Papa.parse(csv, { header: true, skipEmptyLines: true });

  const owner = resolveOwner(institution);
  const inserted = [];

  for (const row of parsed.data as Record<string, string>[]) {
    const merchant = row["Merchant"] || row["Detail"] || row["Transaction Details"] || "";
    const amount = parseFloat(row["Amount"] ?? "0");
    const detail = row["Detail"] || row["Transaction Details"] || "";

    const suggestion = await categoriseTransaction(merchant, detail, amount, (rules ?? []) as MerchantRule[]);

    inserted.push({
      date: row["Date"],
      amount,
      owner,
      transaction_type: row["Transaction Type"] ?? "",
      detail,
      merchant,
      category: suggestion.category,
      sub_category: suggestion.sub_category,
      type: resolveType(suggestion.category, suggestion.sub_category ?? undefined),
      status: "pending_review", // always — no silent auto-categorisation
      confidence: suggestion.confidence,
      source: "bank_import",
    });
  }

  const { error } = await supabase.from("transactions").insert(inserted);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ imported: inserted.length });
}
