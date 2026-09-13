import { NextRequest, NextResponse } from "next/server";
import { CATEGORIES } from "@/lib/taxonomy";
import { createAlertRule, setAlertRuleEnabled, deleteAlertRule } from "@/lib/alertRules";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    category?: string;
    channel?: "email" | "sms";
    destination?: string;
    threshold_pct?: number;
  };
  if (!body.category || !CATEGORIES.some((c) => c.name === body.category)) {
    return NextResponse.json({ error: "Unknown category" }, { status: 400 });
  }
  if (body.channel !== "email" && body.channel !== "sms") {
    return NextResponse.json({ error: "channel must be email or sms" }, { status: 400 });
  }
  if (!body.destination?.trim()) {
    return NextResponse.json({ error: "destination is required" }, { status: 400 });
  }
  const threshold = body.threshold_pct ?? 100;
  if (!Number.isFinite(threshold) || threshold <= 0) {
    return NextResponse.json({ error: "threshold_pct must be a positive number" }, { status: 400 });
  }

  const result = await createAlertRule({
    category: body.category,
    channel: body.channel,
    destination: body.destination.trim(),
    threshold_pct: threshold,
  });
  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  const body = (await req.json()) as { id?: string; enabled?: boolean };
  if (!body.id || typeof body.enabled !== "boolean") {
    return NextResponse.json({ error: "id and enabled are required" }, { status: 400 });
  }
  const result = await setAlertRuleEnabled(body.id, body.enabled);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const body = (await req.json()) as { id?: string };
  if (!body.id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  const result = await deleteAlertRule(body.id);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json({ ok: true });
}
