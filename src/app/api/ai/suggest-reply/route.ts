import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { suggestReply } from "@/modules/ai/ai.service";
import { aiEnabled } from "@/lib/config";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!aiEnabled) return NextResponse.json({ error: "AI is disabled. Set OPENAI_API_KEY and AI_ENABLED=true." }, { status: 400 });

  const { conversationId } = await request.json();
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, organizationId: session.organizationId },
    include: { messages: { orderBy: { createdAt: "asc" }, take: 20 } }
  });
  if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const history = conversation.messages.map((m: { direction: string; content: string | null }) => ({
    role: (m.direction === "INBOUND" ? "user" : "assistant") as "user" | "assistant",
    content: m.content ?? ""
  }));

  const org = await prisma.organization.findUnique({ where: { id: session.organizationId }, select: { aiSystemPromptExtra: true } });
  const result = await suggestReply(history, org?.aiSystemPromptExtra);

  if (!result.confident) {
    return NextResponse.json({
      suggestion: null,
      confident: false,
      fallback: "سيتم تحويل هذه المحادثة إلى موظف بشري لعدم توفر إجابة مؤكدة."
    });
  }

  return NextResponse.json({ suggestion: result.reply, confident: true });
}
