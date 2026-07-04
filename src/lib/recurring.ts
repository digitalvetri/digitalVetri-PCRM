import { prisma } from "@/lib/prisma";
import type { BillingCycle } from "@prisma/client";

/** Normalise a recurring amount to a monthly figure for MRR. */
export function toMonthly(amount: number, cycle: BillingCycle | null | undefined): number {
  if (!amount) return 0;
  if (cycle === "QUARTERLY") return amount / 3;
  if (cycle === "YEARLY") return amount / 12;
  return amount; // MONTHLY (or unset) → treat as monthly
}

/** MRR/ARR + active recurring contracts across all won AMC/retainer deals. */
export async function getRecurringSnapshot() {
  const now = new Date();
  const recurring = await prisma.prospect.findMany({
    where: {
      status: "WON",
      dealType: { in: ["AMC", "RETAINER"] },
      recurringAmount: { not: null },
      OR: [{ contractEnd: null }, { contractEnd: { gte: now } }],
    },
    select: { recurringAmount: true, billingCycle: true },
  });
  const mrr = recurring.reduce((s, p) => s + toMonthly(p.recurringAmount ?? 0, p.billingCycle), 0);
  return { mrr: Math.round(mrr), arr: Math.round(mrr * 12), activeContracts: recurring.length };
}

export interface RenewalDue {
  prospectId: string;
  companyId: string;
  companyName: string;
  renewalDate: string; // ISO
  recurringAmount: number | null;
  billingCycle: BillingCycle | null;
  overdue: boolean;
}

/** Recurring deals whose renewal date falls within `withinDays` (or is overdue). */
export async function getRenewalsDue(withinDays = 45): Promise<RenewalDue[]> {
  const now = new Date();
  const until = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000);
  const rows = await prisma.prospect.findMany({
    where: {
      status: "WON",
      dealType: { in: ["AMC", "RETAINER"] },
      renewalDate: { not: null, lte: until },
    },
    select: {
      id: true,
      recurringAmount: true,
      billingCycle: true,
      renewalDate: true,
      company: { select: { id: true, name: true } },
    },
    orderBy: { renewalDate: "asc" },
    take: 20,
  });
  return rows.map((p) => ({
    prospectId: p.id,
    companyId: p.company.id,
    companyName: p.company.name,
    renewalDate: p.renewalDate!.toISOString(),
    recurringAmount: p.recurringAmount,
    billingCycle: p.billingCycle,
    overdue: p.renewalDate! < now,
  }));
}
