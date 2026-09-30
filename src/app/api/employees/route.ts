import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hashPassword } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const employees = await prisma.user.findMany({
    where: { organizationId: session.organizationId },
    select: { id: true, name: true, email: true, role: true, active: true, createdAt: true, permissions: { select: { permission: true } } }
  });
  return NextResponse.json({ employees });
}

const schema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["ADMIN", "EMPLOYEE"]).default("EMPLOYEE"),
  permissions: z.array(z.string()).default([])
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 });

  const existing = await prisma.user.findUnique({ where: { email: body.data.email } });
  if (existing) return NextResponse.json({ error: "Email already in use" }, { status: 409 });

  const passwordHash = await hashPassword(body.data.password);

  const employee = await prisma.user.create({
    data: {
      organizationId: session.organizationId,
      name: body.data.name,
      email: body.data.email,
      passwordHash,
      role: body.data.role,
      permissions: { create: body.data.permissions.map((p) => ({ permission: p as any })) }
    }
  });

  await prisma.auditLog.create({
    data: { organizationId: session.organizationId, actorId: session.userId, action: "employee.created", target: `User:${employee.id}` }
  });

  return NextResponse.json({ employee: { id: employee.id, name: employee.name, email: employee.email } }, { status: 201 });
}
