import { describe, it, expect, vi } from "vitest";
import { cached, invalidateCache } from "@/lib/cache";

describe("TTL cache (Section 39)", () => {
  it("returns the cached value on a second call within the TTL, without recomputing", async () => {
    const compute = vi.fn().mockResolvedValue({ value: 42 });
    const key = `test:${Math.random()}`;

    const first = await cached(key, 10_000, compute);
    const second = await cached(key, 10_000, compute);

    expect(first).toEqual({ value: 42 });
    expect(second).toEqual({ value: 42 });
    expect(compute).toHaveBeenCalledTimes(1);
  });

  it("recomputes once the TTL has expired", async () => {
    const compute = vi.fn().mockResolvedValueOnce("first").mockResolvedValueOnce("second");
    const key = `test:${Math.random()}`;

    const first = await cached(key, 5, compute);
    await new Promise((r) => setTimeout(r, 15));
    const second = await cached(key, 5, compute);

    expect(first).toBe("first");
    expect(second).toBe("second");
    expect(compute).toHaveBeenCalledTimes(2);
  });

  it("invalidateCache clears entries matching a prefix", async () => {
    const key = `reports:org-${Math.random()}`;
    await cached(key, 60_000, async () => "cached-value");

    invalidateCache("reports:");
    const compute = vi.fn().mockResolvedValue("recomputed");
    const result = await cached(key, 60_000, compute);

    expect(result).toBe("recomputed");
    expect(compute).toHaveBeenCalledTimes(1);
  });
});
