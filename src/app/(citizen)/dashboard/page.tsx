import Link from "next/link";
import { MessageSquarePlus } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { OPEN_STATUSES } from "@/constants/status";
import { requireUser } from "@/lib/auth/require-user";
import { ComplaintList } from "@/features/complaints/complaint-list";
import { listComplaints } from "@/features/complaints/queries";

export const metadata = { title: "Dashboard" };

export default async function CitizenDashboard() {
  const user = await requireUser();

  const [{ items: open }, { items: recent }] = await Promise.all([
    listComplaints(user, { citizenId: user.id, status: [...OPEN_STATUSES], limit: 5 }),
    listComplaints(user, { citizenId: user.id, limit: 5 }),
  ]);
  const awaiting = recent.filter((complaint) => complaint.status === "COMPLETED");

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Namaste, {user.name.split(" ")[0]}
          </h1>
          <p className="text-muted-foreground">Your concerns and their progress live here.</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/raise">
            <MessageSquarePlus />
            Raise a concern
          </Link>
        </Button>
      </div>

      {awaiting.length > 0 ? (
        <section className="flex flex-col gap-2 rounded-2xl border border-primary/30 bg-primary/5 p-4">
          <h2 className="font-medium">Waiting on you</h2>
          <p className="text-sm text-muted-foreground">
            Work is marked done on these. Confirm it, or reopen if it is not right.
          </p>
          <ComplaintList complaints={awaiting} basePath="/dashboard/complaints" />
        </section>
      ) : null}

      {recent.length > 0 ? (
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <h2 className="font-heading text-lg font-semibold">
              {open.length > 0 ? "In progress" : "Recent"}
            </h2>
            <Link
              href="/dashboard/complaints"
              className="ml-auto text-sm text-primary underline-offset-4 hover:underline"
            >
              See all
            </Link>
          </div>
          <ComplaintList
            complaints={open.length > 0 ? open : recent}
            basePath="/dashboard/complaints"
          />
        </section>
      ) : (
        <EmptyState
          icon={MessageSquarePlus}
          title="No concerns raised yet"
          description="Tell us what needs fixing in your area — a photo and two lines is enough."
          action={
            <Button asChild>
              <Link href="/dashboard/raise">Raise a concern</Link>
            </Button>
          }
        />
      )}
    </div>
  );
}
