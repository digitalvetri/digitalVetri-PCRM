import Link from "next/link";
import { FileText, FileDown, Building2, IndianRupee } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/grade-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NewProposalDialog } from "@/components/proposals/new-proposal-dialog";
import { prisma } from "@/lib/prisma";
import { formatINR, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata = { title: "Proposals" };

export default async function ProposalsPage() {
  const proposals = await prisma.proposal.findMany({
    include: { company: true, user: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Proposal Generator"
        description="Generate professional, AI-drafted proposals with pricing, timeline and AMC."
      >
        <NewProposalDialog />
      </PageHeader>

      {proposals.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No proposals yet"
          description="Generate your first AI-powered proposal from a company's analysis and recommendation."
          action={<NewProposalDialog />}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {proposals.map((p) => (
            <Card key={p.id}>
              <CardContent className="flex flex-col gap-3 p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold">{p.title}</h3>
                    <p className="mt-0.5 flex items-center gap-1 truncate text-sm text-muted-foreground">
                      <Building2 className="h-3.5 w-3.5 shrink-0" /> {p.company.name}
                    </p>
                  </div>
                  <StatusBadge status={p.status} />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">{p.proposalNo}</span>
                  <span className="flex items-center gap-1 text-sm font-bold text-primary">
                    <IndianRupee className="h-3.5 w-3.5" />
                    {formatINR(p.totalValue)}
                  </span>
                </div>

                <p className="text-xs text-muted-foreground">Created {formatDate(p.createdAt)}</p>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Button asChild variant="outline" size="sm">
                    <a href={`/api/proposals/${p.id}/pdf`} target="_blank" rel="noreferrer">
                      <FileDown className="h-4 w-4" /> Download PDF
                    </a>
                  </Button>
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/companies/${p.company.id}`}>View</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
