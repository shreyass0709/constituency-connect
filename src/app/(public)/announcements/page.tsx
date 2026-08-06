import Link from "next/link";
import { formatDate } from "@/lib/utils";
import { listAnnouncements } from "@/features/public-site/queries";

export const revalidate = 300;

export const metadata = {
  title: "News & announcements",
  description: "Notices, updates and announcements from the constituency office.",
};

export default async function AnnouncementsPage() {
  const announcements = await listAnnouncements();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-16">
      <h1 className="font-heading text-3xl font-semibold tracking-tight">News & announcements</h1>

      {announcements.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {announcements.map((announcement) => (
            <li key={announcement.id}>
              <Link
                href={`/announcements/${announcement.id}`}
                className="flex flex-col gap-1 rounded-2xl border p-4 hover:bg-muted/40"
              >
                <span className="flex flex-wrap items-baseline gap-2">
                  <span className="font-medium">{announcement.title}</span>
                  {announcement.category ? (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {announcement.category}
                    </span>
                  ) : null}
                </span>
                <span className="line-clamp-2 text-sm text-muted-foreground">
                  {announcement.body}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDate(announcement.publishedAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">
          Nothing announced yet.
        </p>
      )}
    </div>
  );
}
