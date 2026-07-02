import { z } from "zod";
import { withApi } from "@/lib/api";
import { requireUser } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

const schema = z.object({ status: z.enum(["NEW", "QUALIFIED", "DISMISSED"]) });

/** PATCH /api/leads/[id] — update a discovered lead's status (e.g. dismiss). */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return withApi(async () => {
    await requireUser("companies.create");
    const { id } = await params;
    const { status } = schema.parse(await req.json());
    const lead = await prisma.discoveredLead.update({ where: { id }, data: { status } });
    return { lead };
  });
}
