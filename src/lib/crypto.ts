import crypto from "crypto";

/**
 * AES-256-GCM helper for encrypting access tokens before they touch the
 * database. Never store or return raw platform tokens to the frontend.
 * Key is derived from AUTH_SECRET so no extra env var is required, but you
 * may set a dedicated TOKEN_ENCRYPTION_KEY in production if you prefer key
 * separation.
 */
const rawKey = process.env.TOKEN_ENCRYPTION_KEY ?? process.env.AUTH_SECRET ?? "dev-secret-change-me";
const KEY = crypto.createHash("sha256").update(rawKey).digest();

export function encryptSecret(plainText: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

export function decryptSecret(payload: string): string {
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, 12);
  const authTag = buf.subarray(12, 28);
  const encrypted = buf.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", KEY, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
