import { headers } from "next/headers";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "./db";

export type AuditEntry = {
  actorId?: string | null;
  action: string; // "complaint.assign", "user.role_change", …
  entity: string;
  entityId?: string;
  meta?: Prisma.InputJsonValue;
};

// Append-only trail. Called by actionClient after every successful mutation; a failed
// audit write must never roll back work the citizen already saw succeed, so it logs
// loudly and moves on.
export async function audit(entry: AuditEntry): Promise<void> {
  try {
    const h = await headers();
    await db.auditLog.create({
      data: {
        ...entry,
        ip: h.get("x-forwarded-for")?.split(",")[0]?.trim(),
        userAgent: h.get("user-agent"),
      },
    });
  } catch (error) {
    console.error("[audit] failed to write", entry.action, error);
  }
}
