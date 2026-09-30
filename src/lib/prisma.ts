import { PrismaClient } from "@prisma/client";

// Prevent creating a new PrismaClient on every hot-reload in dev.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"]
  });
}

// Lazily constructed via a Proxy: importing this module must never throw by
// itself (e.g. in an environment where the Prisma query-engine binary
// couldn't be downloaded). The constructor only runs on first real usage,
// so callers that guard a query in try/catch (see tests/integration/*)
// get a catchable runtime error instead of an unrecoverable import failure.
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = globalForPrisma.prisma ?? (globalForPrisma.prisma = createClient());
    return Reflect.get(client as object, prop, receiver);
  }
});
