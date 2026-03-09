import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getTenantId } from "@/lib/get-tenant";
import { initiateConnection } from "@/lib/composio";
import { getComposioConnections } from "@/lib/db";

/**
 * GET /api/connect-instagram
 * Check if current tenant has an active Instagram connection.
 */
export async function GET() {
  const tenantId = await getTenantId();
  const connections = await getComposioConnections(tenantId);
  const igConnection = connections.find((c) => c.channel === "instagram");
  return NextResponse.json({
    connected: !!igConnection,
    connection: igConnection || null,
  });
}

/**
 * POST /api/connect-instagram
 * Generates a Composio OAuth magic link for the current tenant.
 * Returns { redirectUrl } — the frontend opens this URL for the user.
 */
export async function POST() {
  const tenantId = await getTenantId();

  const userId = `tenant-${tenantId}-${nanoid(8)}`;

  const origin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const callbackUrl = `${origin}/api/connect-instagram/callback?tenant_id=${tenantId}&user_id=${userId}`;

  const { redirectUrl, connectedAccountId } = await initiateConnection(
    userId,
    callbackUrl
  );

  return NextResponse.json({
    redirectUrl,
    connectedAccountId,
    userId,
  });
}
