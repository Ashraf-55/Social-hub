import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getAdapter } from "@/modules/platforms/registry";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { platform } = await request.json();
  await getAdapter(platform).disconnect();

  await prisma.socialIntegration.updateMany({
    where: { organizationId: session.organizationId, platform: platform.toUpperCase() },
    data: { status: "NOT_CONNECTED", encryptedAccessToken: null }
  });

  await prisma.auditLog.create({
    data: { organizationId: session.organizationId, actorId: session.userId, action: "integration.disconnected", target: `Platform:${platform}` }
  });

  return NextResponse.json({ ok: true });
}
