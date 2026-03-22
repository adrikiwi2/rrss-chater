import { NextResponse } from "next/server";
import { getTenantId } from "@/lib/get-tenant";
import { getFlowById, getAlertRulesForFlow, getAlertDestinationsForTenant, getAlertLogsForFlow } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ flowId: string }> }
) {
  const tenantId = await getTenantId();
  const { flowId } = await params;

  // Verify flow belongs to tenant
  const flow = await getFlowById(flowId, tenantId);
  if (!flow) {
    return NextResponse.json({ error: "Flow not found" }, { status: 404 });
  }

  const [rules, destinations, logs] = await Promise.all([
    getAlertRulesForFlow(tenantId, flowId),
    getAlertDestinationsForTenant(tenantId),
    getAlertLogsForFlow(tenantId, flowId, 20),
  ]);

  return NextResponse.json({ rules, destinations, logs });
}
