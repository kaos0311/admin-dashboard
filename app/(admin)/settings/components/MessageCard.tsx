import { AlertTriangle, CheckCircle2, Info } from "lucide-react";

import { alerts } from "@/theme";

import type { SettingsMessage } from "../settings-types";

type MessageCardProps = {
  message: SettingsMessage;
};

export function MessageCard({ message }: MessageCardProps) {
  const config = {
    success: {
      icon: <CheckCircle2 className="h-5 w-5" />,
      className: alerts.success,
    },
    error: {
      icon: <AlertTriangle className="h-5 w-5" />,
      className: alerts.danger,
    },
    info: {
      icon: <Info className="h-5 w-5" />,
      className: alerts.info,
    },
  }[message.type];

  return (
    <div
      className={[
        "flex items-start gap-3 rounded-3xl border p-4 text-sm shadow-2xl shadow-black/20 backdrop-blur-xl",
        config.className,
      ].join(" ")}
    >
      <div className="mt-0.5 shrink-0">{config.icon}</div>
      <p className="leading-6">{message.text}</p>
    </div>
  );
}
