"use client";

import { AiCompany } from "@/components/command-center/ai-company";
import {
  VetriHud,
  type VetriVitals,
  type VetriProvider,
  type VetriCounts,
} from "@/components/command-center/vetri-hud";

/**
 * The AI Company module — a single page: the Vetri command deck up top, with
 * the department org chart directly beneath it. No sub-tabs.
 */
export function CompanyModule({
  vitals,
  providers,
  counts,
}: {
  vitals: VetriVitals;
  providers: VetriProvider[];
  counts: VetriCounts;
}) {
  return (
    <div className="space-y-6">
      <VetriHud vitals={vitals} providers={providers} counts={counts} />
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">The Org Chart</h2>
        <AiCompany />
      </div>
    </div>
  );
}
