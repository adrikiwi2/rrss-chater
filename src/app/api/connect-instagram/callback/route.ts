import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { createComposioConnection } from "@/lib/db";

/**
 * GET /api/connect-instagram/callback
 * Composio redirects here after the user authorizes Instagram.
 * Saves the connection and redirects back to the app.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const tenantId = searchParams.get("tenant_id");
  const userId = searchParams.get("user_id");

  if (!tenantId || !userId) {
    return NextResponse.json({ error: "Missing tenant_id or user_id" }, { status: 400 });
  }

  // Composio sends back the connected account ID — it may be in various params
  const accountId = searchParams.get("connected_account_id") || searchParams.get("connectedAccountId") || "unknown";

  await createComposioConnection({
    id: nanoid(),
    tenant_id: tenantId,
    channel: "instagram",
    composio_account_id: accountId,
    composio_user_id: userId,
    // platform_user_id will be populated on first scan
  });

  // Redirect back to the app — the user will see the connection in the Live tab
  const origin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return NextResponse.redirect(`${origin}?connected=instagram`);
}
