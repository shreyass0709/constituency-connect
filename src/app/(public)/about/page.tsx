import Image from "next/image";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { getRepresentative, listTestimonials } from "@/features/public-site/queries";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const representative = await getRepresentative();
  return {
    title: representative ? `About ${representative.name}` : "About",
    description: representative?.bio ?? "About the representative and the office.",
  };
}

type Achievement = { year?: string | number; title?: string; description?: string };

export default async function AboutPage() {
  const t = await getTranslations("aboutPage");
  const [representative, testimonials] = await Promise.all([
    getRepresentative(),
    listTestimonials(6),
  ]);

  if (!representative) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20">
        <p className="text-muted-foreground">{t("notPublished")}</p>
      </div>
    );
  }

  const achievements = Array.isArray(representative.achievements)
    ? (representative.achievements as Achievement[])
    : [];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-12 px-4 py-16">
      {/* Search engines get the office as a structured Person, so a name search surfaces
          the real office rather than a scrape of it. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Person",
            name: representative.name,
            jobTitle: representative.type,
            description: representative.bio,
            image: representative.photo ?? undefined,
            worksFor: { "@type": "GovernmentOrganization", name: representative.constituencyName },
            email: representative.contactEmail ?? undefined,
            telephone: representative.contactPhone ?? undefined,
          }),
        }}
      />

      <header className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        {representative.photo ? (
          <Image
            src={representative.photo}
            alt=""
            width={112}
            height={112}
            className="size-28 rounded-2xl object-cover"
          />
        ) : null}
        <div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">
            {representative.name}
          </h1>
          <p className="text-muted-foreground">
            {representative.type} · {representative.constituencyName}
            {representative.party ? ` · ${representative.party}` : ""}
          </p>
        </div>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-xl font-semibold">{t("about")}</h2>
        <p className="whitespace-pre-wrap text-muted-foreground">{representative.bio}</p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-xl font-semibold">{t("vision")}</h2>
        <p className="whitespace-pre-wrap text-muted-foreground">{representative.vision}</p>
      </section>

      {achievements.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-xl font-semibold">{t("achievements")}</h2>
          <ol className="flex flex-col gap-3 border-l pl-6">
            {achievements.map((item, index) => (
              <li key={index} className="relative">
                <span
                  aria-hidden
                  className="absolute -left-[1.65rem] top-2 size-2 rounded-full bg-primary"
                />
                <p className="font-medium">
                  {item.title}
                  {item.year ? (
                    <span className="ml-2 text-sm text-muted-foreground">{item.year}</span>
                  ) : null}
                </p>
                {item.description ? (
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                ) : null}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {testimonials.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-xl font-semibold">{t("testimonials")}</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {testimonials.map((testimonial) => (
              <li key={testimonial.id} className="rounded-2xl border p-4">
                <blockquote className="text-sm">“{testimonial.quote}”</blockquote>
                <p className="mt-2 text-xs text-muted-foreground">— {testimonial.name}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
