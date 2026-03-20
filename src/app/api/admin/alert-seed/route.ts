import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import {
  getTenantByEmailRaw,
  getFlowByName,
  countAlertRulesByFlow,
  createAlertDestination,
  createAlertRule,
} from "@/lib/db";

function verifyAdmin(request: Request): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/**
 * POST /api/admin/alert-seed
 *
 * Inserts alert_destinations + alert_rules for a tenant+flow.
 * Idempotent: returns error if rules already exist for that flow.
 *
 * Body:
 * {
 *   "tenant_email": "ibero@test.com",
 *   "flow_name": "Leads Organicos",
 *   "groups": {
 *     "logs":        { "jid": "xxx@g.us", "name": "Logs Admin" },
 *     "needs_human": { "jid": "yyy@g.us", "name": "RRSS Needs Human" },
 *     "comerciales": { "jid": "zzz@g.us", "name": "Comerciales Ibero" }
 *   }
 * }
 *
 * All three groups can point to the same JID for initial testing.
 */
export async function POST(request: Request) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { tenant_email, flow_name, groups } = body as {
    tenant_email: string;
    flow_name: string;
    groups: Record<string, { jid: string; name?: string }>;
  };

  if (!tenant_email || !flow_name || !groups) {
    return NextResponse.json({ error: "tenant_email, flow_name, groups required" }, { status: 400 });
  }

  // Resolve tenant
  const tenantRow = await getTenantByEmailRaw(tenant_email);
  if (!tenantRow) {
    return NextResponse.json({ error: `Tenant not found: ${tenant_email}` }, { status: 404 });
  }
  const tenantId = tenantRow.id;

  // Resolve flow
  const flow = await getFlowByName(tenantId, flow_name);
  if (!flow) {
    return NextResponse.json({ error: `Flow not found: "${flow_name}" for tenant ${tenant_email}` }, { status: 404 });
  }
  const flowId = flow.id;

  // Idempotency check
  const existingCount = await countAlertRulesByFlow(flowId);
  if (existingCount > 0) {
    return NextResponse.json({
      ok: false,
      message: `Flow already has ${existingCount} alert rule(s). Delete them first to re-seed.`,
      tenant_id: tenantId,
      flow_id: flowId,
    });
  }

  const created = { destinations: [] as string[], rules: [] as string[] };

  async function addDest(key: string, defaultName: string) {
    const g = groups[key];
    if (!g?.jid) throw new Error(`Missing jid for group: ${key}`);
    const id = nanoid();
    await createAlertDestination({
      id,
      tenant_id: tenantId,
      name: g.name || defaultName,
      provider: "whatsapp",
      config: JSON.stringify({ jid: g.jid }),
    });
    created.destinations.push(id);
    return id;
  }

  async function addRule(destId: string, eventType: string, template: string) {
    const id = nanoid();
    await createAlertRule({ id, tenant_id: tenantId, flow_id: flowId, event_type: eventType, template, destination_id: destId });
    created.rules.push(id);
  }

  // 1. Logs Admin — inference.executed + message.sent
  const logsDestId = await addDest("logs", "Logs Admin");
  await addRule(
    logsDestId,
    "inference.executed",
    "🤖 *{{flow_name}}* → {{lead_name}}\n🔄 Categoría: {{category}}\n─────────────────\n🕒 {{time}}"
  );
  await addRule(
    logsDestId,
    "message.sent",
    "📤 *Mensaje encolado* → {{lead_name}}\n📋 {{flow_name}} · {{action}}\n─────────────────\n🕒 {{time}}"
  );

  // 2. RRSS — needs_human
  const rrssDestId = await addDest("needs_human", "RRSS Needs Human");
  await addRule(
    rrssDestId,
    "needs_human",
    "🚨 *NECESITA ATENCIÓN HUMANA*\n👤 Lead: {{lead_name}}\n⚠️ Motivo: {{needs_human_reason}}\n📋 Flow: {{flow_name}}\n─────────────────\n🕒 {{time}}"
  );

  // 3. Comerciales — lead.qualified
  const comercialesDestId = await addDest("comerciales", "Comerciales Ibero");
  await addRule(
    comercialesDestId,
    "lead.qualified",
    "🟢 *NUEVO LEAD CUALIFICADO*\n👤 {{lead_name}}\n📱 Tel: {{telefono}}\n📧 Email: {{email}}\n📍 {{ubicacion}}\n🏢 Tipo: {{tipo_negocio}}\n🛒 Interés: {{productos_interes}}\n🏷️ Cat: {{category_name}}\n─────────────────\n🕒 {{time}}"
  );

  return NextResponse.json({
    ok: true,
    tenant_id: tenantId,
    flow_id: flowId,
    created,
  }, { status: 201 });
}
