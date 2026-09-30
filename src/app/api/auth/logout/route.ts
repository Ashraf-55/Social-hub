import { NextResponse } from "next/server";
import { sessionCookieOptions } from "@/lib/auth";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  const cookie = sessionCookieOptions();
  res.cookies.set(cookie.name, "", { ...cookie, maxAge: 0 });
  return res;
}
