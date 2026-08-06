import { BookOpen } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { requireUser } from "@/lib/auth/require-user";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/utils";
import { DraftStoryButton, StoryEditor } from "@/features/public-site/story-editor";

export const metadata = { title: "Impact stories" };

export default async function StoriesAdminPage() {
  await requireUser("content.publish");

  const [stories, candidates] = await Promise.all([
    db.impactStory.findMany({
      select: {
        id: true,
        slug: true,
        title: true,
        body: true,
        beforeImage: true,
        afterImage: true,
        coverImage: true,
        aiGenerated: true,
        publishedAt: true,
      },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      take: 30,
    }),
    // Finished complaints nobody has written up yet.
    db.complaint.findMany({
      where: { status: "CLOSED", impactStory: null, isPrivate: false },
      select: { id: true, code: true, title: true, closedAt: true },
      orderBy: { closedAt: "desc" },
      take: 10,
    }),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Impact stories</h1>
        <p className="text-muted-foreground">
          Written from complaints that are actually finished. Nothing goes public until you
          publish it.
        </p>
      </div>

      {candidates.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-muted-foreground">Ready to write up</h2>
          <ul className="flex flex-col gap-2">
            {candidates.map((complaint) => (
              <li
                key={complaint.id}
                className="flex flex-wrap items-center gap-3 rounded-2xl border p-4"
              >
                <span className="font-mono text-xs text-muted-foreground">{complaint.code}</span>
                <span className="flex-1 truncate">{complaint.title}</span>
                <span className="text-xs text-muted-foreground">
                  closed {formatDate(complaint.closedAt)}
                </span>
                <DraftStoryButton complaintId={complaint.id} code={complaint.code} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-medium text-muted-foreground">All stories</h2>
        {stories.length > 0 ? (
          stories.map((story) => <StoryEditor key={story.id} story={story} />)
        ) : (
          <EmptyState
            icon={BookOpen}
            title="No stories yet"
            description="Close a complaint, then draft its story here."
          />
        )}
      </section>
    </div>
  );
}
