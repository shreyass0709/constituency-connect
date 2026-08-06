import {
  BadgeIndianRupee,
  Bus,
  CircleEllipsis,
  CloudRain,
  Construction,
  Droplets,
  GraduationCap,
  House,
  Leaf,
  Lightbulb,
  ShieldAlert,
  Stethoscope,
  Trash2,
  Tractor,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type {
  ComplaintCategory,
  ComplaintStatus,
  Priority,
} from "@/generated/prisma/enums";

// Single source for how a status/priority/category is named and coloured anywhere in
// the app (docs/05-ui.md §1). Colour is never the only signal — chips always carry text.

export const STATUS_LABEL: Record<ComplaintStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  ACKNOWLEDGED: "Acknowledged",
  ASSIGNED: "Assigned",
  DEPT_REVIEW: "Department review",
  FIELD_VERIFICATION: "Field verification",
  IN_PROGRESS: "Work in progress",
  COMPLETED: "Completed — confirm",
  CLOSED: "Closed",
  REJECTED: "Rejected",
  REOPENED: "Reopened",
};

export const STATUS_CLASS: Record<ComplaintStatus, string> = {
  DRAFT: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
  SUBMITTED: "bg-blue-500/10 text-blue-600 dark:text-blue-300",
  ACKNOWLEDGED: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-300",
  ASSIGNED: "bg-violet-500/10 text-violet-600 dark:text-violet-300",
  DEPT_REVIEW: "bg-violet-500/10 text-violet-600 dark:text-violet-300",
  FIELD_VERIFICATION: "bg-amber-500/10 text-amber-600 dark:text-amber-300",
  IN_PROGRESS: "bg-amber-500/10 text-amber-600 dark:text-amber-300",
  COMPLETED: "bg-lime-500/10 text-lime-700 dark:text-lime-300",
  CLOSED: "bg-green-500/10 text-green-700 dark:text-green-300",
  REJECTED: "bg-red-500/10 text-red-600 dark:text-red-300",
  REOPENED: "bg-orange-500/10 text-orange-600 dark:text-orange-300",
};

/** What the citizen is told is happening, in plain language. */
export const STATUS_HINT: Record<ComplaintStatus, string> = {
  DRAFT: "Not submitted yet — finish and send it.",
  SUBMITTED: "Received. The office will review it shortly.",
  ACKNOWLEDGED: "The office has read your concern.",
  ASSIGNED: "Handed to a department and an officer.",
  DEPT_REVIEW: "The department is reviewing the details.",
  FIELD_VERIFICATION: "An officer is verifying it on site.",
  IN_PROGRESS: "Work has started.",
  COMPLETED: "Marked done. Please confirm or reopen within 7 days.",
  CLOSED: "Resolved and closed.",
  REJECTED: "Could not be taken up — see the reason below.",
  REOPENED: "You reopened this. The office is looking again.",
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

export const PRIORITY_CLASS: Record<Priority, string> = {
  LOW: "bg-gray-500/10 text-gray-600 dark:text-gray-300",
  MEDIUM: "bg-blue-500/10 text-blue-600 dark:text-blue-300",
  HIGH: "bg-amber-500/10 text-amber-600 dark:text-amber-300",
  URGENT: "bg-red-500/10 text-red-600 dark:text-red-300",
};

export const CATEGORY_LABEL: Record<ComplaintCategory, string> = {
  ROAD: "Road",
  DRAINAGE: "Drainage",
  STREET_LIGHT: "Street light",
  WATER: "Water",
  ELECTRICITY: "Electricity",
  GARBAGE: "Garbage",
  SCHOOL: "School",
  HOSPITAL: "Health",
  PENSION: "Pension",
  HOUSING: "Housing",
  PUBLIC_SAFETY: "Public safety",
  TRANSPORT: "Transport",
  AGRICULTURE: "Agriculture",
  ENVIRONMENT: "Environment",
  OTHER: "Something else",
};

export const CATEGORY_ICON: Record<ComplaintCategory, LucideIcon> = {
  ROAD: Construction,
  DRAINAGE: CloudRain,
  STREET_LIGHT: Lightbulb,
  WATER: Droplets,
  ELECTRICITY: Zap,
  GARBAGE: Trash2,
  SCHOOL: GraduationCap,
  HOSPITAL: Stethoscope,
  PENSION: BadgeIndianRupee,
  HOUSING: House,
  PUBLIC_SAFETY: ShieldAlert,
  TRANSPORT: Bus,
  AGRICULTURE: Tractor,
  ENVIRONMENT: Leaf,
  OTHER: CircleEllipsis,
};

export const CATEGORIES = Object.keys(CATEGORY_LABEL) as ComplaintCategory[];

/** Statuses a citizen sees as "still with us" — used by list filters and dashboards. */
export const OPEN_STATUSES = [
  "SUBMITTED",
  "ACKNOWLEDGED",
  "ASSIGNED",
  "DEPT_REVIEW",
  "FIELD_VERIFICATION",
  "IN_PROGRESS",
  "REOPENED",
] as const satisfies readonly ComplaintStatus[];
