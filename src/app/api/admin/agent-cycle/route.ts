import { NextResponse } from "next/server";
import { runAgentCycle } from "@/lib/agent-cycle";

function verifyAdmin(request: Request): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function POST(request: Request) {
  if (!verifyAdmin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const logs = await runAgentCycle();
    return NextResponse.json({ ok: true, logs });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Agent cycle failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
