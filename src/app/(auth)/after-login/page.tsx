import { redirect } from "next/navigation";
import { HOME_BY_ROLE } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/require-user";

// Where every successful sign-in and onboarding lands: the client never has to know
// the role→home mapping (or whether onboarding is still pending — requireUser does).
export default async function AfterLogin() {
  const user = await requireUser();
  redirect(HOME_BY_ROLE[user.role]);
}
