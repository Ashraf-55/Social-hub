import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

const schema = z.object({
  status: z.enum(["OPEN", "PENDING", "RESOLVED", "ARCHIVED"]).optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
  unread: z.boolean().optional()
});

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const conversation = await prisma.conversation.findFirst({ where: { id: params.id, organizationId: session.organizationId } });
  if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      ...(body.data.status ? { status: body.data.status } : {}),
      ...(body.data.priority ? { priority: body.data.priority } : {}),
      ...(body.data.unread !== undefined ? { unreadCount: body.data.unread ? 1 : 0 } : {})
    }
  });

  await prisma.auditLog.create({
    data: { organizationId: session.organizationId, actorId: session.userId, action: "conversation.updated", target: `Conversation:${conversation.id}`, meta: body.data }
  });

  return NextResponse.json({ conversation: updated });
}
