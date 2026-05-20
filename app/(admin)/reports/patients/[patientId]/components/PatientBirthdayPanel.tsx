import { Cake } from "lucide-react";

import { Panel } from "./PatientDetailPrimitives";

type Props = {
  fullName: string;
  ageTurning: number | null;
  birthday: string;
  isThisMonth: boolean;
};

export function PatientBirthdayPanel({
  fullName,
  ageTurning,
  birthday,
  isThisMonth,
}: Props) {
  if (!isThisMonth) return null;

  return (
    <Panel icon={<Cake className="h-5 w-5" />} title="Birthday Reminder" tone="amber">
      {fullName} turns {ageTurning ?? "—"} on {birthday}.
    </Panel>
  );
}