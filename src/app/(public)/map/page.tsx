import "leaflet/dist/leaflet.css";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { TransformationMap } from "@/features/public-site/transformation-map";

export const revalidate = 300;

export const metadata = {
  title: "Transformation Map",
  description:
    "Every concern raised and every project completed across the constituency, ward by ward.",
};

export default async function MapPage() {
  const t = await getTranslations("mapPage");
  // Centre on the constituency's own complaints rather than a hardcoded city.
  const anchor = await db.complaint.findFirst({
    where: { latitude: { not: null }, longitude: { not: null }, isPrivate: false },
    select: { latitude: true, longitude: true },
    orderBy: { createdAt: "desc" },
  });
  const center: [number, number] = [anchor?.latitude ?? 12.9716, anchor?.longitude ?? 77.5946];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-16">
      <header className="flex flex-col gap-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="max-w-2xl text-muted-foreground">{t("intro")}</p>
      </header>

      <TransformationMap center={center} />
    </div>
  );
}
