import { PageHeader } from "@/components/shared/page-header";
import { WhatsAppGenerator } from "@/components/content/whatsapp-generator";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function WhatsAppGeneratorPage({
  searchParams,
}: {
  searchParams: Promise<{ companyId?: string }>;
}) {
  const { companyId } = await searchParams;
  const [companies, recent] = await Promise.all([
    prisma.company.findMany({
      select: { id: true, name: true, phone: true },
      orderBy: { name: "asc" },
    }),
    prisma.generatedContent.findMany({
      where: { channel: "WHATSAPP" },
      include: { company: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="WhatsApp Generator"
        description="Craft short, friendly WhatsApp messages for your prospects with AI."
      />
      <WhatsAppGenerator
        companies={companies}
        initialCompanyId={companyId ?? null}
        recent={recent.map((r) => ({
          id: r.id,
          category: r.category,
          body: r.body,
          companyName: r.company?.name ?? null,
          createdAt: r.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
