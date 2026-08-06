import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { ArrowRight, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { ActionStats } from "@/features/public-site/action-stats";
import {
  getRepresentative,
  listActionStats,
  listAnnouncements,
  listPublishedStories,
} from "@/features/public-site/queries";

// Public pages are read-mostly and identical for everyone: serve them from the cache and
// refresh in the background (docs/01 §2 performance).
export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const representative = await getRepresentative();
  const title = representative
    ? `${representative.constituencyName} — Office of ${representative.name}`
    : "Constituency Connect";
  return {
    title,
    description:
      representative?.vision ??
      "Raise civic issues, track them, and see what gets fixed — in the open.",
    openGraph: { title, type: "website" },
  };
}

export default async function HomePage() {
  const [representative, stats, stories, announcements] = await Promise.all([
    getRepresentative(),
    listActionStats(),
    listPublishedStories(3),
    listAnnouncements(3),
  ]);

  return (
    <>
      <section className="border-b bg-gradient-to-b from-primary/5 to-transparent">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 px-4 py-20 text-center">
          <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
            {representative?.constituencyName ?? "Your constituency"}
          </p>
          <h1 className="font-heading text-4xl font-semibold tracking-tight sm:text-5xl">
            Your voice, our action
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            {representative?.vision ??
              "Every civic issue heard, triaged, and resolved — in the open."}
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/dashboard/raise">Raise a concern</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/track">Track my concern</Link>
            </Button>
          </div>
          {representative ? (
            <p className="text-sm text-muted-foreground">Office of {representative.name}</p>
          ) : null}
        </div>
      </section>

      {stats.length > 0 ? (
        <section className="mx-auto max-w-6xl px-4 py-16">
          <div className="mb-6 flex flex-wrap items-baseline gap-3">
            <h2 className="font-heading text-2xl font-semibold tracking-tight">What has happened</h2>
            <Link href="/action" className="text-sm text-primary hover:underline">
              See the full dashboard
            </Link>
          </div>
          <ActionStats stats={stats} />
        </section>
      ) : null}

      <section className="border-y bg-muted/30">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-4 px-4 py-16">
          <h2 className="font-heading text-2xl font-semibold tracking-tight">
            See it on the map
          </h2>
          <p className="max-w-xl text-muted-foreground">
            Every concern raised and every project finished, ward by ward. Pins are moved
            slightly so nobody&apos;s home can be identified.
          </p>
          <Button asChild variant="outline">
            <Link href="/map">
              <MapPin />
              Open the Transformation Map
            </Link>
          </Button>
        </div>
      </section>

      {stories.length > 0 ? (
        <section className="mx-auto max-w-6xl px-4 py-16">
          <div className="mb-6 flex flex-wrap items-baseline gap-3">
            <h2 className="font-heading text-2xl font-semibold tracking-tight">Impact stories</h2>
            <Link href="/stories" className="text-sm text-primary hover:underline">
              All stories
            </Link>
          </div>
          <ul className="grid gap-4 sm:grid-cols-3">
            {stories.map((story) => (
              <li key={story.slug}>
                <Link
                  href={`/stories/${story.slug}`}
                  className="flex h-full flex-col gap-3 overflow-hidden rounded-2xl border transition-colors hover:bg-muted/40"
                >
                  {story.coverImage ?? story.afterImage ? (
                    <Image
                      src={(story.coverImage ?? story.afterImage)!}
                      alt=""
                      width={480}
                      height={270}
                      className="aspect-video w-full object-cover"
                    />
                  ) : null}
                  <div className="flex flex-col gap-1 p-4">
                    <span className="font-medium">{story.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {story.ward?.name ?? "Constituency"} · {formatDate(story.publishedAt)}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {announcements.length > 0 ? (
        <section className="mx-auto max-w-6xl px-4 pb-20">
          <div className="mb-6 flex flex-wrap items-baseline gap-3">
            <h2 className="font-heading text-2xl font-semibold tracking-tight">Latest news</h2>
            <Link href="/announcements" className="text-sm text-primary hover:underline">
              All announcements
            </Link>
          </div>
          <ul className="flex flex-col gap-2">
            {announcements.map((announcement) => (
              <li key={announcement.id}>
                <Link
                  href={`/announcements/${announcement.id}`}
                  className="flex items-center gap-3 rounded-2xl border p-4 hover:bg-muted/40"
                >
                  <span className="flex-1 font-medium">{announcement.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(announcement.publishedAt)}
                  </span>
                  <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
