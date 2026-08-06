import type { MetadataRoute } from "next";

/**
 * Installable on a field officer's phone (docs/01 §2 compatibility). Offline behaviour —
 * queuing updates through a dead spot — is Phase 6; this is the install surface only.
 *
 * ponytail: one SVG icon rather than a PNG set. Swap in 192/512 PNGs when someone cares
 * what the home-screen icon looks like on older Android.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Constituency Connect",
    short_name: "Connect",
    description: "Raise civic issues, track them, and see what gets fixed.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#3F51E0",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
