import { PageHeader } from "@/components/shared/page-header";
import { EmailGenerator } from "@/components/content/email-generator";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function EmailGeneratorPage({
  searchParams,
}: {
  searchParams: Promise<{ companyId?: string }>;
}) {
  const { companyId } = await searchParams;
  const [companies, recent] = await Promise.all([
    prisma.company.findMany({
      select: { id: true, name: true, publicEmail: true },
      orderBy: { name: "asc" },
    }),
    prisma.generatedContent.findMany({
      where: { channel: "EMAIL" },
      include: { company: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Email Generator"
        description="Draft personalised sales emails from company intelligence with AI."
      />
      <EmailGenerator
        companies={companies}
        initialCompanyId={companyId ?? null}
        recent={recent.map((r) => ({
          id: r.id,
          category: r.category,
          subject: r.subject,
          body: r.body,
          companyName: r.company?.name ?? null,
          createdAt: r.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
