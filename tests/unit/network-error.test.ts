import { describe, it, expect } from "vitest";
import { describeFetchError } from "@/lib/network-error";

describe("describeFetchError", () => {
  it("includes the underlying cause and error code when present (typical undici fetch failure)", () => {
    const cause = Object.assign(new Error("getaddrinfo ENOTFOUND graph.facebook.com"), { code: "ENOTFOUND" });
    const err = Object.assign(new Error("fetch failed"), { cause });
    expect(describeFetchError(err)).toBe("fetch failed — getaddrinfo ENOTFOUND graph.facebook.com (ENOTFOUND)");
  });

  it("falls back to just the message when there is no cause", () => {
    const err = new Error("Invalid token");
    expect(describeFetchError(err)).toBe("Invalid token");
  });

  it("handles a non-Error thrown value safely", () => {
    expect(describeFetchError("some string error")).toBe("some string error");
  });
});
