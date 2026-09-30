import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { APP_MODE, aiEnabled, n8nConfig } from "@/lib/config";

/**
 * Backs /dashboard/settings (Section 48). Returns both the org's own
 * persisted settings (Business Info, AI, Automation, Notifications) and
 * read-only summaries of things configured elsewhere (Integrations count,
 * Employees count) so the page doesn't need N separate requests.
 */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [org, integrationsConnected, employeeCount, recentAuditLogs] = await Promise.all([
    prisma.organization.findUniqueOrThrow({ where: { id: session.organizationId } }),
    prisma.socialIntegration.count({ where: { organizationId: session.organizationId, status: "CONNECTED" } }),
    prisma.user.count({ where: { organizationId: session.organizationId, active: true } }),
    prisma.auditLog.findMany({
      where: { organizationId: session.organizationId },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { actor: { select: { name: true } } }
    })
  ]);

  return NextResponse.json({
    business: { name: org.name, contactEmail: org.contactEmail, contactPhone: org.contactPhone, timezone: org.timezone },
    ai: { envEnabled: aiEnabled, systemPromptExtra: org.aiSystemPromptExtra, defaultAiMode: org.defaultAiMode },
    automation: { enabled: org.automationsEnabled, n8nConnected: n8nConfig.enabled },
    notifications: { muted: org.mutedNotificationTypes },
    summary: { appMode: APP_MODE, integrationsConnected, employeeCount, role: session.role },
    recentAuditLogs: recentAuditLogs.map((l: { id: string; action: string; target: string | null; actor: { name: string } | null; createdAt: Date }) => ({
      id: l.id,
      action: l.action,
      target: l.target,
      actor: l.actor?.name ?? "system",
      createdAt: l.createdAt
    }))
  });
}

const NOTIFICATION_TYPES = [
  "NEW_MESSAGE",
  "NEW_CUSTOMER",
  "CONVERSATION_ASSIGNED",
  "AI_ESCALATION",
  "INTEGRATION_ERROR",
  "AUTOMATION_FAILED"
] as const;

const schema = z.object({
  contactEmail: z.string().email().nullable().optional(),
  contactPhone: z.string().nullable().optional(),
  timezone: z.string().optional(),
  automationsEnabled: z.boolean().optional(),
  aiSystemPromptExtra: z.string().max(2000).nullable().optional(),
  defaultAiMode: z.enum(["HUMAN", "AI", "HYBRID"]).optional(),
  mutedNotificationTypes: z.array(z.enum(NOTIFICATION_TYPES)).optional()
});

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden — Admin only" }, { status: 403 });

  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 });

  if (body.data.defaultAiMode && body.data.defaultAiMode !== "HUMAN" && !aiEnabled) {
    return NextResponse.json({ error: "AI is disabled at the environment level — only HUMAN can be the default." }, { status: 400 });
  }

  const updated = await prisma.organization.update({ where: { id: session.organizationId }, data: body.data });

  await prisma.auditLog.create({
    data: { organizationId: session.organizationId, actorId: session.userId, action: "settings.updated", meta: { changes: Object.keys(body.data) } }
  });

  return NextResponse.json({ ok: true, business: { name: updated.name, contactEmail: updated.contactEmail, contactPhone: updated.contactPhone, timezone: updated.timezone } });
}
