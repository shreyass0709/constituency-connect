import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";
import { CATEGORY_LABEL } from "@/constants/status";
import { formatDate } from "@/lib/utils";
import { BeforeAfter } from "@/features/public-site/before-after";
import { getStoryBySlug } from "@/features/public-site/queries";

export const revalidate = 300;

export async function generateMetadata({
  params,
}: PageProps<"/stories/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const story = await getStoryBySlug(slug);
  if (!story) return { title: "Story not found" };

  return {
    title: story.title,
    description: story.body.slice(0, 160),
    openGraph: {
      title: story.title,
      description: story.body.slice(0, 160),
      type: "article",
      publishedTime: story.publishedAt?.toISOString(),
      images: story.coverImage ?? story.afterImage ? [(story.coverImage ?? story.afterImage)!] : [],
    },
  };
}

export default async function StoryPage({ params }: PageProps<"/stories/[slug]">) {
  const { slug } = await params;
  const story = await getStoryBySlug(slug);
  if (!story) notFound();

  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-16">
      <Link
        href="/stories"
        className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
        All stories
      </Link>

      <header className="flex flex-col gap-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">{story.title}</h1>
        <p className="text-sm text-muted-foreground">
          {story.ward?.name ?? "Constituency"} · {formatDate(story.publishedAt)}
          {story.complaint ? ` · raised as ${story.complaint.code}` : ""}
          {story.complaint ? ` · ${CATEGORY_LABEL[story.complaint.category]}` : ""}
        </p>
      </header>

      {story.beforeImage && story.afterImage ? (
        <BeforeAfter before={story.beforeImage} after={story.afterImage} label={story.title} />
      ) : story.coverImage ? (
        <Image
          src={story.coverImage}
          alt=""
          width={960}
          height={540}
          className="aspect-video w-full rounded-2xl border object-cover"
        />
      ) : null}

      <div className="whitespace-pre-wrap leading-relaxed">{story.body}</div>

      {story.project ? (
        <p className="text-sm text-muted-foreground">Part of the {story.project.title} project.</p>
      ) : null}

      <p className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
        Something similar near you?{" "}
        <Link href="/dashboard/raise" className="text-primary hover:underline">
          Raise a concern
        </Link>{" "}
        and you will get a tracking code straight away.
      </p>
    </article>
  );
}
