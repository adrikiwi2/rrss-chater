import { NextResponse } from "next/server";
import { getTenantId } from "@/lib/get-tenant";
import { getFlowById, getLeadsByFlow } from "@/lib/db";
import { createClient } from "@libsql/client";

function db() {
  return createClient({
    url: process.env.TURSO_DATABASE_URL || "file:flowlab.db",
    authToken: process.env.TURSO_AUTH_TOKEN || undefined,
  });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ flowId: string }> }
) {
  const tenantId = await getTenantId();
  const { flowId } = await params;

  const flow = await getFlowById(flowId, tenantId);
  if (!flow) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const leads = await getLeadsByFlow(flowId);

  // Stages from agent_config or default
  let stages: string[] = ["new"];
  if (flow.agent_config) {
    try {
      const cfg = JSON.parse(flow.agent_config as string);
      if (Array.isArray(cfg.stages)) stages = cfg.stages;
    } catch {
      /* ignore */
    }
  }

  // Heatmap: messages per day-of-week × hour for this flow
  // strftime('%w') = 0 Sunday … 6 Saturday
  const c = db();
  const heatmapRs = await c.execute({
    sql: `
      SELECT
        strftime('%w', m.received_at) AS dow,
        strftime('%H', m.received_at) AS hour,
        COUNT(*) AS cnt
      FROM messages m
      JOIN leads l ON l.id = m.lead_id
      WHERE l.flow_id = ?
        AND m.direction = 'inbound'
      GROUP BY dow, hour
    `,
    args: [flowId],
  });

  // Build heatmap map: dow (0-6) → hour (0-23) → count
  const heatmap: Record<string, Record<string, number>> = {};
  for (const row of heatmapRs.rows) {
    const dow = String(row.dow);
    const hour = String(parseInt(String(row.hour)));
    if (!heatmap[dow]) heatmap[dow] = {};
    heatmap[dow][hour] = Number(row.cnt);
  }

  // Total messages
  const totalMsgRs = await c.execute({
    sql: `SELECT COUNT(*) AS cnt FROM messages m JOIN leads l ON l.id = m.lead_id WHERE l.flow_id = ?`,
    args: [flowId],
  });
  const totalMessages = Number(totalMsgRs.rows[0]?.cnt ?? 0);

  const stats = {
    total_leads: leads.length,
    needs_human: leads.filter((l) => l.needs_human).length,
    active: leads.filter((l) => !l.needs_human).length,
    total_messages: totalMessages,
  };

  return NextResponse.json({ leads, stages, heatmap, stats });
}
