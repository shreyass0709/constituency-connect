import { db } from "@/lib/db";

/** Seeds the bell badge on the server so it is correct before the first poll. */
export async function unreadCount(userId: string): Promise<number> {
  return db.notification.count({ where: { userId, readAt: null } });
}
