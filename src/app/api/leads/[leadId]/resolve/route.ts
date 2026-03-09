import { NextResponse } from "next/server";
import { getTenantId } from "@/lib/get-tenant";
import { resolveLead } from "@/lib/db";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ leadId: string }> }
) {
  const tenantId = await getTenantId();
  const { leadId } = await params;
  const { stage } = (await request.json()) as { stage: string };

  if (!stage) {
    return NextResponse.json({ error: "stage required" }, { status: 400 });
  }

  const ok = await resolveLead(leadId, stage, tenantId);
  if (!ok) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, stage });
}
