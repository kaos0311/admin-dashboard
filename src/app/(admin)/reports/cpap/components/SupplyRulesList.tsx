"use client";

import { ClipboardCheck } from "lucide-react";
import { CPAP_SUPPLY_RULES } from "../../patients/lib/cpapEligibility";
import { glass, typography } from "@/theme";
import { cx } from "../lib/cpapUtils";

export function SupplyRulesList() {
  return (
    <section className={glass.panelPadded}>
      <div className="mb-4 flex min-w-0 items-center gap-2">
        <ClipboardCheck className="h-5 w-5 shrink-0 text-cyan-200" aria-hidden />
        <h2 className={typography.cardTitle}>CPAP Supply Rules</h2>
      </div>

      <div className="grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {CPAP_SUPPLY_RULES.map((rule) => (
          <article key={rule.id} className={glass.insetPadded}>
            <p className={typography.bodyStrong}>{rule.label}</p>
            <p className={cx(typography.smallMuted, "mt-1")}>{rule.hcpcs.join(", ")}</p>
            <p className={cx(typography.small, "mt-2")}>{rule.description}</p>
            <p className={cx(typography.smallMuted, "mt-1")}>
              Medicare 3-month quantity: {rule.medicareThreeMonthQuantity}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
