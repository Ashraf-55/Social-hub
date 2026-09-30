import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hasPermission, requirePermission } from "@/lib/permissions";

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const customer = await prisma.customer.findFirst({
    where: { id: params.id, organizationId: session.organizationId },
    include: {
      conversations: {
        orderBy: { lastMessageAt: "desc" },
        include: { assignedEmployee: { select: { id: true, name: true } }, tags: { include: { tag: true } } }
      },
      tags: { include: { tag: true } }
    }
  });

  if (!customer) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ customer });
}

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  notes: z.string().nullable().optional()
});

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  requirePermission(await hasPermission(session.userId, session.role, "EDIT_CUSTOMERS"));

  const body = updateSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 });

  const customer = await prisma.customer.findFirst({ where: { id: params.id, organizationId: session.organizationId } });
  if (!customer) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.customer.update({ where: { id: customer.id }, data: body.data });

  await prisma.auditLog.create({
    data: { organizationId: session.organizationId, actorId: session.userId, action: "customer.updated", target: `Customer:${customer.id}`, meta: { changes: Object.keys(body.data) } }
  });

  return NextResponse.json({ customer: updated });
}
