import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

const schema = z.object({ name: z.string().min(1).max(50) });

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const conversation = await prisma.conversation.findFirst({ where: { id: params.id, organizationId: session.organizationId } });
  if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const tag = await prisma.tag.upsert({
    where: { organizationId_name: { organizationId: session.organizationId, name: body.data.name } },
    update: {},
    create: { organizationId: session.organizationId, name: body.data.name }
  });

  const conversationTag = await prisma.conversationTag.upsert({
    where: { conversationId_tagId: { conversationId: conversation.id, tagId: tag.id } },
    update: {},
    create: { conversationId: conversation.id, tagId: tag.id },
    include: { tag: true }
  });

  return NextResponse.json({ conversationTag }, { status: 201 });
}

const deleteSchema = z.object({ tagId: z.string() });

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = deleteSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const conversation = await prisma.conversation.findFirst({ where: { id: params.id, organizationId: session.organizationId } });
  if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.conversationTag.deleteMany({ where: { conversationId: conversation.id, tagId: body.data.tagId } });

  return NextResponse.json({ ok: true });
}
