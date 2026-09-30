/**
 * Minimal structured logger (Section 35). Every entry is a single-line JSON
 * object to stdout/stderr so it's trivially picked up by any log collector
 * (Docker logs, Vercel logs, CloudWatch, etc.) without extra infra.
 *
 * Categories match Section 35 exactly: api, webhook, automation, auth,
 * integration, ai. Each `meta` object is passed through `redact()` first,
 * which strips anything that looks like a token/password/secret — callers
 * don't have to remember to scrub sensitive fields themselves, but should
 * still avoid passing raw tokens in the first place.
 */
type LogCategory = "api" | "webhook" | "automation" | "auth" | "integration" | "ai";
type LogLevel = "info" | "warn" | "error";

const SENSITIVE_KEY_PATTERN = /token|password|secret|authorization|cookie|apikey|api_key/i;

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4 || value == null) return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEY_PATTERN.test(key) ? "[redacted]" : redact(val, depth + 1);
    }
    return out;
  }
  return value;
}

function write(level: LogLevel, category: LogCategory, message: string, meta?: Record<string, unknown>) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    category,
    message,
    ...(meta ? { meta: redact(meta) } : {})
  };
  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  info: (category: LogCategory, message: string, meta?: Record<string, unknown>) => write("info", category, message, meta),
  warn: (category: LogCategory, message: string, meta?: Record<string, unknown>) => write("warn", category, message, meta),
  error: (category: LogCategory, message: string, meta?: Record<string, unknown>) => write("error", category, message, meta)
};
