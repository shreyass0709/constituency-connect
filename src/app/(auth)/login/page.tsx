import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PhoneOtpForm } from "@/features/auth/phone-otp-form";
import { getCurrentUser } from "@/lib/auth/require-user";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await getCurrentUser()) redirect("/after-login");
  const { next, error } = await searchParams;
  const t = await getTranslations("auth");

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1>{t("signIn")}</h1>
        </CardTitle>
        <CardDescription>{t("signInHint")}</CardDescription>
      </CardHeader>
      <CardContent>
        {error === "deactivated" && (
          <p role="alert" className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {t("deactivated")}
          </p>
        )}
        <PhoneOtpForm next={typeof next === "string" && next.startsWith("/") ? next : undefined} />
      </CardContent>
    </Card>
  );
}
