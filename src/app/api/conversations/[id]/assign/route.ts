import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

const schema = z.object({ employeeId: z.string().nullable() });

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const conversation = await prisma.conversation.findFirst({ where: { id: params.id, organizationId: session.organizationId } });
  if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.conversation.update({ where: { id: conversation.id }, data: { assignedEmployeeId: body.data.employeeId } });

  if (body.data.employeeId) {
    await prisma.notification.create({
      data: { organizationId: session.organizationId, type: "CONVERSATION_ASSIGNED", message: "تم تعيين محادثة لك", meta: { conversationId: conversation.id } }
    });
  }

  return NextResponse.json({ conversation: updated });
}
