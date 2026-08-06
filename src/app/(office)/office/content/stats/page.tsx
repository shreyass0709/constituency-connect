import { requireUser } from "@/lib/auth/require-user";
import { db } from "@/lib/db";
import { StatsEditor } from "@/features/public-site/stats-editor";

export const metadata = { title: "Action counters" };

export default async function StatsPage() {
  await requireUser("content.publish");
  const stats = await db.actionStat.findMany({
    select: { id: true, key: true, label: true, value: true, sortOrder: true, autoComputed: true },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
  });

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Action counters</h1>
        <p className="text-muted-foreground">
          The numbers on the public Action Dashboard. Automatic ones are recalculated each
          night from complaints and projects; the rest are yours to keep current.
        </p>
      </div>
      <StatsEditor stats={stats} />
    </div>
  );
}
