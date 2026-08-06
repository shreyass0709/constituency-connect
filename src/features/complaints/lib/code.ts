import type { Prisma } from "@/generated/prisma/client";

/**
 * `CC-2026-01042` — the string a citizen reads out on the phone. The counter is a
 * Postgres sequence (see migration `complaint_code_sequence`), so it needs no locking,
 * no retry loop, and no "select max + 1" race.
 */
export async function nextComplaintCode(
  tx: Prisma.TransactionClient,
  now: Date = new Date(),
): Promise<string> {
  const rows = await tx.$queryRaw<{ n: string | bigint }[]>`SELECT nextval('complaint_code_seq') AS n`;
  const n = String(rows[0]?.n ?? 0);
  return `CC-${now.getFullYear()}-${n.padStart(5, "0")}`;
}
