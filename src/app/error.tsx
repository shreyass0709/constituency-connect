"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";
import { Button } from "@/components/ui/button";

/** Route-level boundary: the shell and navigation survive, only the page is replaced. */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <section className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-24 text-center">
      <h1 className="font-heading text-2xl font-semibold">This page could not load</h1>
      <p className="text-muted-foreground">
        The problem is on our side and the office has been notified. Try again — if it
        keeps happening, your concern is still safe and staff can look it up by code.
      </p>
      <Button onClick={reset}>Try again</Button>
      {error.digest ? (
        <p className="font-mono text-xs text-muted-foreground">Reference: {error.digest}</p>
      ) : null}
    </section>
  );
}
