"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, LoaderCircle, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/utils";
import { generateStoryDraft, publishImpactStory, upsertImpactStory } from "./actions";

export type EditableStory = {
  id: string;
  slug: string;
  title: string;
  body: string;
  beforeImage: string | null;
  afterImage: string | null;
  coverImage: string | null;
  aiGenerated: boolean;
  publishedAt: Date | null;
};

/**
 * The publish gate, as a screen. A story can be edited freely while it is a draft; the
 * only thing that puts it in front of the public is the button at the bottom, pressed by
 * a person who read it.
 */
export function StoryEditor({ story }: { story: EditableStory }) {
  const router = useRouter();
  const [title, setTitle] = useState(story.title);
  const [body, setBody] = useState(story.body);
  const [before, setBefore] = useState(story.beforeImage ?? "");
  const [after, setAfter] = useState(story.afterImage ?? "");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const result = await upsertImpactStory({
      id: story.id,
      title,
      body,
      beforeImage: before || null,
      afterImage: after || null,
      coverImage: story.coverImage,
      aiGenerated: story.aiGenerated,
    });
    setBusy(false);
    if (!result.ok) return toast.error(result.error);
    toast.success("Saved.");
    router.refresh();
  }

  async function togglePublished() {
    setBusy(true);
    const result = await publishImpactStory({ id: story.id, publish: !story.publishedAt });
    setBusy(false);
    if (!result.ok) return toast.error(result.error);
    toast.success(story.publishedAt ? "Unpublished." : "Published to the public site.");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={
            story.publishedAt
              ? "rounded-full bg-green-500/10 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:text-green-300"
              : "rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
          }
        >
          {story.publishedAt ? `Published ${formatDate(story.publishedAt)}` : "Draft"}
        </span>
        {story.aiGenerated ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs text-primary">
            <Sparkles className="size-3" aria-hidden />
            AI draft — read it before publishing
          </span>
        ) : null}
        {story.publishedAt ? (
          <Link
            href={`/stories/${story.slug}`}
            className="ml-auto text-xs text-primary hover:underline"
            target="_blank"
          >
            View on the site
          </Link>
        ) : null}
      </div>

      <div className="grid gap-2">
        <Label htmlFor={`title-${story.id}`}>Title</Label>
        <Input
          id={`title-${story.id}`}
          value={title}
          maxLength={120}
          onChange={(event) => setTitle(event.target.value)}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor={`body-${story.id}`}>Story</Label>
        <Textarea
          id={`body-${story.id}`}
          rows={10}
          value={body}
          maxLength={5000}
          onChange={(event) => setBody(event.target.value)}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor={`before-${story.id}`}>Before image URL</Label>
          <Input
            id={`before-${story.id}`}
            value={before}
            onChange={(event) => setBefore(event.target.value)}
            placeholder="Taken from the citizen's photo"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`after-${story.id}`}>After image URL</Label>
          <Input
            id={`after-${story.id}`}
            value={after}
            onChange={(event) => setAfter(event.target.value)}
            placeholder="Taken from the officer's proof photo"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={busy} onClick={save}>
          {busy ? <LoaderCircle className="animate-spin" /> : <Save />}
          Save draft
        </Button>
        <Button disabled={busy} onClick={togglePublished}>
          {story.publishedAt ? <EyeOff /> : <Eye />}
          {story.publishedAt ? "Unpublish" : "Publish"}
        </Button>
      </div>
    </div>
  );
}

/** "This complaint is finished — write it up." One button, one AI call, still a draft. */
export function DraftStoryButton({ complaintId, code }: { complaintId: string; code: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const result = await generateStoryDraft({ complaintId });
        setBusy(false);
        if (!result.ok) return toast.error(result.error);
        toast.success(
          result.data.aiGenerated
            ? `Draft written from ${code}. Read it before publishing.`
            : `Draft started from ${code} — the assistant was off, so it needs writing.`,
        );
        router.refresh();
      }}
    >
      {busy ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
      Draft a story
    </Button>
  );
}
