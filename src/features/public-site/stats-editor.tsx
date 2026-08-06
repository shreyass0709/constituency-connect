"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Plus, Save, Trash } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteActionStat, upsertActionStat } from "./actions";

export type EditableStat = {
  id: string;
  key: string;
  label: string;
  value: number;
  sortOrder: number;
  autoComputed: boolean;
};

/**
 * Manual counters — trees planted, health camps — live here. The automatic ones are
 * shown read-only: overwriting a number the nightly job recalculates would just look
 * like a bug the next morning.
 */
export function StatsEditor({ stats }: { stats: EditableStat[] }) {
  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-2">
        {stats.map((stat) => (
          <li key={stat.id}>
            <StatRow stat={stat} />
          </li>
        ))}
      </ul>
      <NewStat />
    </div>
  );
}

function StatRow({ stat }: { stat: EditableStat }) {
  const router = useRouter();
  const [label, setLabel] = useState(stat.label);
  const [value, setValue] = useState(String(stat.value));
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const result = await upsertActionStat({
      id: stat.id,
      key: stat.key,
      label,
      value: Number(value) || 0,
      sortOrder: stat.sortOrder,
      autoComputed: stat.autoComputed,
    });
    setBusy(false);
    if (!result.ok) return toast.error(result.error);
    toast.success("Saved.");
    router.refresh();
  }

  async function remove() {
    setBusy(true);
    const result = await deleteActionStat({ id: stat.id });
    setBusy(false);
    if (!result.ok) return toast.error(result.error);
    toast.success("Removed.");
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-2xl border p-4">
      <div className="grid flex-1 gap-1">
        <Label htmlFor={`label-${stat.id}`} className="text-xs text-muted-foreground">
          Label
        </Label>
        <Input
          id={`label-${stat.id}`}
          value={label}
          onChange={(event) => setLabel(event.target.value)}
        />
      </div>

      <div className="grid w-32 gap-1">
        <Label htmlFor={`value-${stat.id}`} className="text-xs text-muted-foreground">
          Value
        </Label>
        <Input
          id={`value-${stat.id}`}
          inputMode="numeric"
          value={value}
          disabled={stat.autoComputed}
          onChange={(event) => setValue(event.target.value.replace(/[^0-9]/g, ""))}
        />
      </div>

      <div className="flex items-center gap-2">
        {stat.autoComputed ? (
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
            Recomputed nightly
          </span>
        ) : null}
        <Button size="sm" variant="outline" disabled={busy} onClick={save}>
          {busy ? <LoaderCircle className="animate-spin" /> : <Save />}
          Save
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={remove}
          aria-label={`Remove ${stat.label}`}
        >
          <Trash />
        </Button>
      </div>
    </div>
  );
}

function NewStat() {
  const router = useRouter();
  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("0");
  const [busy, setBusy] = useState(false);

  async function add() {
    setBusy(true);
    const result = await upsertActionStat({
      key,
      label,
      value: Number(value) || 0,
      sortOrder: 100,
      autoComputed: false,
    });
    setBusy(false);
    if (!result.ok) return toast.error(result.error);
    setKey("");
    setLabel("");
    setValue("0");
    toast.success("Added.");
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-dashed p-4">
      <div className="grid w-44 gap-1">
        <Label htmlFor="new-key" className="text-xs text-muted-foreground">
          Key
        </Label>
        <Input
          id="new-key"
          value={key}
          placeholder="trees_planted"
          onChange={(event) => setKey(event.target.value)}
        />
      </div>
      <div className="grid flex-1 gap-1">
        <Label htmlFor="new-label" className="text-xs text-muted-foreground">
          Label
        </Label>
        <Input
          id="new-label"
          value={label}
          placeholder="Trees planted"
          onChange={(event) => setLabel(event.target.value)}
        />
      </div>
      <div className="grid w-32 gap-1">
        <Label htmlFor="new-value" className="text-xs text-muted-foreground">
          Value
        </Label>
        <Input
          id="new-value"
          inputMode="numeric"
          value={value}
          onChange={(event) => setValue(event.target.value.replace(/[^0-9]/g, ""))}
        />
      </div>
      <Button disabled={busy || !key || !label} onClick={add}>
        {busy ? <LoaderCircle className="animate-spin" /> : <Plus />}
        Add counter
      </Button>
    </div>
  );
}
