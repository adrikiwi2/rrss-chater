import { NextResponse } from "next/server";
import { getTenantId } from "@/lib/get-tenant";
import { getFlowById, setFlowPublished, getComposioConnectionByChannel } from "@/lib/db";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ flowId: string }> }
) {
  const tenantId = await getTenantId();
  const { flowId } = await params;
  const { published } = await request.json() as { published: boolean };

  const flow = await getFlowById(flowId, tenantId);
  if (!flow) {
    return NextResponse.json({ error: "Flow not found" }, { status: 404 });
  }

  // Validate before publishing
  if (published) {
    if (!flow.agent_config) {
      return NextResponse.json(
        { error: "Flow must have agent_config before publishing" },
        { status: 400 }
      );
    }
    if (flow.categories.length === 0) {
      return NextResponse.json(
        { error: "Flow must have at least one category" },
        { status: 400 }
      );
    }

    const agentConfig = JSON.parse(flow.agent_config);
    const channel = agentConfig.channel || "instagram";
    const conn = await getComposioConnectionByChannel(tenantId, channel);
    if (!conn) {
      return NextResponse.json(
        { error: `No connected ${channel} account. Ask admin to set up Composio connection.` },
        { status: 400 }
      );
    }
  }

  await setFlowPublished(flowId, tenantId, published);

  return NextResponse.json({ ok: true, is_published: published });
}
