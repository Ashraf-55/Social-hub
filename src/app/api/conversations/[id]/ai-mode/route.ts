import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hasPermission, requirePermission } from "@/lib/permissions";
import { aiEnabled } from "@/lib/config";

const schema = z.object({ aiMode: z.enum(["AI", "HUMAN", "HYBRID"]) });

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  requirePermission(await hasPermission(session.userId, session.role, "REPLY_MESSAGES"));

  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  if (body.data.aiMode !== "HUMAN" && !aiEnabled) {
    return NextResponse.json({ error: "AI is disabled (no OPENAI_API_KEY / AI_ENABLED=false) — only HUMAN mode is available." }, { status: 400 });
  }

  const conversation = await prisma.conversation.findFirst({ where: { id: params.id, organizationId: session.organizationId } });
  if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.conversation.update({
    where: { id: conversation.id },
    data: { aiMode: body.data.aiMode, pendingAiSuggestion: null } // clear any stale suggestion on mode change
  });

  await prisma.auditLog.create({
    data: { organizationId: session.organizationId, actorId: session.userId, action: "conversation.ai_mode_changed", target: `Conversation:${conversation.id}`, meta: { aiMode: body.data.aiMode } }
  });

  return NextResponse.json({ conversation: updated });
}
