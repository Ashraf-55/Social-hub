/**
 * Minimal in-memory TTL cache (Section 39: "Caching عند الحاجة"). Used for
 * expensive, read-heavy, slightly-stale-tolerant endpoints — currently
 * /api/reports, whose aggregation queries (several groupBy + two raw SQL
 * scans) are the heaviest reads in the app and don't need to reflect a
 * webhook that landed half a second ago.
 *
 * Process-local, same caveat as src/middleware.ts's rate limiter: fine for
 * a single instance; back it with Redis (or Next's `unstable_cache` /
 * `fetch` revalidation once this moves off raw route handlers for these
 * queries) before running more than one app replica, so instances don't
 * serve inconsistently stale data to different users.
 */
const store = new Map<string, { value: unknown; expiresAt: number }>();

export async function cached<T>(key: string, ttlMs: number, compute: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && hit.expiresAt > Date.now()) {
    return hit.value as T;
  }

  const value = await compute();
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

export function invalidateCache(prefix: string) {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}
