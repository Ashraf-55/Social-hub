import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession, hashPassword } from "@/lib/auth";
import type { Prisma } from "@prisma/client";

const PERMISSIONS = [
  "VIEW_INBOX", "REPLY_MESSAGES", "VIEW_CUSTOMERS", "EDIT_CUSTOMERS", "MANAGE_AUTOMATION",
  "MANAGE_INTEGRATIONS", "MANAGE_EMPLOYEES", "VIEW_REPORTS", "MANAGE_SETTINGS"
] as const;

const schema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(["ADMIN", "EMPLOYEE"]).optional(),
  active: z.boolean().optional(),
  password: z.string().min(8).optional(),
  permissions: z.array(z.enum(PERMISSIONS)).optional()
});

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const target = await prisma.user.findFirst({ where: { id: params.id, organizationId: session.organizationId } });
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 });

  // Prevent an admin from locking themselves out by disabling their own only-admin account.
  if (body.data.active === false && target.id === session.userId) {
    return NextResponse.json({ error: "You cannot disable your own account" }, { status: 400 });
  }

  const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const user = await tx.user.update({
      where: { id: target.id },
      data: {
        ...(body.data.name ? { name: body.data.name } : {}),
        ...(body.data.role ? { role: body.data.role } : {}),
        ...(body.data.active !== undefined ? { active: body.data.active } : {}),
        ...(body.data.password ? { passwordHash: await hashPassword(body.data.password) } : {})
      }
    });

    if (body.data.permissions) {
      await tx.userPermission.deleteMany({ where: { userId: target.id } });
      await tx.userPermission.createMany({
        data: body.data.permissions.map((permission) => ({ userId: target.id, permission }))
      });
    }

    return user;
  });

  await prisma.auditLog.create({
    data: {
      organizationId: session.organizationId,
      actorId: session.userId,
      action: body.data.active === false ? "employee.disabled" : body.data.active === true ? "employee.enabled" : "employee.updated",
      target: `User:${target.id}`,
      meta: { changes: Object.keys(body.data) }
    }
  });

  return NextResponse.json({ employee: { id: updated.id, name: updated.name, email: updated.email, role: updated.role, active: updated.active } });
}
