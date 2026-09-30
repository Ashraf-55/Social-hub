import { describe, it, expect } from "vitest";
import { WhatsAppAdapter } from "@/modules/platforms/adapters/whatsapp.adapter";

describe("WhatsAppAdapter.parseWebhookPayload", () => {
  const adapter = new WhatsAppAdapter();

  it("normalizes a text message into a UnifiedMessage", () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  { id: "wamid.123", from: "201000000000", type: "text", text: { body: "مرحبا" }, timestamp: "1710000000" }
                ]
              }
            }
          ]
        }
      ]
    };

    const result = adapter.parseWebhookPayload(payload);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      platform: "whatsapp",
      externalMessageId: "wamid.123",
      customerExternalId: "201000000000",
      direction: "inbound",
      type: "text",
      content: "مرحبا"
    });
  });

  it("returns an empty array when there are no messages", () => {
    expect(adapter.parseWebhookPayload({ entry: [{ changes: [{ value: {} }] }] })).toHaveLength(0);
  });
});
