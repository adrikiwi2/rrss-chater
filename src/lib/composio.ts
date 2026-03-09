import { Composio } from "@composio/core";

let client: Composio | null = null;

function getClient(): Composio {
  if (!client) {
    const apiKey = process.env.COMPOSIO_API_KEY;
    if (!apiKey) throw new Error("COMPOSIO_API_KEY not set");
    client = new Composio({
      apiKey,
      toolkitVersions: { instagram: "20260223_00" },
    });
  }
  return client;
}

export interface ComposioConnection {
  id: string;
  tenant_id: string;
  channel: string;
  composio_account_id: string;
  composio_user_id: string;
  platform_user_id: string | null;
  platform_username: string | null;
  is_active: number;
  created_at: string;
}

export interface IGConversation {
  id: string;
  updated_time: string;
}

export interface IGMessage {
  id: string;
  created_time: string;
  message?: string;
  from: { id: string; username: string };
  to: { data: { id: string; username: string }[] };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyResult = any;

// ── OAuth: initiate a new connected account ─────────────────────────

export async function initiateConnection(
  userId: string,
  callbackUrl: string
): Promise<{ redirectUrl: string; connectedAccountId: string }> {
  const composio = getClient();
  const authConfigId = process.env.COMPOSIO_AUTH_CONFIG_ID;
  if (!authConfigId) throw new Error("COMPOSIO_AUTH_CONFIG_ID not set");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any = await (composio as any).connectedAccounts.initiate(
    userId,
    authConfigId,
    { callbackUrl }
  );

  return {
    redirectUrl: result.redirectUrl,
    connectedAccountId: result.id,
  };
}

// ── Read: list DM conversations ──────────────────────────────────────

export async function listConversations(
  userId: string
): Promise<IGConversation[]> {
  const composio = getClient();
  const result: AnyResult = await composio.tools.execute(
    "INSTAGRAM_LIST_ALL_CONVERSATIONS",
    { userId, arguments: {} }
  );
  return result?.data?.data ?? [];
}

// ── Read: list messages in a conversation ────────────────────────────

export async function listMessages(
  userId: string,
  conversationId: string
): Promise<IGMessage[]> {
  const composio = getClient();
  const result: AnyResult = await composio.tools.execute(
    "INSTAGRAM_LIST_ALL_MESSAGES",
    { userId, arguments: { conversation_id: conversationId } }
  );
  return result?.data?.data ?? [];
}

// ── Write: send a text DM ────────────────────────────────────────────

export async function sendTextMessage(
  userId: string,
  recipientId: string,
  text: string
): Promise<{ messageId: string }> {
  const composio = getClient();
  const result: AnyResult = await composio.tools.execute(
    "INSTAGRAM_SEND_TEXT_MESSAGE",
    { userId, arguments: { recipient_id: recipientId, text } }
  );
  if (!result?.successful) {
    throw new Error(`Composio send failed: ${JSON.stringify(result)}`);
  }
  return { messageId: result.data?.message_id ?? "" };
}
