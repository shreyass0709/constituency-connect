"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle, Plus, X } from "lucide-react";
import { toast } from "sonner";
import type { AppointmentStatus, SuggestionStatus, VolunteerStatus } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/lib/safe-action";
import { formatDate } from "@/lib/utils";
import {
  createPoll,
  resolveCallback,
  updateAppointmentStatus,
  updateSuggestionStatus,
  updateVolunteerStatus,
} from "./actions";

function useRunner() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function call<T>(action: () => Promise<ActionResult<T>>, success: string) {
    setBusy(true);
    const result = await action();
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return false;
    }
    toast.success(success);
    router.refresh();
    return true;
  }

  return { busy, call };
}

export function AppointmentQueue({
  appointments,
}: {
  appointments: {
    id: string;
    purpose: string;
    requestedDate: Date;
    slot: string | null;
    status: string;
    citizen: { name: string; phone: string | null };
  }[];
}) {
  const run = useRunner();

  if (appointments.length === 0) {
    return <Empty>No appointments waiting.</Empty>;
  }

  const set = (id: string, status: AppointmentStatus, message: string) =>
    run.call(() => updateAppointmentStatus({ id, status, staffNote: null }), message);

  return (
    <ul className="flex flex-col gap-2">
      {appointments.map((appointment) => (
        <li key={appointment.id} className="flex flex-wrap items-center gap-3 rounded-2xl border p-4">
          <div className="min-w-48 flex-1">
            <p className="font-medium">
              {formatDate(appointment.requestedDate)}
              {appointment.slot ? ` · ${appointment.slot}` : ""}
            </p>
            <p className="text-sm text-muted-foreground">{appointment.purpose}</p>
            <p className="text-xs text-muted-foreground">
              {appointment.citizen.name}
              {appointment.citizen.phone ? ` · ${appointment.citizen.phone}` : ""}
            </p>
          </div>
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs">
            {appointment.status.toLowerCase()}
          </span>
          {appointment.status === "REQUESTED" ? (
            <Button
              size="sm"
              disabled={run.busy}
              onClick={() => set(appointment.id, "CONFIRMED", "Confirmed.")}
            >
              <Check />
              Confirm
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              disabled={run.busy}
              onClick={() => set(appointment.id, "COMPLETED", "Marked done.")}
            >
              <Check />
              Mark done
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            disabled={run.busy}
            onClick={() => set(appointment.id, "CANCELLED", "Cancelled.")}
          >
            <X />
          </Button>
        </li>
      ))}
    </ul>
  );
}

export function CallbackQueue({
  callbacks,
}: {
  callbacks: {
    id: string;
    topic: string;
    phone: string;
    preferredTime: string | null;
    createdAt: Date;
    citizen: { name: string };
  }[];
}) {
  const run = useRunner();
  if (callbacks.length === 0) return <Empty>No callbacks pending.</Empty>;

  return (
    <ul className="flex flex-col gap-2">
      {callbacks.map((callback) => (
        <li key={callback.id} className="flex flex-wrap items-center gap-3 rounded-2xl border p-4">
          <div className="min-w-48 flex-1">
            <p className="font-medium">{callback.topic}</p>
            <p className="text-sm text-muted-foreground">
              {callback.citizen.name} ·{" "}
              <a href={`tel:${callback.phone}`} className="hover:underline">
                {callback.phone}
              </a>
              {callback.preferredTime ? ` · prefers ${callback.preferredTime}` : ""}
            </p>
          </div>
          <span className="text-xs text-muted-foreground">{formatDate(callback.createdAt)}</span>
          <Button
            size="sm"
            disabled={run.busy}
            onClick={() => run.call(() => resolveCallback({ id: callback.id }), "Marked done.")}
          >
            <Check />
            Called back
          </Button>
        </li>
      ))}
    </ul>
  );
}

export function SuggestionQueue({
  suggestions,
}: {
  suggestions: {
    id: string;
    title: string;
    body: string;
    status: string;
    author: { name: string };
    _count: { votes: number };
  }[];
}) {
  const run = useRunner();
  if (suggestions.length === 0) return <Empty>No suggestions yet.</Empty>;

  const statuses: SuggestionStatus[] = ["CONSIDERED", "ADOPTED", "DECLINED"];

  return (
    <ul className="flex flex-col gap-2">
      {suggestions.map((suggestion) => (
        <li key={suggestion.id} className="flex flex-col gap-2 rounded-2xl border p-4">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="font-medium">{suggestion.title}</span>
            <span className="text-xs text-muted-foreground">
              {suggestion._count.votes} {suggestion._count.votes === 1 ? "vote" : "votes"} ·{" "}
              {suggestion.author.name} · {suggestion.status.toLowerCase()}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">{suggestion.body}</p>
          <div className="flex flex-wrap gap-2">
            {statuses.map((status) => (
              <Button
                key={status}
                size="sm"
                variant="outline"
                disabled={run.busy || suggestion.status === status}
                onClick={() =>
                  run.call(
                    () => updateSuggestionStatus({ id: suggestion.id, status }),
                    `Marked ${status.toLowerCase()}.`,
                  )
                }
              >
                {status.toLowerCase()}
              </Button>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function VolunteerQueue({
  volunteers,
}: {
  volunteers: {
    id: string;
    skills: string[];
    availability: string | null;
    status: string;
    user: { name: string; phone: string | null };
  }[];
}) {
  const run = useRunner();
  if (volunteers.length === 0) return <Empty>Nobody has registered yet.</Empty>;

  const statuses: VolunteerStatus[] = ["APPROVED", "INACTIVE"];

  return (
    <ul className="flex flex-col gap-2">
      {volunteers.map((volunteer) => (
        <li key={volunteer.id} className="flex flex-wrap items-center gap-3 rounded-2xl border p-4">
          <div className="min-w-48 flex-1">
            <p className="font-medium">{volunteer.user.name}</p>
            <p className="text-sm text-muted-foreground">
              {volunteer.skills.join(", ") || "no skills listed"}
              {volunteer.availability ? ` · ${volunteer.availability}` : ""}
            </p>
          </div>
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs">
            {volunteer.status.toLowerCase()}
          </span>
          {statuses.map((status) => (
            <Button
              key={status}
              size="sm"
              variant="outline"
              disabled={run.busy || volunteer.status === status}
              onClick={() =>
                run.call(
                  () => updateVolunteerStatus({ id: volunteer.id, status }),
                  `Marked ${status.toLowerCase()}.`,
                )
              }
            >
              {status.toLowerCase()}
            </Button>
          ))}
        </li>
      ))}
    </ul>
  );
}

export function NewPoll() {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [endsAt, setEndsAt] = useState("");
  const run = useRunner();

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-dashed p-4">
      <div className="grid gap-2">
        <Label htmlFor="poll-question">Question</Label>
        <Input
          id="poll-question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
        />
      </div>

      <div className="grid gap-2">
        <Label>Options</Label>
        {options.map((option, index) => (
          <Input
            key={index}
            value={option}
            aria-label={`Option ${index + 1}`}
            onChange={(event) =>
              setOptions(options.map((current, i) => (i === index ? event.target.value : current)))
            }
          />
        ))}
        {options.length < 6 ? (
          <Button
            size="sm"
            variant="ghost"
            className="w-fit"
            onClick={() => setOptions([...options, ""])}
          >
            <Plus />
            Add an option
          </Button>
        ) : null}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="poll-ends">Closes on</Label>
        <Input
          id="poll-ends"
          type="date"
          value={endsAt}
          onChange={(event) => setEndsAt(event.target.value)}
        />
      </div>

      <Button
        className="w-fit"
        disabled={run.busy || !endsAt || options.filter(Boolean).length < 2}
        onClick={async () => {
          const ok = await run.call(
            () =>
              createPoll({
                question,
                options: options.filter(Boolean),
                startsAt: new Date().toISOString(),
                endsAt,
              }),
            "Poll opened.",
          );
          if (ok) {
            setQuestion("");
            setOptions(["", ""]);
            setEndsAt("");
          }
        }}
      >
        {run.busy ? <LoaderCircle className="animate-spin" /> : <Plus />}
        Open the poll
      </Button>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}
