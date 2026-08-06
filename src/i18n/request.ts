import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import en from "./en.json";
import hi from "./hi.json";

export const LOCALE_COOKIE = "NEXT_LOCALE";

/** The two languages we ship (docs/01 NFR: English + one regional language at launch). */
export const MESSAGES = { en, hi } as const;
export type Locale = keyof typeof MESSAGES;

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && value in MESSAGES;
}

/**
 * Locale comes from a cookie, not a URL segment — the route tree in
 * docs/02-architecture.md §2 has no `[locale]` and single-tenant deployments have no
 * SEO reason to serve two URL trees. `completeOnboarding` and the settings form write
 * the cookie alongside `User.language`, so the two never drift.
 *
 * ponytail: reading a cookie makes every page that uses translations render per request,
 * so the public pages trade ISR for being readable in Hindi. If that ever costs more than
 * it earns, the upgrade is `[locale]` routing with `localePrefix: "as-needed"` — not a
 * different i18n library.
 *
 * **Scope.** Translated: the public site, sign-in and onboarding, every citizen screen,
 * and the field officer PWA — the surfaces the public actually meets. Deliberately not
 * translated: the office and department consoles (triage, analytics, reports, content
 * editors), whose users are trained staff working in the language the rest of the
 * administration uses, and whose vocabulary is procedural rather than civic. Also not
 * translated: text written *into* the database — timeline notes, audit entries — because
 * those are a record of what happened, and a record does not change language when its
 * reader does.
 */
export default getRequestConfig(async () => {
  const cookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale: Locale = isLocale(cookie) ? cookie : "en";

  return { locale, messages: MESSAGES[locale] };
});
