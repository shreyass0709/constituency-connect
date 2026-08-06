import Link from "next/link";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";

// Phase 4 turns this into the full public site (action dashboard, transformation map,
// stories). For now: the promise, and the two doors into the product.
export default async function HomePage() {
  const representative = await db.representative.findFirst({
    select: { name: true, constituencyName: true, vision: true },
  });

  return (
    <section className="mx-auto flex max-w-3xl flex-col items-center gap-8 px-4 py-24 text-center">
      <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
        {representative?.constituencyName ?? "Your constituency"}
      </p>
      <h1 className="font-heading text-4xl font-semibold tracking-tight sm:text-5xl">
        Your voice, our action
      </h1>
      <p className="max-w-xl text-lg text-muted-foreground">
        {representative?.vision ??
          "Every civic issue heard, triaged, and resolved — in the open."}
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button asChild size="lg">
          {/* Proxy bounces anonymous visitors to /login and brings them back here. */}
          <Link href="/dashboard/raise">Raise a concern</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/track">Track my concern</Link>
        </Button>
      </div>
      {representative && (
        <p className="text-sm text-muted-foreground">Office of {representative.name}</p>
      )}
    </section>
  );
}
