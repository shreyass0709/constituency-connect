import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

/** The public site is meant to be found; everything behind a login is not. */
export default function robots(): MetadataRoute.Robots {
  const base = (env.APP_URL ?? env.BETTER_AUTH_URL).replace(/\/$/, "");
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard", "/office", "/department", "/field", "/api/", "/onboarding"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
