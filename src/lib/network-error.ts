/**
 * Node's fetch (undici) throws a generic `TypeError: fetch failed` for any
 * network-level failure (DNS, connection refused, TLS/certificate
 * interception by antivirus, proxy issues...) — the actually useful detail
 * lives on `error.cause`, which plain `error.message` doesn't include.
 * Every adapter that calls an external API (Meta Graph API, OpenAI, n8n)
 * should use this instead of `(e as Error).message` in its catch block, so
 * the person running the app sees *why* the request failed, not just that
 * it did.
 */
export function describeFetchError(e: unknown): string {
  if (e instanceof Error) {
    const cause = (e as Error & { cause?: unknown }).cause;
    if (cause instanceof Error) {
      const code = (cause as NodeJS.ErrnoException).code;
      return `${e.message} — ${cause.message}${code ? ` (${code})` : ""}`;
    }
    if (cause) return `${e.message} — ${String(cause)}`;
    return e.message;
  }
  return String(e);
}
