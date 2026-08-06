import { Inbox } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { requireUser } from "@/lib/auth/require-user";

export const metadata = { title: "Office" };

export default async function OfficeDashboard() {
  const user = await requireUser();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Office dashboard</h1>
        <p className="text-muted-foreground">Signed in as {user.name}.</p>
      </div>
      <EmptyState
        icon={Inbox}
        title="Nothing to triage yet"
        description="Triage, assignment and the SLA board arrive in Phase 1."
      />
    </div>
  );
}
