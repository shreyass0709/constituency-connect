import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { can } from "@/lib/auth/permissions";
import { ComplaintDetail } from "@/features/complaints/complaint-detail";
import { assignmentOptions, getComplaintForViewer } from "@/features/complaints/queries";

export const metadata = { title: "Concern" };

export default async function ComplaintPage({
  params,
  searchParams,
}: PageProps<"/dashboard/complaints/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const { new: isNew } = await searchParams;

  const complaint = await getComplaintForViewer(id, user);
  if (!complaint) notFound();

  const options = can(user.role, "complaint.triage")
    ? await assignmentOptions()
    : { departments: [], officers: [] };

  return (
    <ComplaintDetail
      complaint={complaint}
      viewer={user}
      departments={options.departments}
      officers={options.officers}
      justSubmitted={isNew === "1"}
    />
  );
}
