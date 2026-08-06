import { useTranslations } from "next-intl";
import type { ComplaintStatus, Priority } from "@/generated/prisma/enums";
import { PRIORITY_CLASS, STATUS_CLASS } from "@/constants/status";
import { cn } from "@/lib/utils";

// Colour is decoration; the text is the signal (docs/05-ui.md §1, accessibility).

export function StatusChip({
  status,
  className,
}: {
  status: ComplaintStatus;
  className?: string;
}) {
  const t = useTranslations("status");

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        STATUS_CLASS[status],
        className,
      )}
    >
      {t(status)}
    </span>
  );
}

export function PriorityBadge({
  priority,
  className,
}: {
  priority: Priority;
  className?: string;
}) {
  const t = useTranslations("priority");

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        PRIORITY_CLASS[priority],
        className,
      )}
    >
      {t(priority)}
    </span>
  );
}
