import Link from "next/link";
import { Download } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EstimateNote } from "@/components/shared/confidence-badge";
import { StatusBadge } from "@/components/shared/grade-badge";
import {
  TrendAreaChart,
  DonutChart,
  VerticalBarChart,
  ColumnChart,
} from "@/components/charts/charts";
import { formatINR, enumLabel } from "@/lib/utils";
import { getRevenueForecast, getLeadSourceAnalysis } from "@/lib/queries";
import {
  getProposalConversion,
  getSalesPerformance,
  getMonthlyClosures,
  getPipelineByStage,
  getIndustryAnalysis,
} from "@/lib/reports";

export const dynamic = "force-dynamic";

export const metadata = { title: "Reports" };

export default async function ReportsPage() {
  const [forecast, leadSources, industry, conversion, performance, closures, pipeline] =
    await Promise.all([
      getRevenueForecast(),
      getLeadSourceAnalysis(),
      getIndustryAnalysis(),
      getProposalConversion(),
      getSalesPerformance(),
      getMonthlyClosures(),
      getPipelineByStage(),
    ]);

  const industryChart = industry.map((i) => ({ name: i.industry, value: i.count }));
  const conversionChart = conversion.byStatus.map((s) => ({
    name: enumLabel(s.name),
    value: s.value,
  }));
  const closuresChart = closures.map((c) => ({ name: c.name, value: c.count }));
  const pipelineChart = pipeline.stages.map((s) => ({
    name: enumLabel(s.status),
    value: s.value,
  }));

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description="Business performance across your sales pipeline.">
        <Button asChild>
          <Link href="/api/reports/export">
            <Download className="h-4 w-4" />
            Export to Excel
          </Link>
        </Button>
      </PageHeader>

      <EstimateNote />

      {/* Revenue Forecast */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue Forecast</CardTitle>
        </CardHeader>
        <CardContent>
          <TrendAreaChart
            data={forecast}
            dataKeys={[
              { key: "won", label: "Won", color: "#10b981" },
              { key: "forecast", label: "Forecast (weighted)", color: "#4557d6" },
            ]}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Forecast is probability-weighted from open deals — an estimate, not committed revenue.
          </p>
        </CardContent>
      </Card>

      {/* Lead Source + Industry */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Lead Source Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <DonutChart data={leadSources} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Industry Analysis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <VerticalBarChart data={industryChart} />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Industry</TableHead>
                  <TableHead className="text-right">Companies</TableHead>
                  <TableHead className="text-right">Avg Score</TableHead>
                  <TableHead className="text-right">Pipeline</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {industry.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No industry data yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  industry.map((i) => (
                    <TableRow key={i.industry}>
                      <TableCell className="font-medium">{i.industry}</TableCell>
                      <TableCell className="text-right tabular-nums">{i.count}</TableCell>
                      <TableCell className="text-right tabular-nums">{i.avgLeadScore}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatINR(i.pipelineValue, true)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Proposal Conversion */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Proposal Conversion</CardTitle>
          <div className="text-right">
            <p className="text-2xl font-bold tabular-nums text-primary">
              {conversion.conversionRate}%
            </p>
            <p className="text-xs text-muted-foreground">
              {conversion.accepted} accepted / {conversion.sent} sent
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <ColumnChart data={conversionChart} />
        </CardContent>
      </Card>

      {/* Sales Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Sales Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Team Member</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Deals Won</TableHead>
                <TableHead className="text-right">Won Value</TableHead>
                <TableHead className="text-right">Active Pipeline</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {performance.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No sales team members yet.
                  </TableCell>
                </TableRow>
              ) : (
                performance.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell className="text-muted-foreground">{enumLabel(u.role)}</TableCell>
                    <TableCell className="text-right tabular-nums">{u.wonCount}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatINR(u.wonValue, true)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatINR(u.pipelineValue, true)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <p className="mt-2 text-xs text-muted-foreground">
            Prospects without an assigned owner are excluded from per-member totals.
          </p>
        </CardContent>
      </Card>

      {/* Monthly Closures + Pipeline by Stage */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Monthly Closures</CardTitle>
          </CardHeader>
          <CardContent>
            <ColumnChart data={closuresChart} color="#10b981" />
            <p className="mt-2 text-xs text-muted-foreground">
              Deals won per month over the last 6 months.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Pipeline by Stage</CardTitle>
            <div className="text-right">
              <p className="text-lg font-bold tabular-nums text-primary">
                {formatINR(pipeline.totalValue, true)}
              </p>
              <p className="text-xs text-muted-foreground">{pipeline.totalCount} prospects</p>
            </div>
          </CardHeader>
          <CardContent>
            <VerticalBarChart data={pipelineChart} color="#8b5cf6" />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Stage</TableHead>
                  <TableHead className="text-right">Count</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pipeline.stages.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      No open pipeline yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  pipeline.stages.map((s) => (
                    <TableRow key={s.status}>
                      <TableCell>
                        <StatusBadge status={s.status} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{s.count}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatINR(s.value, true)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
