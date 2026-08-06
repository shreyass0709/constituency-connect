import { db } from "./db";

/**
 * The one entry point for telling people something happened (docs/02-architecture.md §6).
 * Phase 1 has a single channel — the in-app bell — so this writes `Notification` rows and
 * nothing more. FCM push and Resend email join *inside* these functions in Phase 2; call
 * sites never learn about channels.
 *
 * Fire-and-forget by contract: callers run it in `after()`, and a failure here must never
 * undo a mutation the citizen already saw succeed.
 */

type Notice = {
  /** Event key, e.g. "complaint.status_changed" — stored for later filtering/preferences. */
  type: string;
  title: string;
  body: string;
  link?: string;
};

export async function notifyUsers(userIds: string[], notice: Notice): Promise<void> {
  const recipients = [...new Set(userIds)].filter(Boolean);
  if (recipients.length === 0) return;
  try {
    await db.notification.createMany({
      data: recipients.map((userId) => ({ userId, ...notice })),
    });
  } catch (error) {
    console.error("[notify] failed", notice.type, error);
  }
}

/**
 * Everyone watching a complaint: the citizen who raised it, anyone whose duplicate was
 * merged into it, and the officer currently on it — minus whoever triggered the event,
 * who does not need to be told what they just did.
 */
export async function notifyComplaint(
  complaintId: string,
  notice: Omit<Notice, "link"> & { link?: string },
  options: { exceptUserId?: string | null; alsoNotify?: (string | null | undefined)[] } = {},
): Promise<void> {
  try {
    const complaint = await db.complaint.findUnique({
      where: { id: complaintId },
      select: {
        id: true,
        citizenId: true,
        assignedToId: true,
        followers: { select: { userId: true } },
      },
    });
    if (!complaint) return;

    const recipients = [
      complaint.citizenId,
      complaint.assignedToId,
      ...complaint.followers.map((f) => f.userId),
      ...(options.alsoNotify ?? []),
    ].filter((id): id is string => !!id && id !== options.exceptUserId);

    await notifyUsers(recipients, {
      ...notice,
      link: notice.link ?? `/dashboard/complaints/${complaint.id}`,
    });
  } catch (error) {
    console.error("[notify] failed", notice.type, error);
  }
}
