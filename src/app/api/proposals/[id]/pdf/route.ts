import { withApi } from "@/lib/api";
import { requireUser, ApiError } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { createPdfBuilder, drawCoverPage, addPageFooters, pdfResponse } from "@/lib/pdf";
import type { ProposalContent } from "@/lib/ai/proposal";

const inr = new Intl.NumberFormat("en-IN");
function rs(amount: number | null | undefined): string {
  return `Rs. ${inr.format(Math.round(amount ?? 0))}`;
}

/** GET /api/proposals/[id]/pdf — full professional proposal PDF. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi(async () => {
    await requireUser("proposals.view");
    const { id } = await params;

    const proposal = await prisma.proposal.findUnique({
      where: { id },
      include: { company: true },
    });
    if (!proposal) throw new ApiError(404, "Proposal not found");

    const c = proposal.content as unknown as ProposalContent;
    const builder = await createPdfBuilder();

    drawCoverPage(builder, {
      title: c.coverPage?.title || proposal.title || "Software Proposal",
      subtitle: c.coverPage?.subtitle || `${proposal.company.industry ?? "Business"} Solution`,
      forCompany: proposal.company.name,
    });

    // Company Overview
    if (c.companyOverview) {
      builder.heading("Company Overview");
      builder.paragraph(c.companyOverview);
      builder.spacer(6);
    }

    // Current Problems
    const problems = c.currentProblems ?? [];
    if (problems.length) {
      builder.heading("Current Problems");
      for (const p of problems) {
        builder.subheading(p.title ?? "");
        if (p.description) builder.paragraph(p.description);
      }
      builder.spacer(6);
    }

    // Recommended Solution
    if (c.recommendedSolution) {
      builder.heading("Recommended Solution");
      builder.paragraph(c.recommendedSolution);
      builder.spacer(6);
    }

    // Scope
    const scope = c.scope ?? [];
    if (scope.length) {
      builder.heading("Scope of Work");
      for (const s of scope) builder.bullet(s);
      builder.spacer(6);
    }

    // Modules
    const modules = c.modules ?? [];
    if (modules.length) {
      builder.heading("Modules");
      for (const m of modules) {
        builder.subheading(m.name ?? "");
        if (m.description) builder.paragraph(m.description);
      }
      builder.spacer(6);
    }

    // Timeline
    const timeline = c.timeline ?? [];
    if (timeline.length) {
      builder.heading("Project Timeline");
      builder.table(
        ["Phase", "Duration", "Deliverables"],
        timeline.map((t) => [t.phase ?? "", t.duration ?? "", t.deliverables ?? ""]),
        [150, 100, 245]
      );
      builder.spacer(6);
    }

    // Deliverables
    const deliverables = c.deliverables ?? [];
    if (deliverables.length) {
      builder.heading("Deliverables");
      for (const d of deliverables) builder.bullet(d);
      builder.spacer(6);
    }

    // Technology
    const technology = c.technology ?? [];
    if (technology.length) {
      builder.heading("Technology Stack");
      for (const t of technology) builder.bullet(t);
      builder.spacer(6);
    }

    // Pricing
    const pricing = c.pricing ?? [];
    if (pricing.length) {
      builder.heading("Pricing");
      const rows = pricing.map((p) => [p.item ?? "", p.description ?? "", rs(p.amount)]);
      rows.push(["Total", "", rs(c.totalValue ?? proposal.totalValue)]);
      builder.table(["Item", "Description", "Amount"], rows, [150, 245, 100]);
      builder.spacer(6);
    }

    // Milestones
    const milestones = c.milestones ?? [];
    if (milestones.length) {
      builder.heading("Payment Milestones");
      builder.table(
        ["Milestone", "Payment"],
        milestones.map((m) => [m.milestone ?? "", m.payment ?? ""]),
        [345, 150]
      );
      builder.spacer(6);
    }

    // AMC
    if (c.amc) {
      builder.heading("Annual Maintenance (AMC)");
      if (c.amc.description) builder.paragraph(c.amc.description);
      builder.keyValue("Annual Value", rs(c.amc.annualValue));
      builder.spacer(6);
    }

    // Support
    if (c.support) {
      builder.heading("Support");
      builder.paragraph(c.support);
      builder.spacer(6);
    }

    // Terms
    const terms = c.terms ?? [];
    if (terms.length) {
      builder.heading("Terms & Conditions");
      terms.forEach((t, i) => builder.paragraph(`${i + 1}. ${t}`));
      builder.spacer(6);
    }

    // Signature
    builder.heading("Acceptance");
    const sig = c.signature;
    builder.paragraph(
      "By signing below, the parties agree to the terms of this proposal.",
      { color: undefined }
    );
    builder.spacer(20);
    builder.keyValue("For DigitalVetri", "____________________________");
    builder.spacer(10);
    builder.keyValue(
      `For ${sig?.company || proposal.company.name}`,
      "____________________________"
    );
    if (sig?.contact) builder.keyValue("Contact", sig.contact);
    if (sig?.email) builder.keyValue("Email", sig.email);

    addPageFooters(builder);

    const filename = `proposal-${proposal.proposalNo}-${proposal.company.slug}.pdf`;
    return pdfResponse(await builder.doc.save(), filename);
  });
}
