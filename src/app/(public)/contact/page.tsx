import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Clock, Download, Mail, MapPin, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getRepresentative, listDocuments } from "@/features/public-site/queries";

export const revalidate = 300;

export const metadata = {
  title: "Contact the office",
  description: "Office address, hours, emergency numbers and downloadable documents.",
};

type EmergencyContact = { label?: string; phone?: string };

export default async function ContactPage() {
  const t = await getTranslations("contactPage");
  const nav = await getTranslations("publicNav");
  const [representative, documents] = await Promise.all([getRepresentative(), listDocuments()]);

  const emergency = Array.isArray(representative?.emergencyContacts)
    ? (representative.emergencyContacts as EmergencyContact[])
    : [];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-10 px-4 py-16">
      <header className="flex flex-col gap-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("intro")}</p>
        <Button asChild className="w-fit">
          <Link href="/dashboard/raise">{nav("raiseConcern")}</Link>
        </Button>
      </header>

      <section className="grid gap-4 sm:grid-cols-2">
        {representative?.officeAddress ? (
          <p className="flex items-start gap-3 rounded-2xl border p-4 text-sm">
            <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="whitespace-pre-wrap">{representative.officeAddress}</span>
          </p>
        ) : null}
        {representative?.officeHours ? (
          <p className="flex items-start gap-3 rounded-2xl border p-4 text-sm">
            <Clock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            {representative.officeHours}
          </p>
        ) : null}
        {representative?.contactPhone ? (
          <p className="flex items-start gap-3 rounded-2xl border p-4 text-sm">
            <Phone className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            <a href={`tel:${representative.contactPhone}`} className="hover:underline">
              {representative.contactPhone}
            </a>
          </p>
        ) : null}
        {representative?.contactEmail ? (
          <p className="flex items-start gap-3 rounded-2xl border p-4 text-sm">
            <Mail className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            <a href={`mailto:${representative.contactEmail}`} className="hover:underline">
              {representative.contactEmail}
            </a>
          </p>
        ) : null}
      </section>

      {emergency.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-xl font-semibold">{t("emergency")}</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {emergency.map((contact, index) => (
              <li key={index} className="flex items-center gap-3 rounded-2xl border p-4 text-sm">
                <Phone className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="flex-1">{contact.label}</span>
                <a href={`tel:${contact.phone}`} className="font-medium hover:underline">
                  {contact.phone}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {documents.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-xl font-semibold">{t("documents")}</h2>
          <ul className="flex flex-col gap-2">
            {documents.map((document) => (
              <li key={document.id}>
                <a
                  href={document.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 rounded-2xl border p-4 text-sm hover:bg-muted/40"
                >
                  <Download className="size-4 text-muted-foreground" aria-hidden />
                  <span className="flex-1">{document.title}</span>
                  {document.category ? (
                    <span className="text-xs text-muted-foreground">{document.category}</span>
                  ) : null}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
