"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Ban,
  Camera,
  Check,
  LoaderCircle,
  Merge,
  RotateCcw,
  Star,
  TriangleAlert,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import type { ComplaintCategory, ComplaintStatus, Priority } from "@/generated/prisma/enums";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  CATEGORIES,
  CATEGORY_LABEL,
  PRIORITY_LABEL,
  STATUS_LABEL,
} from "@/constants/status";
import type { ActionResult } from "@/lib/safe-action";
import {
  acknowledgeComplaint,
  advanceComplaint,
  assignComplaints,
  categorizeComplaint,
  confirmResolution,
  escalateComplaint,
  mergeDuplicate,
  rejectComplaint,
  reopenComplaint,
  submitFeedback,
} from "./actions";

const PRIORITIES = Object.keys(PRIORITY_LABEL) as Priority[];

/** The statuses `advanceComplaint` accepts — completion goes through `completeWork`. */
type OfficerMove = "DEPT_REVIEW" | "FIELD_VERIFICATION" | "IN_PROGRESS";

export type ActionContext = {
  id: string;
  status: ComplaintStatus;
  category: ComplaintCategory;
  priority: Priority;
  departmentId: string | null;
  isOwner: boolean;
  canTriage: boolean;
  hasRating: boolean;
  /** Computed server-side from the workflow map — the UI never guesses. */
  allowed: ComplaintStatus[];
  departments: { id: string; name: string }[];
  officers: { id: string; name: string; departmentId: string | null }[];
};

/** Every control on the detail page, filtered by what this viewer may actually do. */
export function ComplaintActions(context: ActionContext) {
  const { allowed, canTriage, isOwner, status } = context;
  const run = useRunner();

  // Completion is not here: it needs proof photos, so it happens on the field task page.
  const officerMoves = allowed.filter((to) =>
    (["DEPT_REVIEW", "FIELD_VERIFICATION", "IN_PROGRESS"] as ComplaintStatus[]).includes(to),
  );
  const canComplete = allowed.includes("COMPLETED");

  return (
    <div className="flex flex-wrap gap-2">
      {isOwner && allowed.includes("CLOSED") ? (
        <Button
          disabled={run.busy}
          onClick={() => run.call(() => confirmResolution({ id: context.id }), "Thank you — closed.")}
        >
          {run.busy ? <LoaderCircle className="animate-spin" /> : <Check />}
          Yes, it is fixed
        </Button>
      ) : null}

      {isOwner && allowed.includes("REOPENED") ? (
        <ReasonDialog
          trigger={
            <Button variant="outline">
              <RotateCcw />
              Not fixed — reopen
            </Button>
          }
          title="Reopen this concern"
          description="Tell the office what is still wrong. It goes back into the queue."
          label="What is still wrong?"
          onSubmit={(reason) => reopenComplaint({ id: context.id, reason })}
          success="Reopened. The office has been told."
        />
      ) : null}

      {isOwner && status === "CLOSED" && !context.hasRating ? <RatingDialog id={context.id} /> : null}

      {canTriage && allowed.includes("ACKNOWLEDGED") ? (
        <Button
          disabled={run.busy}
          onClick={() => run.call(() => acknowledgeComplaint({ id: context.id }), "Acknowledged.")}
        >
          {run.busy ? <LoaderCircle className="animate-spin" /> : <Check />}
          Acknowledge
        </Button>
      ) : null}

      {canTriage && allowed.includes("ASSIGNED") ? <AssignDialog {...context} /> : null}
      {canTriage && status !== "DRAFT" ? <CategoriseDialog {...context} /> : null}

      {canTriage && allowed.includes("REJECTED") ? (
        <>
          <ReasonDialog
            trigger={
              <Button variant="outline">
                <Ban />
                Reject
              </Button>
            }
            title="Reject this concern"
            description="The citizen sees this reason, so make it clear and kind."
            label="Reason"
            onSubmit={(reason) => rejectComplaint({ id: context.id, reason })}
            success="Rejected with a reason."
          />
          <ReasonDialog
            trigger={
              <Button variant="outline">
                <Merge />
                Merge duplicate
              </Button>
            }
            title="Merge into another complaint"
            description="This one is closed as a duplicate and its reporter starts following the original."
            label="Original complaint code"
            placeholder="CC-2026-01042"
            multiline={false}
            onSubmit={(originalCode) => mergeDuplicate({ id: context.id, originalCode })}
            success="Merged."
          />
        </>
      ) : null}

      {canTriage ? (
        <ReasonDialog
          trigger={
            <Button variant="outline">
              <TriangleAlert />
              Escalate
            </Button>
          }
          title="Escalate to the admin"
          description="Adds an internal note and notifies every admin. The citizen does not see it."
          label="Note"
          onSubmit={(note) => escalateComplaint({ id: context.id, note })}
          success="Escalated."
        />
      ) : null}

      {officerMoves.map((to) => (
        <Button
          key={to}
          variant="outline"
          disabled={run.busy}
          onClick={() =>
            run.call(
              () => advanceComplaint({ id: context.id, to: to as OfficerMove }),
              `Moved to ${STATUS_LABEL[to].toLowerCase()}.`,
            )
          }
        >
          {run.busy ? <LoaderCircle className="animate-spin" /> : <UserCheck />}
          {STATUS_LABEL[to]}
        </Button>
      ))}

      {canComplete ? (
        <Button asChild>
          <Link href={`/field/${context.id}`}>
            <Camera />
            Complete with proof
          </Link>
        </Button>
      ) : null}
    </div>
  );
}

/** Shared plumbing: run an action, toast the result, refresh the server components. */
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

function ReasonDialog({
  trigger,
  title,
  description,
  label,
  placeholder,
  multiline = true,
  onSubmit,
  success,
}: {
  trigger: React.ReactNode;
  title: string;
  description: string;
  label: string;
  placeholder?: string;
  multiline?: boolean;
  onSubmit: (value: string) => Promise<ActionResult<unknown>>;
  success: string;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const run = useRunner();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="reason-field">{label}</Label>
          {multiline ? (
            <Textarea
              id="reason-field"
              rows={4}
              value={value}
              placeholder={placeholder}
              onChange={(event) => setValue(event.target.value)}
            />
          ) : (
            <Input
              id="reason-field"
              value={value}
              placeholder={placeholder}
              onChange={(event) => setValue(event.target.value)}
            />
          )}
        </div>
        <DialogFooter>
          <Button
            disabled={run.busy}
            onClick={async () => {
              if (await run.call(() => onSubmit(value), success)) {
                setOpen(false);
                setValue("");
              }
            }}
          >
            {run.busy ? <LoaderCircle className="animate-spin" /> : null}
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AssignDialog({ id, departmentId, departments, officers }: ActionContext) {
  const [open, setOpen] = useState(false);
  const [department, setDepartment] = useState(departmentId ?? "");
  const [officer, setOfficer] = useState("");
  const [eta, setEta] = useState("");
  const run = useRunner();

  const eligible = officers.filter((o) => o.departmentId === department);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <UserCheck />
          Assign
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign this concern</DialogTitle>
          <DialogDescription>
            The citizen is told which department has it and by when.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="assign-department">Department</Label>
            <Select
              value={department}
              onValueChange={(value) => {
                setDepartment(value);
                setOfficer("");
              }}
            >
              <SelectTrigger id="assign-department" className="w-full">
                <SelectValue placeholder="Choose a department" />
              </SelectTrigger>
              <SelectContent>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="assign-officer">Field officer (optional)</Label>
            <Select value={officer} onValueChange={setOfficer} disabled={!department}>
              <SelectTrigger id="assign-officer" className="w-full">
                <SelectValue placeholder={eligible.length ? "Choose an officer" : "No officers in this department"} />
              </SelectTrigger>
              <SelectContent>
                {eligible.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="assign-eta">Estimated completion (optional)</Label>
            <Input
              id="assign-eta"
              type="date"
              value={eta}
              onChange={(event) => setEta(event.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={run.busy || !department}
            onClick={async () => {
              const ok = await run.call(
                () =>
                  assignComplaints({
                    ids: [id],
                    departmentId: department,
                    officerId: officer || null,
                    estimatedCompletion: eta || null,
                  }),
                "Assigned.",
              );
              if (ok) setOpen(false);
            }}
          >
            {run.busy ? <LoaderCircle className="animate-spin" /> : null}
            Assign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CategoriseDialog({ id, category, priority, departmentId, departments }: ActionContext) {
  const [open, setOpen] = useState(false);
  const [nextCategory, setNextCategory] = useState<ComplaintCategory>(category);
  const [nextPriority, setNextPriority] = useState<Priority>(priority);
  const [department, setDepartment] = useState(departmentId ?? "");
  const run = useRunner();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Categorise</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Category and priority</DialogTitle>
          <DialogDescription>
            Changing the category resets the resolution deadline to that category&apos;s SLA.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="cat">Category</Label>
            <Select value={nextCategory} onValueChange={(v) => setNextCategory(v as ComplaintCategory)}>
              <SelectTrigger id="cat" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {CATEGORY_LABEL[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="prio">Priority</Label>
            <Select value={nextPriority} onValueChange={(v) => setNextPriority(v as Priority)}>
              <SelectTrigger id="prio" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {PRIORITY_LABEL[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="dept">Department (optional)</Label>
            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger id="dept" className="w-full">
                <SelectValue placeholder="Not routed yet" />
              </SelectTrigger>
              <SelectContent>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={run.busy}
            onClick={async () => {
              const ok = await run.call(
                () =>
                  categorizeComplaint({
                    id,
                    category: nextCategory,
                    priority: nextPriority,
                    departmentId: department || null,
                  }),
                "Updated.",
              );
              if (ok) setOpen(false);
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RatingDialog({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const run = useRunner();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Star />
          Rate how it went
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>How did we do?</DialogTitle>
          <DialogDescription>Your rating feeds the office&apos;s satisfaction score.</DialogDescription>
        </DialogHeader>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              aria-label={`${value} star${value > 1 ? "s" : ""}`}
              aria-pressed={rating === value}
              onClick={() => setRating(value)}
              className="rounded p-1"
            >
              <Star
                className={value <= rating ? "size-6 fill-amber-400 text-amber-400" : "size-6 text-muted-foreground"}
              />
            </button>
          ))}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="feedback">Anything to add? (optional)</Label>
          <Textarea id="feedback" rows={3} value={text} onChange={(e) => setText(e.target.value)} />
        </div>
        <DialogFooter>
          <Button
            disabled={run.busy}
            onClick={async () => {
              const ok = await run.call(
                () => submitFeedback({ id, rating, feedbackText: text || null }),
                "Thank you for the feedback.",
              );
              if (ok) setOpen(false);
            }}
          >
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
