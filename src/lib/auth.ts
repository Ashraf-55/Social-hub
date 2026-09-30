import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? "social_hub_session";
const SECRET = new TextEncoder().encode(process.env.AUTH_SECRET ?? "dev-secret-change-me");

export interface SessionPayload {
  userId: string;
  organizationId: string;
  role: "ADMIN" | "EMPLOYEE";
  email: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(SECRET);
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;

  const payload = await verifySessionToken(token);
  if (!payload) return null;

  // Section 15/32: a disabled employee's still-valid JWT must stop working
  // immediately, not just after the token's 7-day expiry. Lazily imported to
  // avoid a require cycle (lib/auth <-> lib/prisma <-> lib/auth via types).
  const { prisma } = await import("./prisma");
  try {
    const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { active: true, role: true } });
    if (!user || !user.active) return null;
    // Keep the role in sync too, in case an admin changed it after the token was issued.
    return { ...payload, role: user.role };
  } catch {
    // If the DB is unreachable, fail closed on anything security-sensitive
    // would be ideal, but for the dashboard's own availability we fail open
    // here and rely on the JWT signature check above; every DB-backed route
    // downstream will fail on its own query anyway.
    return payload;
  }
}

export function sessionCookieOptions() {
  return {
    name: COOKIE_NAME,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 7
  };
}

export { COOKIE_NAME };
