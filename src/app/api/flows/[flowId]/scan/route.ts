import { NextResponse } from "next/server";
import { getTenantId } from "@/lib/get-tenant";
import { getFlowById } from "@/lib/db";
import { processFlow } from "@/lib/agent-cycle";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ flowId: string }> }
) {
  const tenantId = await getTenantId();
  const { flowId } = await params;

  const flow = await getFlowById(flowId, tenantId);
  if (!flow) {
    return NextResponse.json({ error: "Flow not found" }, { status: 404 });
  }

  if (!flow.agent_config) {
    return NextResponse.json({ error: "Flow has no agent_config" }, { status: 400 });
  }

  const log = await processFlow(flowId, tenantId, flow.name);
  return NextResponse.json(log);
}
