import { withApi } from "@/lib/api";
import { requireUser, ApiError } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { createPdfBuilder, drawCoverPage, addPageFooters, pdfResponse } from "@/lib/pdf";
import type { QuestionnaireSection } from "@/lib/ai/questionnaire";

/** GET /api/meetings/[id]/pdf — export the discovery questionnaire as a PDF. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi(async () => {
    await requireUser("meetings.view");
    const { id } = await params;

    const meeting = await prisma.meeting.findUnique({
      where: { id },
      include: { company: true },
    });
    if (!meeting) throw new ApiError(404, "Meeting not found");

    const sections = (meeting.questionnaire as unknown as QuestionnaireSection[] | null) ?? [];
    const industry = meeting.questionnaireIndustry ?? meeting.company.industry ?? "General";

    const builder = await createPdfBuilder();
    drawCoverPage(builder, {
      title: "Discovery Questionnaire",
      subtitle: `${industry} Industry`,
      forCompany: meeting.company.name,
    });

    builder.heading(meeting.title);
    builder.spacer(4);

    if (sections.length === 0) {
      builder.paragraph(
        "No questionnaire has been generated for this meeting yet. Generate the discovery questions before exporting."
      );
    }

    let n = 1;
    for (const section of sections) {
      builder.subheading(section.section);
      for (const question of section.questions ?? []) {
        builder.paragraph(`${n}. ${question.q}`, { bold: true });
        // Blank answer line for the interviewer to fill in.
        builder.paragraph("____________________________________________________________");
        builder.spacer(4);
        n++;
      }
      builder.spacer(6);
    }

    addPageFooters(builder);

    const filename = `discovery-questionnaire-${meeting.company.slug}.pdf`;
    return pdfResponse(await builder.doc.save(), filename);
  });
}
