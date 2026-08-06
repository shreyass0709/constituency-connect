import Link from "next/link";
import { BookOpen, Gauge, UserCog } from "lucide-react";
import { requireUser } from "@/lib/auth/require-user";

export const metadata = { title: "Content" };

const SECTIONS = [
  {
    href: "/office/content/stories",
    icon: BookOpen,
    title: "Impact stories",
    description: "Write up finished complaints and publish them to the public site.",
  },
  {
    href: "/office/content/stats",
    icon: Gauge,
    title: "Action counters",
    description: "The numbers on the Action Dashboard.",
  },
  {
    href: "/office/content/profile",
    icon: UserCog,
    title: "Representative profile",
    description: "Name, vision, office hours and contact details.",
  },
];

export default async function ContentHub() {
  await requireUser("content.publish");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Public content</h1>
        <p className="text-muted-foreground">What visitors see on the constituency website.</p>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map((section) => (
          <li key={section.href}>
            <Link
              href={section.href}
              className="flex h-full flex-col gap-2 rounded-2xl border p-5 transition-colors hover:bg-muted/40"
            >
              <section.icon className="size-5 text-primary" aria-hidden />
              <span className="font-medium">{section.title}</span>
              <span className="text-sm text-muted-foreground">{section.description}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
