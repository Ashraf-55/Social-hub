import { NextRequest, NextResponse } from "next/server";
import { getAdapter } from "@/modules/platforms/registry";
import { ingestWebhookEvent } from "@/services/webhook.service";
import { randomUUID } from "crypto";

const adapter = getAdapter("tiktok");

// Meta/TikTok webhook handshake (GET with hub.challenge, or platform-specific verification).
export async function GET(request: NextRequest) {
  const result = await adapter.verifyWebhook(request);
  if (!result.valid) return new NextResponse("Forbidden", { status: 403 });
  return new NextResponse(result.challenge ?? "OK", { status: 200 });
}

// Inbound events.
export async function POST(request: NextRequest) {
  const verification = await adapter.verifyWebhook(request);
  if (!verification.valid) {
    return new NextResponse("Invalid signature", { status: 401 });
  }

  const payload = await request.json();
  const messages = adapter.parseWebhookPayload(payload);

  const externalEventId =
    (payload?.entry?.[0]?.id ?? "unknown") + ":" +
    (payload?.entry?.[0]?.changes?.[0]?.value?.messages?.[0]?.id ??
      payload?.entry?.[0]?.messaging?.[0]?.message?.mid ??
      randomUUID());

  const result = await ingestWebhookEvent({
    platform: "tiktok",
    externalEventId,
    rawPayload: payload,
    messages
  });

  return NextResponse.json({ received: true, ...result });
}
