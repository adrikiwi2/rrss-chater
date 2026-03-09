import { NextResponse } from "next/server";
import { getTenantId } from "@/lib/get-tenant";
import { getFlowById, getLeadsByFlow } from "@/lib/db";

export async function GET(request: Request) {
  const tenantId = await getTenantId();
  const { searchParams } = new URL(request.url);
  const flowId = searchParams.get("flow_id");

  if (!flowId) {
    return NextResponse.json({ error: "flow_id required" }, { status: 400 });
  }

  const flow = await getFlowById(flowId, tenantId);
  if (!flow) {
    return NextResponse.json({ error: "Flow not found" }, { status: 404 });
  }

  const leads = await getLeadsByFlow(flowId);
  return NextResponse.json(leads);
}
