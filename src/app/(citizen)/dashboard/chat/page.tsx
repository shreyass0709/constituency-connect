import { requireUser } from "@/lib/auth/require-user";
import { LiveChat } from "@/features/chat/live-chat";

export const metadata = { title: "Message the office" };

export default async function CitizenChatPage() {
  const user = await requireUser();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Message the office</h1>
        <p className="text-muted-foreground">
          Staff reply during office hours. For a civic problem, raising a concern is faster —
          it comes with a tracking code and a record.
        </p>
      </div>
      <LiveChat viewerId={user.id} isStaff={false} />
    </div>
  );
}
