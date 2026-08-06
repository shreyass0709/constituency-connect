import { Prisma } from "@/generated/prisma/client";
import type { ComplaintCategory, ComplaintStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth/require-user";
import { can } from "@/lib/auth/permissions";
import { daysBetween } from "@/lib/utils";
import { OPEN_STATUSES } from "@/constants/status";
import { canViewComplaint, complaintScopeWhere } from "./lib/access";

// Reads for Server Components. Every one of them narrows by `complaintScopeWhere`, so a
// forgotten filter cannot leak another citizen's complaint.

const CARD_SELECT = {
  id: true,
  code: true,
  title: true,
  status: true,
  priority: true,
  category: true,
  createdAt: true,
  dueAt: true,
  completedAt: true,
  // Coordinates ride along for the field officer's distance sort and navigation link.
  latitude: true,
  longitude: true,
  address: true,
  // The triage board reads its one-click suggestions out of here.
  aiMeta: true,
  ward: { select: { name: true } },
  department: { select: { name: true } },
  assignedTo: { select: { name: true } },
  _count: { select: { media: true } },
} satisfies Prisma.ComplaintSelect;

/**
 * The SLA countdown is derived here, not in the component: "is it late" depends on the
 * current time, and reading the clock during render is impure.
 */
export type ComplaintCard = Prisma.ComplaintGetPayload<{ select: typeof CARD_SELECT }> & {
  overdue: boolean;
  daysLeft: number | null;
};

function withSla(
  complaint: Prisma.ComplaintGetPayload<{ select: typeof CARD_SELECT }>,
  now: Date,
): ComplaintCard {
  const settled = Boolean(complaint.completedAt);
  return {
    ...complaint,
    overdue: Boolean(complaint.dueAt && !settled && complaint.dueAt < now),
    daysLeft: complaint.dueAt && !settled ? daysBetween(now, complaint.dueAt) : null,
  };
}

export type ComplaintFilters = {
  /** Set for "my concerns" — a staff member's own complaints, not everyone's. */
  citizenId?: string;
  status?: ComplaintStatus | ComplaintStatus[];
  category?: ComplaintCategory;
  departmentId?: string;
  wardId?: string;
  assignedToId?: string;
  /** Past its SLA deadline and still not finished. */
  overdue?: boolean;
  /** Someone has raised a hand about it — an ESCALATION entry exists on the timeline. */
  escalated?: boolean;
  /** The AI never managed to tag it, so a human has to. */
  unclassified?: boolean;
  q?: string;
  page?: number;
  limit?: number;
};

/**
 * "Nobody has looked at this yet, human or machine": either the AI never wrote its
 * verdict, or it wrote a failure. Exported so the triage badge and the queue agree.
 */
export const UNCLASSIFIED_WHERE: Prisma.ComplaintWhereInput = {
  status: { in: ["SUBMITTED", "ACKNOWLEDGED"] },
  OR: [
    { aiMeta: { equals: Prisma.DbNull } },
    { aiMeta: { path: ["status"], equals: "failed" } },
  ],
};

function whereFrom(user: CurrentUser, filters: ComplaintFilters): Prisma.ComplaintWhereInput {
  const { citizenId, status, category, departmentId, wardId, assignedToId, q } = filters;
  return {
    AND: [
      complaintScopeWhere(user),
      citizenId ? { citizenId } : {},
      // Drafts are private scratch space — they surface only on the drafts screen.
      status ? { status: Array.isArray(status) ? { in: status } : status } : { status: { not: "DRAFT" } },
      category ? { category } : {},
      departmentId ? { departmentId } : {},
      wardId ? { wardId } : {},
      assignedToId ? { assignedToId } : {},
      filters.overdue
        ? {
            dueAt: { lt: new Date() },
            status: { notIn: ["DRAFT", "COMPLETED", "CLOSED", "REJECTED"] },
          }
        : {},
      filters.escalated
        ? {
            timeline: { some: { type: "ESCALATION" } },
            status: { notIn: ["DRAFT", "CLOSED", "REJECTED"] },
          }
        : {},
      filters.unclassified ? UNCLASSIFIED_WHERE : {},
      q
        ? {
            OR: [
              { code: { contains: q, mode: "insensitive" } },
              { title: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
            ],
          }
        : {},
    ],
  };
}

export async function listComplaints(user: CurrentUser, filters: ComplaintFilters = {}) {
  const limit = Math.min(filters.limit ?? 25, 50);
  const page = Math.max(filters.page ?? 1, 1);
  const where = whereFrom(user, filters);

  const [items, total] = await Promise.all([
    db.complaint.findMany({
      where,
      select: CARD_SELECT,
      orderBy: [{ createdAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.complaint.count({ where }),
  ]);

  const now = new Date();
  return {
    items: items.map((complaint) => withSla(complaint, now)),
    meta: { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) },
  };
}

export async function listMyDrafts(userId: string) {
  return db.complaint.findMany({
    where: { citizenId: userId, status: "DRAFT" },
    select: { id: true, title: true, category: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getDraft(id: string, userId: string) {
  const draft = await db.complaint.findFirst({
    where: { id, citizenId: userId, status: "DRAFT" },
    select: {
      id: true,
      title: true,
      description: true,
      category: true,
      latitude: true,
      longitude: true,
      address: true,
      landmark: true,
      isPrivate: true,
      media: { select: { id: true, kind: true, url: true } },
    },
  });
  return draft;
}

const DETAIL_SELECT = {
  id: true,
  code: true,
  title: true,
  description: true,
  category: true,
  status: true,
  priority: true,
  language: true,
  citizenId: true,
  departmentId: true,
  assignedToId: true,
  latitude: true,
  longitude: true,
  address: true,
  landmark: true,
  isPrivate: true,
  dueAt: true,
  acknowledgedAt: true,
  estimatedCompletion: true,
  completedAt: true,
  closedAt: true,
  rejectionReason: true,
  rating: true,
  feedbackText: true,
  createdAt: true,
  citizen: { select: { id: true, name: true, phone: true } },
  ward: { select: { id: true, name: true } },
  village: { select: { name: true } },
  department: { select: { id: true, name: true } },
  assignedTo: { select: { id: true, name: true } },
  duplicateOf: { select: { id: true, code: true, title: true } },
  media: {
    select: { id: true, kind: true, url: true, stage: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  },
  timeline: {
    select: {
      id: true,
      type: true,
      fromStatus: true,
      toStatus: true,
      note: true,
      isPublic: true,
      createdAt: true,
      actor: { select: { id: true, name: true, role: true } },
    },
    orderBy: { createdAt: "asc" },
  },
} satisfies Prisma.ComplaintSelect;

export type ComplaintDetail = Prisma.ComplaintGetPayload<{ select: typeof DETAIL_SELECT }> & {
  overdue: boolean;
  daysLeft: number | null;
};

/** Returns null when the complaint does not exist *or* is not this viewer's to see. */
export async function getComplaintForViewer(id: string, user: CurrentUser) {
  const found = await db.complaint.findUnique({ where: { id }, select: DETAIL_SELECT });
  if (!found || !canViewComplaint(user, found)) return null;

  const now = new Date();
  const settled = Boolean(found.completedAt);
  const complaint = {
    ...found,
    overdue: Boolean(found.dueAt && !settled && found.dueAt < now),
    daysLeft: found.dueAt && !settled ? daysBetween(now, found.dueAt) : null,
  };

  // Internal notes are for people who work complaints, not for the citizen who raised one.
  if (can(user.role, "complaint.view_all")) return complaint;
  return { ...complaint, timeline: complaint.timeline.filter((entry) => entry.isPublic) };
}

/**
 * The department dashboard's numbers. Average resolution time is one SQL aggregate on
 * purpose — pulling every closed row into Node to subtract two dates would fall over at
 * the 100k-complaint scale the project is designed for.
 */
export async function departmentStats(departmentId: string) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [open, overdue, completedThisMonth, escalated, byCategory, averages] = await Promise.all([
    db.complaint.count({
      where: { departmentId, status: { in: [...OPEN_STATUSES] } },
    }),
    db.complaint.count({
      where: {
        departmentId,
        dueAt: { lt: now },
        status: { notIn: ["DRAFT", "COMPLETED", "CLOSED", "REJECTED"] },
      },
    }),
    db.complaint.count({
      where: { departmentId, completedAt: { gte: monthStart } },
    }),
    db.complaint.count({
      where: {
        departmentId,
        timeline: { some: { type: "ESCALATION" } },
        status: { notIn: ["DRAFT", "CLOSED", "REJECTED"] },
      },
    }),
    db.complaint.groupBy({
      by: ["category"],
      where: { departmentId, status: { not: "DRAFT" } },
      _count: { _all: true },
      orderBy: { _count: { category: "desc" } },
    }),
    db.$queryRaw<{ days: number | null }[]>`
      SELECT AVG(EXTRACT(EPOCH FROM ("completedAt" - "createdAt")) / 86400) AS days
      FROM "Complaint"
      WHERE "departmentId" = ${departmentId} AND "completedAt" IS NOT NULL
    `,
  ]);

  return {
    open,
    overdue,
    completedThisMonth,
    escalated,
    avgResolutionDays: averages[0]?.days ? Number(averages[0].days) : null,
    byCategory: byCategory.map((row) => ({ category: row.category, count: row._count._all })),
  };
}

/** Departments and the officers who can be assigned work in them. */
export async function assignmentOptions() {
  const [departments, officers] = await Promise.all([
    db.department.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.user.findMany({
      where: { role: { in: ["FIELD_OFFICER", "DEPARTMENT_OFFICER"] }, isActive: true },
      select: { id: true, name: true, departmentId: true },
      orderBy: { name: "asc" },
    }),
  ]);
  return { departments, officers };
}

/** Public track-by-code: status and public timeline only — no names, no phone, no address. */
export async function getPublicComplaintByCode(code: string) {
  const complaint = await db.complaint.findUnique({
    where: { code: code.trim().toUpperCase() },
    select: {
      code: true,
      title: true,
      category: true,
      status: true,
      createdAt: true,
      acknowledgedAt: true,
      estimatedCompletion: true,
      completedAt: true,
      closedAt: true,
      department: { select: { name: true } },
      ward: { select: { name: true } },
      timeline: {
        where: { isPublic: true },
        select: { id: true, type: true, toStatus: true, note: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!complaint || complaint.status === "DRAFT") return null;
  return complaint;
}

/** Counters for the citizen dashboard and the office header tabs. */
export async function complaintCounts(user: CurrentUser) {
  const scope = complaintScopeWhere(user);
  const grouped = await db.complaint.groupBy({
    by: ["status"],
    where: scope,
    _count: { _all: true },
  });
  const counts = Object.fromEntries(grouped.map((row) => [row.status, row._count._all])) as Partial<
    Record<ComplaintStatus, number>
  >;
  const total = grouped.reduce((sum, row) => sum + row._count._all, 0);
  return { counts, total: total - (counts.DRAFT ?? 0) };
}
