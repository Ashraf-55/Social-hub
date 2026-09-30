import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { realtimeBus } from "@/lib/realtime";

export const dynamic = "force-dynamic";

/**
 * Server-Sent Events stream, scoped to the caller's organization. The
 * Inbox page subscribes to this instead of (or in addition to) polling —
 * see src/app/dashboard/inbox/page.tsx's useEventSource usage.
 *
 * Events are published by src/services/webhook.service.ts and
 * notification.service.ts via realtimeBus.publish(organizationId, ...)
 * whenever a message/notification is created, so the flow matches Section
 * 40 exactly: Webhook -> Backend -> Database -> Real-time event -> Dashboard.
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const encoder = new TextEncoder();
  const channel = `org:${session.organizationId}`;

  let listener: (event: { type: string; payload: unknown }) => void;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: { type: string; payload: unknown }) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      // Initial comment so the client knows the connection is live.
      controller.enqueue(encoder.encode(`: connected\n\n`));

      listener = send;
      realtimeBus.on(channel, listener);

      // Heartbeat to keep intermediary proxies from closing the connection.
      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(`: ping\n\n`));
      }, 25000);

      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        realtimeBus.off(channel, listener);
        controller.close();
      });
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    }
  });
}
