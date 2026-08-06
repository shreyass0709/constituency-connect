import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { audit } from "./audit";
import type { Permission } from "./auth/permissions";
import { requireUser, type CurrentUser } from "./auth/require-user";

/** Message safe to show the user. Anything else becomes a generic error. */
export class ActionError extends Error {}

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

type Config<S extends z.ZodType, T> = {
  /** Audit action name, e.g. "complaint.assign". */
  name: string;
  entity: string;
  schema: S;
  permission?: Permission;
  handler: (input: z.output<S>, ctx: { user: CurrentUser }) => Promise<T>;
};

function idOf(value: unknown): string | undefined {
  if (typeof value !== "object" || value === null || !("id" in value)) return undefined;
  const id = (value as { id: unknown }).id;
  return typeof id === "string" ? id : undefined;
}

/**
 * The one wrapper every mutation goes through: Zod → session → RBAC → run → audit.
 * (Rate limiting joins this chain in Phase 6, when Upstash lands.)
 */
export function defineAction<S extends z.ZodType, T>(config: Config<S, T>) {
  return async (rawInput: unknown): Promise<ActionResult<T>> => {
    const parsed = config.schema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        ok: false,
        error: "Please check the highlighted fields.",
        fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]>,
      };
    }

    // Throws a redirect for anonymous/forbidden callers — same guard as the layouts.
    const user = await requireUser(config.permission);

    let data: T;
    try {
      data = await config.handler(parsed.data, { user });
    } catch (error) {
      if (error instanceof ActionError) return { ok: false, error: error.message };
      throw error; // redirects, and genuine bugs, belong in the error boundary + logs
    }

    await audit({
      actorId: user.id,
      action: config.name,
      entity: config.entity,
      entityId: idOf(data) ?? idOf(parsed.data),
      meta: parsed.data as Prisma.InputJsonValue,
    });

    return { ok: true, data };
  };
}
