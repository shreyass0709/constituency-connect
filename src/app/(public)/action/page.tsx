import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ActionStats } from "@/features/public-site/action-stats";
import { listActionStats } from "@/features/public-site/queries";

export const revalidate = 300;

export const metadata = {
  title: "Action Dashboard",
  description: "Live counters of what the office has done, recomputed every night.",
};

export default async function ActionDashboardPage() {
  const t = await getTranslations("actionPage");
  const stats = await listActionStats();

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-16">
      <header className="flex flex-col gap-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="max-w-2xl text-muted-foreground">{t("intro")}</p>
      </header>

      {stats.length > 0 ? (
        <ActionStats stats={stats} />
      ) : (
        <p className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">
          {t("empty")}
        </p>
      )}

      <p className="text-sm text-muted-foreground">
        {t.rich("detail", {
          map: (chunks) => (
            <Link href="/map" className="text-primary hover:underline">
              {chunks}
            </Link>
          ),
          stories: (chunks) => (
            <Link href="/stories" className="text-primary hover:underline">
              {chunks}
            </Link>
          ),
        })}
      </p>
    </div>
  );
}
