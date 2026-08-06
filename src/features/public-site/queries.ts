import { db } from "@/lib/db";

/**
 * Every read behind the public, unauthenticated site.
 *
 * The rule this file exists to enforce: **nothing here selects a citizen's identity.**
 * No `citizen`, no `phone`, no `email`, no exact complaint coordinates. If a public page
 * needs a field, it gets added to a select here, where that rule is visible — not to an
 * ad-hoc query in a page component (docs/01 §2 privacy).
 */

export async function getRepresentative() {
  return db.representative.findFirst();
}

export async function listActionStats() {
  return db.actionStat.findMany({
    select: { id: true, key: true, label: true, value: true, icon: true },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
  });
}

export async function listPublishedStories(limit = 24) {
  return db.impactStory.findMany({
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
  });
}

export async function getStoryBySlug(slug: string) {
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

export async function listAnnouncements(limit = 30) {
  return db.announcement.findMany({
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
  });
}

export async function getAnnouncement(id: string) {
  return db.announcement.findFirst({
    where: { id, publishedAt: { not: null } },
    select: { title: true, body: true, category: true, coverImage: true, publishedAt: true },
  });
}

export async function listSchemes() {
  return db.scheme.findMany({
    where: { isActive: true },
    orderBy: [{ category: "asc" }, { title: "asc" }],
  });
}

export async function listGallery(limit = 60) {
  return db.galleryItem.findMany({
    select: { id: true, kind: true, url: true, caption: true, category: true, takenAt: true },
    orderBy: [{ takenAt: "desc" }, { createdAt: "desc" }],
    take: limit,
  });
}

export async function listFaqs() {
  return db.faq.findMany({
    select: { id: true, question: true, answer: true, category: true },
    orderBy: [{ sortOrder: "asc" }, { question: "asc" }],
  });
}

export async function listTestimonials(limit = 12) {
  return db.testimonial.findMany({
    where: { approved: true },
    select: { id: true, name: true, quote: true, avatarUrl: true },
    take: limit,
  });
}

export async function listDocuments() {
  return db.documentFile.findMany({
    select: { id: true, title: true, category: true, fileUrl: true, sizeBytes: true },
    orderBy: { createdAt: "desc" },
  });
}
