import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Fixed locale so a date reads the same whether it was rendered on the server or the
// client — a hydration mismatch on a complaint's dates would be a trust problem.
const DATE = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" })
const DATE_TIME = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
})

export function formatDate(value: Date | string | null | undefined) {
  if (!value) return "—"
  return DATE.format(new Date(value))
}

export function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return "—"
  return DATE_TIME.format(new Date(value))
}

/** "3 days left" / "2 days overdue" — the SLA clock in words. */
export function daysBetween(from: Date | string, to: Date | string) {
  const ms = new Date(to).getTime() - new Date(from).getTime()
  return Math.round(ms / (24 * 60 * 60 * 1000))
}
