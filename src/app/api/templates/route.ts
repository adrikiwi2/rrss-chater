import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { createTemplate } from "@/lib/db";
import { getTenantId } from "@/lib/get-tenant";

export async function POST(request: Request) {
  const tenantId = await getTenantId();
  const body = await request.json();
  const { flow_id, name, body: templateBody, category_id } = body;

  if (!flow_id || !name || templateBody == null) {
    return NextResponse.json(
      { error: "flow_id, name, and body are required" },
      { status: 400 }
    );
  }

  const template = await createTemplate(
    { id: nanoid(), flow_id, name, body: templateBody, category_id },
    tenantId
  );
  if (!template) {
    return NextResponse.json({ error: "Flow not found" }, { status: 404 });
  }
  return NextResponse.json(template, { status: 201 });
}
