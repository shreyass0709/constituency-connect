/**
 * The first thing a keyboard or screen-reader user meets on every page: a way past the
 * navigation. Without it, reaching the raise-a-concern form means tabbing through nine
 * public links, and reaching a complaint means tabbing through the whole sidebar — on
 * every single page (docs/06-roadmap.md Phase 6, keyboard-only walk).
 *
 * Visually hidden until focused, then it appears where it can actually be seen.
 */
export const MAIN_CONTENT_ID = "main-content";

export function SkipLink({ label = "Skip to content" }: { label?: string }) {
  return (
    <a
      href={`#${MAIN_CONTENT_ID}`}
      className="sr-only z-50 focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:rounded-lg focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring"
    >
      {label}
    </a>
  );
}
