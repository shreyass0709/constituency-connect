import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { listFaqs } from "@/features/public-site/queries";

export const revalidate = 300;

export const metadata = {
  title: "Frequently asked questions",
  description: "How to raise a concern, track it, and what happens after you do.",
};

export default async function FaqPage() {
  const t = await getTranslations("faqPage");
  const faqs = await listFaqs();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-16">
      <h1 className="font-heading text-3xl font-semibold tracking-tight">{t("title")}</h1>

      {/* FAQPage structured data is what puts these answers straight into search results —
          the point of the page is that people find the answer without calling the office. */}
      {faqs.length > 0 ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: faqs.map((faq) => ({
                "@type": "Question",
                name: faq.question,
                acceptedAnswer: { "@type": "Answer", text: faq.answer },
              })),
            }),
          }}
        />
      ) : null}

      {faqs.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {faqs.map((faq) => (
            <li key={faq.id}>
              <details className="group rounded-2xl border p-4">
                <summary className="cursor-pointer list-none font-medium marker:content-none">
                  {faq.question}
                </summary>
                <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                  {faq.answer}
                </p>
              </details>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">
          {t("empty")}
        </p>
      )}

      <p className="text-sm text-muted-foreground">
        {t.rich("notAnswered", {
          contact: (chunks) => (
            <Link href="/contact" className="text-primary hover:underline">
              {chunks}
            </Link>
          ),
          raise: (chunks) => (
            <Link href="/dashboard/raise" className="text-primary hover:underline">
              {chunks}
            </Link>
          ),
        })}
      </p>
    </div>
  );
}
