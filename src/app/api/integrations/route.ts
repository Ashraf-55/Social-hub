import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { allAdapters, getAdapter } from "@/modules/platforms/registry";
import { isMockMode } from "@/lib/config";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const stored = await prisma.socialIntegration.findMany({ where: { organizationId: session.organizationId } });

  const result = allAdapters().map((adapter) => {
    const row = stored.find((s: { platform: string }) => s.platform.toLowerCase() === adapter.platform);
    return {
      platform: adapter.platform,
      status: row?.status ?? "NOT_CONNECTED",
      accountName: row?.externalAccountName ?? null,
      lastWebhookAt: row?.lastWebhookAt ?? null,
      lastSyncAt: row?.lastSyncAt ?? null,
      lastError: row?.lastError ?? null,
      configured: adapter.isConfigured(),
      mockMode: isMockMode
    };
  });

  return NextResponse.json({ integrations: result, mode: isMockMode ? "mock" : "live" });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { platform } = await request.json();
  const adapter = getAdapter(platform);
  const platformEnum = platform.toUpperCase();

  if (isMockMode) {
    const integration = await prisma.socialIntegration.upsert({
      where: { organizationId_platform: { organizationId: session.organizationId, platform: platformEnum } },
      update: { status: "CONNECTED", externalAccountName: `Mock ${platform} account` },
      create: { organizationId: session.organizationId, platform: platformEnum, status: "CONNECTED", externalAccountName: `Mock ${platform} account` }
    });
    return NextResponse.json({ integration });
  }

  const result = await adapter.connect();
  const integration = await prisma.socialIntegration.upsert({
    where: { organizationId_platform: { organizationId: session.organizationId, platform: platformEnum } },
    update: {
      status: result.connected ? "CONNECTED" : "ERROR",
      externalAccountId: result.accountId,
      externalAccountName: result.accountName,
      lastError: result.error,
      lastSyncAt: new Date()
    },
    create: {
      organizationId: session.organizationId,
      platform: platformEnum,
      status: result.connected ? "CONNECTED" : "ERROR",
      externalAccountId: result.accountId,
      externalAccountName: result.accountName,
      lastError: result.error
    }
  });

  await prisma.auditLog.create({
    data: { organizationId: session.organizationId, actorId: session.userId, action: "integration.connect_attempt", target: `Platform:${platform}`, meta: { success: result.connected } }
  });

  return NextResponse.json({ integration });
}
