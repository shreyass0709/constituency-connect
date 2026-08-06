import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function PublicLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <header className="sticky top-0 z-10 border-b bg-background/70 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center px-4">
          <Link href="/" className="font-heading text-lg font-semibold tracking-tight">
            Constituency<span className="text-primary"> Connect</span>
          </Link>
          <Button asChild size="sm" variant="ghost" className="ml-auto">
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        Office of the representative · Citizen voice, representative action, visible outcome
      </footer>
    </>
  );
}
