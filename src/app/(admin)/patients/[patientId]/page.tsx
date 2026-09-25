import { redirect } from "next/navigation";

export default async function PatientRedirectPage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  const { patientId } = await params;

  redirect(`/reports/patients/${encodeURIComponent(patientId)}`);
}
