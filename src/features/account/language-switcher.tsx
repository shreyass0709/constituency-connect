"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { LANGUAGES } from "@/features/auth/schemas";
import { cn } from "@/lib/utils";
import { setLanguage } from "./actions";

/**
 * The only way a second language is worth shipping: somewhere obvious to switch it.
 * Works signed out too — the action writes the cookie either way and only touches
 * `User.language` when there is a user to touch.
 *
 * ponytail: a native `<select>`, not the Radix one the rest of the app uses. This control
 * sits in the public header, so its cost is paid on every public page load, and a native
 * select for two options gives a mobile user their platform's own picker for free.
 */
export function LanguageSwitcher({ className }: { className?: string }) {
  const locale = useLocale();
  const t = useTranslations("language");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <select
      aria-label={t("label")}
      value={locale}
      disabled={pending}
      onChange={(event) => {
        const value = event.target.value;
        startTransition(async () => {
          const result = await setLanguage(value);
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          // The locale lives in a cookie the server read at render time, so the whole
          // tree has to come back from the server — a client re-render would not help.
          router.refresh();
          toast.success(t("saved"));
        });
      }}
      className={cn(
        "h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    >
      {LANGUAGES.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
