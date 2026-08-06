"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Check, HandHeart, LoaderCircle, PhoneCall, Plus, ThumbsUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { SuggestionStatus } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ActionResult } from "@/lib/safe-action";
import { cn, formatDate } from "@/lib/utils";
import {
  bookAppointment,
  cancelAppointment,
  createSuggestion,
  registerVolunteer,
  requestCallback,
  voteSuggestion,
  votePoll,
} from "./actions";

/** One runner for every panel: call, toast, refresh the server components. */
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

export function AppointmentPanel({
  appointments,
}: {
  appointments: {
    id: string;
    purpose: string;
    requestedDate: Date;
    slot: string | null;
    status: string;
    staffNote: string | null;
  }[];
}) {
  const [purpose, setPurpose] = useState("");
  const [date, setDate] = useState("");
  const [slot, setSlot] = useState("");
  const t = useTranslations("engage.appointments");
  const common = useTranslations("common");
  const run = useRunner();

  return (
    <section className="flex flex-col gap-4 rounded-2xl border p-5">
      <h2 className="font-heading text-lg font-semibold">{t("heading")}</h2>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="purpose">{t("purpose")}</Label>
          <Textarea
            id="purpose"
            rows={2}
            value={purpose}
            maxLength={500}
            onChange={(event) => setPurpose(event.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="date">{t("date")}</Label>
          <Input
            id="date"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="slot">{t("slot")}</Label>
          <Input
            id="slot"
            value={slot}
            placeholder={t("slotPlaceholder")}
            onChange={(event) => setSlot(event.target.value)}
          />
        </div>
      </div>

      <Button
        className="w-fit"
        disabled={run.busy || !date || purpose.trim().length < 10}
        onClick={async () => {
          const ok = await run.call(
            () => bookAppointment({ purpose, requestedDate: date, slot: slot || null }),
            t("requested"),
          );
          if (ok) {
            setPurpose("");
            setDate("");
            setSlot("");
          }
        }}
      >
        {run.busy ? <LoaderCircle className="animate-spin" /> : <CalendarPlus />}
        {t("request")}
      </Button>

      {appointments.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {appointments.map((appointment) => (
            <li
              key={appointment.id}
              className="flex flex-wrap items-center gap-3 rounded-xl border p-3 text-sm"
            >
              <span className="flex-1">
                <span className="font-medium">{formatDate(appointment.requestedDate)}</span>
                {appointment.slot ? ` · ${appointment.slot}` : ""}
                <span className="block text-xs text-muted-foreground">{appointment.purpose}</span>
                {appointment.staffNote ? (
                  <span className="block text-xs text-muted-foreground">
                    {t("officeNote", { note: appointment.staffNote })}
                  </span>
                ) : null}
              </span>
              <StatusPill value={appointment.status} />
              {appointment.status === "REQUESTED" || appointment.status === "CONFIRMED" ? (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={run.busy}
                  onClick={() =>
                    run.call(() => cancelAppointment({ id: appointment.id }), t("cancelled"))
                  }
                >
                  {common("cancel")}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export function CallbackPanel({
  callbacks,
  defaultPhone,
}: {
  callbacks: { id: string; topic: string; status: string; createdAt: Date }[];
  defaultPhone: string;
}) {
  const [phone, setPhone] = useState(defaultPhone);
  const [topic, setTopic] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const t = useTranslations("engage.callbacks");
  const run = useRunner();

  return (
    <section className="flex flex-col gap-4 rounded-2xl border p-5">
      <h2 className="font-heading text-lg font-semibold">{t("heading")}</h2>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor="cb-phone">{t("phone")}</Label>
          <Input id="cb-phone" value={phone} onChange={(event) => setPhone(event.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="cb-topic">{t("topic")}</Label>
          <Input id="cb-topic" value={topic} onChange={(event) => setTopic(event.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="cb-time">{t("bestTime")}</Label>
          <Input
            id="cb-time"
            value={preferredTime}
            placeholder={t("bestTimePlaceholder")}
            onChange={(event) => setPreferredTime(event.target.value)}
          />
        </div>
      </div>

      <Button
        className="w-fit"
        disabled={run.busy || topic.trim().length < 5}
        onClick={async () => {
          const ok = await run.call(
            () => requestCallback({ phone, topic, preferredTime: preferredTime || null }),
            t("requested"),
          );
          if (ok) {
            setTopic("");
            setPreferredTime("");
          }
        }}
      >
        {run.busy ? <LoaderCircle className="animate-spin" /> : <PhoneCall />}
        {t("request")}
      </Button>

      {callbacks.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {callbacks.map((callback) => (
            <li key={callback.id} className="flex items-center gap-3 rounded-xl border p-3 text-sm">
              <span className="flex-1">{callback.topic}</span>
              <span className="text-xs text-muted-foreground">
                {formatDate(callback.createdAt)}
              </span>
              <StatusPill value={callback.status} />
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export function PollPanel({
  polls,
}: {
  polls: {
    id: string;
    question: string;
    endsAt: Date;
    open: boolean;
    total: number;
    myVote: string | null;
    options: { id: string; label: string; count: number }[];
  }[];
}) {
  const t = useTranslations("engage.polls");
  const run = useRunner();
  if (polls.length === 0) return null;

  return (
    <section className="flex flex-col gap-4 rounded-2xl border p-5">
      <h2 className="font-heading text-lg font-semibold">{t("heading")}</h2>

      {polls.map((poll) => {
        // Results appear once you have voted, or once the poll has closed — otherwise
        // the running tally nudges the next voter.
        const showResults = Boolean(poll.myVote) || !poll.open;
        return (
          <div key={poll.id} className="flex flex-col gap-3">
            <p className="font-medium">{poll.question}</p>
            <ul className="flex flex-col gap-2">
              {poll.options.map((option) => {
                const share = poll.total > 0 ? Math.round((option.count / poll.total) * 100) : 0;
                return (
                  <li key={option.id}>
                    {showResults ? (
                      <div className="flex items-center gap-3 text-sm">
                        <span className="w-40 shrink-0 truncate">{option.label}</span>
                        <span className="h-2 flex-1 rounded-full bg-muted">
                          <span
                            className={cn(
                              "block h-2 rounded-full",
                              poll.myVote === option.id ? "bg-primary" : "bg-muted-foreground/40",
                            )}
                            style={{ width: `${share}%` }}
                          />
                        </span>
                        <span className="w-10 text-right tabular-nums text-muted-foreground">
                          {share}%
                        </span>
                        {poll.myVote === option.id ? (
                          <Check className="size-4 text-primary" aria-label={t("yourVote")} />
                        ) : null}
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full justify-start"
                        disabled={run.busy}
                        onClick={() =>
                          run.call(
                            () => votePoll({ pollId: poll.id, optionId: option.id }),
                            t("recorded"),
                          )
                        }
                      >
                        {option.label}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
            <p className="text-xs text-muted-foreground">
              {t("votes", { count: poll.total })} ·{" "}
              {poll.open ? t("closes", { date: formatDate(poll.endsAt) }) : t("closed")}
            </p>
          </div>
        );
      })}
    </section>
  );
}

export function SuggestionPanel({
  suggestions,
}: {
  suggestions: {
    id: string;
    title: string;
    body: string;
    status: SuggestionStatus;
    votes: number;
    voted: boolean;
    author: { name: string };
  }[];
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [open, setOpen] = useState(false);
  const t = useTranslations("engage.suggestions");
  const run = useRunner();

  return (
    <section className="flex flex-col gap-4 rounded-2xl border p-5">
      <div className="flex items-center gap-3">
        <h2 className="font-heading text-lg font-semibold">{t("heading")}</h2>
        <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setOpen(!open)}>
          <Plus />
          {t("suggest")}
        </Button>
      </div>

      {open ? (
        <div className="flex flex-col gap-3 rounded-xl border border-dashed p-4">
          <div className="grid gap-2">
            <Label htmlFor="sg-title">{t("title")}</Label>
            <Input id="sg-title" value={title} onChange={(event) => setTitle(event.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="sg-body">{t("idea")}</Label>
            <Textarea
              id="sg-body"
              rows={3}
              value={body}
              onChange={(event) => setBody(event.target.value)}
            />
          </div>
          <Button
            className="w-fit"
            disabled={run.busy || title.trim().length < 8 || body.trim().length < 20}
            onClick={async () => {
              const ok = await run.call(
                () => createSuggestion({ title, body }),
                t("shared"),
              );
              if (ok) {
                setTitle("");
                setBody("");
                setOpen(false);
              }
            }}
          >
            {t("post")}
          </Button>
        </div>
      ) : null}

      {suggestions.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {suggestions.map((suggestion) => (
            <li key={suggestion.id} className="flex gap-3 rounded-xl border p-3">
              <Button
                variant={suggestion.voted ? "default" : "outline"}
                size="sm"
                className="h-fit flex-col gap-0 px-3 py-2"
                disabled={run.busy}
                aria-pressed={suggestion.voted}
                onClick={() =>
                  run.call(
                    () => voteSuggestion({ suggestionId: suggestion.id }),
                    suggestion.voted ? t("voteRemoved") : t("upvoted"),
                  )
                }
              >
                <ThumbsUp className="size-3.5" />
                <span className="text-xs tabular-nums">{suggestion.votes}</span>
              </Button>
              <div className="flex-1">
                <p className="font-medium">{suggestion.title}</p>
                <p className="text-sm text-muted-foreground">{suggestion.body}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {suggestion.author.name} · {suggestion.status.toLowerCase()}
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          {t("empty")}
        </p>
      )}
    </section>
  );
}

export function VolunteerPanel({
  volunteer,
}: {
  volunteer: { skills: string[]; availability: string | null; status: string } | null;
}) {
  const [skills, setSkills] = useState(volunteer?.skills.join(", ") ?? "");
  const [availability, setAvailability] = useState(volunteer?.availability ?? "");
  const t = useTranslations("engage.volunteer");
  const run = useRunner();

  return (
    <section className="flex flex-col gap-4 rounded-2xl border p-5">
      <div className="flex items-center gap-3">
        <h2 className="font-heading text-lg font-semibold">{t("heading")}</h2>
        {volunteer ? <StatusPill value={volunteer.status} /> : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="vol-skills">{t("skills")}</Label>
          <Input
            id="vol-skills"
            value={skills}
            placeholder={t("skillsPlaceholder")}
            onChange={(event) => setSkills(event.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="vol-availability">{t("availability")}</Label>
          <Input
            id="vol-availability"
            value={availability}
            placeholder={t("availabilityPlaceholder")}
            onChange={(event) => setAvailability(event.target.value)}
          />
        </div>
      </div>

      <Button
        className="w-fit"
        disabled={run.busy}
        onClick={() =>
          run.call(
            () =>
              registerVolunteer({
                skills: skills
                  .split(",")
                  .map((skill) => skill.trim())
                  .filter(Boolean),
                availability: availability || null,
              }),
            volunteer ? t("updated") : t("registered"),
          )
        }
      >
        {run.busy ? <LoaderCircle className="animate-spin" /> : <HandHeart />}
        {volunteer ? t("update") : t("register")}
      </Button>
    </section>
  );
}

function StatusPill({ value }: { value: string }) {
  return (
    <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
      {value.toLowerCase().replace(/_/g, " ")}
    </span>
  );
}
