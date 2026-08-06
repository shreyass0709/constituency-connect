import { requireUser } from "@/lib/auth/require-user";
import { db } from "@/lib/db";
import { ProfileForm, type ProfileValues } from "@/features/public-site/profile-form";

export const metadata = { title: "Representative profile" };

const BLANK: ProfileValues = {
  name: "",
  type: "MLA",
  constituencyName: "",
  party: null,
  photo: null,
  bio: "",
  vision: "",
  contactEmail: null,
  contactPhone: null,
  officeAddress: null,
  officeHours: null,
};

export default async function ProfilePage() {
  await requireUser("content.publish");
  const profile = await db.representative.findFirst();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Representative profile
        </h1>
        <p className="text-muted-foreground">
          Everything here is public — it drives the home page, About and Contact.
        </p>
      </div>
      <ProfileForm initial={profile ? { ...BLANK, ...profile } : BLANK} />
    </div>
  );
}
