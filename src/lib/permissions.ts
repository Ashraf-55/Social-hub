import { Permission, RoleName } from "@prisma/client";
import { prisma } from "./prisma";

/** ADMIN implicitly has every permission; EMPLOYEE only what was granted. */
export async function hasPermission(
  userId: string,
  role: RoleName,
  permission: Permission
): Promise<boolean> {
  if (role === "ADMIN") return true;

  const grant = await prisma.userPermission.findUnique({
    where: { userId_permission: { userId, permission } }
  });
  return Boolean(grant);
}

export function requirePermission(hasIt: boolean) {
  if (!hasIt) {
    const err = new Error("Forbidden: missing permission");
    (err as any).status = 403;
    throw err;
  }
}
