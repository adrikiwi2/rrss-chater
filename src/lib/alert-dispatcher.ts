import { nanoid } from "nanoid";
import { getAlertRulesForEvent, createAlertLog } from "./db";

export type AlertEventType =
  | "message.received"
  | "inference.executed"
  | "message.sent"
  | "needs_human"
  | "lead.qualified";

/**
 * Dispatch an alert event. Looks up active rules for this tenant+flow+event,
 * evaluates conditions, renders the template, and sends to each destination.
 * Never throws — errors are logged to alert_logs and console.
 */
export async function dispatch(
  tenantId: string,
  flowId: string,
  eventType: AlertEventType,
  payload: Record<string, string>
): Promise<void> {
  let rules;
  try {
    rules = await getAlertRulesForEvent(tenantId, flowId, eventType);
  } catch (err) {
    console.error("[alert] Failed to fetch rules:", err);
    return;
  }

  for (const rule of rules) {
    let status = "success";
    let errorMsg: string | null = null;

    try {
      if (rule.conditions) {
        const cond = JSON.parse(rule.conditions) as { field: string; op: string; value: string };
        const fieldValue = payload[cond.field] ?? "";
        if (!evalCondition(fieldValue, cond.op, cond.value)) continue;
      }

      const message = renderTemplate(rule.template, payload);

      if (rule.provider === "whatsapp") {
        const destConfig = JSON.parse(rule.config) as { jid: string };
        await sendWhatsApp(destConfig.jid, message);
      }
      // future: slack, webhook, email
    } catch (err) {
      status = "error";
      errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[alert] Rule ${rule.id} failed:`, errorMsg);
    }

    createAlertLog({
      id: nanoid(),
      rule_id: rule.id,
      status,
      payload: JSON.stringify({ eventType, payload, error: errorMsg }),
    }).catch((e) => console.error("[alert] Failed to write log:", e));
  }
}

function renderTemplate(template: string, payload: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => payload[key] ?? "");
}

function evalCondition(fieldValue: string, op: string, value: string): boolean {
  switch (op) {
    case "==": return fieldValue === value;
    case "!=": return fieldValue !== value;
    case "contains": return fieldValue.includes(value);
    default: return true;
  }
}

async function sendWhatsApp(jid: string, message: string): Promise<void> {
  const url = process.env.NOTIFY_SERVICE_URL;
  const secret = process.env.NOTIFY_SECRET;
  if (!url || !secret) throw new Error("NOTIFY_SERVICE_URL or NOTIFY_SECRET not configured");

  const res = await fetch(`${url}/notify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({ to: jid, message }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Send failed: ${res.status} ${text}`);
  }
}
