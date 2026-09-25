"use client";

import { type LucideIcon } from "lucide-react";
import { buttons, glass, typography } from "@/theme";
import { metricButtonTone } from "../lib/insuranceUtils";
import type { FocusArea } from "../types";

type FocusAreaWithIcon = FocusArea & { icon: LucideIcon };

type Props = {
  areas: FocusAreaWithIcon[];
};

export default function FocusAreaCardsGrid({ areas }: Props) {
  return (
    <section
      aria-label="Insurance bridge focus areas"
      className="grid gap-5 md:grid-cols-2 xl:grid-cols-4"
    >
      {areas.map((area) => {
        const Icon = area.icon;

        return (
          <article key={area.label} className={`${glass.card} p-5`}>
            <div className={glass.iconBox}>
              <Icon className="h-5 w-5" aria-hidden="true" />
            </div>

            <div className="mt-4 flex items-start justify-between gap-3">
              <h2 className={typography.bodyStrong}>{area.label}</h2>

              <a
                href={area.href}
                aria-label={`${area.actionLabel}: ${area.value.toLocaleString()}`}
                className={`${buttons.secondary} shrink-0 whitespace-nowrap px-3 py-2 text-xs`}
              >
                <span
                  className={`tabular-nums ${metricButtonTone(area.tone)}`}
                >
                  {area.value.toLocaleString()}
                </span>
                <span>{area.actionLabel}</span>
              </a>
            </div>

            <p className={`mt-2 ${typography.bodyMuted}`}>
              {area.description}
            </p>
          </article>
        );
      })}
    </section>
  );
}
