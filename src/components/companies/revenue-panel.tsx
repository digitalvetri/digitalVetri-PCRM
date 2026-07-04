"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Check, Trash2, Loader2, IndianRupee } from "lucide-react";
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
import { formatINR, formatDate } from "@/lib/utils";

export interface RevenueEntryItem {
  id: string;
  date: string;
  kind: string;
  amount: number;
  cost: number;
  status: string;
  invoiceNo: string | null;
  note: string | null;
}

interface Totals {
  lifetimeValue: number;
  collected: number;
  outstanding: number;
}

const STATUS_CLS: Record<string, string> = {
  PAID: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  INVOICED: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  OVERDUE: "bg-destructive/10 text-destructive",
  DRAFT: "bg-muted text-muted-foreground",
};

const todayInput = () => new Date(new Date().getTime() + 5.5 * 3600_000).toISOString().slice(0, 10);

export function RevenuePanel({
  companyId,
  entries,
  totals,
  canWrite,
}: {
  companyId: string;
  entries: RevenueEntryItem[];
  totals: Totals;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [adding, setAdding] = React.useState(false);
  const [busy, setBusy] = React.useState<string | null>(null);

  // add-form state
  const [amount, setAmount] = React.useState("");
  const [cost, setCost] = React.useState("");
  const [date, setDate] = React.useState(todayInput());
  const [kind, setKind] = React.useState("PROJECT");
  const [status, setStatus] = React.useState("INVOICED");
  const [invoiceNo, setInvoiceNo] = React.useState("");

  async function addEntry() {
    if (amount === "" || Number(amount) < 0) {
      toast.error("Enter the amount billed.");
      return;
    }
    setBusy("add");
    try {
      const res = await fetch("/api/revenue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          date,
          kind,
          status,
          amount: Number(amount),
          cost: cost === "" ? 0 : Number(cost),
          invoiceNo: invoiceNo || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not add entry");
      toast.success("Revenue entry added.");
      setAmount("");
      setCost("");
      setInvoiceNo("");
      setAdding(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add entry");
    } finally {
      setBusy(null);
    }
  }

  async function markPaid(id: string) {
    setBusy(id);
    try {
      const res = await fetch(`/api/revenue/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PAID" }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Marked paid.");
      router.refresh();
    } catch {
      toast.error("Couldn't update.");
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this revenue entry?")) return;
    setBusy(id);
    try {
      const res = await fetch(`/api/revenue/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast.success("Deleted.");
      router.refresh();
    } catch {
      toast.error("Couldn't delete.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <IndianRupee className="h-4 w-4 text-primary" /> Revenue &amp; Invoices
        </CardTitle>
        {canWrite && (
          <Button size="sm" variant="outline" onClick={() => setAdding((v) => !v)}>
            <Plus className="h-4 w-4" /> Add entry
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Totals */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Lifetime value</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums">{formatINR(totals.lifetimeValue, true)}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Collected</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
              {formatINR(totals.collected, true)}
            </p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Outstanding</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums text-amber-600 dark:text-amber-400">
              {formatINR(totals.outstanding, true)}
            </p>
          </div>
        </div>

        {/* Add form */}
        {adding && canWrite && (
          <div className="grid gap-3 rounded-lg border bg-muted/30 p-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="rev-amount">Amount billed (₹)</Label>
              <Input id="rev-amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rev-cost">Delivery cost (₹)</Label>
              <Input id="rev-cost" type="number" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rev-date">Date</Label>
              <Input id="rev-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rev-kind">Type</Label>
              <Select value={kind} onValueChange={setKind}>
                <SelectTrigger id="rev-kind"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PROJECT">Project</SelectItem>
                  <SelectItem value="AMC">AMC</SelectItem>
                  <SelectItem value="ADDON">Add-on</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rev-status">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="rev-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="INVOICED">Invoiced</SelectItem>
                  <SelectItem value="PAID">Paid</SelectItem>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="OVERDUE">Overdue</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rev-inv">Invoice no. (optional)</Label>
              <Input id="rev-inv" value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} placeholder="INV-001" />
            </div>
            <div className="sm:col-span-3">
              <Button size="sm" onClick={addEntry} disabled={busy === "add"}>
                {busy === "add" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Save entry
              </Button>
            </div>
          </div>
        )}

        {/* Ledger */}
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No revenue recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">Type</th>
                  <th className="py-2 pr-3">Amount</th>
                  <th className="py-2 pr-3">Profit</th>
                  <th className="py-2 pr-3">Status</th>
                  {canWrite && <th className="py-2" />}
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-b last:border-0">
                    <td className="whitespace-nowrap py-2 pr-3">{formatDate(e.date)}</td>
                    <td className="py-2 pr-3">{e.kind === "ADDON" ? "Add-on" : e.kind.charAt(0) + e.kind.slice(1).toLowerCase()}</td>
                    <td className="py-2 pr-3 tabular-nums">{formatINR(e.amount, true)}</td>
                    <td className="py-2 pr-3 tabular-nums">{formatINR(e.amount - e.cost, true)}</td>
                    <td className="py-2 pr-3">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_CLS[e.status] ?? ""}`}>
                        {e.status.charAt(0) + e.status.slice(1).toLowerCase()}
                      </span>
                    </td>
                    {canWrite && (
                      <td className="py-2 text-right">
                        <span className="inline-flex gap-1">
                          {(e.status === "INVOICED" || e.status === "OVERDUE") && (
                            <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Mark paid" disabled={busy === e.id} onClick={() => markPaid(e.id)}>
                              <Check className="h-4 w-4 text-emerald-600" />
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Delete entry" disabled={busy === e.id} onClick={() => remove(e.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </span>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
