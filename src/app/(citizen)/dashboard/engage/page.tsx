import { requireUser } from "@/lib/auth/require-user";
import {
  AppointmentPanel,
  CallbackPanel,
  PollPanel,
  SuggestionPanel,
  VolunteerPanel,
} from "@/features/engagement/citizen-panels";
import { listPolls, listSuggestions, myEngagement } from "@/features/engagement/queries";

export const metadata = { title: "Take part" };

export default async function EngagePage() {
  const user = await requireUser("engagement.participate");

  const [{ appointments, callbacks, volunteer }, polls, suggestions] = await Promise.all([
    myEngagement(user.id),
    listPolls(user.id),
    listSuggestions(user.id),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Take part</h1>
        <p className="text-muted-foreground">
          Meet the office, vote on what matters, and put ideas forward.
        </p>
      </div>

      <PollPanel polls={polls} />
      <AppointmentPanel appointments={appointments} />
      <CallbackPanel callbacks={callbacks} defaultPhone={user.phone ?? ""} />
      <SuggestionPanel suggestions={suggestions} />
      <VolunteerPanel volunteer={volunteer} />
    </div>
  );
}
