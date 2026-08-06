import Image from "next/image";
import { Play } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { listGallery } from "@/features/public-site/queries";

export const revalidate = 300;

export const metadata = {
  title: "Gallery & media",
  description: "Photographs and video from the constituency and the office's work.",
};

/**
 * Gallery and "media coverage" share one surface: both are `GalleryItem` rows, told
 * apart by their category. A second model for press clippings would be a second CRUD
 * screen for the same thing.
 */
export default async function GalleryPage() {
  const items = await listGallery();

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-16">
      <header className="flex flex-col gap-2">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">Gallery & media</h1>
        <p className="text-muted-foreground">From the wards, the office, and the press.</p>
      </header>

      {items.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => (
            <li key={item.id} className="overflow-hidden rounded-2xl border">
              <a href={item.url} target="_blank" rel="noreferrer" className="block">
                {item.kind === "IMAGE" ? (
                  <Image
                    src={item.url}
                    alt={item.caption ?? ""}
                    width={400}
                    height={400}
                    className="aspect-square w-full object-cover"
                  />
                ) : (
                  <span className="flex aspect-square w-full items-center justify-center bg-muted">
                    <Play className="size-6 text-muted-foreground" aria-hidden />
                  </span>
                )}
              </a>
              {item.caption ? (
                <p className="p-3 text-xs text-muted-foreground">
                  {item.caption}
                  {item.takenAt ? ` · ${formatDate(item.takenAt)}` : ""}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">
          Nothing in the gallery yet.
        </p>
      )}
    </div>
  );
}
