import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import {
  getComposioConnections,
  createComposioConnection,
  deleteComposioConnection,
} from "@/lib/db";

function verifyAdmin(request: Request): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get("tenant_id");
  if (!tenantId) {
    return NextResponse.json({ error: "tenant_id required" }, { status: 400 });
  }

  const connections = await getComposioConnections(tenantId);
  return NextResponse.json(connections);
}

export async function POST(request: Request) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const {
    tenant_id,
    channel,
    composio_account_id,
    composio_user_id,
    platform_user_id,
    platform_username,
  } = await request.json();

  if (!tenant_id || !channel || !composio_account_id || !composio_user_id) {
    return NextResponse.json(
      { error: "tenant_id, channel, composio_account_id, and composio_user_id required" },
      { status: 400 }
    );
  }

  const connection = await createComposioConnection({
    id: nanoid(),
    tenant_id,
    channel,
    composio_account_id,
    composio_user_id,
    platform_user_id,
    platform_username,
  });

  return NextResponse.json(connection, { status: 201 });
}

export async function DELETE(request: Request) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await request.json();
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const deleted = await deleteComposioConnection(id);
  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
