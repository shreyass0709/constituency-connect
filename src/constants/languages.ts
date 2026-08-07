/**
 * The two languages we ship (docs/01 NFR: English + one regional language at launch).
 *
 * This lives apart from `features/auth/schemas` because the language switcher sits in the
 * public header: a client component importing this list out of a Zod module pulled all of
 * Zod (~59 KiB over the wire, 85% unused) into every public page's bundle. A plain array
 * has no runtime dependency, so keep it that way. `MESSAGES` in `src/i18n/request.ts` is
 * the server-side twin — the two must list the same locales.
 */
export const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "hi", label: "हिन्दी" },
] as const;
