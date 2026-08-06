import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PhoneOtpForm } from "@/features/auth/phone-otp-form";
import { getCurrentUser } from "@/lib/auth/require-user";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await getCurrentUser()) redirect("/after-login");
  const { next, error } = await searchParams;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>
          We&apos;ll text a 6-digit code to your phone. No password needed.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error === "deactivated" && (
          <p role="alert" className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            This account has been deactivated. Contact the representative&apos;s office.
          </p>
        )}
        <PhoneOtpForm next={typeof next === "string" && next.startsWith("/") ? next : undefined} />
      </CardContent>
    </Card>
  );
}
