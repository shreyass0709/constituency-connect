import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/require-user";
import { getDraft } from "@/features/complaints/queries";
import { RaiseWizard } from "@/features/complaints/raise-wizard";

export const metadata = { title: "Raise a concern" };

export default async function RaisePage({ searchParams }: PageProps<"/dashboard/raise">) {
  const user = await requireUser("complaint.create");
  const { draft: draftId } = await searchParams;

  const [draft, ward] = await Promise.all([
    typeof draftId === "string" ? getDraft(draftId, user.id) : null,
    user.wardId
      ? db.ward.findUnique({ where: { id: user.wardId }, select: { name: true } })
      : null,
  ]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Raise a concern</h1>
        <p className="text-muted-foreground">
          Three short steps. Your progress is saved as you go.
        </p>
      </div>
      <RaiseWizard
        draft={draft ? { ...draft, media: draft.media } : null}
        homeWard={ward?.name ?? null}
      />
    </div>
  );
}
