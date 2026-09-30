import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Regression test for a real bug found during review: the Inbox page
 * called `GET /api/conversations/:id` (no `/messages` suffix) but only
 * `src/app/api/conversations/[id]/messages/route.ts` existed — Next.js App
 * Router has no route for `/api/conversations/[id]` on its own in that
 * case, so opening any conversation would 404 in production despite
 * looking fine in every manual code read. A plain "does this file exist"
 * check catches an entire class of these path-mismatch bugs cheaply.
 */
describe("API route files match what the Inbox UI actually fetches", () => {
  const apiRoot = path.resolve(__dirname, "../../src/app/api");
  const uiFile = path.resolve(__dirname, "../../src/app/dashboard/inbox/page.tsx");

  it("has a route.ts for every literal /api/... path referenced by fetch() in the Inbox page", () => {
    const source = fs.readFileSync(uiFile, "utf-8");
    const fetchCalls = [...source.matchAll(/fetch\(`\/api\/([a-zA-Z0-9/_-]+)/g)].map((m) => m[1]);
    expect(fetchCalls.length).toBeGreaterThan(0);

    const uniquePaths = new Set(
      fetchCalls.map((p) =>
        p
          .split("/")
          .map((segment) => (segment.includes("${") ? "[id]" : segment))
          .join("/")
      )
    );

    for (const relativePath of uniquePaths) {
      const routeFile = path.join(apiRoot, relativePath, "route.ts");
      expect(fs.existsSync(routeFile), `expected ${routeFile} to exist for fetch("/api/${relativePath}...")`).toBe(true);
    }
  });
});
