import { createClient, type Client } from "@libsql/client";
import type {
  Flow,
  Tenant,
  Category,
  ExtractField,
  Template,
  Simulation,
  FlowWithDetails,
} from "./types";
import type { ComposioConnection } from "./composio";

let client: Client | null = null;

function getClient(): Client {
  if (!client) {
    client = createClient({
      url: process.env.TURSO_DATABASE_URL || "file:flowlab.db",
      authToken: process.env.TURSO_AUTH_TOKEN || undefined,
    });
  }
  return client;
}

export async function initSchema() {
  const db = getClient();
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS tenants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS flows (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id),
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      system_prompt TEXT DEFAULT '',
      role_a_label TEXT DEFAULT 'Company',
      role_b_label TEXT DEFAULT 'Prospect',
      agent_config TEXT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      flow_id TEXT NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      color TEXT DEFAULT '#6366f1',
      rules TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS extract_fields (
      id TEXT PRIMARY KEY,
      flow_id TEXT NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
      field_name TEXT NOT NULL,
      field_type TEXT DEFAULT 'text',
      description TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      flow_id TEXT NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
      category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS simulations (
      id TEXT PRIMARY KEY,
      flow_id TEXT NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
      title TEXT DEFAULT '',
      messages_json TEXT DEFAULT '[]',
      last_result_json TEXT DEFAULT NULL,
      detected_status TEXT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Agent tables: leads, messages, conversation state, outbox, events

    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id),
      flow_id TEXT NOT NULL REFERENCES flows(id),
      channel TEXT NOT NULL,
      platform_handle TEXT NOT NULL,
      display_name TEXT DEFAULT '',
      stage TEXT DEFAULT 'new',
      owner TEXT DEFAULT 'bot',
      needs_human INTEGER DEFAULT 0,
      needs_human_reason TEXT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL REFERENCES leads(id),
      direction TEXT NOT NULL,
      text TEXT NOT NULL,
      message_type TEXT DEFAULT 'text',
      platform_message_id TEXT,
      detected_status TEXT DEFAULT NULL,
      needs_human INTEGER DEFAULT 0,
      suggested_template_id TEXT DEFAULT NULL,
      inference_result_json TEXT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      received_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS conversation_state (
      lead_id TEXT PRIMARY KEY REFERENCES leads(id),
      stage TEXT DEFAULT 'new',
      flags_json TEXT DEFAULT '{}',
      interaction_count INTEGER DEFAULT 0,
      last_inbound_at DATETIME DEFAULT NULL,
      last_outbound_at DATETIME DEFAULT NULL,
      last_processed_msg_id TEXT DEFAULT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS outbox (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL REFERENCES leads(id),
      channel TEXT NOT NULL,
      action TEXT NOT NULL,
      payload_json TEXT NOT NULL DEFAULT '{}',
      status TEXT DEFAULT 'pending',
      attempts INTEGER DEFAULT 0,
      last_error TEXT DEFAULT NULL,
      idempotency_key TEXT UNIQUE,
      next_attempt_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS lead_events (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL REFERENCES leads(id),
      event_type TEXT NOT NULL,
      actor TEXT DEFAULT 'bot',
      from_stage TEXT DEFAULT NULL,
      to_stage TEXT DEFAULT NULL,
      meta_json TEXT DEFAULT '{}',
      event_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS composio_connections (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL REFERENCES tenants(id),
      channel TEXT NOT NULL,
      composio_account_id TEXT NOT NULL,
      composio_user_id TEXT NOT NULL,
      platform_user_id TEXT DEFAULT NULL,
      platform_username TEXT DEFAULT NULL,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_composio_conn_tenant ON composio_connections(tenant_id, channel);
    CREATE INDEX IF NOT EXISTS idx_leads_tenant_flow ON leads(tenant_id, flow_id);
    CREATE INDEX IF NOT EXISTS idx_leads_needs_human ON leads(tenant_id, needs_human);
    CREATE INDEX IF NOT EXISTS idx_messages_lead ON messages(lead_id, received_at);
    CREATE INDEX IF NOT EXISTS idx_messages_platform ON messages(platform_message_id);
    CREATE INDEX IF NOT EXISTS idx_outbox_status ON outbox(status, next_attempt_at);
    CREATE INDEX IF NOT EXISTS idx_lead_events_lead ON lead_events(lead_id, event_at);
  `);

  // Safe migrations for existing databases
  const migrations = [
    "ALTER TABLE flows ADD COLUMN agent_config TEXT DEFAULT NULL",
    "ALTER TABLE flows ADD COLUMN is_published INTEGER DEFAULT 0",
  ];
  for (const sql of migrations) {
    try { await db.execute(sql); } catch { /* column already exists */ }
  }
}

let schemaReady: Promise<void> | null = null;

async function db() {
  if (!schemaReady) {
    schemaReady = initSchema();
  }
  await schemaReady;
  return getClient();
}

// --- Tenants ---

export async function getTenantByEmail(email: string): Promise<Tenant | null> {
  const c = await db();
  const rs = await c.execute({ sql: "SELECT * FROM tenants WHERE email = ?", args: [email] });
  return (rs.rows[0] as unknown as Tenant) ?? null;
}

export async function getTenantById(id: string): Promise<Tenant | null> {
  const c = await db();
  const rs = await c.execute({ sql: "SELECT * FROM tenants WHERE id = ?", args: [id] });
  return (rs.rows[0] as unknown as Tenant) ?? null;
}

export async function createTenant(data: {
  id: string;
  name: string;
  email: string;
  password_hash: string;
}): Promise<Tenant> {
  const c = await db();
  await c.execute({
    sql: "INSERT INTO tenants (id, name, email, password_hash) VALUES (?, ?, ?, ?)",
    args: [data.id, data.name, data.email, data.password_hash],
  });
  const rs = await c.execute({ sql: "SELECT * FROM tenants WHERE id = ?", args: [data.id] });
  return rs.rows[0] as unknown as Tenant;
}

// --- Flows ---

export async function getAllFlows(
  tenantId: string
): Promise<(Flow & { category_count: number; simulation_count: number })[]> {
  const c = await db();
  const rs = await c.execute({
    sql: `SELECT f.*,
      (SELECT COUNT(*) FROM categories WHERE flow_id = f.id) as category_count,
      (SELECT COUNT(*) FROM simulations WHERE flow_id = f.id) as simulation_count
    FROM flows f WHERE f.tenant_id = ? ORDER BY f.updated_at DESC`,
    args: [tenantId],
  });
  return rs.rows as unknown as (Flow & { category_count: number; simulation_count: number })[];
}

export async function getFlowById(id: string, tenantId: string): Promise<FlowWithDetails | null> {
  const c = await db();
  const flowRs = await c.execute({
    sql: "SELECT * FROM flows WHERE id = ? AND tenant_id = ?",
    args: [id, tenantId],
  });
  const flow = flowRs.rows[0] as unknown as Flow | undefined;
  if (!flow) return null;

  const [catRs, fieldRs, tplRs] = await Promise.all([
    c.execute({
      sql: "SELECT * FROM categories WHERE flow_id = ? ORDER BY sort_order, created_at",
      args: [id],
    }),
    c.execute({ sql: "SELECT * FROM extract_fields WHERE flow_id = ?", args: [id] }),
    c.execute({ sql: "SELECT * FROM templates WHERE flow_id = ? ORDER BY created_at", args: [id] }),
  ]);

  return {
    ...flow,
    categories: catRs.rows as unknown as Category[],
    extract_fields: fieldRs.rows as unknown as ExtractField[],
    templates: tplRs.rows as unknown as Template[],
  };
}

export async function createFlow(
  data: { id: string; name: string; description?: string },
  tenantId: string
): Promise<Flow> {
  const c = await db();
  await c.execute({
    sql: "INSERT INTO flows (id, tenant_id, name, description) VALUES (?, ?, ?, ?)",
    args: [data.id, tenantId, data.name, data.description || ""],
  });
  const rs = await c.execute({ sql: "SELECT * FROM flows WHERE id = ?", args: [data.id] });
  return rs.rows[0] as unknown as Flow;
}

export async function updateFlow(
  id: string,
  data: Partial<Pick<Flow, "name" | "description" | "system_prompt" | "role_a_label" | "role_b_label">>,
  tenantId: string
): Promise<Flow | null> {
  const c = await db();
  const fields: string[] = [];
  const values: (string | number)[] = [];

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      fields.push(`${key} = ?`);
      values.push(value as string);
    }
  }
  if (fields.length === 0) return getFlowById(id, tenantId) as unknown as Flow;

  fields.push("updated_at = CURRENT_TIMESTAMP");
  values.push(id, tenantId);
  await c.execute({
    sql: `UPDATE flows SET ${fields.join(", ")} WHERE id = ? AND tenant_id = ?`,
    args: values,
  });
  const rs = await c.execute({ sql: "SELECT * FROM flows WHERE id = ? AND tenant_id = ?", args: [id, tenantId] });
  return (rs.rows[0] as unknown as Flow) ?? null;
}

export async function deleteFlow(id: string, tenantId: string): Promise<boolean> {
  const c = await db();
  const rs = await c.execute({
    sql: "DELETE FROM flows WHERE id = ? AND tenant_id = ?",
    args: [id, tenantId],
  });
  return rs.rowsAffected > 0;
}

// --- Categories ---

export async function createCategory(
  data: { id: string; flow_id: string; name: string; color?: string; rules?: string },
  tenantId: string
): Promise<Category | null> {
  const c = await db();
  // Verify flow belongs to tenant
  const check = await c.execute({
    sql: "SELECT id FROM flows WHERE id = ? AND tenant_id = ?",
    args: [data.flow_id, tenantId],
  });
  if (check.rows.length === 0) return null;

  const maxRs = await c.execute({
    sql: "SELECT COALESCE(MAX(sort_order), -1) as max_order FROM categories WHERE flow_id = ?",
    args: [data.flow_id],
  });
  const maxOrder = (maxRs.rows[0] as unknown as { max_order: number }).max_order;

  await c.execute({
    sql: "INSERT INTO categories (id, flow_id, name, color, rules, sort_order) VALUES (?, ?, ?, ?, ?, ?)",
    args: [data.id, data.flow_id, data.name, data.color || "#6366f1", data.rules || "", maxOrder + 1],
  });
  const rs = await c.execute({ sql: "SELECT * FROM categories WHERE id = ?", args: [data.id] });
  return rs.rows[0] as unknown as Category;
}

export async function updateCategory(
  id: string,
  data: Partial<Pick<Category, "name" | "color" | "rules" | "sort_order">>,
  tenantId: string
): Promise<Category | null> {
  const c = await db();
  // Verify ownership
  const check = await c.execute({
    sql: "SELECT id FROM categories WHERE id = ? AND flow_id IN (SELECT id FROM flows WHERE tenant_id = ?)",
    args: [id, tenantId],
  });
  if (check.rows.length === 0) return null;

  const fields: string[] = [];
  const values: (string | number)[] = [];

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      fields.push(`${key} = ?`);
      values.push(value as string | number);
    }
  }
  if (fields.length === 0) {
    const rs = await c.execute({ sql: "SELECT * FROM categories WHERE id = ?", args: [id] });
    return rs.rows[0] as unknown as Category;
  }

  values.push(id);
  await c.execute({ sql: `UPDATE categories SET ${fields.join(", ")} WHERE id = ?`, args: values });
  await c.execute({
    sql: "UPDATE flows SET updated_at = CURRENT_TIMESTAMP WHERE id = (SELECT flow_id FROM categories WHERE id = ?)",
    args: [id],
  });
  const rs = await c.execute({ sql: "SELECT * FROM categories WHERE id = ?", args: [id] });
  return rs.rows[0] as unknown as Category;
}

export async function deleteCategory(id: string, tenantId: string): Promise<boolean> {
  const c = await db();
  const rs = await c.execute({
    sql: "DELETE FROM categories WHERE id = ? AND flow_id IN (SELECT id FROM flows WHERE tenant_id = ?)",
    args: [id, tenantId],
  });
  return rs.rowsAffected > 0;
}

// --- Extract Fields ---

export async function createExtractField(
  data: { id: string; flow_id: string; field_name: string; field_type?: string; description?: string },
  tenantId: string
): Promise<ExtractField | null> {
  const c = await db();
  const check = await c.execute({
    sql: "SELECT id FROM flows WHERE id = ? AND tenant_id = ?",
    args: [data.flow_id, tenantId],
  });
  if (check.rows.length === 0) return null;

  await c.execute({
    sql: "INSERT INTO extract_fields (id, flow_id, field_name, field_type, description) VALUES (?, ?, ?, ?, ?)",
    args: [data.id, data.flow_id, data.field_name, data.field_type || "text", data.description || ""],
  });
  const rs = await c.execute({ sql: "SELECT * FROM extract_fields WHERE id = ?", args: [data.id] });
  return rs.rows[0] as unknown as ExtractField;
}

export async function updateExtractField(
  id: string,
  data: Partial<Pick<ExtractField, "field_name" | "field_type" | "description">>,
  tenantId: string
): Promise<ExtractField | null> {
  const c = await db();
  const check = await c.execute({
    sql: "SELECT id FROM extract_fields WHERE id = ? AND flow_id IN (SELECT id FROM flows WHERE tenant_id = ?)",
    args: [id, tenantId],
  });
  if (check.rows.length === 0) return null;

  const fields: string[] = [];
  const values: (string | number)[] = [];

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      fields.push(`${key} = ?`);
      values.push(value as string);
    }
  }
  if (fields.length === 0) {
    const rs = await c.execute({ sql: "SELECT * FROM extract_fields WHERE id = ?", args: [id] });
    return rs.rows[0] as unknown as ExtractField;
  }

  values.push(id);
  await c.execute({ sql: `UPDATE extract_fields SET ${fields.join(", ")} WHERE id = ?`, args: values });
  const rs = await c.execute({ sql: "SELECT * FROM extract_fields WHERE id = ?", args: [id] });
  return rs.rows[0] as unknown as ExtractField;
}

export async function deleteExtractField(id: string, tenantId: string): Promise<boolean> {
  const c = await db();
  const rs = await c.execute({
    sql: "DELETE FROM extract_fields WHERE id = ? AND flow_id IN (SELECT id FROM flows WHERE tenant_id = ?)",
    args: [id, tenantId],
  });
  return rs.rowsAffected > 0;
}

// --- Templates ---

export async function createTemplate(
  data: { id: string; flow_id: string; category_id?: string | null; name: string; body: string },
  tenantId: string
): Promise<Template | null> {
  const c = await db();
  const check = await c.execute({
    sql: "SELECT id FROM flows WHERE id = ? AND tenant_id = ?",
    args: [data.flow_id, tenantId],
  });
  if (check.rows.length === 0) return null;

  await c.execute({
    sql: "INSERT INTO templates (id, flow_id, category_id, name, body) VALUES (?, ?, ?, ?, ?)",
    args: [data.id, data.flow_id, data.category_id || null, data.name, data.body],
  });
  const rs = await c.execute({ sql: "SELECT * FROM templates WHERE id = ?", args: [data.id] });
  return rs.rows[0] as unknown as Template;
}

export async function updateTemplate(
  id: string,
  data: Partial<Pick<Template, "name" | "body" | "category_id">>,
  tenantId: string
): Promise<Template | null> {
  const c = await db();
  const check = await c.execute({
    sql: "SELECT id FROM templates WHERE id = ? AND flow_id IN (SELECT id FROM flows WHERE tenant_id = ?)",
    args: [id, tenantId],
  });
  if (check.rows.length === 0) return null;

  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      fields.push(`${key} = ?`);
      values.push(value as string | null);
    }
  }
  if (fields.length === 0) {
    const rs = await c.execute({ sql: "SELECT * FROM templates WHERE id = ?", args: [id] });
    return rs.rows[0] as unknown as Template;
  }

  values.push(id);
  await c.execute({ sql: `UPDATE templates SET ${fields.join(", ")} WHERE id = ?`, args: values });
  const rs = await c.execute({ sql: "SELECT * FROM templates WHERE id = ?", args: [id] });
  return rs.rows[0] as unknown as Template;
}

export async function deleteTemplate(id: string, tenantId: string): Promise<boolean> {
  const c = await db();
  const rs = await c.execute({
    sql: "DELETE FROM templates WHERE id = ? AND flow_id IN (SELECT id FROM flows WHERE tenant_id = ?)",
    args: [id, tenantId],
  });
  return rs.rowsAffected > 0;
}

// --- Simulations ---

export async function getSimulationsByFlow(flowId: string, tenantId: string): Promise<Simulation[]> {
  const c = await db();
  // Verify flow belongs to tenant
  const check = await c.execute({
    sql: "SELECT id FROM flows WHERE id = ? AND tenant_id = ?",
    args: [flowId, tenantId],
  });
  if (check.rows.length === 0) return [];

  const rs = await c.execute({
    sql: "SELECT * FROM simulations WHERE flow_id = ? ORDER BY updated_at DESC",
    args: [flowId],
  });
  return rs.rows as unknown as Simulation[];
}

export async function getSimulationById(id: string, tenantId: string): Promise<Simulation | null> {
  const c = await db();
  const rs = await c.execute({
    sql: "SELECT * FROM simulations WHERE id = ? AND flow_id IN (SELECT id FROM flows WHERE tenant_id = ?)",
    args: [id, tenantId],
  });
  return (rs.rows[0] as unknown as Simulation) ?? null;
}

export async function createSimulation(
  data: { id: string; flow_id: string; title?: string },
  tenantId: string
): Promise<Simulation | null> {
  const c = await db();
  const check = await c.execute({
    sql: "SELECT id FROM flows WHERE id = ? AND tenant_id = ?",
    args: [data.flow_id, tenantId],
  });
  if (check.rows.length === 0) return null;

  await c.execute({
    sql: "INSERT INTO simulations (id, flow_id, title) VALUES (?, ?, ?)",
    args: [data.id, data.flow_id, data.title || ""],
  });
  const rs = await c.execute({ sql: "SELECT * FROM simulations WHERE id = ?", args: [data.id] });
  return rs.rows[0] as unknown as Simulation;
}

export async function updateSimulation(
  id: string,
  data: Partial<Pick<Simulation, "title" | "messages_json" | "last_result_json" | "detected_status">>,
  tenantId: string
): Promise<Simulation | null> {
  const c = await db();
  const check = await c.execute({
    sql: "SELECT id FROM simulations WHERE id = ? AND flow_id IN (SELECT id FROM flows WHERE tenant_id = ?)",
    args: [id, tenantId],
  });
  if (check.rows.length === 0) return null;

  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      fields.push(`${key} = ?`);
      values.push(value as string | null);
    }
  }
  if (fields.length === 0) {
    const rs = await c.execute({ sql: "SELECT * FROM simulations WHERE id = ?", args: [id] });
    return rs.rows[0] as unknown as Simulation;
  }

  fields.push("updated_at = CURRENT_TIMESTAMP");
  values.push(id);
  await c.execute({ sql: `UPDATE simulations SET ${fields.join(", ")} WHERE id = ?`, args: values });
  const rs = await c.execute({ sql: "SELECT * FROM simulations WHERE id = ?", args: [id] });
  return rs.rows[0] as unknown as Simulation;
}

export async function deleteSimulation(id: string, tenantId: string): Promise<boolean> {
  const c = await db();
  const rs = await c.execute({
    sql: "DELETE FROM simulations WHERE id = ? AND flow_id IN (SELECT id FROM flows WHERE tenant_id = ?)",
    args: [id, tenantId],
  });
  return rs.rowsAffected > 0;
}

// --- Composio Connections ---

export async function getComposioConnections(tenantId: string): Promise<ComposioConnection[]> {
  const c = await db();
  const rs = await c.execute({
    sql: "SELECT * FROM composio_connections WHERE tenant_id = ? AND is_active = 1 ORDER BY created_at DESC",
    args: [tenantId],
  });
  return rs.rows as unknown as ComposioConnection[];
}

export async function getComposioConnectionByChannel(
  tenantId: string,
  channel: string
): Promise<ComposioConnection | null> {
  const c = await db();
  const rs = await c.execute({
    sql: "SELECT * FROM composio_connections WHERE tenant_id = ? AND channel = ? AND is_active = 1 LIMIT 1",
    args: [tenantId, channel],
  });
  return (rs.rows[0] as unknown as ComposioConnection) ?? null;
}

export async function createComposioConnection(data: {
  id: string;
  tenant_id: string;
  channel: string;
  composio_account_id: string;
  composio_user_id: string;
  platform_user_id?: string;
  platform_username?: string;
}): Promise<ComposioConnection> {
  const c = await db();
  await c.execute({
    sql: `INSERT INTO composio_connections (id, tenant_id, channel, composio_account_id, composio_user_id, platform_user_id, platform_username)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [
      data.id,
      data.tenant_id,
      data.channel,
      data.composio_account_id,
      data.composio_user_id,
      data.platform_user_id || null,
      data.platform_username || null,
    ],
  });
  const rs = await c.execute({ sql: "SELECT * FROM composio_connections WHERE id = ?", args: [data.id] });
  return rs.rows[0] as unknown as ComposioConnection;
}

export async function deleteComposioConnection(id: string): Promise<boolean> {
  const c = await db();
  const rs = await c.execute({
    sql: "UPDATE composio_connections SET is_active = 0 WHERE id = ?",
    args: [id],
  });
  return rs.rowsAffected > 0;
}

// --- Published Flows ---

export async function getPublishedFlows(): Promise<Flow[]> {
  const c = await db();
  const rs = await c.execute({
    sql: "SELECT * FROM flows WHERE is_published = 1",
    args: [],
  });
  return rs.rows as unknown as Flow[];
}

export async function setFlowPublished(id: string, tenantId: string, published: boolean): Promise<boolean> {
  const c = await db();
  const rs = await c.execute({
    sql: "UPDATE flows SET is_published = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?",
    args: [published ? 1 : 0, id, tenantId],
  });
  return rs.rowsAffected > 0;
}

// --- Leads ---

export interface Lead {
  id: string;
  tenant_id: string;
  flow_id: string;
  channel: string;
  platform_handle: string;
  display_name: string;
  stage: string;
  owner: string;
  needs_human: number;
  needs_human_reason: string | null;
  created_at: string;
  updated_at: string;
}

export async function getLeadByHandle(
  tenantId: string,
  flowId: string,
  platformHandle: string
): Promise<Lead | null> {
  const c = await db();
  const rs = await c.execute({
    sql: "SELECT * FROM leads WHERE tenant_id = ? AND flow_id = ? AND platform_handle = ?",
    args: [tenantId, flowId, platformHandle],
  });
  return (rs.rows[0] as unknown as Lead) ?? null;
}

export async function upsertLead(data: {
  id: string;
  tenant_id: string;
  flow_id: string;
  channel: string;
  platform_handle: string;
  display_name?: string;
}): Promise<Lead> {
  const c = await db();
  const existing = await getLeadByHandle(data.tenant_id, data.flow_id, data.platform_handle);
  if (existing) {
    if (data.display_name && data.display_name !== existing.display_name) {
      await c.execute({
        sql: "UPDATE leads SET display_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        args: [data.display_name, existing.id],
      });
    }
    const rs = await c.execute({ sql: "SELECT * FROM leads WHERE id = ?", args: [existing.id] });
    return rs.rows[0] as unknown as Lead;
  }
  await c.execute({
    sql: "INSERT INTO leads (id, tenant_id, flow_id, channel, platform_handle, display_name) VALUES (?, ?, ?, ?, ?, ?)",
    args: [data.id, data.tenant_id, data.flow_id, data.channel, data.platform_handle, data.display_name || ""],
  });
  const rs = await c.execute({ sql: "SELECT * FROM leads WHERE id = ?", args: [data.id] });
  return rs.rows[0] as unknown as Lead;
}

export async function updateLeadNeedsHuman(
  leadId: string,
  needsHuman: boolean,
  reason: string | null
): Promise<void> {
  const c = await db();
  await c.execute({
    sql: "UPDATE leads SET needs_human = ?, needs_human_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    args: [needsHuman ? 1 : 0, reason, leadId],
  });
}

export async function resolveLead(
  leadId: string,
  stage: string,
  tenantId: string
): Promise<boolean> {
  const c = await db();
  const rs = await c.execute({
    sql: `UPDATE leads SET needs_human = 0, needs_human_reason = NULL, stage = ?, owner = 'bot', updated_at = CURRENT_TIMESTAMP
          WHERE id = ? AND tenant_id = ?`,
    args: [stage, leadId, tenantId],
  });
  return rs.rowsAffected > 0;
}

// --- Messages ---

export interface Message {
  id: string;
  lead_id: string;
  direction: string;
  text: string;
  message_type: string;
  platform_message_id: string | null;
  detected_status: string | null;
  needs_human: number;
  suggested_template_id: string | null;
  inference_result_json: string | null;
  created_at: string;
  received_at: string;
}

export async function messageExistsByPlatformId(platformMessageId: string): Promise<boolean> {
  const c = await db();
  const rs = await c.execute({
    sql: "SELECT 1 FROM messages WHERE platform_message_id = ? LIMIT 1",
    args: [platformMessageId],
  });
  return rs.rows.length > 0;
}

export async function createMessage(data: {
  id: string;
  lead_id: string;
  direction: string;
  text: string;
  platform_message_id?: string;
  detected_status?: string;
  needs_human?: boolean;
  suggested_template_id?: string;
  inference_result_json?: string;
  received_at?: string;
}): Promise<Message> {
  const c = await db();
  await c.execute({
    sql: `INSERT INTO messages (id, lead_id, direction, text, platform_message_id, detected_status, needs_human, suggested_template_id, inference_result_json, received_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      data.id,
      data.lead_id,
      data.direction,
      data.text,
      data.platform_message_id || null,
      data.detected_status || null,
      data.needs_human ? 1 : 0,
      data.suggested_template_id || null,
      data.inference_result_json || null,
      data.received_at || new Date().toISOString(),
    ],
  });
  const rs = await c.execute({ sql: "SELECT * FROM messages WHERE id = ?", args: [data.id] });
  return rs.rows[0] as unknown as Message;
}

export async function getMessagesByLead(leadId: string): Promise<Message[]> {
  const c = await db();
  const rs = await c.execute({
    sql: "SELECT * FROM messages WHERE lead_id = ? ORDER BY received_at ASC",
    args: [leadId],
  });
  return rs.rows as unknown as Message[];
}

// --- Outbox ---

export interface OutboxItem {
  id: string;
  lead_id: string;
  channel: string;
  action: string;
  payload_json: string;
  status: string;
  attempts: number;
  last_error: string | null;
  idempotency_key: string | null;
  next_attempt_at: string;
  created_at: string;
  updated_at: string;
}

export async function createOutboxItem(data: {
  id: string;
  lead_id: string;
  channel: string;
  action: string;
  payload_json: string;
  idempotency_key?: string;
}): Promise<OutboxItem> {
  const c = await db();
  await c.execute({
    sql: `INSERT INTO outbox (id, lead_id, channel, action, payload_json, idempotency_key)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [data.id, data.lead_id, data.channel, data.action, data.payload_json, data.idempotency_key || null],
  });
  const rs = await c.execute({ sql: "SELECT * FROM outbox WHERE id = ?", args: [data.id] });
  return rs.rows[0] as unknown as OutboxItem;
}

export async function getPendingOutboxByFlow(flowId: string): Promise<(OutboxItem & { lead_display_name: string; lead_platform_handle: string })[]> {
  const c = await db();
  const rs = await c.execute({
    sql: `SELECT o.*, l.display_name as lead_display_name, l.platform_handle as lead_platform_handle
          FROM outbox o
          JOIN leads l ON o.lead_id = l.id
          WHERE l.flow_id = ? AND o.status = 'pending'
          ORDER BY o.created_at ASC`,
    args: [flowId],
  });
  return rs.rows as unknown as (OutboxItem & { lead_display_name: string; lead_platform_handle: string })[];
}

export async function getOutboxItem(id: string): Promise<OutboxItem | null> {
  const c = await db();
  const rs = await c.execute({ sql: "SELECT * FROM outbox WHERE id = ?", args: [id] });
  return (rs.rows[0] as unknown as OutboxItem) ?? null;
}

export async function updateOutboxStatus(id: string, status: string, lastError?: string): Promise<void> {
  const c = await db();
  await c.execute({
    sql: "UPDATE outbox SET status = ?, last_error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    args: [status, lastError || null, id],
  });
}

export async function getLeadsByFlow(flowId: string): Promise<Lead[]> {
  const c = await db();
  const rs = await c.execute({
    sql: "SELECT * FROM leads WHERE flow_id = ? ORDER BY updated_at DESC",
    args: [flowId],
  });
  return rs.rows as unknown as Lead[];
}
