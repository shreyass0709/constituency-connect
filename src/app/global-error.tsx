"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

/**
 * The last boundary — it replaces the root layout, so it ships its own <html>/<body>
 * and cannot use anything from the design system.
 */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          display: "flex",
          minHeight: "100vh",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          fontFamily: "system-ui, sans-serif",
          padding: "2rem",
          textAlign: "center",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", fontWeight: 600 }}>Something went wrong</h1>
        <p style={{ maxWidth: "34rem", color: "#555" }}>
          The office has been notified. Nothing you submitted has been lost — reload the
          page and it will pick up where you left off.
        </p>
        {/* A plain anchor on purpose: the router is part of what just broke, so this
            needs to be a full document load, not a client-side navigation. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/" style={{ textDecoration: "underline" }}>
          Back to the home page
        </a>
      </body>
    </html>
  );
}
