import { db } from "../db";
import { sendEmail } from "./email";
import { prefsOf } from "./prefs";
import { sendPush } from "./push";

/**
 * The one entry point for telling people something happened (docs/02-architecture.md §6).
 *
 *   notify → recipients → per-user preference filter → fan out:
 *     in-app  (Notification row — always, it is the record)
 *     push    (FCM to User.fcmTokens; dead tokens pruned on the spot)
 *     email   (Resend)
 *
 * Fire-and-forget by contract: callers run it inside `after()`, and no channel failure
 * may undo a mutation the citizen already saw succeed. Unconfigured channels are simply
 * skipped, so a dev machine with no Resend key behaves like production minus the email.
 */

type Notice = {
  /** Event key, e.g. "complaint.status_changed" — stored for filtering and later prefs. */
  type: string;
  title: string;
  body: string;
  link?: string;
};

export async function notifyUsers(userIds: string[], notice: Notice): Promise<void> {
  const recipients = [...new Set(userIds)].filter(Boolean);
  if (recipients.length === 0) return;

  try {
    const users = await db.user.findMany({
      where: { id: { in: recipients }, isActive: true },
      select: { id: true, email: true, fcmTokens: true, notificationPrefs: true },
    });

    // In-app first and unconditionally: if everything below fails, the bell still knows.
    await db.notification.createMany({
      data: users.map((user) => ({ userId: user.id, ...notice })),
    });

    await Promise.all(users.map((user) => fanOut(user, notice)));
  } catch (error) {
    console.error("[notify] failed", notice.type, error);
  }
}

type Recipient = {
  id: string;
  email: string | null;
  fcmTokens: string[];
  notificationPrefs: unknown;
};

async function fanOut(user: Recipient, notice: Notice) {
  const prefs = prefsOf(user.notificationPrefs);

  if (prefs.push && user.fcmTokens.length > 0) {
    try {
      const { dead } = await sendPush(user.fcmTokens, notice);
      if (dead.length > 0) {
        await db.user.update({
          where: { id: user.id },
          data: { fcmTokens: user.fcmTokens.filter((token) => !dead.includes(token)) },
        });
      }
    } catch (error) {
      console.error("[notify] push failed", notice.type, error);
    }
  }

  // Phone-OTP citizens often have a placeholder @phone.local address — never mail those.
  if (prefs.email && user.email && !user.email.endsWith("@phone.local")) {
    try {
      await sendEmail(user.email, notice);
    } catch (error) {
      console.error("[notify] email failed", notice.type, error);
    }
  }
}

/**
 * Everyone watching a complaint: the citizen who raised it, anyone whose duplicate was
 * merged into it, and the officer currently on it — minus whoever triggered the event,
 * who does not need to be told what they just did.
 */
export async function notifyComplaint(
  complaintId: string,
  notice: Notice,
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
      ...complaint.followers.map((follower) => follower.userId),
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
