import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { OnboardingForm } from "@/features/auth/onboarding-form";
import { HOME_BY_ROLE } from "@/lib/auth/permissions";
import { needsOnboarding, requireUser } from "@/lib/auth/require-user";
import { db } from "@/lib/db";

export const metadata = { title: "Welcome" };

export default async function OnboardingPage() {
  const user = await requireUser(undefined, { allowIncomplete: true });
  if (!needsOnboarding(user)) redirect(HOME_BY_ROLE[user.role]);

  const wards = await db.ward.findMany({
    select: { id: true, number: true, name: true },
    orderBy: { number: "asc" },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Welcome</CardTitle>
        <CardDescription>
          Two details and you&apos;re set — your ward decides who handles your concerns.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Phone-signup seeds name with the phone number; don't prefill that back. */}
        <OnboardingForm
          defaultName={user.name === user.phone ? "" : user.name}
          wards={wards}
        />
      </CardContent>
    </Card>
  );
}
