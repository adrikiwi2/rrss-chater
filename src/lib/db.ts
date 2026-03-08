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
