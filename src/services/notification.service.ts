import { prisma } from "@/lib/prisma";
import { NotificationType } from "@prisma/client";
import { realtimeBus } from "@/lib/realtime";

export async function createNotification(organizationId: string, type: NotificationType, message: string, meta?: Record<string, unknown>) {
  const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { mutedNotificationTypes: true } });
  if (org?.mutedNotificationTypes.includes(type)) {
    return null; // Section 48: org has muted this category — skip DB write and realtime push entirely
  }

  const notification = await prisma.notification.create({
    data: { organizationId, type, message, meta: meta as any }
  });

  realtimeBus.publish(organizationId, { type: "notification.created", payload: notification });

  return notification;
}
