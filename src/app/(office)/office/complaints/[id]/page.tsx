import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/require-user";
import { ComplaintDetail } from "@/features/complaints/complaint-detail";
import { assignmentOptions, getComplaintForViewer } from "@/features/complaints/queries";

export const metadata = { title: "Complaint" };

export default async function OfficeComplaintPage({
  params,
}: PageProps<"/office/complaints/[id]">) {
  const user = await requireUser("complaint.view_all");
  const { id } = await params;

  const [complaint, options] = await Promise.all([
    getComplaintForViewer(id, user),
    assignmentOptions(),
  ]);
  if (!complaint) notFound();

  return (
    <ComplaintDetail
      complaint={complaint}
      viewer={user}
      departments={options.departments}
      officers={options.officers}
    />
  );
}
