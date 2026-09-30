import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const unreadOnly = searchParams.get("unread") === "true";

  const notifications = await prisma.notification.findMany({
    where: { organizationId: session.organizationId, ...(unreadOnly ? { read: false } : {}) },
    orderBy: { createdAt: "desc" },
    take: 50
  });

  const unreadCount = await prisma.notification.count({ where: { organizationId: session.organizationId, read: false } });

  return NextResponse.json({ notifications, unreadCount });
}

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, all } = await request.json().catch(() => ({}));

  if (all) {
    await prisma.notification.updateMany({ where: { organizationId: session.organizationId, read: false }, data: { read: true } });
    return NextResponse.json({ ok: true });
  }

  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  await prisma.notification.updateMany({ where: { id, organizationId: session.organizationId }, data: { read: true } });
  return NextResponse.json({ ok: true });
}
