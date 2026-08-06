"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LANGUAGES } from "@/features/auth/schemas";
import { setLanguage } from "./actions";

/**
 * The only way a second language is worth shipping: somewhere obvious to switch it.
 * Works signed out too — the action writes the cookie either way and only touches
 * `User.language` when there is a user to touch.
 */
export function LanguageSwitcher({ className }: { className?: string }) {
  const locale = useLocale();
  const t = useTranslations("language");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className={className}>
      <Label htmlFor="language-switcher" className="sr-only">
        {t("label")}
      </Label>
      <Select
        value={locale}
        disabled={pending}
        onValueChange={(value) =>
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
          })
        }
      >
        <SelectTrigger id="language-switcher" className="w-full" aria-label={t("label")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {LANGUAGES.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
