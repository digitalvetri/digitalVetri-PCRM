"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PROSPECT_STATUSES } from "@/lib/constants";

interface AssignableUser {
  id: string;
  name: string;
}

interface ProspectActionsProps {
  prospectId: string;
  synced: boolean;
  initial: {
    status: string;
    assignedToId: string | null;
    proposalValue: number | null;
    expectedCloseDate: string | null;
    probability: number | null;
    nextFollowUpDate: string | null;
    dealType: string;
    recurringAmount: number | null;
    billingCycle: string | null;
    renewalDate: string | null;
  };
  users: AssignableUser[];
  /** Whether the current user may change the assignee (prospects.assign). */
  canAssign: boolean;
}

const UNASSIGNED = "UNASSIGNED";

export function ProspectActions({ prospectId, synced, initial, users, canAssign }: ProspectActionsProps) {
  const router = useRouter();
  const statusId = React.useId();
  const assignedToId2 = React.useId();
  const proposalValueId = React.useId();
  const probabilityId = React.useId();
  const expectedCloseDateId = React.useId();
  const nextFollowUpDateId = React.useId();
  const dealTypeId = React.useId();
  const recurringAmountId = React.useId();
  const billingCycleId = React.useId();
  const renewalDateId = React.useId();
  const [status, setStatus] = React.useState(initial.status);
  const [assignedToId, setAssignedToId] = React.useState(initial.assignedToId ?? UNASSIGNED);
  const [proposalValue, setProposalValue] = React.useState(
    initial.proposalValue != null ? String(initial.proposalValue) : ""
  );
  const [expectedCloseDate, setExpectedCloseDate] = React.useState(initial.expectedCloseDate ?? "");
  const [probability, setProbability] = React.useState(
    initial.probability != null ? String(initial.probability) : ""
  );
  const [nextFollowUpDate, setNextFollowUpDate] = React.useState(initial.nextFollowUpDate ?? "");
  const [dealType, setDealType] = React.useState(initial.dealType || "ONE_TIME");
  const [recurringAmount, setRecurringAmount] = React.useState(
    initial.recurringAmount != null ? String(initial.recurringAmount) : ""
  );
  const [billingCycle, setBillingCycle] = React.useState(initial.billingCycle || "MONTHLY");
  const [renewalDate, setRenewalDate] = React.useState(initial.renewalDate ?? "");
  const [saving, setSaving] = React.useState(false);
  const isRecurring = dealType !== "ONE_TIME";
  const [syncing, setSyncing] = React.useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/prospects/${prospectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          // Only send the assignee when the user is allowed to change it, so
          // pipeline edits by non-managers aren't rejected by the server gate.
          ...(canAssign
            ? { assignedToId: assignedToId === UNASSIGNED ? null : assignedToId }
            : {}),
          proposalValue: proposalValue === "" ? null : Number(proposalValue),
          expectedCloseDate: expectedCloseDate || null,
          probability: probability === "" ? null : Number(probability),
          nextFollowUpDate: nextFollowUpDate || null,
          dealType,
          recurringAmount: !isRecurring || recurringAmount === "" ? null : Number(recurringAmount),
          billingCycle: isRecurring ? billingCycle : null,
          renewalDate: isRecurring ? renewalDate || null : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Update failed");
      toast.success("Prospect updated.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  async function sync() {
    setSyncing(true);
    try {
      const res = await fetch(`/api/prospects/${prospectId}/sync`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Sync failed");
      toast.success(json.message ?? "Synced to CRM.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Pipeline & Assignment</CardTitle>
        <Button variant="outline" size="sm" onClick={sync} disabled={syncing}>
          <RefreshCw className="h-4 w-4" />
          {syncing ? "Syncing…" : synced ? "Re-sync to CRM" : "Sync to CRM"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor={statusId}>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id={statusId}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROSPECT_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={assignedToId2}>Assigned To</Label>
            <Select value={assignedToId} onValueChange={setAssignedToId} disabled={!canAssign}>
              <SelectTrigger id={assignedToId2}>
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!canAssign && (
              <p className="text-xs text-muted-foreground">Only managers can reassign prospects.</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={dealTypeId}>Engagement type</Label>
            <Select value={dealType} onValueChange={setDealType}>
              <SelectTrigger id={dealTypeId} aria-label="Engagement type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ONE_TIME">One-time project</SelectItem>
                <SelectItem value="AMC">AMC (annual maintenance)</SelectItem>
                <SelectItem value="RETAINER">Retainer</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={proposalValueId}>
              {isRecurring ? "Project / setup value (₹)" : "Proposal Value (₹)"}
            </Label>
            <Input
              id={proposalValueId}
              type="number"
              value={proposalValue}
              onChange={(e) => setProposalValue(e.target.value)}
              placeholder="0"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={probabilityId}>Probability (%)</Label>
            <Input
              id={probabilityId}
              type="number"
              min={0}
              max={100}
              value={probability}
              onChange={(e) => setProbability(e.target.value)}
              placeholder="0"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={expectedCloseDateId}>Expected Close Date</Label>
            <Input
              id={expectedCloseDateId}
              type="date"
              value={expectedCloseDate}
              onChange={(e) => setExpectedCloseDate(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor={nextFollowUpDateId}>Next Follow-up</Label>
            <Input
              id={nextFollowUpDateId}
              type="date"
              value={nextFollowUpDate}
              onChange={(e) => setNextFollowUpDate(e.target.value)}
            />
          </div>
        </div>

        {isRecurring && (
          <div className="grid gap-4 rounded-lg border bg-muted/30 p-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor={recurringAmountId}>Recurring amount (₹)</Label>
              <Input
                id={recurringAmountId}
                type="number"
                value={recurringAmount}
                onChange={(e) => setRecurringAmount(e.target.value)}
                placeholder="e.g. 5000"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={billingCycleId}>Billing cycle</Label>
              <Select value={billingCycle} onValueChange={setBillingCycle}>
                <SelectTrigger id={billingCycleId} aria-label="Billing cycle">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MONTHLY">Monthly</SelectItem>
                  <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                  <SelectItem value="YEARLY">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={renewalDateId}>Renewal date</Label>
              <Input id={renewalDateId} type="date" value={renewalDate} onChange={(e) => setRenewalDate(e.target.value)} />
            </div>
            <p className="text-xs text-muted-foreground sm:col-span-3">
              Recurring deals count toward MRR once won and appear in the renewals-due list near their renewal date.
            </p>
          </div>
        )}

        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
