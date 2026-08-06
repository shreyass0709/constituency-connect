"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { assignComplaints } from "@/features/complaints/actions";
import { ComplaintList } from "@/features/complaints/complaint-list";
import type { ComplaintCard } from "@/features/complaints/queries";

/**
 * The morning-triage surface (journey J2): tick a run of road complaints, send them all
 * to one department in a single call. Selection is the only client state here — the list
 * itself is the same component the citizen sees.
 */
export function TriageBoard({
  complaints,
  departments,
  officers,
}: {
  complaints: ComplaintCard[];
  departments: { id: string; name: string }[];
  officers: { id: string; name: string; departmentId: string | null }[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [departmentId, setDepartmentId] = useState("");
  const [officerId, setOfficerId] = useState("");
  const [eta, setEta] = useState("");
  const [busy, setBusy] = useState(false);

  const eligible = officers.filter((officer) => officer.departmentId === departmentId);

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  async function assign() {
    setBusy(true);
    const result = await assignComplaints({
      ids: [...selected],
      departmentId,
      officerId: officerId || null,
      estimatedCompletion: eta || null,
    });
    setBusy(false);
    if (!result.ok) return toast.error(result.error);

    const { assigned, skipped } = result.data;
    toast.success(
      skipped.length > 0
        ? `Assigned ${assigned}. ${skipped.length} had already moved on.`
        : `Assigned ${assigned}.`,
    );
    setSelected(new Set());
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={selected.size > 0 && selected.size === complaints.length}
            onChange={(event) =>
              setSelected(event.target.checked ? new Set(complaints.map((c) => c.id)) : new Set())
            }
          />
          Select all
        </label>
        {selected.size > 0 ? (
          <span className="text-muted-foreground">{selected.size} selected</span>
        ) : null}
      </div>

      <ComplaintList
        complaints={complaints}
        basePath="/office/complaints"
        selected={selected}
        onToggle={toggle}
      />

      {selected.size > 0 ? (
        <div className="sticky bottom-4 flex flex-wrap items-end gap-3 rounded-2xl border bg-background/95 p-4 shadow-lg backdrop-blur">
          <div className="grid gap-1">
            <span className="text-xs text-muted-foreground">Department</span>
            <Select
              value={departmentId}
              onValueChange={(value) => {
                setDepartmentId(value);
                setOfficerId("");
              }}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Choose" />
              </SelectTrigger>
              <SelectContent>
                {departments.map((department) => (
                  <SelectItem key={department.id} value={department.id}>
                    {department.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1">
            <span className="text-xs text-muted-foreground">Officer (optional)</span>
            <Select value={officerId} onValueChange={setOfficerId} disabled={!departmentId}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder={eligible.length ? "Choose" : "None available"} />
              </SelectTrigger>
              <SelectContent>
                {eligible.map((officer) => (
                  <SelectItem key={officer.id} value={officer.id}>
                    {officer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1">
            <span className="text-xs text-muted-foreground">Est. completion</span>
            <Input
              type="date"
              className="w-40"
              value={eta}
              onChange={(event) => setEta(event.target.value)}
            />
          </div>

          <Button className="ml-auto" disabled={busy || !departmentId} onClick={assign}>
            {busy ? <LoaderCircle className="animate-spin" /> : <UserCheck />}
            Assign {selected.size}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
