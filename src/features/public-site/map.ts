import { Prisma } from "@/generated/prisma/client";
import type { ComplaintCategory, ComplaintStatus, ProjectStatus } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { PUBLIC_MAP_WHERE, toComplaintPin, type MapPin } from "./lib/pins";

/**
 * What the Transformation Map is allowed to know.
 *
 * The shaping rules live in `lib/pins.ts` (pure, tested); this file is the data access
 * around them. The `select` below is deliberately narrow — adding `citizen`,
 * `description` or `address` here would put them on an anonymous page.
 */

export type { MapPin } from "./lib/pins";

export async function listMapPins(
  filters: {
    status?: ComplaintStatus;
    category?: ComplaintCategory;
    projectStatus?: ProjectStatus;
  } = {},
): Promise<MapPin[]> {
  const [complaints, projects] = await Promise.all([
    db.complaint.findMany({
      where: {
        ...PUBLIC_MAP_WHERE,
        ...(filters.status && { status: filters.status }),
        ...(filters.category && { category: filters.category }),
        latitude: { not: null },
        longitude: { not: null },
      },
      select: {
        id: true,
        status: true,
        category: true,
        latitude: true,
        longitude: true,
        impactStory: {
          select: { slug: true, beforeImage: true, afterImage: true, publishedAt: true },
        },
      },
      take: 2000,
      orderBy: { createdAt: "desc" },
    }),
    db.project.findMany({
      where: {
        latitude: { not: null },
        longitude: { not: null },
        ...(filters.projectStatus && { status: filters.projectStatus }),
      },
      select: {
        id: true,
        title: true,
        status: true,
        latitude: true,
        longitude: true,
        beforeImage: true,
        afterImage: true,
      },
      take: 500,
    }),
  ]);

  // Projects are the office's own work — no jitter, they are meant to be findable.
  const projectPins: MapPin[] = projects.map((project) => ({
    id: project.id,
    kind: "project",
    status: project.status,
    title: project.title,
    latitude: project.latitude!,
    longitude: project.longitude!,
    beforeImage: project.beforeImage,
    afterImage: project.afterImage,
  }));

  return [...complaints.map(toComplaintPin), ...projectPins];
}

/** Ward outlines for the map's boundary layer; only wards that have one drawn. */
export async function listWardBoundaries() {
  return db.ward.findMany({
    where: { boundary: { not: Prisma.DbNull } },
    select: { id: true, number: true, name: true, boundary: true },
  });
}
