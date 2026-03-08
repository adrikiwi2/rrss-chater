import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getTenantByEmail } from "@/lib/db";
import { signToken } from "@/lib/auth";

export async function POST(request: Request) {
  const { email, password } = await request.json();

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  }

  const tenant = await getTenantByEmail(email);
  if (!tenant || !tenant.is_active) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const valid = await bcrypt.compare(password, tenant.password_hash);
  if (!valid) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const token = await signToken(tenant.id);

  return NextResponse.json({
    token,
    tenant: { id: tenant.id, name: tenant.name, email: tenant.email },
  });
}
