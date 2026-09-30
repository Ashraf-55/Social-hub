import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const organization = await prisma.organization.findUnique({ where: { id: session.organizationId } });
  return NextResponse.json({ organization });
}

const schema = z.object({ name: z.string().min(1).max(200) });

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden — Admin only" }, { status: 403 });

  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const organization = await prisma.organization.update({ where: { id: session.organizationId }, data: { name: body.data.name } });

  await prisma.auditLog.create({
    data: { organizationId: session.organizationId, actorId: session.userId, action: "organization.updated", target: `Organization:${session.organizationId}`, meta: { name: body.data.name } }
  });

  return NextResponse.json({ organization });
}
