import { z } from "zod";
import { withApi } from "@/lib/api";
import { requireUser, ApiError } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

/** GET /api/companies/[id]/notes — notes for a company (newest first). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi(async () => {
    await requireUser("companies.view");
    const { id } = await params;
    const notes = await prisma.note.findMany({
      where: { companyId: id },
      include: { author: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });
    return { notes };
  });
}

const createSchema = z.object({ content: z.string().trim().min(1).max(5000) });

/** POST /api/companies/[id]/notes — add a manual note to a company. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi(async () => {
    const user = await requireUser("companies.edit");
    const { id } = await params;
    const { content } = createSchema.parse(await req.json());

    const company = await prisma.company.findUnique({ where: { id }, select: { id: true } });
    if (!company) throw new ApiError(404, "Company not found");

    const note = await prisma.note.create({
      data: { companyId: id, authorId: user.id, content },
      include: { author: { select: { id: true, name: true } } },
    });
    return { note };
  });
}
