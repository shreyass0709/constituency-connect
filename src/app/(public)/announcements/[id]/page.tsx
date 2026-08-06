import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { getAnnouncement } from "@/features/public-site/queries";

export const revalidate = 300;

export async function generateMetadata({
  params,
}: PageProps<"/announcements/[id]">): Promise<Metadata> {
  const { id } = await params;
  const announcement = await getAnnouncement(id);
  if (!announcement) return { title: "Announcement not found" };
  return {
    title: announcement.title,
    description: announcement.body.slice(0, 160),
    openGraph: { title: announcement.title, type: "article" },
  };
}

export default async function AnnouncementPage({ params }: PageProps<"/announcements/[id]">) {
  const { id } = await params;
  const announcement = await getAnnouncement(id);
  if (!announcement) notFound();

  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-16">
      <Link
        href="/announcements"
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
        All announcements
      </Link>

      <header className="flex flex-col gap-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">{announcement.title}</h1>
        <p className="text-sm text-muted-foreground">
          {formatDate(announcement.publishedAt)}
          {announcement.category ? ` · ${announcement.category}` : ""}
        </p>
      </header>

      {announcement.coverImage ? (
        <Image
          src={announcement.coverImage}
          alt=""
          width={960}
          height={540}
          className="aspect-video w-full rounded-2xl border object-cover"
        />
      ) : null}

      <div className="whitespace-pre-wrap leading-relaxed">{announcement.body}</div>
    </article>
  );
}
