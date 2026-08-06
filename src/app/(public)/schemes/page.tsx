import { ExternalLink } from "lucide-react";
import { listSchemes } from "@/features/public-site/queries";

export const revalidate = 300;

export const metadata = {
  title: "Government schemes",
  description: "Schemes you may be eligible for, what they give, and what to bring.",
};

export default async function SchemesPage() {
  const schemes = await listSchemes();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-16">
      <header className="flex flex-col gap-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">Government schemes</h1>
        <p className="text-muted-foreground">
          What each scheme is for, who qualifies, and the papers to bring to the office.
        </p>
      </header>

      {schemes.length > 0 ? (
        <ul className="flex flex-col gap-4">
          {schemes.map((scheme) => (
            <li key={scheme.id} className="flex flex-col gap-3 rounded-2xl border p-5">
              <div className="flex flex-wrap items-baseline gap-2">
                <h2 className="font-heading text-lg font-semibold">{scheme.title}</h2>
                {scheme.category ? (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    {scheme.category}
                  </span>
                ) : null}
              </div>
              <p className="text-sm text-muted-foreground">{scheme.summary}</p>

              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    Who qualifies
                  </dt>
                  <dd>{scheme.eligibility}</dd>
                </div>
                {scheme.benefits ? (
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                      What you get
                    </dt>
                    <dd>{scheme.benefits}</dd>
                  </div>
                ) : null}
              </dl>

              {scheme.documentsRequired.length > 0 ? (
                <div className="text-sm">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Documents to bring
                  </p>
                  <ul className="mt-1 flex flex-wrap gap-2">
                    {scheme.documentsRequired.map((document) => (
                      <li key={document} className="rounded-full bg-muted px-2.5 py-0.5 text-xs">
                        {document}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {scheme.applyUrl ? (
                <a
                  href={scheme.applyUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex w-fit items-center gap-2 text-sm text-primary hover:underline"
                >
                  <ExternalLink className="size-4" aria-hidden />
                  Apply online
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">
          No schemes have been listed yet.
        </p>
      )}
    </div>
  );
}
