import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import type { SettingsMessage } from "../settings-types";

type MessageCardProps = {
  message: SettingsMessage;
};

export function MessageCard({ message }: MessageCardProps) {
  const config = {
    success: {
      icon: <CheckCircle2 className="h-5 w-5 text-emerald-200" />,
      className: "border-emerald-300/20 bg-emerald-400/10 text-emerald-50",
    },
    error: {
      icon: <AlertTriangle className="h-5 w-5 text-red-200" />,
      className: "border-red-300/20 bg-red-500/10 text-red-50",
    },
    info: {
      icon: <Info className="h-5 w-5 text-cyan-200" />,
      className: "border-cyan-300/20 bg-cyan-400/10 text-cyan-50",
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