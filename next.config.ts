import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/**
 * One CSP block for the whole app (docs/02-architecture.md §8). Every origin listed here
 * is one the browser genuinely talks to: Cloudinary for signed uploads and media, OSM for
 * Leaflet tiles, gstatic + googleapis for the FCM service worker and its registration.
 *
 * ponytail: `'unsafe-inline'` for scripts rather than per-request nonces. Nonces force
 * every page dynamic, which would throw away the ISR the public site is built on and the
 * Lighthouse score gate M4 asks for. Revisit only if we ever host third-party script tags —
 * with no such tags, the XSS surface this closes is one React already escapes.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://www.gstatic.com${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://res.cloudinary.com https://*.tile.openstreetmap.org",
  "font-src 'self' data:",
  "connect-src 'self' https://api.cloudinary.com https://*.googleapis.com https://*.tile.openstreetmap.org",
  "worker-src 'self' blob:",
  "media-src 'self' blob: https://res.cloudinary.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  // Nothing gains from announcing the framework version to a scanner.
  poweredByHeader: false,
  images: {
    // Complaint photos and public-site media all live in one Cloudinary account.
    remotePatterns: [{ protocol: "https", hostname: "res.cloudinary.com" }],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          // Two years, preloadable — the whole app is behind HTTPS on Vercel.
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Field officers need the camera and GPS for geo-verified proof; nothing else.
          {
            key: "Permissions-Policy",
            value: "camera=(self), geolocation=(self), microphone=(self), payment=(), usb=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
