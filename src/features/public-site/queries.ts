import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";

/**
 * Every read behind the public, unauthenticated site.
 *
 * The rule this file exists to enforce: **nothing here selects a citizen's identity.**
 * No `citizen`, no `phone`, no `email`, no exact complaint coordinates. If a public page
 * needs a field, it gets added to a select here, where that rule is visible — not to an
 * ad-hoc query in a page component (docs/01 §2 privacy).
 *
 * Every read is cached for five minutes behind the `public-site` tag. These pages used to
 * be ISR and lost it when the cookie-based locale made them render per request — without
 * this, an anonymous visitor costs four Neon round trips before a byte of HTML goes out,
 * which measured as an 820 ms TTFB and a 4.5 s mobile LCP. The content actions bust the
 * tag, so a staff publish still appears immediately.
 *
 * ponytail: `unstable_cache`, not the `use cache` directive that supersedes it in Next 16.
 * `use cache` needs `cacheComponents: true`, which changes rendering semantics for the
 * whole app — too wide a blast radius for a TTFB fix. Migrate when the app opts into
 * Cache Components deliberately.
 */

export const PUBLIC_SITE_TAG = "public-site";

const CACHE = { revalidate: 300, tags: [PUBLIC_SITE_TAG] };

export const getRepresentative = unstable_cache(
  async () => db.representative.findFirst(),
  ["public:representative"],
  CACHE,
);

export const listActionStats = unstable_cache(
  async () =>
    db.actionStat.findMany({
      select: { id: true, key: true, label: true, value: true, icon: true },
      orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    }),
  ["public:action-stats"],
  CACHE,
);

export const listPublishedStories = unstable_cache(
  async (limit: number = 24) =>
    db.impactStory.findMany({
      where: { publishedAt: { not: null } },
      select: {
        id: true,
        slug: true,
        title: true,
        coverImage: true,
        beforeImage: true,
        afterImage: true,
        publishedAt: true,
        ward: { select: { name: true } },
      },
      orderBy: { publishedAt: "desc" },
      take: limit,
    }),
  ["public:stories"],
  CACHE,
);

/**
 * Uncached. `unstable_cache` throws "incrementalCache missing" outside a Next request, so
 * anything running in a plain Node process — `scripts/smoke.ts` asserts this exact select
 * carries no PII — has to call the query directly. Pages use the cached export below.
 */
export async function storyBySlug(slug: string) {
  return db.impactStory.findFirst({
    where: { slug, publishedAt: { not: null } },
    select: {
      slug: true,
      title: true,
      body: true,
      coverImage: true,
      beforeImage: true,
      afterImage: true,
      publishedAt: true,
      ward: { select: { name: true } },
      // The complaint's *code* is public (it is on the citizen's own tracking page);
      // who raised it is not, so the citizen relation is never selected.
      complaint: { select: { code: true, category: true } },
      project: { select: { title: true } },
    },
  });
}

export const getStoryBySlug = unstable_cache(storyBySlug, ["public:story"], CACHE);

export const listAnnouncements = unstable_cache(
  async (limit: number = 30) =>
    db.announcement.findMany({
      where: { publishedAt: { not: null } },
      select: {
        id: true,
        title: true,
        body: true,
        category: true,
        coverImage: true,
        publishedAt: true,
      },
      orderBy: { publishedAt: "desc" },
      take: limit,
    }),
  ["public:announcements"],
  CACHE,
);

export const getAnnouncement = unstable_cache(
  async (id: string) =>
    db.announcement.findFirst({
      where: { id, publishedAt: { not: null } },
      select: { title: true, body: true, category: true, coverImage: true, publishedAt: true },
    }),
  ["public:announcement"],
  CACHE,
);

export const listSchemes = unstable_cache(
  async () =>
    db.scheme.findMany({
      where: { isActive: true },
      orderBy: [{ category: "asc" }, { title: "asc" }],
    }),
  ["public:schemes"],
  CACHE,
);

export const listGallery = unstable_cache(
  async (limit: number = 60) =>
    db.galleryItem.findMany({
      select: { id: true, kind: true, url: true, caption: true, category: true, takenAt: true },
      orderBy: [{ takenAt: "desc" }, { createdAt: "desc" }],
      take: limit,
    }),
  ["public:gallery"],
  CACHE,
);

export const listFaqs = unstable_cache(
  async () =>
    db.faq.findMany({
      select: { id: true, question: true, answer: true, category: true },
      orderBy: [{ sortOrder: "asc" }, { question: "asc" }],
    }),
  ["public:faqs"],
  CACHE,
);

export const listTestimonials = unstable_cache(
  async (limit: number = 12) =>
    db.testimonial.findMany({
      where: { approved: true },
      select: { id: true, name: true, quote: true, avatarUrl: true },
      take: limit,
    }),
  ["public:testimonials"],
  CACHE,
);

export const listDocuments = unstable_cache(
  async () =>
    db.documentFile.findMany({
      select: { id: true, title: true, category: true, fileUrl: true, sizeBytes: true },
      orderBy: { createdAt: "desc" },
    }),
  ["public:documents"],
  CACHE,
);
