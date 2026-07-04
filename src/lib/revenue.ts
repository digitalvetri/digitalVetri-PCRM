import { prisma } from "@/lib/prisma";
import type { PaymentStatus } from "@prisma/client";
import { istMonthKey, istStartOfMonth, istEndOfMonth, IST_OFFSET_MS } from "@/lib/time";

/** Revenue that actually counts toward the books — billed or collected. */
const COUNTED: PaymentStatus[] = ["INVOICED", "PAID", "OVERDUE"];

/** Last `months` of revenue, cost and profit, bucketed by IST month. */
export async function getRevenueHistory(months = 6) {
  const entries = await prisma.revenueEntry.findMany({
    where: { status: { in: COUNTED } },
    select: { date: true, amount: true, cost: true },
  });

  const istNow = new Date(Date.now() + IST_OFFSET_MS);
  const base = istNow.getUTCFullYear() * 12 + istNow.getUTCMonth();
  const out: { name: string; revenue: number; profit: number }[] = [];
  for (let i = -(months - 1); i <= 0; i++) {
    const tot = base + i;
    const y = Math.floor(tot / 12);
    const m = ((tot % 12) + 12) % 12;
    const key = `${y}-${String(m + 1).padStart(2, "0")}`;
    const label = new Date(Date.UTC(y, m, 1)).toLocaleDateString("en-IN", {
      month: "short",
      year: "2-digit",
      timeZone: "UTC",
    });
    let revenue = 0;
    let profit = 0;
    for (const e of entries) {
      if (istMonthKey(e.date) === key) {
        revenue += e.amount;
        profit += e.amount - e.cost;
      }
    }
    out.push({ name: label, revenue: Math.round(revenue), profit: Math.round(profit) });
  }
  return out;
}

/** This-IST-month revenue & profit, plus total outstanding receivables. */
export async function getRevenueSummary() {
  const monthStart = istStartOfMonth();
  const monthEnd = istEndOfMonth();

  const [thisMonth, outstanding] = await Promise.all([
    prisma.revenueEntry.findMany({
      where: { status: { in: COUNTED }, date: { gte: monthStart, lte: monthEnd } },
      select: { amount: true, cost: true },
    }),
    prisma.revenueEntry.aggregate({
      where: { status: { in: ["INVOICED", "OVERDUE"] } },
      _sum: { amount: true },
    }),
  ]);

  const revenue = thisMonth.reduce((s, e) => s + e.amount, 0);
  const profit = thisMonth.reduce((s, e) => s + (e.amount - e.cost), 0);
  return {
    monthRevenue: Math.round(revenue),
    monthProfit: Math.round(profit),
    outstanding: Math.round(outstanding._sum.amount ?? 0),
  };
}

/** A single client's ledger + lifetime totals for the company detail page. */
export async function getCompanyRevenue(companyId: string) {
  const entries = await prisma.revenueEntry.findMany({
    where: { companyId },
    orderBy: { date: "desc" },
    take: 100,
  });

  let lifetimeValue = 0;
  let collected = 0;
  let outstanding = 0;
  for (const e of entries) {
    if (e.status === "PAID" || e.status === "INVOICED" || e.status === "OVERDUE") lifetimeValue += e.amount;
    if (e.status === "PAID") collected += e.amount;
    if (e.status === "INVOICED" || e.status === "OVERDUE") outstanding += e.amount;
  }

  return {
    entries: entries.map((e) => ({
      id: e.id,
      date: e.date.toISOString(),
      kind: e.kind,
      amount: e.amount,
      cost: e.cost,
      status: e.status,
      invoiceNo: e.invoiceNo,
      note: e.note,
    })),
    totals: {
      lifetimeValue: Math.round(lifetimeValue),
      collected: Math.round(collected),
      outstanding: Math.round(outstanding),
    },
  };
}
