import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hasPermission, requirePermission } from "@/lib/permissions";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const automations = await prisma.automation.findMany({
    where: { organizationId: session.organizationId },
    orderBy: { createdAt: "desc" }
  });
  return NextResponse.json({ automations });
}

const schema = z.object({
  name: z.string().min(1),
  triggerType: z.literal("new_message").default("new_message"),
  conditions: z.record(z.any()),
  actions: z.array(z.record(z.any())),
  enabled: z.boolean().default(true)
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  requirePermission(await hasPermission(session.userId, session.role, "MANAGE_AUTOMATION"));

  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: body.error.flatten() }, { status: 400 });

  const automation = await prisma.automation.create({
    data: { organizationId: session.organizationId, ...body.data }
  });

  await prisma.auditLog.create({
    data: { organizationId: session.organizationId, actorId: session.userId, action: "automation.created", target: `Automation:${automation.id}` }
  });

  return NextResponse.json({ automation }, { status: 201 });
}
