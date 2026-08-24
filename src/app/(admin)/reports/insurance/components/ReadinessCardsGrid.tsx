"use client";

import { buttons, glass, typography } from "@/theme";
import { metricButtonTone } from "../lib/insuranceUtils";
import type { ReadinessItem } from "../types";

type Props = {
  items: ReadinessItem[];
};

export default function ReadinessCardsGrid({ items }: Props) {
  return (
    <section
      aria-label="Insurance readiness summary"
      className="grid gap-5 md:grid-cols-2 xl:grid-cols-4"
    >
      {items.map((item) => (
        <article key={item.label} className={`${glass.card} p-5`}>
          <div className="flex min-w-0 items-start justify-between gap-4">
            <p className={`${typography.caption} min-w-0 break-words`}>
              {item.label}
            </p>

            <a
              href={item.href}
              aria-label={`${item.actionLabel}: ${item.value}`}
              className={`${buttons.secondary} shrink-0 whitespace-nowrap px-3 py-2 text-xs`}
            >
              <span className={`tabular-nums ${metricButtonTone(item.tone)}`}>
                {item.value}
              </span>
              <span>{item.actionLabel}</span>
            </a>
          </div>

          <p className={`mt-4 ${typography.bodyMuted}`}>{item.detail}</p>
        </article>
      ))}
    </section>
  );
}
