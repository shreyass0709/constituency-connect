import Link from "next/link";
import { getTranslations } from "next-intl/server";
import Image from "next/image";
import { formatDate } from "@/lib/utils";
import { listPublishedStories } from "@/features/public-site/queries";

export const revalidate = 300;

export const metadata = {
  title: "Impact stories",
  description: "Concerns that citizens raised, and what changed on the ground.",
};

export default async function StoriesPage() {
  const t = await getTranslations("storiesPage");
  const home = await getTranslations("home");
  const stories = await listPublishedStories();

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-16">
      <header className="flex flex-col gap-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">{home("impactStories")}</h1>
        <p className="max-w-2xl text-muted-foreground">{t("intro")}</p>
      </header>

      {stories.length > 0 ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stories.map((story) => (
            <li key={story.slug}>
              <Link
                href={`/stories/${story.slug}`}
                className="flex h-full flex-col overflow-hidden rounded-2xl border transition-colors hover:bg-muted/40"
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
                <div className="flex flex-1 flex-col gap-1 p-4">
                  <span className="font-medium">{story.title}</span>
                  <span className="mt-auto text-xs text-muted-foreground">
                    {story.ward?.name ?? home("constituency")} · {formatDate(story.publishedAt)}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">
          {t("empty")}
        </p>
      )}
    </div>
  );
}
