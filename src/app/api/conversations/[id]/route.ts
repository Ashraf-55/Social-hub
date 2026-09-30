import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

const MESSAGE_PAGE_SIZE = 50;

/**
 * GET /api/conversations/:id — full conversation detail for the Inbox
 * thread view: customer, AI mode/suggestion, tags, notes, and the most
 * recent page of messages only.
 *
 * Section 39 (Performance): a conversation can accumulate thousands of
 * messages over time; loading all of them on every open would be slow and
 * wasteful. We fetch only the newest `MESSAGE_PAGE_SIZE` here (ordered
 * ascending for display) and report `hasMoreMessages` so the UI can lazy-
 * load older ones via `GET /api/conversations/:id/messages?before=...`
 * (see that route) only if the person actually scrolls up for history.
 */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const conversation = await prisma.conversation.findFirst({
    where: { id: params.id, organizationId: session.organizationId },
    include: {
      customer: true,
      notes: { include: { author: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
      tags: { include: { tag: true } }
    }
  });

  if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [recentMessagesDesc, totalMessageCount] = await Promise.all([
    prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "desc" },
      take: MESSAGE_PAGE_SIZE,
      include: { attachments: true }
    }),
    prisma.message.count({ where: { conversationId: conversation.id } })
  ]);

  const messages = recentMessagesDesc.slice().reverse(); // back to chronological order for display

  await prisma.conversation.update({ where: { id: conversation.id }, data: { unreadCount: 0 } });

  return NextResponse.json({
    conversation: {
      ...conversation,
      messages,
      hasMoreMessages: totalMessageCount > messages.length
    }
  });
}
