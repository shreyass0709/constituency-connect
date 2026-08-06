import { requireUser } from "@/lib/auth/require-user";
import { staffEngagementQueues } from "@/features/engagement/queries";
import {
  AppointmentQueue,
  CallbackQueue,
  NewPoll,
  SuggestionQueue,
  VolunteerQueue,
} from "@/features/engagement/staff-queues";

export const metadata = { title: "Engagement" };

export default async function EngagementPage() {
  await requireUser("complaint.triage");
  const { appointments, callbacks, suggestions, volunteers } = await staffEngagementQueues();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Engagement</h1>
        <p className="text-muted-foreground">
          Appointments, callbacks, ideas and volunteers — everything citizens sent that is
          not a complaint.
        </p>
      </div>

      <Section title="Appointments" count={appointments.length}>
        <AppointmentQueue appointments={appointments} />
      </Section>

      <Section title="Callbacks" count={callbacks.length}>
        <CallbackQueue callbacks={callbacks} />
      </Section>

      <Section title="Suggestions" count={suggestions.length}>
        <SuggestionQueue suggestions={suggestions} />
      </Section>

      <Section title="Volunteers" count={volunteers.length}>
        <VolunteerQueue volunteers={volunteers} />
      </Section>

      <Section title="Open a poll">
        <NewPoll />
      </Section>
    </div>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 font-heading text-lg font-semibold">
        {title}
        {count !== undefined ? (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
            {count}
          </span>
        ) : null}
      </h2>
      {children}
    </section>
  );
}
