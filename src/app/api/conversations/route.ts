import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const platform = searchParams.get("platform") ?? undefined;
  const status = searchParams.get("status") ?? undefined;
  const assignedEmployeeId = searchParams.get("employee") ?? undefined;
  const search = searchParams.get("q") ?? undefined;
  const page = Number(searchParams.get("page") ?? "1");
  const pageSize = 25;

  const where: any = {
    organizationId: session.organizationId,
    ...(platform ? { platform: platform.toUpperCase() } : {}),
    ...(status ? { status: status.toUpperCase() } : {}),
    ...(assignedEmployeeId ? { assignedEmployeeId } : {}),
    ...(search
      ? {
          OR: [
            { customer: { name: { contains: search, mode: "insensitive" } } },
            { customer: { phone: { contains: search } } },
            { customer: { email: { contains: search, mode: "insensitive" } } },
            { lastMessagePreview: { contains: search, mode: "insensitive" } },
            { messages: { some: { content: { contains: search, mode: "insensitive" } } } }
          ]
        }
      : {})
  };

  const [conversations, total] = await Promise.all([
    prisma.conversation.findMany({
      where,
      include: { customer: true, tags: { include: { tag: true } }, assignedEmployee: { select: { id: true, name: true } } },
      orderBy: { lastMessageAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.conversation.count({ where })
  ]);

  return NextResponse.json({ conversations, total, page, pageSize });
}
