"use client";

import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRole } from "@/components/layout/app-shell";
import { AiCompany } from "@/components/command-center/ai-company";
import {
  VetriHud,
  type VetriVitals,
  type VetriProvider,
  type VetriCounts,
} from "@/components/command-center/vetri-hud";
import { LeadRadar, type DiscoveredLeadItem } from "@/components/command-center/lead-radar";
import { OutreachQueue, type OutreachDraftItem } from "@/components/command-center/outreach-queue";
import {
  AutomationPanel,
  type AutomationConfig,
  type AgentRunItem,
} from "@/components/command-center/automation-panel";

/**
 * The AI Company module — the org chart of department heads reporting to the AI
 * CEO, plus the Sales department's working surfaces (Lead Radar, Outreach) and
 * the 24/7 automation engine config, relocated here out of the Command Center.
 */
export function CompanyModule({
  leads,
  outreachDrafts,
  automation,
  agentRuns,
  placesConfigured,
  vitals,
  providers,
  counts,
}: {
  leads: DiscoveredLeadItem[];
  outreachDrafts: OutreachDraftItem[];
  automation: AutomationConfig;
  agentRuns: AgentRunItem[];
  placesConfigured: boolean;
  vitals: VetriVitals;
  providers: VetriProvider[];
  counts: VetriCounts;
}) {
  const canManage = useRole() !== "VIEWER";

  return (
    <Tabs defaultValue="vetri" className="animate-fade-in">
      <TabsList className="h-auto flex-wrap justify-start">
        <TabsTrigger value="vetri">🛰️ Vetri</TabsTrigger>
        <TabsTrigger value="org">🏢 Org Chart</TabsTrigger>
        {canManage && <TabsTrigger value="leads">Leads</TabsTrigger>}
        {canManage && <TabsTrigger value="outreach">Outreach</TabsTrigger>}
        {canManage && <TabsTrigger value="automation">24/7 Engine</TabsTrigger>}
      </TabsList>

      <TabsContent value="vetri" forceMount className="mt-4 data-[state=inactive]:hidden">
        <VetriHud vitals={vitals} providers={providers} counts={counts} />
      </TabsContent>
      <TabsContent value="org" forceMount className="mt-4 data-[state=inactive]:hidden">
        <AiCompany />
      </TabsContent>

      {canManage && (
        <>
          <TabsContent value="leads" forceMount className="mt-4 data-[state=inactive]:hidden">
            <LeadRadar leads={leads} placesConfigured={placesConfigured} />
          </TabsContent>
          <TabsContent value="outreach" forceMount className="mt-4 data-[state=inactive]:hidden">
            <OutreachQueue drafts={outreachDrafts} />
          </TabsContent>
          <TabsContent value="automation" forceMount className="mt-4 data-[state=inactive]:hidden">
            <AutomationPanel config={automation} recentRuns={agentRuns} placesConfigured={placesConfigured} />
          </TabsContent>
        </>
      )}
    </Tabs>
  );
}
