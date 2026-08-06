import type { MetadataRoute } from "next";
import { PUBLIC_NAV } from "@/constants/public-nav";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

export const revalidate = 3600;

/** Static pages plus everything published — drafts and complaints never appear here. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (env.APP_URL ?? env.BETTER_AUTH_URL).replace(/\/$/, "");

  const [stories, announcements] = await Promise.all([
    db.impactStory.findMany({
      where: { publishedAt: { not: null } },
      select: { slug: true, publishedAt: true },
    }),
    db.announcement.findMany({
      where: { publishedAt: { not: null } },
      select: { id: true, publishedAt: true },
    }),
  ]);

  return [
    { url: `${base}/`, priority: 1 },
    { url: `${base}/track`, priority: 0.8 },
    ...PUBLIC_NAV.map((item) => ({ url: `${base}${item.href}`, priority: 0.7 })),
    ...stories.map((story) => ({
      url: `${base}/stories/${story.slug}`,
      lastModified: story.publishedAt ?? undefined,
      priority: 0.6,
    })),
    ...announcements.map((announcement) => ({
      url: `${base}/announcements/${announcement.id}`,
      lastModified: announcement.publishedAt ?? undefined,
      priority: 0.5,
    })),
  ];
}
