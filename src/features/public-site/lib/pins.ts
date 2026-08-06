import type { ComplaintCategory, ComplaintStatus } from "@/generated/prisma/enums";
import { jitterPoint } from "./jitter";

/**
 * The privacy boundary of the public map, kept pure so it can be tested on its own —
 * "we forgot to strip something" is the failure that matters here, and it should not
 * need a database to catch.
 */

export type MapPin = {
  id: string;
  kind: "complaint" | "project";
  status: string;
  category?: ComplaintCategory | null;
  title: string;
  latitude: number;
  longitude: number;
  beforeImage?: string | null;
  afterImage?: string | null;
  storySlug?: string | null;
};

const PUBLIC_STATUSES: ComplaintStatus[] = [
  "ACKNOWLEDGED",
  "ASSIGNED",
  "DEPT_REVIEW",
  "FIELD_VERIFICATION",
  "IN_PROGRESS",
  "COMPLETED",
  "CLOSED",
];

/** Rows that may appear on the public map at all. Drafts and private ones never do. */
export const PUBLIC_MAP_WHERE = {
  isPrivate: false,
  status: { in: PUBLIC_STATUSES },
} as const;

/** The complaint row the public map is allowed to see, before it is turned into a pin. */
export type PublicComplaintRow = {
  id: string;
  status: ComplaintStatus;
  category: ComplaintCategory;
  latitude: number | null;
  longitude: number | null;
  impactStory: {
    slug: string;
    beforeImage: string | null;
    afterImage: string | null;
    publishedAt: Date | null;
  } | null;
};

/** Whatever the row contains, only these fields survive — and the position is jittered. */
export function toComplaintPin(complaint: PublicComplaintRow): MapPin {
  const pin = jitterPoint(complaint.latitude!, complaint.longitude!, complaint.id);
  const story = complaint.impactStory?.publishedAt ? complaint.impactStory : null;
  return {
    id: complaint.id,
    kind: "complaint",
    status: complaint.status,
    category: complaint.category,
    // A category, not the citizen's words — descriptions can name people and houses.
    title: complaint.category,
    latitude: pin.latitude,
    longitude: pin.longitude,
    beforeImage: story?.beforeImage ?? null,
    afterImage: story?.afterImage ?? null,
    storySlug: story?.slug ?? null,
  };
}
