import { requireUser } from "@/lib/auth/require-user";
import { LiveChat } from "@/features/chat/live-chat";

export const metadata = { title: "Messages" };

export default async function StaffChatPage() {
  const user = await requireUser("complaint.view_all");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Messages</h1>
        <p className="text-muted-foreground">Live conversations with citizens.</p>
      </div>
      <LiveChat viewerId={user.id} isStaff />
    </div>
  );
}
