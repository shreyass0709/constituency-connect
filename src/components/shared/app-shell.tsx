"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { LogOut, MoonStar, Sun } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CommandPalette } from "@/components/shared/command-palette";
import { NotificationBell } from "@/features/notifications/notification-bell";
import { NAV_BY_SECTION } from "@/constants/nav";
import type { Section } from "@/lib/auth/permissions";
import { signOut } from "@/lib/auth/client";
import { cn } from "@/lib/utils";

type ShellUser = { name: string; image: string | null; role: string };

/** Sidebar on desktop, bottom bar on phones — one shell for all four role sections. */
export function AppShell({
  user,
  section,
  unreadCount,
  children,
}: {
  user: ShellUser;
  section: Section;
  unreadCount: number;
  children: React.ReactNode;
}) {
  const items = NAV_BY_SECTION[section];
  const pathname = usePathname();

  return (
    <div className="flex min-h-full flex-1 flex-col md:grid md:grid-cols-[15rem_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r px-3 py-4 md:flex">
        <Link href="/" className="px-3 pb-6 font-heading text-lg font-semibold tracking-tight">
          Constituency<span className="text-primary"> Connect</span>
        </Link>
        <nav className="flex flex-col gap-1">
          {items.map((item) => (
            <NavLink key={item.href} item={item} active={pathname === item.href} />
          ))}
        </nav>
        <div className="mt-auto px-1">
          <ThemeToggle />
        </div>
      </aside>

      <div className="flex flex-1 flex-col pb-16 md:pb-0">
        <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur">
          <Link href="/" className="font-heading font-semibold md:hidden">
            Constituency Connect
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden text-xs text-muted-foreground sm:inline">
              Press <kbd className="rounded border px-1 font-mono">⌘K</kbd>
            </span>
            <NotificationBell initialUnread={unreadCount} />
            <UserMenu user={user} />
          </div>
        </header>

        <main className="flex-1 p-4 md:p-8">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t bg-background md:hidden">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-2 text-xs",
              pathname === item.href ? "text-primary" : "text-muted-foreground",
            )}
          >
            <item.icon className="size-5" />
            {item.label}
          </Link>
        ))}
      </nav>

      <CommandPalette items={items} />
    </div>
  );
}

function NavLink({
  item,
  active,
}: {
  item: (typeof NAV_BY_SECTION)[Section][number];
  active: boolean;
}) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted",
      )}
    >
      <item.icon className="size-4" />
      {item.label}
    </Link>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <Button
      variant="ghost"
      size="sm"
      className="w-full justify-start gap-3 text-muted-foreground"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      {resolvedTheme === "dark" ? <Sun className="size-4" /> : <MoonStar className="size-4" />}
      {resolvedTheme === "dark" ? "Light mode" : "Dark mode"}
    </Button>
  );
}

function UserMenu({ user }: { user: ShellUser }) {
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full" aria-label="Account menu">
          <Avatar className="size-8">
            {user.image ? <AvatarImage src={user.image} alt="" /> : null}
            <AvatarFallback>{user.name.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="font-normal">
          <div className="font-medium">{user.name}</div>
          <div className="text-xs text-muted-foreground">{roleLabel(user.role)}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={async () => {
            await signOut();
            router.push("/login");
          }}
        >
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function roleLabel(role: string) {
  return role.toLowerCase().replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}
