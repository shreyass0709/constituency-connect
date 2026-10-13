"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { LogOut, MoonStar, Sun } from "lucide-react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import type { NavItem } from "@/constants/nav";
import { signOut } from "@/lib/auth/client";

// ⌘K shell: navigation + theme + sign out. Later phases add complaint search and
// role quick-actions as extra <CommandGroup>s.
export function CommandPalette({ items }: { items: NavItem[] }) {
  const t = useTranslations("shell");
  const nav = useTranslations("nav");
  const common = useTranslations("common");
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const run = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      {/* cmdk's Input and List read a store from <Command>; CommandDialog does not provide one. */}
      <Command>
        <CommandInput placeholder={t("commandPlaceholder")} />
        <CommandList>
          <CommandEmpty>{t("noResults")}</CommandEmpty>
          <CommandGroup heading={t("goTo")}>
            {items.map((item) => (
              <CommandItem
                key={item.href}
                value={nav(item.labelKey)}
                onSelect={() => run(() => router.push(item.href))}
              >
                <item.icon />
                {nav(item.labelKey)}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading={t("actions")}>
            <CommandItem
              value={t("toggleTheme")}
              onSelect={() => run(() => setTheme(resolvedTheme === "dark" ? "light" : "dark"))}
            >
              {resolvedTheme === "dark" ? <Sun /> : <MoonStar />}
              {t("toggleTheme")}
            </CommandItem>
            <CommandItem
              value={common("signOut")}
              onSelect={() =>
                run(async () => {
                  await signOut();
                  router.push("/login");
                })
              }
            >
              <LogOut />
              {common("signOut")}
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
