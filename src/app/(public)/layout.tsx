import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PUBLIC_NAV } from "@/constants/public-nav";
import { aiEnabled } from "@/lib/ai/gemini";
import { ChatWidget } from "@/features/chat/chat-widget";

export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <header className="sticky top-0 z-20 border-b bg-background/70 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
          <Link href="/" className="font-heading text-lg font-semibold tracking-tight">
            Constituency<span className="text-primary"> Connect</span>
          </Link>

          <nav aria-label="Site" className="hidden flex-1 items-center gap-1 lg:flex">
            {PUBLIC_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2 lg:ml-0">
            <Button asChild size="sm" variant="ghost">
              <Link href="/track">Track</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/dashboard/raise">Raise a concern</Link>
            </Button>
          </div>
        </div>

        {/* The same links, scrollable, for phones — no hamburger to build or maintain. */}
        <nav
          aria-label="Site"
          className="flex gap-1 overflow-x-auto border-t px-4 py-2 text-sm lg:hidden"
        >
          {PUBLIC_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="shrink-0 rounded-lg px-3 py-1 text-muted-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 text-sm text-muted-foreground sm:flex-row sm:items-center">
          <p>Citizen voice · Representative action · Visible outcome</p>
          <nav aria-label="Footer" className="flex flex-wrap gap-4 sm:ml-auto">
            <Link href="/track" className="hover:text-foreground">
              Track a concern
            </Link>
            <Link href="/faq" className="hover:text-foreground">
              FAQ
            </Link>
            <Link href="/contact" className="hover:text-foreground">
              Contact
            </Link>
            <Link href="/login" className="hover:text-foreground">
              Sign in
            </Link>
          </nav>
        </div>
      </footer>

      {/* No key configured, no dead button: the FAQ page carries the same answers. */}
      {aiEnabled() ? <ChatWidget /> : null}
    </>
  );
}
