/**
 * Agent execution cycle: poll conversations → detect new messages → inference → respond.
 *
 * Same pipeline as simulation, but with real messages via Composio.
 */

import { nanoid } from "nanoid";
import { classifyConversation, generateKnowledgeResponse } from "./router";
import {
  getPublishedFlows,
  getFlowById,
  getComposioConnectionByChannel,
  upsertLead,
  messageExistsByPlatformId,
  createMessage,
  getMessagesByLead,
  updateLeadNeedsHuman,
  createOutboxItem,
  getKnowledgeDocsWithContent,
} from "./db";
import {
  listConversations,
  listMessages,
} from "./composio";
import { dispatch } from "./alert-dispatcher";
import type { SimMessage, FlowWithDetails } from "./types";

export interface CycleLog {
  flowId: string;
  flowName: string;
  conversations: number;
  newMessages: number;
  inferencesRun: number;
  messagesSent: number;
  errors: string[];
}

/**
 * Run one full cycle for all published flows.
 */
export async function runAgentCycle(): Promise<CycleLog[]> {
  const publishedFlows = await getPublishedFlows();
  const logs: CycleLog[] = [];

  for (const flow of publishedFlows) {
    const log = await processFlow(flow.id, flow.tenant_id, flow.name);
    logs.push(log);
  }

  return logs;
}

export async function processFlow(
  flowId: string,
  tenantId: string,
  flowName: string
): Promise<CycleLog> {
  const log: CycleLog = {
    flowId,
    flowName,
    conversations: 0,
    newMessages: 0,
    inferencesRun: 0,
    messagesSent: 0,
    errors: [],
  };

  try {
    // Parse agent_config to know the channel
    const flow = await getFlowById(flowId, tenantId);
    if (!flow) {
      log.errors.push("Flow not found");
      return log;
    }

    const agentConfig = flow.agent_config ? JSON.parse(flow.agent_config) : null;
    const channel = agentConfig?.channel || "instagram";

    // Get composio connection for this tenant+channel
    const conn = await getComposioConnectionByChannel(tenantId, channel);
    if (!conn) {
      log.errors.push(`No composio connection for channel "${channel}"`);
      return log;
    }

    const myPlatformId = conn.platform_user_id;

    // List all conversations
    const conversations = await listConversations(conn.composio_user_id);
    log.conversations = conversations.length;

    for (const conv of conversations) {
      try {
        await processConversation(conv.id, flow, conn, myPlatformId, log);
      } catch (err) {
        log.errors.push(`Conv ${conv.id.slice(0, 20)}...: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  } catch (err) {
    log.errors.push(err instanceof Error ? err.message : String(err));
  }

  return log;
}

async function processConversation(
  conversationId: string,
  flow: FlowWithDetails,
  conn: {
    composio_user_id: string;
    tenant_id: string;
    channel: string;
    platform_user_id: string | null;
  },
  myPlatformId: string | null,
  log: CycleLog
): Promise<void> {
  const messages = await listMessages(conn.composio_user_id, conversationId);
  if (!messages.length) return;

  // Identify the other participant (the lead)
  const otherMsg = messages.find((m) => m.from.id !== myPlatformId);
  if (!otherMsg) return; // All messages are from us

  const leadHandle = otherMsg.from.id;
  const leadUsername = otherMsg.from.username;

  // Upsert lead
  const lead = await upsertLead({
    id: nanoid(),
    tenant_id: conn.tenant_id,
    flow_id: flow.id,
    channel: conn.channel,
    platform_handle: leadHandle,
    display_name: leadUsername,
  });

  // Find new messages (not yet in DB)
  let hasNewInbound = false;
  const chronological = [...messages].reverse(); // API returns newest first

  for (const msg of chronological) {
    if (!msg.message) continue; // skip non-text (attachments, etc.)
    const exists = await messageExistsByPlatformId(msg.id);
    if (exists) continue;

    const direction = msg.from.id === myPlatformId ? "outbound" : "inbound";
    if (direction === "inbound") hasNewInbound = true;

    await createMessage({
      id: nanoid(),
      lead_id: lead.id,
      direction,
      text: msg.message,
      platform_message_id: msg.id,
      received_at: msg.created_time,
    });
    log.newMessages++;
  }

  // Only run inference if there are new inbound messages
  if (!hasNewInbound) return;

  const time = new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  const leadName = lead.display_name || lead.platform_handle;

  dispatch(conn.tenant_id, flow.id, "message.received", {
    lead_name: leadName,
    flow_name: flow.name,
    time,
  }).catch(() => {});

  // Skip inference if lead is already escalated to human
  if (lead.needs_human) return;

  // Build conversation history from all stored messages for this lead
  const allMsgs = await getMessagesByLead(lead.id);

  // Hard limit: escalate if too many interactions
  const agentConfig = flow.agent_config ? JSON.parse(flow.agent_config) : null;
  const maxInteractions = agentConfig?.max_interactions ?? 0;
  if (maxInteractions > 0) {
    const inboundCount = allMsgs.filter((m) => m.direction === "inbound").length;
    if (inboundCount >= maxInteractions) {
      await updateLeadNeedsHuman(lead.id, true, `Max interactions reached (${maxInteractions})`);
      return;
    }
  }
  const simMessages: SimMessage[] = allMsgs.map((m) => ({
    id: m.id,
    role: m.direction === "outbound" ? "a" as const : "b" as const,
    body: m.text,
    timestamp: m.received_at,
  }));

  // Collect already-used template IDs to avoid repeats
  const usedTemplateIds = allMsgs
    .map((m) => m.suggested_template_id)
    .filter((id): id is string => id != null);

  // Run inference (same as simulation)
  const result = await classifyConversation(flow, simMessages, usedTemplateIds);
  log.inferencesRun++;

  dispatch(conn.tenant_id, flow.id, "inference.executed", {
    lead_name: leadName,
    flow_name: flow.name,
    category: result.detected_status || "",
    needs_human: result.needs_human ? "Sí" : "No",
    time,
  }).catch(() => {});

  // Update the last inbound message with inference result
  const lastInbound = allMsgs.filter((m) => m.direction === "inbound").pop();
  if (lastInbound) {
    // We don't have an updateMessage query, so we store inference on the new message we just created
    // The inference result is available in the cycle log
  }

  // Handle needs_human
  if (result.needs_human) {
    await updateLeadNeedsHuman(lead.id, true, result.needs_human_reason);
    dispatch(conn.tenant_id, flow.id, "needs_human", {
      lead_name: leadName,
      flow_name: flow.name,
      needs_human_reason: result.needs_human_reason || "",
      time,
    }).catch(() => {});
    return; // Don't auto-respond
  }

  // Fire lead.qualified if extracted_info has telefono or email
  const extracted = result.extracted_info ?? {};
  if (extracted.telefono || extracted.email) {
    const qualifiedPayload: Record<string, string> = {
      lead_name: leadName,
      flow_name: flow.name,
      category_name: result.detected_status || "",
      time,
    };
    for (const [k, v] of Object.entries(extracted)) {
      qualifiedPayload[k] = v ?? "";
    }
    dispatch(conn.tenant_id, flow.id, "lead.qualified", qualifiedPayload).catch(() => {});
  }

  // Check if detected category uses knowledge mode
  const detectedCategory = flow.categories.find(
    (c) => c.name === result.detected_status
  );
  if (detectedCategory?.mode === "knowledge") {
    const docs = await getKnowledgeDocsWithContent(flow.id);
    if (docs.length > 0) {
      const generatedText = await generateKnowledgeResponse(flow, simMessages, docs);
      await createOutboxItem({
        id: nanoid(),
        lead_id: lead.id,
        channel: conn.channel,
        action: "send_text",
        payload_json: JSON.stringify({
          composio_user_id: conn.composio_user_id,
          recipient_id: leadHandle,
          text: generatedText,
          generated: true,
          inference_result: result,
        }),
        idempotency_key: `${lead.id}:${allMsgs[allMsgs.length - 1]?.id}`,
      });
      log.messagesSent++;
      dispatch(conn.tenant_id, flow.id, "message.sent", {
        lead_name: leadName,
        flow_name: flow.name,
        action: "knowledge",
        time,
      }).catch(() => {});
    }
    return;
  }

  // Queue suggested template for approval (not auto-sent)
  if (result.suggested_template_id) {
    const template = flow.templates.find((t) => t.id === result.suggested_template_id);
    if (template) {
      await createOutboxItem({
        id: nanoid(),
        lead_id: lead.id,
        channel: conn.channel,
        action: "send_text",
        payload_json: JSON.stringify({
          composio_user_id: conn.composio_user_id,
          recipient_id: leadHandle,
          text: template.body,
          template_id: template.id,
          template_name: template.name,
          inference_result: result,
        }),
        idempotency_key: `${lead.id}:${allMsgs[allMsgs.length - 1]?.id}`,
      });
      log.messagesSent++; // queued, not sent yet
      dispatch(conn.tenant_id, flow.id, "message.sent", {
        lead_name: leadName,
        flow_name: flow.name,
        action: "template",
        template_name: template.name,
        time,
      }).catch(() => {});
    }
  }
}
