import type { ReactNode } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type StatCardProps = {
  label: string;
  value: string | number;
  description?: string;
  icon?: ReactNode;
  className?: string;
};

export function StatCard({
  label,
  value,
  description,
  icon,
  className,
}: StatCardProps) {
  return (
    <Card className={cn("min-h-28", className)}>
      <CardContent className="flex h-full items-center justify-between p-6">
        <div>
          <p className="text-sm font-medium text-[var(--muted-foreground)]">
            {label}
          </p>

          <p className="mt-2 text-3xl font-bold tracking-tight text-[var(--foreground)]">
            {value}
          </p>

          {description ? (
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              {description}
            </p>
          ) : null}
        </div>

        {icon ? (
          <div className="rounded-md bg-[var(--muted)] p-3 text-[var(--muted-foreground)]">
            {icon}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
