/**
 * The public site's own navigation — one list, used by the header and the sitemap.
 * `labelKey` indexes the `publicNav` namespace in src/i18n, never a literal string.
 */
export const PUBLIC_NAV = [
  { href: "/about", labelKey: "about" },
  { href: "/action", labelKey: "action" },
  { href: "/map", labelKey: "map" },
  { href: "/stories", labelKey: "stories" },
  { href: "/announcements", labelKey: "announcements" },
  { href: "/schemes", labelKey: "schemes" },
  { href: "/gallery", labelKey: "gallery" },
  { href: "/faq", labelKey: "faq" },
  { href: "/contact", labelKey: "contact" },
] as const;
