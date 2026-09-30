import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { simulateInboundMessage } from "@/modules/mock/mock.service";
import { isMockMode } from "@/lib/config";
import { PlatformId } from "@/types/unified-message";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isMockMode) return NextResponse.json({ error: "Mock mode is disabled (APP_MODE=live)" }, { status: 400 });

  const body = (await request.json().catch(() => ({}))) as { platform?: PlatformId; content?: string; customerKey?: string };
  const p = body.platform ?? "whatsapp";

  const result = await simulateInboundMessage(session.organizationId, p, { content: body.content, customerKey: body.customerKey });
  return NextResponse.json({ ok: true, result });
}
