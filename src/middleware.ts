import { NextRequest, NextResponse } from "next/server";

/**
 * Simple in-memory sliding-window rate limiter applied to all /api/*
 * routes, with a stricter window for /api/auth/login (brute-force
 * protection) and /api/webhooks/* (protects the DB from a platform
 * retry-storm during an outage on our end).
 *
 * This is process-local — fine for a single instance / Docker Compose
 * deployment. For a multi-instance production deployment, replace the
 * `buckets` Map with a shared store (Redis `INCR` + `EXPIRE`, or a
 * managed rate-limiting service) behind the same `checkLimit()` signature.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function checkLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (bucket.count >= limit) return false;

  bucket.count++;
  return true;
}

function clientIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? "unknown";
}

const STATE_CHANGING_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

/**
 * CSRF protection (Section 32). The session cookie is already SameSite=lax
 * + HttpOnly, which blocks the classic cross-site form-POST CSRF case. As a
 * second layer (covers browsers/proxies that mishandle SameSite, and
 * cross-site fetches with credentials), state-changing requests to
 * non-webhook API routes must have an Origin/Referer matching our own host.
 * Webhook routes are exempt: they're never called by a browser and use
 * platform signature verification instead (see adapters' verifyWebhook()).
 */
export function isSameOrigin(request: NextRequest): boolean {
  if (request.nextUrl.pathname.startsWith("/api/webhooks/")) return true;

  const origin = request.headers.get("origin") ?? request.headers.get("referer");
  if (!origin) return true; // same-origin requests from some clients omit both; rely on SameSite cookie here

  try {
    return new URL(origin).host === request.nextUrl.host;
  } catch {
    return false;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Chrome's DevTools automatically probes this path on every localhost
  // dev server; it's not a real request our app needs to handle, just
  // silence the noisy 404 in the terminal/console.
  if (pathname === "/.well-known/appspecific/com.chrome.devtools.json") {
    return NextResponse.json({});
  }

  const ip = clientIp(request);

  if (STATE_CHANGING_METHODS.has(request.method) && !isSameOrigin(request)) {
    return NextResponse.json({ error: "Cross-origin request blocked" }, { status: 403 });
  }

  let limit = 120;
  let windowMs = 60_000; // general API: 120 req/min/IP

  if (pathname === "/api/auth/login") {
    limit = 10;
    windowMs = 60_000; // 10 login attempts/min/IP
  } else if (pathname.startsWith("/api/webhooks/")) {
    limit = 300;
    windowMs = 60_000; // generous, but still bounded, for platform delivery bursts
  }

  const allowed = checkLimit(`${ip}:${pathname.startsWith("/api/webhooks/") ? "webhooks" : pathname}`, limit, windowMs);

  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*", "/.well-known/appspecific/com.chrome.devtools.json"]
};
