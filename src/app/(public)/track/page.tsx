import { headers } from "next/headers";
import Link from "next/link";
import { Search } from "lucide-react";
import { StatusChip } from "@/components/shared/status-chip";
import { Timeline } from "@/components/shared/timeline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { getTranslations } from "next-intl/server";
import { rateLimit } from "@/lib/ratelimit";
import { formatDate } from "@/lib/utils";
import { getPublicComplaintByCode } from "@/features/complaints/queries";

export const metadata = {
  title: "Track a concern",
  description: "Check the status of a concern with its code — no sign-in needed.",
};

/**
 * No login, no PII: a code holder sees status and public history, never a name, phone
 * or exact address (docs/01 §2 privacy). Lookups share the 60/min/IP public-API bucket
 * so nobody can walk the code space (docs/02 §8).
 */
export default async function TrackPage({ searchParams }: PageProps<"/track">) {
  const { code } = await searchParams;
  const query = typeof code === "string" ? code.trim() : "";
  const t = await getTranslations("track");
  const hint = await getTranslations("statusHint");
  const category = await getTranslations("category");
  const detail = await getTranslations("complaintDetail");

  let throttled = false;
  if (query) {
    const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "anonymous";
    throttled = !(await rateLimit(`public-api:${ip}`, 60, 60_000)).ok;
  }

  const complaint = query && !throttled ? await getPublicComplaintByCode(query) : null;
  const notFound = Boolean(query) && !throttled && !complaint;

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-16">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>

      <form method="get" className="flex gap-2">
        <Input
          name="code"
          defaultValue={query}
          placeholder="CC-2026-01042"
          aria-label={t("codeLabel")}
          aria-invalid={notFound || undefined}
          aria-describedby={notFound ? "track-not-found" : undefined}
          className="font-mono"
        />
        <Button type="submit">
          <Search />
          {t("track")}
        </Button>
      </form>

      {throttled ? (
        <p role="alert" className="rounded-2xl border border-dashed p-6 text-center text-muted-foreground">
          {t("throttled")}
        </p>
      ) : null}

      {notFound ? (
        <p
          id="track-not-found"
          role="alert"
          className="rounded-2xl border border-dashed p-6 text-center text-muted-foreground"
        >
          {t.rich("notFound", {
            signin: (chunks) => (
              <Link href="/login" className="text-primary hover:underline">
                {chunks}
              </Link>
            ),
          })}
        </p>
      ) : null}

      {complaint ? (
        <article className="flex flex-col gap-6 rounded-2xl border p-6">
          <header className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm text-muted-foreground">{complaint.code}</span>
              <StatusChip status={complaint.status} />
            </div>
            <h2 className="font-heading text-xl font-semibold">{complaint.title}</h2>
            <p className="text-sm text-muted-foreground">{hint(complaint.status)}</p>
          </header>

          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                {detail("field.category")}
              </dt>
              <dd className="font-medium">{category(complaint.category)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                {detail("field.ward")}
              </dt>
              <dd className="font-medium">{complaint.ward?.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                {detail("field.department")}
              </dt>
              <dd className="font-medium">{complaint.department?.name ?? detail("notRouted")}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                {detail("field.raised")}
              </dt>
              <dd className="font-medium">{formatDate(complaint.createdAt)}</dd>
            </div>
          </dl>

          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-medium text-muted-foreground">{detail("history")}</h3>
            <Timeline entries={complaint.timeline} />
          </div>
        </article>
      ) : null}
    </section>
  );
}
